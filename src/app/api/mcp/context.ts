import { AsyncLocalStorage } from 'async_hooks';
import { db } from '@/db';
import { agentActivity } from '@/db/schema';
import { captureAgentCall } from '@/lib/analytics/server';

export type TokenContext = {
  tokenId: string;
  /** Which table tokenId points at — routes the audit-log FK columns (migration 0034). */
  tokenKind: 'pat' | 'oauth';
  workspaceId: string;
  scope: 'read' | 'write';
  agentName: string | null;
  /** The user who owns the token (PAT creator / OAuth grantee) — for funnel attribution. */
  ownerUserId: string | null;
};

/**
 * Request-scoped start time, so every tool can be timed without threading a
 * stopwatch through ~30 handlers. Set once in handleMcpRequest; read here when
 * the call is logged. A tool reached outside that wrapper (a script, a test)
 * simply logs no duration.
 */
export const mcpCallTiming = new AsyncLocalStorage<{ startedAt: number }>();

/** Extra measurements a call can report. Everything here is optional by design. */
export type ActivityMetrics = {
  /**
   * Bytes the same information would have cost the naive way. Pass it ONLY when
   * it is computed from data already in hand — never estimated. See
   * AGENTS.md → "Agent Savings Metrics".
   */
  baselineBytes?: number;
  /** Pages/rows this call created or updated, for bulk tools. */
  itemsAffected?: number;
};

export async function logActivity(
  ctx: TokenContext,
  tool: string,
  status: 'success' | 'error',
  targetType?: string,
  targetId?: string,
  responseText?: string,
  metrics?: ActivityMetrics,
) {
  const startedAt = mcpCallTiming.getStore()?.startedAt;

  db.insert(agentActivity)
    .values({
      tokenId: ctx.tokenKind === 'pat' ? ctx.tokenId : null,
      oauthTokenId: ctx.tokenKind === 'oauth' ? ctx.tokenId : null,
      ownerUserId: ctx.ownerUserId,
      workspaceId: ctx.workspaceId,
      tool,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      status,
      responseBytes: responseText != null ? Buffer.byteLength(responseText, 'utf8') : null,
      baselineBytes: metrics?.baselineBytes ?? null,
      durationMs: startedAt != null ? Math.round(performance.now() - startedAt) : null,
      itemsAffected: metrics?.itemsAffected ?? null,
      createdAt: new Date(),
    })
    .catch(() => {});

  // Funnel: 'agent_call' (final activation step). Successful calls only, so a
  // failed/unauthorized probe doesn't count as activation. Fire-and-forget.
  if (status === 'success' && ctx.ownerUserId) {
    void captureAgentCall(ctx.ownerUserId, tool, ctx.workspaceId);
  }
}
