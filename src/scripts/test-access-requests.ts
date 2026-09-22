/**
 * Integration check for the `npx remnus join` access-request service
 * (`src/lib/services/accessRequests.ts`), against a real database.
 *
 * Covers the properties that are easy to break and expensive to get wrong:
 * the non-member information leak, the one-row-per-person invariant, the
 * cooling-off window after a refusal, and role → scope clamping.
 *
 * **Local only.** It writes users, a workspace and requests, then deletes them
 * again — it must never run against Turso. The guard below refuses anything
 * that is not a `file:` URL rather than trusting the caller to remember.
 *
 *   DATABASE_URL="file:local.db" npx tsx src/scripts/test-access-requests.ts
 */
import 'dotenv/config';

import { db } from '@/db';
import { users, workspaceAccessRequests, workspaceMembers, workspaces } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import {
  DENY_COOLDOWN_MS,
  createAccessRequest,
  getWorkspaceOwnerIds,
  listPendingAccessRequests,
  markAccessRequestResolved,
  maxScopeForRole,
  resolveJoinAccess,
} from '@/lib/services/accessRequests';

const url = process.env.DATABASE_URL ?? 'file:local.db';
if (!url.startsWith('file:')) {
  console.error(`Refusing to run against a remote database (${url.split('@').pop()}). Set DATABASE_URL="file:local.db".`);
  process.exit(1);
}

let passed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const SUFFIX = `test-access-${Date.now()}`;
const ownerId = `${SUFFIX}-owner`;
const joinerId = `${SUFFIX}-joiner`;
const viewerId = `${SUFFIX}-viewer`;
const workspaceId = `${SUFFIX}-ws`;

