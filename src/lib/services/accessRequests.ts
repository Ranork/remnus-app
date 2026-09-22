// ── Workspace access requests ────────────────────────────────────────────────
//
// The request a person sends when they run `npx remnus join` in a project whose
// `.remnus/config.json` names a workspace they are not a member of. It is the
// mirror image of `workspace_invites`: that one is addressed by the owner to an
// email and grants membership on acceptance; this one is addressed by a person to
// a workspace id they already hold, and grants nothing until the owner approves.
//
// **A workspace id is not a secret.** It sits in a committed file, so anyone with
// the repository has it. Two consequences run through this whole module:
//
//  - It is never treated as proof of anything. Membership is re-read from the
//    database on every call; the id is client input.
//  - A non-member learns *nothing* from these functions — not the workspace's name,
//    not who is in it, not even whether it exists. A request against an id that
//    matches no workspace reports the same "sent" as a real one (it is simply not
//    stored, since the row could not satisfy its foreign key). Anything else would
//    turn this into a workspace-enumeration oracle.
//
// Cookie-free by design (the service-layer convention): the caller establishes who
// is asking and passes the user id in.

import { db } from '@/db';
import { users, workspaceAccessRequests, workspaceMembers, workspaces } from '@/db/schema';
import { and, desc, eq } from 'drizzle-orm';

/** How long a refusal holds before the same person may ask again. Long enough that
 *  "no" is not a speed bump, short enough that a mistaken denial is not permanent. */
export const DENY_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export type MemberRole = 'owner' | 'member' | 'viewer';

/** What the joiner may do here, as far as this workspace is concerned. */
export type JoinAccess =
  /** Already a member — a token can be minted, clamped to what the role allows. */
  | { state: 'member'; role: MemberRole; maxScope: 'read' | 'write' }
  /** Asked already; the owner has not answered yet. */
  | { state: 'pending' }
  /** Asked already and was refused; may ask again after `retryAt`. */
  | { state: 'denied'; retryAt: Date }
  /** No membership and no live request — the join screen offers to send one. */
  | { state: 'none' };

/** A viewer's agent may read and nothing else; anything above that is a privilege
 *  escalation dressed up as a form field. */
export function maxScopeForRole(role: MemberRole): 'read' | 'write' {
  return role === 'viewer' ? 'read' : 'write';
}

/**
 * Where this person stands with this workspace. Safe to call with an arbitrary
 * workspace id: every outcome below is reachable for an id that does not exist,
 * so the answer distinguishes nothing.
 */
export async function resolveJoinAccess(workspaceId: string, userId: string): Promise<JoinAccess> {
  const [member] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId),
    ))
    .limit(1);

  if (member) {
    const role = (member.role === 'owner' || member.role === 'viewer' ? member.role : 'member') as MemberRole;
    return { state: 'member', role, maxScope: maxScopeForRole(role) };
  }

  const [request] = await db
    .select({
      status: workspaceAccessRequests.status,
      resolvedAt: workspaceAccessRequests.resolvedAt,
    })
    .from(workspaceAccessRequests)
    .where(and(
      eq(workspaceAccessRequests.workspaceId, workspaceId),
      eq(workspaceAccessRequests.userId, userId),
    ))
    .limit(1);

  if (!request) return { state: 'none' };
  if (request.status === 'pending') return { state: 'pending' };

  if (request.status === 'denied') {
    const since = request.resolvedAt?.getTime() ?? 0;
    const retryAt = new Date(since + DENY_COOLDOWN_MS);
    if (retryAt.getTime() > Date.now()) return { state: 'denied', retryAt };
  }

  // 'approved' with no membership row means the member was removed again (or the
  // approval predates a leave). Either way there is nothing granting access now, so
  // they are back to asking.
  return { state: 'none' };
}

export type CreateRequestOutcome =
  | { state: 'pending' }
  | { state: 'denied'; retryAt: Date }
  | { state: 'member' };

