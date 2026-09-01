'use server';
import { db } from '@/db';
import { workspaceMembers, workspaces } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/session';
import { listTrashForWorkspaces, restoreSnapshot } from '@/lib/services/snapshots';
import type { TrashEntry, RestoreResult } from '@/lib/services/snapshots';
import { publish } from '@/lib/realtime/publish';

// Direct from-clause re-export — same pattern as `RelatedPageRef` in
// actions/workspace.ts. A locally-bound `export type { X }` (import type X,
// then re-export that local binding) breaks Next's "use server" action-
// reference codegen for this file, producing a runtime `ReferenceError: X is
// not defined`. The `import type` above is separate and only for the local
// return-type annotations below — it's fully erased, so it doesn't touch
// that codegen path.
export type { TrashEntry, RestoreResult } from '@/lib/services/snapshots';

export type TrashWorkspaceGroup = {
  workspace: { id: string; name: string; icon: string | null; iconColor: string | null };
  entries: TrashEntry[];
};

async function assertWorkspaceAccess(workspaceId: string): Promise<string> {
  const user = await getCurrentUser();
  if (user.role === 'admin') return user.id;

  const [member] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id)))
    .limit(1);

  if (!member) {
    const t = await getTranslations('Errors');
    throw new Error(t('unauthorized'));
  }
  return user.id;
}

// Cross-workspace, grouped-by-workspace — mirrors `getUserWorkspacesWithTokens`
// in actions/agentToken.ts (same "common ground" sidebar surface as the AI
// Agents modal, not a per-workspace Settings tab).
export async function getMyTrash(): Promise<TrashWorkspaceGroup[]> {
  const user = await getCurrentUser();

  const wsList = await db
    .select({ id: workspaces.id, name: workspaces.name, icon: workspaces.icon, iconColor: workspaces.iconColor })
    .from(workspaces)
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, user.id)))
    .orderBy(workspaces.name);
  if (wsList.length === 0) return [];

  const entries = await listTrashForWorkspaces(wsList.map((w) => w.id));
  return wsList.map((ws) => ({ workspace: ws, entries: entries.filter((e) => e.workspaceId === ws.id) }));
}

// Sidebar badge count — same shape as `getUserAgentTokenCount`.
export async function getUserTrashCount(): Promise<number> {
  const user = await getCurrentUser();

  const wsIds = await db
    .select({ id: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, user.id));
  if (wsIds.length === 0) return 0;

  const entries = await listTrashForWorkspaces(wsIds.map((w) => w.id));
  return entries.length;
}

// Restore is human-only by design — there is no MCP counterpart to this
// action. An agent being able to revive something a human deliberately
// deleted would make the delete meaningless (same reasoning as agent
// comments being append-only). See `.ai/FEATURE_BULK_AND_TRASH.md` §B.3.
export async function restoreTrashItem(workspaceId: string, snapshotId: string): Promise<RestoreResult> {
  const userId = await assertWorkspaceAccess(workspaceId);
  const result = await restoreSnapshot(workspaceId, snapshotId);
  if (result.restored) {
    // Without this, the caller's own tab only picks the restore up on the
    // next activity-heartbeat poll (~30s, and only once idle — see
    // useWorkspaceEvents) instead of immediately. `deleteWorkspaceItem`/
    // `deletePage` already do the equivalent on the delete side; restore was
    // missing its half of the same pattern. Row restores revalidate just the
    // owning database's route (matches `deletePage`); page/database restores
    // revalidate the whole layout since the item can resurface anywhere in
    // the sidebar tree (matches `deleteWorkspaceItem`).
    if (result.itemType === 'database_row' && result.databaseId) {
      revalidatePath(`/db/${result.databaseId}`);
    } else {
      revalidatePath('/', 'layout');
    }
    publish({
      scope: result.itemType === 'database_row' ? 'database' : 'sidebar',
      workspaceId,
      resourceId: result.itemType === 'database_row' ? result.databaseId : undefined,
      actorId: userId,
    });
  }
  return result;
}
