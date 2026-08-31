/**
 * Page comments — a time-ordered thread attached to a standalone page or
 * database row, separate from its markdown body. Shared by the MCP
 * `add_comment` tool (agent-authored) and the UI server actions
 * (human-authored). See migration 0045.
 */
import { db } from '@/db';
import { pageComments, users } from '@/db/schema';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { getAnyPageById } from './workspace';

export const MAX_COMMENT_LENGTH = 4_000;

export type CommentKind = 'note' | 'closure';

export type CommentRow = {
  id: string;
  body: string;
  kind: CommentKind;
  authorKind: 'human' | 'agent';
  authorUserId: string | null;
  authorLabel: string;
  /** Current avatar URL, live-joined off `users.image` — unlike `authorLabel`
   *  this is NOT frozen at write time, so it always reflects the author's
   *  latest picture (or null if they never set one, or the comment is
   *  agent-authored). Absent from the MCP-facing payload (see read.ts). */
  authorImage: string | null;
  createdAt: Date;
};

type AddCommentInput = {
  workspaceId: string;
  pageId: string;
  body: string;
  kind?: CommentKind;
} & (
  | { authorKind: 'human'; authorUserId: string; authorLabel: string; authorImage?: string | null }
  | { authorKind: 'agent'; authorLabel: string; tokenId?: string | null; oauthTokenId?: string | null }
);

// Confirms the page exists and belongs to workspaceId (via getAnyPageById)
// before writing — a comment must not be plantable on a page from another
// workspace just by guessing its id.
export async function addPageComment(input: AddCommentInput) {
  if (!input.body.trim()) throw new Error('Comment body is required');
  if (input.body.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Comment exceeds ${MAX_COMMENT_LENGTH} characters`);
  }
  await getAnyPageById(input.workspaceId, input.pageId);

  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(pageComments).values({
    id,
    pageId: input.pageId,
    workspaceId: input.workspaceId,
    body: input.body,
    kind: input.kind ?? 'note',
    authorKind: input.authorKind,
    authorUserId: input.authorKind === 'human' ? input.authorUserId : null,
    authorLabel: input.authorLabel,
    tokenId: input.authorKind === 'agent' ? input.tokenId ?? null : null,
    oauthTokenId: input.authorKind === 'agent' ? input.oauthTokenId ?? null : null,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id,
    createdAt: now,
    authorLabel: input.authorLabel,
    authorImage: input.authorKind === 'human' ? input.authorImage ?? null : null,
  };
}

export async function listPageComments(pageId: string): Promise<CommentRow[]> {
  return db
    .select({
      id: pageComments.id,
      body: pageComments.body,
      kind: pageComments.kind,
      authorKind: pageComments.authorKind,
      authorUserId: pageComments.authorUserId,
      authorLabel: pageComments.authorLabel,
      authorImage: users.image,
      createdAt: pageComments.createdAt,
    })
    .from(pageComments)
    .leftJoin(users, eq(pageComments.authorUserId, users.id))
    .where(eq(pageComments.pageId, pageId))
    .orderBy(asc(pageComments.createdAt)) as Promise<CommentRow[]>;
}

// Batch counterpart for query_database — one grouped query instead of N.
// Pages with zero comments are simply absent from the returned map, so
// callers can tell "no comments" apart from "0" without an extra branch.
export async function getCommentCounts(pageIds: string[]): Promise<Map<string, number>> {
  if (pageIds.length === 0) return new Map();
  const rows = await db
    .select({ pageId: pageComments.pageId, n: sql<number>`count(*)` })
    .from(pageComments)
    .where(inArray(pageComments.pageId, pageIds))
    .groupBy(pageComments.pageId);
  return new Map(rows.map((r) => [r.pageId, Number(r.n)]));
}

// Permission check lives here (not in the caller) so the read-then-delete
// stays a single round trip: human authors may remove their own comment,
// the workspace owner may remove any comment (including an agent's).
// workspaceId is scoped into both queries — isWorkspaceOwner is only ever
// checked against the comment's own workspace, so owning some other
// workspace can't authorize deleting a comment that isn't in it.
export async function deletePageComment(
  workspaceId: string,
  commentId: string,
  requesterUserId: string,
  isWorkspaceOwner: boolean,
): Promise<{ pageId: string; workspaceId: string }> {
  const [comment] = await db
    .select({ pageId: pageComments.pageId, workspaceId: pageComments.workspaceId, authorUserId: pageComments.authorUserId })
    .from(pageComments)
    .where(and(eq(pageComments.id, commentId), eq(pageComments.workspaceId, workspaceId)))
    .limit(1);
  if (!comment) throw new Error('Comment not found');
  if (comment.authorUserId !== requesterUserId && !isWorkspaceOwner) {
    throw new Error('Unauthorized');
  }

  await db.delete(pageComments).where(and(eq(pageComments.id, commentId), eq(pageComments.workspaceId, workspaceId)));
  return { pageId: comment.pageId, workspaceId: comment.workspaceId };
}
