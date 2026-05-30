import { db } from '@/db';
import { agentActivity } from '@/db/schema';

export type TokenContext = {
  tokenId: string;
  workspaceId: string;
  scope: 'read' | 'write';
  agentName: string | null;
};

export async function logActivity(
  ctx: TokenContext,
  tool: string,
  status: 'success' | 'error',
  targetType?: string,
  targetId?: string,
) {
  db.insert(agentActivity)
    .values({
      tokenId: ctx.tokenId,
      workspaceId: ctx.workspaceId,
      tool,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      status,
      createdAt: new Date(),
    })
    .catch(() => {});
}
