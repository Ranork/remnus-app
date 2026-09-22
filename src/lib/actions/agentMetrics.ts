'use server';
import { db } from '@/db';
import { workspaceMembers } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser, getCurrentUserAllowingWorkspaceLock } from '@/lib/auth/session';
import { assertWorkspaceLockAllows } from '@/lib/auth/workspaceLock';
import { getAgentMetrics } from '@/lib/services/agentMetrics';
import type { AgentMetrics } from '@/lib/services/agentMetrics';

// Direct from-clause re-export — same pattern, and same reason, as `TrashEntry`
// in actions/trash.ts. A locally-bound `export type { AgentMetrics }` (import
// the type, then re-export that binding) breaks Next's "use server"
// action-reference codegen for this file: the generated actions module throws
// `ReferenceError: AgentMetrics is not defined` at module evaluation, which
// takes down EVERY server action on any route that mounts the sidebar, not
// just this one. The `import type` above is separate and only feeds the local
// return-type annotations below — it is fully erased and never reaches codegen.
export type { AgentMetrics } from '@/lib/services/agentMetrics';

/**
 * Savings metrics for the sidebar card.
 *
 * With a workspaceId this is workspace-scoped content data, which a project
 * window is entitled to; without one it sums every token the caller owns, which
 * a locked session is not allowed to see (`getCurrentUser` throws there).
 */
export async function getMyAgentMetrics(workspaceId?: string): Promise<AgentMetrics> {
  if (!workspaceId) {
    const user = await getCurrentUser();
    return getAgentMetrics({ ownerUserId: user.id });
  }

  const user = await getCurrentUserAllowingWorkspaceLock();
  // Project windows are confined to their workspace — checked before any admin shortcut.
  await assertWorkspaceLockAllows(user, workspaceId);
  if (user.role !== 'admin') {
    const [member] = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id)))
      .limit(1);
    if (!member) {
      const t = await getTranslations('Errors');
      throw new Error(t('unauthorized'));
    }
  }

  return getAgentMetrics({ workspaceId });
}
