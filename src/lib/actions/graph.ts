'use server';
import { db } from '@/db';
import { workspaceMembers, workspaces } from '@/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { getCurrentUserAllowingWorkspaceLock } from '@/lib/auth/session';
import { assertWorkspaceLockAllows } from '@/lib/auth/workspaceLock';
import { getLocalGraph, getWorkspaceGraph } from '@/lib/services/graph';
import { HOME_DASHBOARD_SQL } from '@/lib/services/dashboards';
import { MAX_EXPANDED_DATABASES, type GraphPayload } from '@/lib/graph/types';

/**
 * Session-aware wrappers around the cookie-free graph service
 * (`services/graph.ts`). The graph is workspace CONTENT, so these opt in to
 * project windows — `getCurrentUserAllowingWorkspaceLock()` then
 * `assertWorkspaceLockAllows()` on the workspace being read, before the admin
 * shortcut — and a window asking for another workspace's graph is refused
 * (AGENTS.md → Project Install §4).
 */

async function assertWorkspaceAccess(workspaceId: string): Promise<void> {
  const user = await getCurrentUserAllowingWorkspaceLock();
  // Project windows are confined to their workspace — checked before any admin shortcut.
  await assertWorkspaceLockAllows(user, workspaceId);
  if (user.role === 'admin') return;

  const [member] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id)))
    .limit(1);

  if (!member) {
    const t = await getTranslations('Errors');
    throw new Error(t('unauthorized'));
  }
}

const cleanId = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 && value.length <= 64 ? value : null;

export type GraphWorkspace = { id: string; name: string; icon: string | null; iconColor: string | null };

/**
 * The graph route's gate, or null when this session may not read the workspace.
 * Besides the workspace itself (its identity heads the map, its home dashboard is
 * the way back) it lists the workspaces the map can switch to — null in a project
 * window, which is confined to its one workspace and gets no switcher.
 */
export async function getGraphWorkspace(workspaceId: string): Promise<{
  workspace: GraphWorkspace & { homeDashboardItemId: string | null };
  switchable: GraphWorkspace[] | null;
} | null> {
  const id = cleanId(workspaceId);
  if (!id) return null;
  try {
    await assertWorkspaceAccess(id);
  } catch {
    return null;
  }
  const user = await getCurrentUserAllowingWorkspaceLock();
  const [[row], choices] = await Promise.all([
    db
      .select({ id: workspaces.id, name: workspaces.name, icon: workspaces.icon, iconColor: workspaces.iconColor, homeDashboardItemId: HOME_DASHBOARD_SQL })
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1),
    user.workspaceLock
      ? Promise.resolve(null)
      : db
          .select({ id: workspaces.id, name: workspaces.name, icon: workspaces.icon, iconColor: workspaces.iconColor, hidden: workspaceMembers.hidden })
          .from(workspaces)
          .innerJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, user.id)))
          .orderBy(asc(workspaces.sortOrder), asc(workspaces.createdAt)),
  ]);
  if (!row) return null;
  // Same list as the sidebar: workspaces the user hid stay out, the open one always in.
  const switchable = choices
    ? choices.filter((w) => !w.hidden || w.id === id).map((w) => ({ id: w.id, name: w.name, icon: w.icon, iconColor: w.iconColor }))
    : null;
  return { workspace: row, switchable };
}

export async function getWorkspaceGraphData(
  workspaceId: string,
  options?: { expanded?: string[]; activityDays?: number; code?: boolean },
): Promise<GraphPayload> {
  await assertWorkspaceAccess(workspaceId);
  const expanded = Array.isArray(options?.expanded)
    ? options.expanded.map(cleanId).filter((id): id is string => id !== null).slice(0, MAX_EXPANDED_DATABASES)
    : [];
  return getWorkspaceGraph(workspaceId, { expanded, activityDays: Number(options?.activityDays), code: options?.code === true });
}

export async function getLocalGraphData(workspaceId: string, itemId: string, depth: number): Promise<GraphPayload | null> {
  await assertWorkspaceAccess(workspaceId);
  const id = cleanId(itemId);
  if (!id) return null;
  return getLocalGraph(workspaceId, id, depth === 2 ? 2 : 1);
}
