'use server';
import { db } from '@/db';
import { sharedPages, workspaceMembers, workspaceItems } from '@/db/schema';
import { eq, and, count, inArray } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/session';
import { getTranslations } from 'next-intl/server';
import { getAnyPageById } from '@/lib/services/workspace';

const SLUG_REGEX = /^[a-z0-9][a-z0-9\-/]*[a-z0-9]$|^[a-z0-9]$/;
const MAX_SLUG_LEN = 120;

async function assertWorkspaceMember(workspaceId: string): Promise<{ userId: string; role: string }> {
  const user = await getCurrentUser();
  if (user.role === 'admin') return { userId: user.id, role: 'admin' };

  const [member] = await db
    .select({ id: workspaceMembers.id, role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id)))
    .limit(1);

  if (!member) {
    const t = await getTranslations('Errors');
    throw new Error(t('unauthorized'));
  }
  return { userId: user.id, role: member.role };
}

export type ShareWidth = 'narrow' | 'wide' | 'full';

export type ShareRecord = {
  id: string;
  slug: string;
  pageId: string;
  workspaceId: string;
  permission: 'read' | 'write';
  width: ShareWidth;
  inSitemap: boolean;
  createdBy: string;
  createdAt: Date;
};

export async function createShare(
  workspaceId: string,
  pageId: string,
  permission: 'read' | 'write',
  customSlug?: string,
  width: ShareWidth = 'narrow',
): Promise<{ share?: ShareRecord; error?: string }> {
  const t = await getTranslations('Sharing');
  const { userId, role } = await assertWorkspaceMember(workspaceId);

  // Verify page belongs to this workspace
  try {
    await getAnyPageById(workspaceId, pageId);
  } catch {
    return { error: 'Page not found in this workspace.' };
  }

  let slug: string;

  if (customSlug !== undefined && customSlug !== '') {
    if (role !== 'admin') {
      const tErr = await getTranslations('Errors');
      return { error: tErr('unauthorized') };
    }
    const clean = customSlug.trim().toLowerCase();
    if (clean.length > MAX_SLUG_LEN || !SLUG_REGEX.test(clean)) {
      return { error: t('slugInvalid') };
    }
    // Check uniqueness
    const [existing] = await db
      .select({ id: sharedPages.id })
      .from(sharedPages)
      .where(eq(sharedPages.slug, clean))
      .limit(1);
    if (existing) return { error: t('slugTaken') };
    slug = clean;
  } else {
    // Regular users get a UUID slug; loop on collision (astronomically unlikely)
    slug = crypto.randomUUID();
    const [existing] = await db
      .select({ id: sharedPages.id })
      .from(sharedPages)
      .where(eq(sharedPages.slug, slug))
      .limit(1);
    if (existing) slug = crypto.randomUUID();
  }

  const id = crypto.randomUUID();
  await db.insert(sharedPages).values({
    id,
    slug,
    pageId,
    workspaceId,
    permission,
    width,
    createdBy: userId,
    createdAt: new Date(),
  });

  return {
    share: { id, slug, pageId, workspaceId, permission, width, inSitemap: false, createdBy: userId, createdAt: new Date() },
  };
}

export async function revokeShare(shareId: string, workspaceId: string): Promise<{ error?: string }> {
  await assertWorkspaceMember(workspaceId);
  await db.delete(sharedPages).where(and(eq(sharedPages.id, shareId), eq(sharedPages.workspaceId, workspaceId)));
  return {};
}

export async function getSharesByWorkspace(workspaceId: string): Promise<ShareRecord[]> {
  await assertWorkspaceMember(workspaceId);
  const rows = await db
    .select()
    .from(sharedPages)
    .where(eq(sharedPages.workspaceId, workspaceId));
  return rows.map(r => ({
    ...r,
    permission: r.permission as 'read' | 'write',
    width: (r.width ?? 'narrow') as ShareWidth,
    inSitemap: Boolean(r.inSitemap),
    createdAt: r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt as number * 1000),
  }));
}

export async function getShareBySlug(slug: string): Promise<ShareRecord | null> {
  const [row] = await db
    .select()
    .from(sharedPages)
    .where(eq(sharedPages.slug, slug))
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    permission: row.permission as 'read' | 'write',
    width: (row.width ?? 'narrow') as ShareWidth,
    inSitemap: Boolean(row.inSitemap),
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as number * 1000),
  };
}

export async function getShareByPageId(workspaceId: string, pageId: string): Promise<ShareRecord | null> {
  await assertWorkspaceMember(workspaceId);
  const [row] = await db
    .select()
    .from(sharedPages)
    .where(and(eq(sharedPages.workspaceId, workspaceId), eq(sharedPages.pageId, pageId)))
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    permission: row.permission as 'read' | 'write',
    width: (row.width ?? 'narrow') as ShareWidth,
    inSitemap: Boolean(row.inSitemap),
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as number * 1000),
  };
}

