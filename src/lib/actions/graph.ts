'use server';
import { db } from '@/db';
import { workspaceMembers, workspaces } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { getCurrentUserAllowingWorkspaceLock } from '@/lib/auth/session';
import { assertWorkspaceLockAllows } from '@/lib/auth/workspaceLock';
import { getLocalGraph, getWorkspaceGraph } from '@/lib/services/graph';
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

/** The graph route's gate: the workspace's name, or null when this session may not read it. */
export async function getGraphWorkspace(workspaceId: string): Promise<{ id: string; name: string } | null> {
  const id = cleanId(workspaceId);
  if (!id) return null;
  try {
    await assertWorkspaceAccess(id);
  } catch {
    return null;
  }
  const [row] = await db.select({ id: workspaces.id, name: workspaces.name }).from(workspaces).where(eq(workspaces.id, id)).limit(1);
  return row ?? null;
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
