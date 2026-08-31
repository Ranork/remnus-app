'use server';
import { db } from '@/db';
import { workspaceMembers } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/session';
import {
  addPageComment,
  deletePageComment,
  listPageComments,
  type CommentKind,
  type CommentRow,
} from '@/lib/services/comments';
import { getAnyPageById } from '@/lib/services/workspace';

async function assertWorkspaceAccess(workspaceId: string): Promise<{ userId: string; isOwner: boolean }> {
  const user = await getCurrentUser();
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
  const [comments, user] = await Promise.all([listPageComments(pageId), getCurrentUser()]);
  return { comments, viewerUserId: userId, viewerName: user.name ?? null, viewerImage: user.image ?? null, isOwner };
}

export async function addComment(
  workspaceId: string,
  pageId: string,
  body: string,
  kind: CommentKind = 'note',
) {
  const { userId } = await assertWorkspaceAccess(workspaceId);
  const user = await getCurrentUser();
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
  const { userId, isOwner } = await assertWorkspaceAccess(workspaceId);
  return deletePageComment(workspaceId, commentId, userId, isOwner);
}
