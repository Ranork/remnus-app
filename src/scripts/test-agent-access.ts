/**
 * Regression check: an agent token can never outlive or exceed its holder's access.
 *
 *   - removing someone from a workspace cuts off their PATs and OAuth tokens, both at
 *     request time (MCP auth re-reads membership) and in the stored rows (revoked);
 *   - making someone a viewer leaves their agents read-only, at request time and in
 *     the stored scope — and a later promotion does not quietly restore write;
 *   - other people's tokens, and the same person's tokens for other workspaces, are
 *     untouched;
 *   - a site admin's token and a PAT whose creator's account was deleted keep their
 *     stored scope (see src/lib/services/agentAccess.ts).
 *
 * **Local only.** It writes rows and deletes them again; it refuses a non-`file:` URL.
 *
 *   DATABASE_URL="file:local.db" npm run test:agent-access
 */
import 'dotenv/config';

import { randomBytes } from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { agentTokens, oauthAccessTokens, users, workspaceMembers, workspaces } from '@/db/schema';
import {
  effectiveAgentScope,
  findOAuthTokenForAuth,
  findPatForAuth,
  restrictAgentAccessToRead,
  revokeAgentAccess,
  revokeAllAgentAccessOf,
  type AgentGrant,
} from '@/lib/services/agentAccess';

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

const SUFFIX = `test-agent-access-${Date.now()}`;
const ownerId = `${SUFFIX}-owner`;
const memberId = `${SUFFIX}-member`;
const adminId = `${SUFFIX}-admin`;
const leaverId = `${SUFFIX}-leaver`;
const W = `${SUFFIX}-ws`;
const W2 = `${SUFFIX}-ws2`;
const prefix = () => randomBytes(4).toString('hex');

const P = {
  owner: prefix(),
  member: prefix(),
  memberOther: prefix(),
  admin: prefix(),
  legacy: prefix(),
  oauthMember: prefix(),
  leaverW: prefix(),
  leaverW2: prefix(),
  oauthLeaver: prefix(),
};

async function seed() {
  const now = new Date();
  await db.insert(users).values([
    { id: ownerId, name: 'Owner A', email: `${ownerId}@example.invalid`, role: 'user' },
    { id: memberId, name: 'Member B', email: `${memberId}@example.invalid`, role: 'user' },
    { id: adminId, name: 'Admin', email: `${adminId}@example.invalid`, role: 'admin' },
    { id: leaverId, name: 'Leaver', email: `${leaverId}@example.invalid`, role: 'user' },
  ]);
  await db.insert(workspaces).values([
    { id: W, name: 'Agent access', billingOwnerId: ownerId, createdAt: now, updatedAt: now },
    { id: W2, name: 'Agent access 2', billingOwnerId: ownerId, createdAt: now, updatedAt: now },
  ]);
  await db.insert(workspaceMembers).values([
    { workspaceId: W, userId: ownerId, role: 'owner', createdAt: now },
    { workspaceId: W, userId: memberId, role: 'member', createdAt: now },
    { workspaceId: W2, userId: ownerId, role: 'owner', createdAt: now },
    { workspaceId: W2, userId: memberId, role: 'member', createdAt: now },
    { workspaceId: W, userId: leaverId, role: 'member', createdAt: now },
    { workspaceId: W2, userId: leaverId, role: 'member', createdAt: now },
  ]);
  const pat = (workspaceId: string, tokenPrefix: string, createdBy: string | null) => ({
    workspaceId, name: `Remnus CLI · ${tokenPrefix}`, tokenPrefix, tokenHash: 'x',
    scope: 'write' as const, createdBy, createdAt: now,
  });
  await db.insert(agentTokens).values([
    pat(W, P.owner, ownerId),
    pat(W, P.member, memberId),
    pat(W2, P.memberOther, memberId),
    pat(W, P.admin, adminId),
    pat(W, P.legacy, null),
    pat(W, P.leaverW, leaverId),
    pat(W2, P.leaverW2, leaverId),
  ]);
  await db.insert(oauthAccessTokens).values([
    {
      tokenPrefix: P.oauthMember, tokenHash: 'x', clientId: `${SUFFIX}-client`, userId: memberId,
      workspaceId: W, scope: 'write', expiresAt: new Date(now.getTime() + 3600_000), createdAt: now,
    },
    {
      tokenPrefix: P.oauthLeaver, tokenHash: 'x', clientId: `${SUFFIX}-client`, userId: leaverId,
      workspaceId: W2, scope: 'write', expiresAt: new Date(now.getTime() + 3600_000), createdAt: now,
    },
  ]);
}

async function cleanup() {
  await db.delete(agentTokens).where(inArray(agentTokens.workspaceId, [W, W2]));
  await db.delete(oauthAccessTokens).where(inArray(oauthAccessTokens.workspaceId, [W, W2]));
  await db.delete(workspaceMembers).where(inArray(workspaceMembers.workspaceId, [W, W2]));
  await db.delete(workspaces).where(inArray(workspaces.id, [W, W2]));
  await db.delete(users).where(inArray(users.id, [ownerId, memberId, adminId, leaverId]));
}

async function patScope(tokenPrefix: string) {
  const found = await findPatForAuth(tokenPrefix);
  return found ? effectiveAgentScope(found.grant) : 'no row';
}