/**
 * Records (or refreshes) this person's request for access.
 *
 * One row per (workspace, user) forever — the unique index makes that a database
 * guarantee rather than a convention, and reusing the row is what lets a denial
 * keep holding for `DENY_COOLDOWN_MS` instead of being erased by an immediate
 * re-send. Returns what the CLI should tell the human.
 */
export async function createAccessRequest(input: {
  workspaceId: string;
  userId: string;
  scope: 'read' | 'write';
  projectName?: string | null;
  note?: string | null;
}): Promise<CreateRequestOutcome> {
  const { workspaceId, userId, scope } = input;

  const current = await resolveJoinAccess(workspaceId, userId);
  if (current.state === 'member') return { state: 'member' };
  if (current.state === 'pending') return { state: 'pending' };
  if (current.state === 'denied') return { state: 'denied', retryAt: current.retryAt };

  // Only now does workspace existence matter, and only to decide whether a row can
  // be written at all — the answer below is the same either way (see the header).
  const [workspace] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) return { state: 'pending' };

  const now = new Date();
  const values = {
    workspaceId,
    userId,
    scope,
    status: 'pending' as const,
    projectName: input.projectName?.slice(0, 60) ?? null,
    note: input.note?.slice(0, 280) ?? null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    resolvedBy: null,
  };

  await db
    .insert(workspaceAccessRequests)
    .values(values)
    .onConflictDoUpdate({
      target: [workspaceAccessRequests.workspaceId, workspaceAccessRequests.userId],
      set: {
        scope: values.scope,
        status: 'pending',
        projectName: values.projectName,
        note: values.note,
        updatedAt: now,
        resolvedAt: null,
        resolvedBy: null,
      },
    });

  return { state: 'pending' };
}

export interface PendingAccessRequest {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  scope: 'read' | 'write';
  projectName: string | null;
  note: string | null;
  createdAt: Date;
}

/** Pending requests for one workspace, newest first. Access-checked by the caller. */
export async function listPendingAccessRequests(workspaceId: string): Promise<PendingAccessRequest[]> {
  const rows = await db
    .select({
      id: workspaceAccessRequests.id,
      userId: workspaceAccessRequests.userId,
      scope: workspaceAccessRequests.scope,
      projectName: workspaceAccessRequests.projectName,
      note: workspaceAccessRequests.note,
      createdAt: workspaceAccessRequests.createdAt,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(workspaceAccessRequests)
    .innerJoin(users, eq(users.id, workspaceAccessRequests.userId))
    .where(and(
      eq(workspaceAccessRequests.workspaceId, workspaceId),
      eq(workspaceAccessRequests.status, 'pending'),
    ))
    .orderBy(desc(workspaceAccessRequests.createdAt));

  return rows;
}

/** One pending request plus the workspace it belongs to — for the approve/deny gate. */
export async function getPendingAccessRequest(requestId: string) {
  const [row] = await db
    .select({
      id: workspaceAccessRequests.id,
      workspaceId: workspaceAccessRequests.workspaceId,
      userId: workspaceAccessRequests.userId,
      scope: workspaceAccessRequests.scope,
      status: workspaceAccessRequests.status,
    })
    .from(workspaceAccessRequests)
    .where(eq(workspaceAccessRequests.id, requestId))
    .limit(1);

  return row ?? null;
}

/** Marks a request answered. Membership (and its seat check) is the caller's job —
 *  the two are separate so an approval that cannot get a seat leaves no half-state. */
export async function markAccessRequestResolved(
  requestId: string,
  status: 'approved' | 'denied',
  resolvedBy: string,
): Promise<void> {
  const now = new Date();
  await db
    .update(workspaceAccessRequests)
    .set({ status, resolvedAt: now, updatedAt: now, resolvedBy })
    .where(eq(workspaceAccessRequests.id, requestId));
}

/** Workspace owners (for the "someone wants in" notification). */
export async function getWorkspaceOwnerIds(workspaceId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.role, 'owner'),
    ));
  return rows.map((row) => row.userId);
}
