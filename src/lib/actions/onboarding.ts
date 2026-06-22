'use server';
import { db } from '@/db';
import { agentTokens, agentActivity, oauthAccessTokens, workspaces, workspaceMembers } from '@/db/schema';
import { and, eq, isNull, ne, inArray } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/session';

/**
 * The fake "Claude AI Agent" token planted by `createRichWorkspaceData` (seed.ts).
 * Every freshly-seeded workspace ships with this token + a batch of demo
 * `agent_activity` rows, so onboarding progress MUST exclude it — otherwise a
 * brand-new user would see every step pre-completed. Real PATs use an 8-hex
 * `tokenPrefix`; only the seed uses this sentinel.
 */
const SEED_TOKEN_PREFIX = 'rmns-demo';

export interface OnboardingProgress {
  /** A real (non-seed) MCP token exists — PAT or OAuth. The "connect agent" step. */
  hasToken: boolean;
  /** A real agent tool-call was recorded in the audit log. The "first agent call" step. */
  hasAgentCall: boolean;
  /** Workspaces the user can mint a PAT in — fed straight to ConnectFlow. */
  mintTargets: { id: string; name: string }[];
}

/**
 * Derives new-user onboarding progress entirely from real DB state — no separate
 * "completed" flag/column. The client persists only a local "dismissed" bit.
 *
 * NOTE (known gap): OAuth-path tool calls are NOT recorded in `agent_activity`
 * (its `token_id` FKs to `agent_tokens`, so the OAuth token id silently fails the
 * insert). So `hasAgentCall` reflects the PAT path reliably; OAuth first-calls are
 * not yet server-detectable. Tracked as a follow-up — see the Work Plan task.
 */
export async function getOnboardingProgress(): Promise<OnboardingProgress> {
  const user = await getCurrentUser();

  // Demo accounts are ephemeral — never onboard them.
  if (user.role === 'demo') {
    return { hasToken: false, hasAgentCall: false, mintTargets: [] };
  }

  const wsRows = await db
    .select({ id: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
    .from(workspaces)
    .innerJoin(workspaceMembers, and(
      eq(workspaceMembers.workspaceId, workspaces.id),
      eq(workspaceMembers.userId, user.id),
    ));

  if (wsRows.length === 0) {
    return { hasToken: false, hasAgentCall: false, mintTargets: [] };
  }

  const wsIds = wsRows.map(w => w.id);
  const mintTargets = wsRows
    .filter(w => w.role === 'owner' || user.role === 'admin')
    .map(w => ({ id: w.id, name: w.name }));

  const [patRows, oauthRows, activityRows] = await Promise.all([
    // Real PAT (exclude the planted seed token).
    db.select({ id: agentTokens.id })
      .from(agentTokens)
      .where(and(
        inArray(agentTokens.workspaceId, wsIds),
        isNull(agentTokens.revokedAt),
        ne(agentTokens.tokenPrefix, SEED_TOKEN_PREFIX),
      ))
      .limit(1),
    // Any active OAuth connection counts as "connected".
    db.select({ id: oauthAccessTokens.id })
      .from(oauthAccessTokens)
      .where(and(
        eq(oauthAccessTokens.userId, user.id),
        isNull(oauthAccessTokens.revokedAt),
      ))
      .limit(1),
    // A real tool call: audit-log row tied to a non-seed token.
    db.select({ id: agentActivity.id })
      .from(agentActivity)
      .innerJoin(agentTokens, eq(agentActivity.tokenId, agentTokens.id))
      .where(and(
        inArray(agentActivity.workspaceId, wsIds),
        ne(agentTokens.tokenPrefix, SEED_TOKEN_PREFIX),
      ))
      .limit(1),
  ]);

  return {
    hasToken: patRows.length > 0 || oauthRows.length > 0,
    hasAgentCall: activityRows.length > 0,
    mintTargets,
  };
}