async function oauthScope(tokenPrefix: string) {
  const found = await findOAuthTokenForAuth(tokenPrefix);
  return found ? effectiveAgentScope(found.grant) : 'no row';
}

async function storedPatScope(tokenPrefix: string) {
  const [row] = await db.select({ scope: agentTokens.scope, revokedAt: agentTokens.revokedAt })
    .from(agentTokens).where(eq(agentTokens.tokenPrefix, tokenPrefix)).limit(1);
  return row;
}

async function setRole(userId: string, role: string) {
  await db.update(workspaceMembers).set({ role })
    .where(and(eq(workspaceMembers.workspaceId, W), eq(workspaceMembers.userId, userId)));
}

function pureRules() {
  console.log('effectiveAgentScope');
  const base: AgentGrant = { tokenScope: 'write', userId: 'u', userExists: true, userIsAdmin: false, memberRole: 'member' };
  check('member keeps write', effectiveAgentScope(base) === 'write');
  check('member read token stays read', effectiveAgentScope({ ...base, tokenScope: 'read' }) === 'read');
  check('owner keeps write', effectiveAgentScope({ ...base, memberRole: 'owner' }) === 'write');
  check('viewer is clamped to read', effectiveAgentScope({ ...base, memberRole: 'viewer' }) === 'read');
  check('non-member is refused', effectiveAgentScope({ ...base, memberRole: null }) === null);
  check('deleted account is refused', effectiveAgentScope({ ...base, userExists: false }) === null);
  check('admin non-member keeps the stored scope', effectiveAgentScope({ ...base, memberRole: null, userIsAdmin: true }) === 'write');
  check('admin who is a viewer is clamped', effectiveAgentScope({ ...base, memberRole: 'viewer', userIsAdmin: true }) === 'read');
  check('creator-less PAT keeps the stored scope', effectiveAgentScope({ ...base, userId: null, userExists: false, memberRole: null }) === 'write');
}

async function lifecycle() {
  console.log('membership changes, against the database');
  check('member PAT: write', await patScope(P.member) === 'write');
  check('member OAuth: write', await oauthScope(P.oauthMember) === 'write');
  check('unknown prefix: no row', await findPatForAuth('zzzzzzzz') === null);

  // Role flipped by any path at all — the request-time check alone must clamp it.
  await setRole(memberId, 'viewer');
  check('viewer (row only): PAT read', await patScope(P.member) === 'read');
  check('viewer (row only): OAuth read', await oauthScope(P.oauthMember) === 'read');

  await restrictAgentAccessToRead(W, memberId);
  check('restrict: stored PAT scope read', (await storedPatScope(P.member))?.scope === 'read');
  const [oauthRow] = await db.select({ scope: oauthAccessTokens.scope }).from(oauthAccessTokens)
    .where(eq(oauthAccessTokens.tokenPrefix, P.oauthMember)).limit(1);
  check('restrict: stored OAuth scope read', oauthRow?.scope === 'read');
  check('restrict: owner token untouched', (await storedPatScope(P.owner))?.scope === 'write');
  check('restrict: same person, other workspace untouched', (await storedPatScope(P.memberOther))?.scope === 'write');

  await setRole(memberId, 'member');
  check('promoted again: PAT stays read until re-join', await patScope(P.member) === 'read');

  // Removed by any path — refused at request time before anything is revoked.
  await db.delete(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, W), eq(workspaceMembers.userId, memberId)));
  check('removed (row only): PAT refused', await patScope(P.member) === null);
  check('removed (row only): OAuth refused', await oauthScope(P.oauthMember) === null);

  await revokeAgentAccess([W], memberId);
  check('revoke: PAT row revoked', (await storedPatScope(P.member))?.revokedAt instanceof Date);
  check('revoke: PAT no longer found', await findPatForAuth(P.member) === null);
  check('revoke: OAuth no longer found', await findOAuthTokenForAuth(P.oauthMember) === null);
  check('revoke: owner token still works', await patScope(P.owner) === 'write');
  check('revoke: same person, other workspace still works', await patScope(P.memberOther) === 'write');

  check('admin non-member PAT: write', await patScope(P.admin) === 'write');
  check('creator-less PAT: write', await patScope(P.legacy) === 'write');
  await revokeAgentAccess([], memberId);
  check('revoke with no workspaces is a no-op', await patScope(P.memberOther) === 'write');

  // Account deletion: every token of that person, in every workspace, before created_by goes.
  check('leaver: PATs work before deletion', await patScope(P.leaverW) === 'write' && await patScope(P.leaverW2) === 'write');
  await revokeAllAgentAccessOf(leaverId);
  check('account deletion: PAT in W revoked', await findPatForAuth(P.leaverW) === null);
  check('account deletion: PAT in W2 revoked', await findPatForAuth(P.leaverW2) === null);
  check('account deletion: OAuth revoked', await findOAuthTokenForAuth(P.oauthLeaver) === null);
  check('account deletion: others untouched', await patScope(P.owner) === 'write' && await patScope(P.memberOther) === 'write');
}

async function main() {
  pureRules();
  await seed();
  try {
    await lifecycle();
  } finally {
    await cleanup();
  }
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  cleanup().finally(() => process.exit(1));
});