async function seed() {
  const now = new Date();
  await db.insert(users).values([
    { id: ownerId, name: 'Owner A', email: `${ownerId}@example.invalid`, role: 'user' },
    { id: joinerId, name: 'Joiner B', email: `${joinerId}@example.invalid`, role: 'user' },
    { id: viewerId, name: 'Viewer C', email: `${viewerId}@example.invalid`, role: 'user' },
  ]);
  await db.insert(workspaces).values({
    id: workspaceId,
    name: 'Shared Project Workspace',
    billingOwnerId: ownerId,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(workspaceMembers).values([
    { workspaceId, userId: ownerId, role: 'owner', createdAt: now },
    { workspaceId, userId: viewerId, role: 'viewer', createdAt: now },
  ]);
}

async function cleanup() {
  await db.delete(workspaceAccessRequests).where(eq(workspaceAccessRequests.workspaceId, workspaceId));
  await db.delete(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  await db.delete(users).where(inArray(users.id, [ownerId, joinerId, viewerId]));
}

async function main() {
  console.log(`Target: ${url}\n`);
  await seed();

  try {
    // ── Roles ────────────────────────────────────────────────────────────────
    console.log('roles');
    const ownerAccess = await resolveJoinAccess(workspaceId, ownerId);
    check('owner resolves as a member', ownerAccess.state === 'member');
    check('owner may hold a write token',
      ownerAccess.state === 'member' && ownerAccess.maxScope === 'write');

    const viewerAccess = await resolveJoinAccess(workspaceId, viewerId);
    check('viewer resolves as a member', viewerAccess.state === 'member');
    check('viewer is clamped to read',
      viewerAccess.state === 'member' && viewerAccess.maxScope === 'read',
      viewerAccess.state === 'member' ? viewerAccess.maxScope : viewerAccess.state);
    check('maxScopeForRole agrees', maxScopeForRole('viewer') === 'read' && maxScopeForRole('member') === 'write');

    const strangerAccess = await resolveJoinAccess(workspaceId, joinerId);
    check('non-member starts with no standing', strangerAccess.state === 'none');

    // ── No information leak ──────────────────────────────────────────────────
    console.log('\nnon-member gets no signal about the workspace');
    const ghost = await createAccessRequest({
      workspaceId: `${SUFFIX}-does-not-exist`,
      userId: joinerId,
      scope: 'write',
      projectName: 'probe',
    });
    check('request against a non-existent workspace answers `pending` like any other',
      ghost.state === 'pending', ghost.state);
    const ghostRows = await db
      .select({ id: workspaceAccessRequests.id })
      .from(workspaceAccessRequests)
      .where(eq(workspaceAccessRequests.workspaceId, `${SUFFIX}-does-not-exist`));
    check('…but nothing is stored for it', ghostRows.length === 0, `${ghostRows.length} rows`);

    // ── Request lifecycle ────────────────────────────────────────────────────
    console.log('\nrequest lifecycle');
    const first = await createAccessRequest({
      workspaceId, userId: joinerId, scope: 'write', projectName: 'remnus-app', note: 'Joining the team.',
    });
    check('first request is pending', first.state === 'pending');

    const second = await createAccessRequest({ workspaceId, userId: joinerId, scope: 'write' });
    check('a repeat request stays pending (idempotent)', second.state === 'pending');

    const rows = await db
      .select({ id: workspaceAccessRequests.id, note: workspaceAccessRequests.note })
      .from(workspaceAccessRequests)
      .where(and(
        eq(workspaceAccessRequests.workspaceId, workspaceId),
        eq(workspaceAccessRequests.userId, joinerId),
      ));
    check('exactly one row per (workspace, person)', rows.length === 1, `${rows.length} rows`);
    check('the original note survives a repeat', rows[0]?.note === 'Joining the team.', String(rows[0]?.note));

    const pending = await listPendingAccessRequests(workspaceId);
    check('the owner sees it in the pending list', pending.length === 1 && pending[0].userId === joinerId);
    check('the list carries who is asking', pending[0]?.email?.includes(joinerId) === true);
    check('the list carries the project name', pending[0]?.projectName === 'remnus-app');

    const owners = await getWorkspaceOwnerIds(workspaceId);
    check('owner lookup finds exactly the owner', owners.length === 1 && owners[0] === ownerId);

    // ── Denial and the cooling-off window ────────────────────────────────────
    console.log('\ndenial holds for a cooling-off period');
    await markAccessRequestResolved(rows[0].id, 'denied', ownerId);

    const afterDeny = await resolveJoinAccess(workspaceId, joinerId);
    check('a refused person reads as denied', afterDeny.state === 'denied', afterDeny.state);
    check('…with a retry date roughly a week out',
      afterDeny.state === 'denied' &&
        Math.abs(afterDeny.retryAt.getTime() - (Date.now() + DENY_COOLDOWN_MS)) < 60_000);

    const resend = await createAccessRequest({ workspaceId, userId: joinerId, scope: 'write' });
    check('re-sending inside the window is refused, not queued', resend.state === 'denied', resend.state);
    check('nothing is pending for the owner', (await listPendingAccessRequests(workspaceId)).length === 0);

    // Expire the cooling-off window by backdating the refusal.
    await db
      .update(workspaceAccessRequests)
      .set({ resolvedAt: new Date(Date.now() - DENY_COOLDOWN_MS - 1000) })
      .where(eq(workspaceAccessRequests.id, rows[0].id));

    const afterCooldown = await resolveJoinAccess(workspaceId, joinerId);
    check('once the window passes they may ask again', afterCooldown.state === 'none', afterCooldown.state);
    const reasked = await createAccessRequest({ workspaceId, userId: joinerId, scope: 'read', projectName: 'remnus-app' });
    check('and the new request is pending', reasked.state === 'pending', reasked.state);
    const reaskedRows = await db
      .select({ id: workspaceAccessRequests.id, scope: workspaceAccessRequests.scope, status: workspaceAccessRequests.status })
      .from(workspaceAccessRequests)
      .where(and(
        eq(workspaceAccessRequests.workspaceId, workspaceId),
        eq(workspaceAccessRequests.userId, joinerId),
      ));
    check('still one row — it was reused, not duplicated', reaskedRows.length === 1, `${reaskedRows.length} rows`);
    check('the reused row is pending again with the new scope',
      reaskedRows[0]?.status === 'pending' && reaskedRows[0]?.scope === 'read');

    // ── Approval ─────────────────────────────────────────────────────────────
    console.log('\napproval');
    await db.insert(workspaceMembers).values({
      workspaceId, userId: joinerId, role: 'member', createdAt: new Date(),
    });
    await markAccessRequestResolved(reaskedRows[0].id, 'approved', ownerId);

    const afterApproval = await resolveJoinAccess(workspaceId, joinerId);
    check('an approved joiner resolves as a member', afterApproval.state === 'member', afterApproval.state);
    check('…as `member`, so they may write',
      afterApproval.state === 'member' && afterApproval.role === 'member' && afterApproval.maxScope === 'write');
    check('nothing is left pending', (await listPendingAccessRequests(workspaceId)).length === 0);

    // Membership removed after approval → back to asking, not stuck on 'approved'.
    await db.delete(workspaceMembers).where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, joinerId),
    ));
    const afterRemoval = await resolveJoinAccess(workspaceId, joinerId);
    check('a removed member may ask again rather than reading as approved',
      afterRemoval.state === 'none', afterRemoval.state);
  } finally {
    await cleanup();
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main().catch(async (err) => {
  console.error(err);
  await cleanup().catch(() => {});
  process.exit(1);
});
