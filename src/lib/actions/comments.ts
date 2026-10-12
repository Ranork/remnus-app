'use server';
import { db } from '@/db';
import { workspaceMembers } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { getCurrentUserAllowingWorkspaceLock } from '@/lib/auth/session';
import { assertWorkspaceLockAllows } from '@/lib/auth/workspaceLock';
import {
  addPageComment,
  deletePageComment,
  listPageComments,
  type CommentKind,
  type CommentRow,
} from '@/lib/services/comments';
import { getAnyPageById } from '@/lib/services/workspace';
import { roleAllows, roleRefusal, type WorkspaceNeed } from '@/lib/auth/workspaceRole';

async function assertWorkspaceAccess(workspaceId: string, need: WorkspaceNeed = 'read'): Promise<{ userId: string; isOwner: boolean }> {
  const user = await getCurrentUserAllowingWorkspaceLock();
  // Project windows are confined to their workspace — checked before any admin shortcut.
  await assertWorkspaceLockAllows(user, workspaceId);
  if (user.role === 'admin') return { userId: user.id, isOwner: true };

  const [member] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id)))
    .limit(1);

  if (!member) {
    const t = await getTranslations('Errors');
    throw new Error(t('unauthorized'));
  }
  // A viewer reads; changing anything needs a member.
  if (!roleAllows(member.role, need)) throw await roleRefusal(need);
  return { userId: user.id, isOwner: member.role === 'owner' };
}

export async function getComments(
  workspaceId: string,
  pageId: string,
): Promise<{
  comments: CommentRow[];
  viewerUserId: string;
  viewerName: string | null;
  viewerImage: string | null;
  isOwner: boolean;
}> {
  const { userId, isOwner } = await assertWorkspaceAccess(workspaceId);
  await getAnyPageById(workspaceId, pageId);
  const [comments, user] = await Promise.all([listPageComments(pageId), getCurrentUserAllowingWorkspaceLock()]);
  return { comments, viewerUserId: userId, viewerName: user.name ?? null, viewerImage: user.image ?? null, isOwner };
}

export async function addComment(
  workspaceId: string,
  pageId: string,
  body: string,
  kind: CommentKind = 'note',
) {
  const { userId } = await assertWorkspaceAccess(workspaceId, 'edit');
  const user = await getCurrentUserAllowingWorkspaceLock();
  const authorLabel = user.name || user.email || 'Someone';

  return addPageComment({
    workspaceId,
    pageId,
    body,
    kind,
    authorKind: 'human',
    authorUserId: userId,
    authorLabel,
    authorImage: user.image,
  });
}

export async function deleteComment(workspaceId: string, commentId: string) {
  const { userId, isOwner } = await assertWorkspaceAccess(workspaceId, 'edit');
  return deletePageComment(workspaceId, commentId, userId, isOwner);
}
