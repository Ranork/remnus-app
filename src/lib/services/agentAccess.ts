// ── Agent access follows membership ──────────────────────────────────────────
//
// An agent credential — a project/panel PAT or an OAuth access token — is one
// person's access handed to an agent. It must never outlive or exceed that person's
// place in the workspace: removing someone cuts off their agents, and making them a
// viewer leaves their agents read-only.
//
// Two layers, on purpose:
//
//  - **Every MCP request re-checks it** (`findPatForAuth` / `findOAuthTokenForAuth`
//    + `effectiveAgentScope`). The membership row is read in the same query as the
//    token, so this costs no extra round-trip, and it holds no matter which path
//    changed the membership — including ones that do not call the helpers below.
//  - **Membership changes also update the stored tokens** (`revokeAgentAccess`,
//    `restrictAgentAccessToRead`), so the AI Agents panel and the plan's agent quota
//    tell the truth instead of counting credentials that can no longer do anything.
//
// A PAT whose `created_by` is null belonged to an account that was deleted; account
// deletion keeps such tokens working as workspace-owned (see `performAccountDeletion`),
// and there is no one left to check, so they keep their stored scope.
//
// Cookie-free by design (the service-layer convention).

import { db } from '@/db';
import { agentTokens, oauthAccessTokens, users, workspaceMembers } from '@/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { maxScopeForRole, type MemberRole } from './accessRequests';

export type AgentScope = 'read' | 'write';

export interface AgentGrant {
  tokenScope: AgentScope;
  /** PAT creator / OAuth grantee. Null only for a PAT whose creator's account is gone. */
  userId: string | null;
  /** Whether that user's account still exists. */
  userExists: boolean;
  /** Site admin: owner-level in any workspace, as when the token was minted. */
  userIsAdmin: boolean;
  /** Their role in the token's workspace right now; null when they are not a member. */
  memberRole: string | null;
}

/**
 * What a token may do right now: its stored scope, narrowed by its holder's current
 * role, or `null` when the holder no longer has access at all.
 */
export function effectiveAgentScope(grant: AgentGrant): AgentScope | null {
  if (grant.userId === null) return grant.tokenScope;
  if (!grant.userExists) return null;
  if (grant.memberRole === null) return grant.userIsAdmin ? grant.tokenScope : null;
  const role: MemberRole =
    grant.memberRole === 'owner' || grant.memberRole === 'viewer' ? grant.memberRole : 'member';
  return maxScopeForRole(role) === 'read' ? 'read' : grant.tokenScope;
}

function grantFrom(
  tokenScope: string,
  userId: string | null,
  account: { id: string | null; role: string | null },
  memberRole: string | null,
): AgentGrant {
  return {
    tokenScope: tokenScope === 'write' ? 'write' : 'read',
    userId,
    userExists: account.id !== null,
    userIsAdmin: account.role === 'admin',
    memberRole,
  };
}

/** The live PAT with this prefix, plus what its creator may do in its workspace now. */
export async function findPatForAuth(prefix: string) {
  const [row] = await db
    .select({
      token: agentTokens,
      memberRole: workspaceMembers.role,
      accountId: users.id,
      accountRole: users.role,
    })
    .from(agentTokens)
    .leftJoin(workspaceMembers, and(
      eq(workspaceMembers.workspaceId, agentTokens.workspaceId),
      eq(workspaceMembers.userId, agentTokens.createdBy),
    ))
    .leftJoin(users, eq(users.id, agentTokens.createdBy))
    .where(and(eq(agentTokens.tokenPrefix, prefix), isNull(agentTokens.revokedAt)))
    .limit(1);

  if (!row) return null;
  return {
    token: row.token,
    grant: grantFrom(
      row.token.scope,
      row.token.createdBy,
      { id: row.accountId, role: row.accountRole },
      row.memberRole,
    ),
  };
}

/** The live OAuth access token with this prefix, plus what its grantee may do now. */
export async function findOAuthTokenForAuth(prefix: string) {
  const [row] = await db
    .select({
      token: oauthAccessTokens,
      memberRole: workspaceMembers.role,
      accountId: users.id,
      accountRole: users.role,
    })
    .from(oauthAccessTokens)
    .leftJoin(workspaceMembers, and(
      eq(workspaceMembers.workspaceId, oauthAccessTokens.workspaceId),
      eq(workspaceMembers.userId, oauthAccessTokens.userId),
    ))
    .leftJoin(users, eq(users.id, oauthAccessTokens.userId))
    .where(and(eq(oauthAccessTokens.tokenPrefix, prefix), isNull(oauthAccessTokens.revokedAt)))
    .limit(1);

  if (!row) return null;
  return {
    token: row.token,
    grant: grantFrom(
      row.token.scope,
      row.token.userId,
      { id: row.accountId, role: row.accountRole },
      row.memberRole,
    ),
  };
}

/**
 * Someone left these workspaces: every agent credential they hold for them stops
 * now. Revoking the OAuth row also kills its refresh token (a refresh of a revoked,
 * never-rotated row is refused).
 */
export async function revokeAgentAccess(workspaceIds: string[], userId: string): Promise<void> {
  if (workspaceIds.length === 0) return;
  const now = new Date();
  await db
    .update(agentTokens)
    .set({ revokedAt: now })
    .where(and(
      inArray(agentTokens.workspaceId, workspaceIds),
      eq(agentTokens.createdBy, userId),
      isNull(agentTokens.revokedAt),
    ));
  await db
    .update(oauthAccessTokens)
    .set({ revokedAt: now })
    .where(and(
      inArray(oauthAccessTokens.workspaceId, workspaceIds),
      eq(oauthAccessTokens.userId, userId),
      isNull(oauthAccessTokens.revokedAt),
    ));
}

/**
 * Someone became a viewer: the agents they already connected keep reading and stop
 * writing. Not undone by a later promotion — they re-join (or re-authorize) for a
 * write token, the same way they got the first one.
 */
export async function restrictAgentAccessToRead(workspaceId: string, userId: string): Promise<void> {
  await db
    .update(agentTokens)
    .set({ scope: 'read' })
    .where(and(
      eq(agentTokens.workspaceId, workspaceId),
      eq(agentTokens.createdBy, userId),
      eq(agentTokens.scope, 'write'),
      isNull(agentTokens.revokedAt),
    ));
  // A refresh copies the scope of the live row it rotates, so the next pair stays read.
  await db
    .update(oauthAccessTokens)
    .set({ scope: 'read' })
    .where(and(
      eq(oauthAccessTokens.workspaceId, workspaceId),
      eq(oauthAccessTokens.userId, userId),
      eq(oauthAccessTokens.scope, 'write'),
      isNull(oauthAccessTokens.revokedAt),
    ));
}
