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

export async function logActivity(
  ctx: TokenContext,
  tool: string,
  status: 'success' | 'error',
  targetType?: string,
  targetId?: string,
  responseText?: string,
) {
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
      createdAt: new Date(),
    })
    .catch(() => {});

  // Funnel: 'agent_call' (final activation step). Successful calls only, so a
  // failed/unauthorized probe doesn't count as activation. Fire-and-forget.
  if (status === 'success' && ctx.ownerUserId) {
    void captureAgentCall(ctx.ownerUserId, tool, ctx.workspaceId);
  }
}