// Returns all shared page IDs that are descendants of `rootPageId` in workspace_items.
async function findDescendantSharedPageIds(rootPageId: string, workspaceId: string): Promise<string[]> {
  // Fetch all workspace items + all shared page IDs for this workspace at once
  const [allItems, sharedRows] = await Promise.all([
    db.select({ id: workspaceItems.id, parentId: workspaceItems.parentId })
      .from(workspaceItems)
      .where(eq(workspaceItems.workspaceId, workspaceId)),
    db.select({ pageId: sharedPages.pageId })
      .from(sharedPages)
      .where(eq(sharedPages.workspaceId, workspaceId)),
  ]);

  const sharedIds = new Set(sharedRows.map(r => r.pageId));
  const childrenOf = new Map<string, string[]>();
  for (const item of allItems) {
    if (item.parentId) {
      if (!childrenOf.has(item.parentId)) childrenOf.set(item.parentId, []);
      childrenOf.get(item.parentId)!.push(item.id);
    }
  }

  const result: string[] = [];
  const queue = [rootPageId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const childId of (childrenOf.get(cur) ?? [])) {
      if (sharedIds.has(childId)) result.push(childId);
      queue.push(childId);
    }
  }
  return result;
}

export async function updateShare(
  shareId: string,
  workspaceId: string,
  patch: { permission?: 'read' | 'write'; width?: ShareWidth; inSitemap?: boolean },
): Promise<{ error?: string }> {
  const { role } = await assertWorkspaceMember(workspaceId);
  if (patch.inSitemap !== undefined && role !== 'admin') {
    const tErr = await getTranslations('Errors');
    return { error: tErr('unauthorized') };
  }

  const set: Record<string, unknown> = {};
  if (patch.permission) set.permission = patch.permission;
  if (patch.width) set.width = patch.width;
  if (patch.inSitemap !== undefined) set.inSitemap = patch.inSitemap;

  await db.update(sharedPages).set(set).where(and(eq(sharedPages.id, shareId), eq(sharedPages.workspaceId, workspaceId)));

  // Cascade inSitemap change to all child shared pages
  if (patch.inSitemap !== undefined) {
    const [share] = await db.select({ pageId: sharedPages.pageId }).from(sharedPages).where(eq(sharedPages.id, shareId)).limit(1);
    if (share) {
      const descendantIds = await findDescendantSharedPageIds(share.pageId, workspaceId);
      if (descendantIds.length > 0) {
        await db.update(sharedPages)
          .set({ inSitemap: patch.inSitemap })
          .where(inArray(sharedPages.pageId, descendantIds));
      }
    }
  }

  return {};
}

export async function updateSharedPageContent(
  shareId: string,
  content: string,
): Promise<{ error?: string }> {
  const session = await import('@/lib/auth/session').then(m => m.getCurrentUser()).catch(() => null);
  if (!session) return { error: 'Login required.' };

  const [share] = await db
    .select()
    .from(sharedPages)
    .where(eq(sharedPages.id, shareId))
    .limit(1);

  if (!share || share.permission !== 'write') return { error: 'Not allowed.' };

  const { updatePageById } = await import('@/lib/services/workspace');
  try {
    await updatePageById(share.workspaceId, share.pageId, { content }, undefined, {
      kind: 'human', userId: session.id, label: session.name || session.email || 'Someone',
    });
    return {};
  } catch (err) {
    return { error: String(err) };
  }
}

export async function countSharedPagesInWorkspace(workspaceId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(sharedPages)
    .where(eq(sharedPages.workspaceId, workspaceId));
  return row?.n ?? 0;
}

export async function revokeAllSharesInWorkspace(workspaceId: string): Promise<void> {
  await assertWorkspaceMember(workspaceId);
  await db.delete(sharedPages).where(eq(sharedPages.workspaceId, workspaceId));
}

// ── Cascade sharing ───────────────────────────────────────────────────────────

async function findDescendantItemIds(rootItemId: string, workspaceId: string): Promise<string[]> {
  const result: string[] = [];
  const queue = [rootItemId];
  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const children = await db
      .select({ id: workspaceItems.id })
      .from(workspaceItems)
      .where(and(eq(workspaceItems.parentId, parentId), eq(workspaceItems.workspaceId, workspaceId)));
    for (const child of children) {
      result.push(child.id);
      queue.push(child.id);
    }
  }
  return result;
}

export async function createShareWithChildren(
  workspaceId: string,
  pageId: string,
  permission: 'read' | 'write',
  customSlug?: string,
  width: ShareWidth = 'narrow',
): Promise<{ share?: ShareRecord; childCount?: number; error?: string }> {
  const rootResult = await createShare(workspaceId, pageId, permission, customSlug, width);
  if (rootResult.error || !rootResult.share) return rootResult;

  // Find all descendant workspace items and create UUID shares for each
  const descendantIds = await findDescendantItemIds(pageId, workspaceId);

  // Skip items that already have a share
  const newIds: string[] = [];
  for (const id of descendantIds) {
    const [existing] = await db
      .select({ id: sharedPages.id })
      .from(sharedPages)
      .where(and(eq(sharedPages.workspaceId, workspaceId), eq(sharedPages.pageId, id)))
      .limit(1);
    if (!existing) newIds.push(id);
  }

  const { userId } = await assertWorkspaceMember(workspaceId);
  if (newIds.length > 0) {
    await db.insert(sharedPages).values(
      newIds.map(id => ({
        id: crypto.randomUUID(),
        slug: crypto.randomUUID(),
        pageId: id,
        workspaceId,
        permission,
        createdBy: userId,
        createdAt: new Date(),
      })),
    );
  }

  return { share: rootResult.share, childCount: newIds.length };
}

