'use server';
import { db } from '@/db';
import { workspaceMembers } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getAnyPageById } from '@/lib/services/workspace';
import { listContentVersions, restoreContentVersion } from '@/lib/services/snapshots';
import type { ContentVersion, RestoreVersionResult } from '@/lib/services/snapshots';

export type { ContentVersion, RestoreVersionResult } from '@/lib/services/snapshots';

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

export async function getPageHistory(workspaceId: string, pageId: string): Promise<ContentVersion[]> {
  await assertWorkspaceAccess(workspaceId);
  await getAnyPageById(workspaceId, pageId); // confirms the page belongs to this workspace
  return listContentVersions(workspaceId, pageId);
}

// Restore is human-only by design — same reasoning as trash restore
// (`actions/trash.ts`): an agent reverting a human's edit would defeat the
// point of the edit. No MCP counterpart exists.
export async function restoreVersion(workspaceId: string, pageId: string, snapshotId: string): Promise<RestoreVersionResult> {
  const userId = await assertWorkspaceAccess(workspaceId);
  const user = await getCurrentUser();
  const result = await restoreContentVersion(workspaceId, pageId, snapshotId, {
    kind: 'human', userId, label: user.name || user.email || 'Someone',
  });
  if (result.restored) {
    // Same fix as the B follow-up bug — without this the caller's own open
    // editor only picks the restore up on the next activity-heartbeat poll.
    revalidatePath('/', 'layout');
  }
  return result;
}
