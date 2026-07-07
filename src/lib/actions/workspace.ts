'use server';
import { db } from '@/db';
import { workspaces, workspaceItems, standalonePages, databases, pages, workspaceMembers, users, sharedPages } from '@/db/schema';
import { eq, asc, and, inArray, sql, count } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth/session';
import type { SchemaColumn } from '@/lib/templates';
import type { DatabaseView } from '@/lib/types/views';
import { getTranslations } from 'next-intl/server';
import { publish } from '@/lib/realtime/publish';
import { isCloudinaryUrl, deleteCloudinaryImage } from '@/lib/cloudinary';
import { checkCanCreateWorkspace } from '@/lib/services/billing';
import { recordDeletionTombstone } from '@/lib/services/workspace';
import { syncPageLinks, removePageLinksFor } from '@/lib/services/pageLinks';

export interface CreateDatabaseOptions {
  schema?: SchemaColumn[];
  views?: DatabaseView[];
  icon?: string | null;
  iconColor?: string | null;
}

export type WorkspaceItemRow = {
  id: string;
  workspaceId: string;
  type: 'page' | 'database';
  title: string;
  parentId: string | null;
  sortOrder: number;
  icon: string | null;
  iconColor: string | null;
  createdAt: Date;
  updatedAt: Date;
  databaseId: string | null;
};

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function assertWorkspaceAccess(workspaceId: string): Promise<string> {
  const user = await getCurrentUser();
  if (user.role === 'admin') return user.id;

  const [member] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, user.id),
      ),
    )
    .limit(1);

  if (!member) {
    const t = await getTranslations('Errors');
    throw new Error(t('unauthorized'));
  }
  return user.id;
}

// ── Workspace ─────────────────────────────────────────────────────────────────

export async function getActiveWorkspaceId(): Promise<string | null> {
  const user = await getCurrentUser();

  const cookieStore = await cookies();
  const workspaceId = cookieStore.get('remnus_workspace_id')?.value;

  if (workspaceId) {
    // Verify user is a member of the stored workspace
    const [member] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id)))
      .limit(1);
    if (member) return workspaceId;
  }

  // Fall back to first accessible workspace
  const accessible = await getWorkspaces();
  if (accessible[0]) {
    return accessible[0].id;
  }

  return null;
}

export async function getWorkspaces() {
  const user = await getCurrentUser();

  // Always filter by membership — admins see all workspaces only via the admin panel
  const memberships = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, user.id));

  if (memberships.length === 0) return [];

  const ids = memberships.map((m) => m.workspaceId);
  // Join the caller's membership row so `hidden` is per-user (not workspace-global).
  return db
    .select({
      id:        workspaces.id,
      name:      workspaces.name,
      icon:      workspaces.icon,
      iconColor: workspaces.iconColor,
      sortOrder: workspaces.sortOrder,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      hidden:    workspaceMembers.hidden,
    })
    .from(workspaces)
    .innerJoin(
      workspaceMembers,
      and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, user.id)),
    )
    .where(inArray(workspaces.id, ids))
    .orderBy(asc(workspaces.sortOrder), asc(workspaces.createdAt));
}

export async function createWorkspace(name: string) {
  const user = await getCurrentUser();

  // Workspace cap — the caller's plan limits how many workspaces they may own.
  if (user.role !== 'admin') {
    const code = await checkCanCreateWorkspace(user.id);
    if (code) {
      const t = await getTranslations('Errors');
      return { error: t(code) };
    }
  }

  const id = crypto.randomUUID();

  await db.insert(workspaces).values({
    id,
    name: name.trim() || 'Untitled',
    billingOwnerId: user.id,
    createdAt: new Date(),
  });

  // Creator becomes owner
  await db.insert(workspaceMembers).values({
    workspaceId: id,
    userId: user.id,
    role: 'owner',
    createdAt: new Date(),
  });

  const cookieStore = await cookies();
  cookieStore.set('remnus_workspace_id', id, { path: '/' });
  revalidatePath('/', 'layout');
  return { id };
}

export async function deleteWorkspace(id: string) {
  const userId = await assertWorkspaceAccess(id);
  const t = await getTranslations('Errors');
  const tSharing = await getTranslations('Sharing');

  const accessible = await getWorkspaces();
  if (accessible.length <= 1) {
    return { error: t('cannotDeleteOnlyWorkspace') };
  }

  const [{ n: sharedCount }] = await db
    .select({ n: count() })
    .from(sharedPages)
    .where(eq(sharedPages.workspaceId, id));

  if (sharedCount > 0) {
    return {
      sharedPagesWarning: tSharing('deleteWorkspaceSharedWarning', { count: sharedCount }),
      sharedCount,
    };
  }

  await db.delete(workspaces).where(eq(workspaces.id, id));

  const cookieStore = await cookies();
  if (cookieStore.get('remnus_workspace_id')?.value === id) {
    const remaining = accessible.find((w) => w.id !== id);
    if (remaining) {
      cookieStore.set('remnus_workspace_id', remaining.id, { path: '/' });
    } else {
      cookieStore.delete('remnus_workspace_id');
    }
  }

  revalidatePath('/', 'layout');
  publish({ scope: 'sidebar', workspaceId: id, actorId: userId });
  return { success: true };
}

export async function renameWorkspace(id: string, name: string) {
  const userId = await assertWorkspaceAccess(id);
  await db.update(workspaces)
    .set({ name: name.trim() || 'Untitled', updatedAt: new Date() })
    .where(eq(workspaces.id, id));

  revalidatePath('/', 'layout');
  publish({ scope: 'sidebar', workspaceId: id, actorId: userId });
  return { success: true };
}

export async function updateWorkspaceIcon(id: string, icon: string | null, iconColor: string | null) {
  const userId = await assertWorkspaceAccess(id);

  const [old] = await db.select({ icon: workspaces.icon }).from(workspaces).where(eq(workspaces.id, id)).limit(1);
  if (isCloudinaryUrl(old?.icon) && old.icon !== icon) {
    deleteCloudinaryImage(old.icon!);
  }

  await db.update(workspaces)
    .set({ icon, iconColor, updatedAt: new Date() })
    .where(eq(workspaces.id, id));

  revalidatePath('/', 'layout');
  publish({ scope: 'sidebar', workspaceId: id, actorId: userId });
}

export async function setWorkspaceHidden(id: string, hidden: boolean) {
  const userId = await assertWorkspaceAccess(id);

  // Per-user preference — only flips the caller's own membership row, never other members'.
  await db.update(workspaceMembers)
    .set({ hidden })
    .where(and(eq(workspaceMembers.workspaceId, id), eq(workspaceMembers.userId, userId)));

  revalidatePath('/', 'layout');
  publish({ scope: 'sidebar', workspaceId: id, actorId: userId });
}

export async function switchWorkspace(workspaceId: string) {
  await assertWorkspaceAccess(workspaceId);
  const cookieStore = await cookies();
  cookieStore.set('remnus_workspace_id', workspaceId, { path: '/' });
  revalidatePath('/', 'layout');
  return { success: true };
}

// Total bytes of assets uploaded into this workspace. Used by the settings
// panel to surface storage usage (foundation for future plan limits).
export async function getWorkspaceStorageUsage(workspaceId: string): Promise<number> {
  await assertWorkspaceAccess(workspaceId);
  const { getWorkspaceStorageBytes } = await import('@/lib/services/assets');
  return getWorkspaceStorageBytes(workspaceId);
}

// Total bytes of assets uploaded by the current user across all workspaces.
export async function getCurrentUserStorageBytes(): Promise<number> {
  const user = await getCurrentUser();
  const { getUserStorageBytes } = await import('@/lib/services/assets');
  return getUserStorageBytes(user.id);
}

// ── Workspace items ───────────────────────────────────────────────────────────

export async function getWorkspaceItems(workspaceId: string): Promise<WorkspaceItemRow[]> {
  await assertWorkspaceAccess(workspaceId);

  const rows = await db
    .select({
      id: workspaceItems.id,
      workspaceId: workspaceItems.workspaceId,
      type: workspaceItems.type,
      title: workspaceItems.title,
      parentId: workspaceItems.parentId,
      sortOrder: workspaceItems.sortOrder,
      icon: workspaceItems.icon,
      iconColor: workspaceItems.iconColor,
      createdAt: workspaceItems.createdAt,
      updatedAt: workspaceItems.updatedAt,
      databaseId: databases.id,
    })
    .from(workspaceItems)
    .leftJoin(databases, eq(databases.itemId, workspaceItems.id))
    .where(eq(workspaceItems.workspaceId, workspaceId))
    .orderBy(asc(workspaceItems.sortOrder), asc(workspaceItems.createdAt));

  return rows.map((r) => ({ ...r, databaseId: r.databaseId ?? null }));
}

export async function getAllWorkspaceItems(): Promise<WorkspaceItemRow[]> {
  const user = await getCurrentUser();

  let accessibleWorkspaceIds: string[];

  if (user.role === 'admin') {
    const all = await db.select({ id: workspaces.id }).from(workspaces);
    accessibleWorkspaceIds = all.map((w) => w.id);
  } else {
    const memberships = await db
      .select({ workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, user.id));
    accessibleWorkspaceIds = memberships.map((m) => m.workspaceId);
  }

  if (accessibleWorkspaceIds.length === 0) return [];

  const rows = await db
    .select({
      id: workspaceItems.id,
      workspaceId: workspaceItems.workspaceId,
      type: workspaceItems.type,
      title: workspaceItems.title,
      parentId: workspaceItems.parentId,
      sortOrder: workspaceItems.sortOrder,
      icon: workspaceItems.icon,
      iconColor: workspaceItems.iconColor,
      createdAt: workspaceItems.createdAt,
      updatedAt: workspaceItems.updatedAt,
      databaseId: databases.id,
    })
    .from(workspaceItems)
    .leftJoin(databases, eq(databases.itemId, workspaceItems.id))
    .where(inArray(workspaceItems.workspaceId, accessibleWorkspaceIds))
    .orderBy(asc(workspaceItems.sortOrder), asc(workspaceItems.createdAt));

  return rows.map((r) => ({ ...r, databaseId: r.databaseId ?? null }));
}

// If parent is shared, automatically share the new child with the same settings.
// Best-effort — never throws, never blocks the caller.
async function autoShareIfParentShared(itemId: string, parentId: string, workspaceId: string, userId: string): Promise<void> {
  try {
    const [parentShare] = await db
      .select({ permission: sharedPages.permission, width: sharedPages.width, inSitemap: sharedPages.inSitemap })
      .from(sharedPages)
      .where(eq(sharedPages.pageId, parentId))
      .limit(1);
    if (!parentShare) return;

    const [existing] = await db
      .select({ id: sharedPages.id })
      .from(sharedPages)
      .where(eq(sharedPages.pageId, itemId))
      .limit(1);
    if (existing) return;

    await db.insert(sharedPages).values({
      id: crypto.randomUUID(),
      slug: crypto.randomUUID(),
      pageId: itemId,
      workspaceId,
      permission: parentShare.permission,
      width: parentShare.width ?? 'narrow',
      inSitemap: Boolean(parentShare.inSitemap),
      createdBy: userId,
      createdAt: new Date(),
    });
  } catch {
    // best-effort — ignore errors
  }
}

export async function createStandalonePage(
  workspaceId: string,
  title: string,
  parentId?: string,
  options?: { initialContent?: string; icon?: string | null; iconColor?: string | null },
) {
  const userId = await assertWorkspaceAccess(workspaceId);

  const itemId = crypto.randomUUID();
  const pageId = crypto.randomUUID();
  const now = new Date();

  await db.insert(workspaceItems).values({
    id: itemId,
    workspaceId,
    type: 'page',
    title: title || 'Untitled',
    parentId: parentId ?? null,
    sortOrder: 0,
    icon: options?.icon ?? null,
    iconColor: options?.iconColor ?? null,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(standalonePages).values({
    id: pageId,
    itemId,
    content: options?.initialContent ?? '',
    createdAt: now,
    updatedAt: now,
  });

  if (options?.initialContent) await syncPageLinks(workspaceId, itemId, 'page', options.initialContent);
  if (parentId) autoShareIfParentShared(itemId, parentId, workspaceId, userId);

  revalidatePath('/', 'layout');
  publish({ scope: 'sidebar', workspaceId, actorId: userId });
  return { itemId, pageId };
}

export async function createWorkspaceDatabase(
  workspaceId: string,
  name: string,
  options?: CreateDatabaseOptions & { parentId?: string | null },
) {
  const userId = await assertWorkspaceAccess(workspaceId);

  const itemId = crypto.randomUUID();
  const dbId = crypto.randomUUID();
  const now = new Date();

  await db.insert(workspaceItems).values({
    id: itemId,
    workspaceId,
    type: 'database',
    title: name,
    parentId: options?.parentId ?? null,
    sortOrder: 0,
    icon: options?.icon ?? null,
    iconColor: options?.iconColor ?? null,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(databases).values({
    id: dbId,
    name,
    itemId,
    schema: options?.schema ?? [
      { id: 'title', name: 'Title', type: 'text' },
      { id: 'status', name: 'Status', type: 'select', options: ['To Do', 'In Progress', 'Done'] },
    ],
    views: options?.views ?? null,
    createdAt: now,
    updatedAt: now,
  });

  if (options?.parentId) autoShareIfParentShared(itemId, options.parentId, workspaceId, userId);

  revalidatePath('/', 'layout');
  publish({ scope: 'sidebar', workspaceId, actorId: userId });
  return { itemId, dbId };
}

export async function getStandalonePageByItemId(itemId: string) {
  const item = await db.select().from(workspaceItems).where(eq(workspaceItems.id, itemId));
  if (!item[0] || item[0].type !== 'page') return null;

  await assertWorkspaceAccess(item[0].workspaceId);

  const page = await db.select().from(standalonePages).where(eq(standalonePages.itemId, itemId));
  return { item: item[0], page: page[0] ?? null };
}

export async function updateStandalonePageContent(itemId: string, content: string) {
  const item = await db.select({ workspaceId: workspaceItems.workspaceId }).from(workspaceItems).where(eq(workspaceItems.id, itemId)).limit(1);
  if (item[0]) await assertWorkspaceAccess(item[0].workspaceId);

  await db.update(standalonePages)
    .set({ content, updatedAt: new Date() })
    .where(eq(standalonePages.itemId, itemId));

  if (item[0]) await syncPageLinks(item[0].workspaceId, itemId, 'page', content);
}

export async function updateWorkspaceItemTitle(itemId: string, title: string) {
  const item = await db.select({ workspaceId: workspaceItems.workspaceId }).from(workspaceItems).where(eq(workspaceItems.id, itemId)).limit(1);
  let userId: string | undefined;
  if (item[0]) userId = await assertWorkspaceAccess(item[0].workspaceId);

  await db.update(workspaceItems)
    .set({ title, updatedAt: new Date() })
    .where(eq(workspaceItems.id, itemId));

  await db.update(databases)
    .set({ name: title, updatedAt: new Date() })
    .where(eq(databases.itemId, itemId));

  revalidatePath('/', 'layout');
  if (item[0] && userId) publish({ scope: 'sidebar', workspaceId: item[0].workspaceId, actorId: userId });
}

export async function getDatabaseByItemId(itemId: string) {
  const item = await db.select({ workspaceId: workspaceItems.workspaceId }).from(workspaceItems).where(eq(workspaceItems.id, itemId)).limit(1);
  if (item[0]) await assertWorkspaceAccess(item[0].workspaceId);

  const result = await db.select().from(databases).where(eq(databases.itemId, itemId));
  return result[0] ?? null;
}

export async function updateWorkspaceItemIcon(itemId: string, icon: string | null, iconColor: string | null) {
  const item = await db.select({ workspaceId: workspaceItems.workspaceId, icon: workspaceItems.icon }).from(workspaceItems).where(eq(workspaceItems.id, itemId)).limit(1);
  let userId: string | undefined;
  if (item[0]) userId = await assertWorkspaceAccess(item[0].workspaceId);

  if (isCloudinaryUrl(item[0]?.icon) && item[0].icon !== icon) {
    deleteCloudinaryImage(item[0].icon!);
  }

  await db.update(workspaceItems)
    .set({ icon, iconColor, updatedAt: new Date() })
    .where(eq(workspaceItems.id, itemId));

  revalidatePath('/', 'layout');
  if (item[0] && userId) publish({ scope: 'sidebar', workspaceId: item[0].workspaceId, actorId: userId });
}

export async function deleteWorkspaceItem(itemId: string) {
  const item = await db.select().from(workspaceItems).where(eq(workspaceItems.id, itemId)).limit(1);
  if (!item[0]) return;

  const userId = await assertWorkspaceAccess(item[0].workspaceId);
  const { workspaceId } = item[0];

  await deleteWorkspaceItemRecursive(workspaceId, itemId, item[0].type, item[0].title);
  revalidatePath('/', 'layout');
  publish({ scope: 'sidebar', workspaceId, actorId: userId });
}

export async function checkItemHasContent(itemId: string): Promise<boolean> {
  const [item] = await db
    .select({ type: workspaceItems.type, workspaceId: workspaceItems.workspaceId })
    .from(workspaceItems)
    .where(eq(workspaceItems.id, itemId))
    .limit(1);
  if (!item) return false;
  await assertWorkspaceAccess(item.workspaceId);

  // Has nested children?
  const [child] = await db
    .select({ id: workspaceItems.id })
    .from(workspaceItems)
    .where(eq(workspaceItems.parentId, itemId))
    .limit(1);
  if (child) return true;

  if (item.type === 'page') {
    const [page] = await db
      .select({ content: standalonePages.content })
      .from(standalonePages)
      .where(eq(standalonePages.itemId, itemId))
      .limit(1);
    return !!(page?.content && page.content.trim().length > 0);
  } else {
    // Has any database rows?
    const [row] = await db
      .select({ id: pages.id })
      .from(pages)
      .innerJoin(databases, eq(databases.id, pages.databaseId))
      .where(eq(databases.itemId, itemId))
      .limit(1);
    return !!row;
  }
}

async function deleteWorkspaceItemRecursive(workspaceId: string, itemId: string, type: 'page' | 'database', title: string) {
  // Find all children
  const children = await db.select({ id: workspaceItems.id, type: workspaceItems.type, title: workspaceItems.title })
    .from(workspaceItems)
    .where(eq(workspaceItems.parentId, itemId));

  for (const child of children) {
    await deleteWorkspaceItemRecursive(workspaceId, child.id, child.type, child.title);
  }

  if (type === 'database') {
    await db.delete(databases).where(eq(databases.itemId, itemId));
  } else {
    await db.delete(standalonePages).where(eq(standalonePages.itemId, itemId));
  }

  await db.delete(workspaceItems).where(eq(workspaceItems.id, itemId));
  await recordDeletionTombstone(workspaceId, itemId, type, title);
  await removePageLinksFor(itemId);
}

async function getWorkspaceIdForParent(parentId: string): Promise<string | null> {
  // Check if parent is a workspace item
  const [item] = await db
    .select({ workspaceId: workspaceItems.workspaceId })
    .from(workspaceItems)
    .where(eq(workspaceItems.id, parentId))
    .limit(1);
  if (item) return item.workspaceId;

  // Check if parent is a database row (page)
  const [row] = await db
    .select({ workspaceId: workspaceItems.workspaceId })
    .from(pages)
    .innerJoin(databases, eq(pages.databaseId, databases.id))
    .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
    .where(eq(pages.id, parentId))
    .limit(1);
  if (row) return row.workspaceId;

  return null;
}

export async function getSubItems(parentId: string): Promise<WorkspaceItemRow[]> {
  const workspaceId = await getWorkspaceIdForParent(parentId);
  if (!workspaceId) return [];
  await assertWorkspaceAccess(workspaceId);

  const rows = await db
    .select({
      id: workspaceItems.id,
      workspaceId: workspaceItems.workspaceId,
      type: workspaceItems.type,
      title: workspaceItems.title,
      parentId: workspaceItems.parentId,
      sortOrder: workspaceItems.sortOrder,
      icon: workspaceItems.icon,
      iconColor: workspaceItems.iconColor,
      createdAt: workspaceItems.createdAt,
      updatedAt: workspaceItems.updatedAt,
      databaseId: databases.id,
    })
    .from(workspaceItems)
    .leftJoin(databases, eq(databases.itemId, workspaceItems.id))
    .where(eq(workspaceItems.parentId, parentId))
    .orderBy(asc(workspaceItems.sortOrder), asc(workspaceItems.createdAt));

  return rows.map((r) => ({ ...r, databaseId: r.databaseId ?? null }));
}

export async function duplicateWorkspaceItem(itemId: string) {
  const item = await db.select().from(workspaceItems).where(eq(workspaceItems.id, itemId));
  if (!item[0]) return null;

  const userId = await assertWorkspaceAccess(item[0].workspaceId);
  const { workspaceId } = item[0];

  const newItemId = crypto.randomUUID();
  const now = new Date();
  await db.insert(workspaceItems).values({
    id: newItemId,
    workspaceId: item[0].workspaceId,
    type: item[0].type,
    title: `${item[0].title} (Copy)`,
    parentId: item[0].parentId,
    sortOrder: item[0].sortOrder + 1,
    icon: item[0].icon,
    iconColor: item[0].iconColor,
    createdAt: now,
    updatedAt: now,
  });

  if (item[0].type === 'page') {
    const sp = await db.select().from(standalonePages).where(eq(standalonePages.itemId, itemId));
    await db.insert(standalonePages).values({
      id: crypto.randomUUID(),
      itemId: newItemId,
      content: sp[0]?.content ?? '',
      createdAt: now,
      updatedAt: now,
    });
    if (sp[0]?.content) await syncPageLinks(workspaceId, newItemId, 'page', sp[0].content);
    revalidatePath('/', 'layout');
    publish({ scope: 'sidebar', workspaceId, actorId: userId });
    return { type: 'page' as const, itemId: newItemId };
  } else {
    const dbRow = await db.select().from(databases).where(eq(databases.itemId, itemId));
    if (!dbRow[0]) { revalidatePath('/', 'layout'); publish({ scope: 'sidebar', workspaceId, actorId: userId }); return null; }

    const newDbId = crypto.randomUUID();
    await db.insert(databases).values({
      id: newDbId,
      name: `${dbRow[0].name} (Copy)`,
      itemId: newItemId,
      schema: dbRow[0].schema,
      views: dbRow[0].views,
      createdAt: now,
      updatedAt: now,
    });

    const existingPages = await db.select().from(pages).where(eq(pages.databaseId, dbRow[0].id));
    for (const p of existingPages) {
      const newRowId = crypto.randomUUID();
      await db.insert(pages).values({
        id: newRowId,
        databaseId: newDbId,
        title: p.title,
        content: p.content,
        properties: p.properties,
        sortOrder: p.sortOrder,
        icon: p.icon,
        iconColor: p.iconColor,
        createdAt: now,
        updatedAt: now,
      });
      if (p.content) await syncPageLinks(workspaceId, newRowId, 'database_row', p.content);
    }

    revalidatePath('/', 'layout');
    publish({ scope: 'sidebar', workspaceId, actorId: userId });
    return { type: 'database' as const, dbId: newDbId };
  }
}

export async function updateWorkspacesOrder(workspaceIds: string[]) {
  const user = await getCurrentUser();
  for (let i = 0; i < workspaceIds.length; i++) {
    const wsId = workspaceIds[i];
    if (user.role !== 'admin') {
      const [member] = await db
        .select()
        .from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, wsId), eq(workspaceMembers.userId, user.id)))
        .limit(1);
      if (!member) continue;
    }
    await db.update(workspaces).set({ sortOrder: i }).where(eq(workspaces.id, wsId));
  }
  revalidatePath('/', 'layout');
}

export async function updateWorkspaceItemsOrder(itemIds: string[]) {
  if (itemIds.length === 0) return;

  // Single query to get all items and verify access (one auth check per workspace found)
  const rows = await db
    .select({ id: workspaceItems.id, workspaceId: workspaceItems.workspaceId })
    .from(workspaceItems)
    .where(inArray(workspaceItems.id, itemIds));

  const checkedWorkspaces = new Set<string>();
  for (const row of rows) {
    if (!checkedWorkspaces.has(row.workspaceId)) {
      await assertWorkspaceAccess(row.workspaceId);
      checkedWorkspaces.add(row.workspaceId);
    }
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < itemIds.length; i++) {
      await tx.update(workspaceItems).set({ sortOrder: i }).where(eq(workspaceItems.id, itemIds[i]));
    }
  });
  revalidatePath('/', 'layout');
  const userId = await getCurrentUser().then((u) => u.id);
  for (const wsId of checkedWorkspaces) {
    publish({ scope: 'sidebar', workspaceId: wsId, actorId: userId });
  }
}

/**
 * Nest an item inside another item (drag-into). Sets the dragged item's `parentId`
 * to `newParentId` (or null for root), optionally moving it to `targetWorkspaceId`,
 * then re-sequences the new sibling group via `siblingIdsOrder`.
 */
export async function reparentWorkspaceItem(
  itemId: string,
  newParentId: string | null,
  targetWorkspaceId: string,
  siblingIdsOrder: string[],
) {
  const [item] = await db
    .select({ workspaceId: workspaceItems.workspaceId })
    .from(workspaceItems)
    .where(eq(workspaceItems.id, itemId))
    .limit(1);
  if (!item) {
    const t = await getTranslations('Errors');
    throw new Error(t('itemNotFound'));
  }

  const userId = await assertWorkspaceAccess(item.workspaceId);
  if (targetWorkspaceId !== item.workspaceId) await assertWorkspaceAccess(targetWorkspaceId);

  // Cycle guard: a new parent must not be the item itself or one of its descendants.
  if (newParentId) {
    if (newParentId === itemId) return;
    const all = await db
      .select({ id: workspaceItems.id, parentId: workspaceItems.parentId })
      .from(workspaceItems)
      .where(eq(workspaceItems.workspaceId, targetWorkspaceId));
    const isDescendantOf = (candidate: string): boolean => {
      let cursor: string | null = candidate;
      const seen = new Set<string>();
      while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        if (cursor === itemId) return true;
        cursor = all.find((r) => r.id === cursor)?.parentId ?? null;
      }
      return false;
    };
    if (isDescendantOf(newParentId)) return;
  }

  await db
    .update(workspaceItems)
    .set({ parentId: newParentId, workspaceId: targetWorkspaceId })
    .where(eq(workspaceItems.id, itemId));

  await db.transaction(async (tx) => {
    for (let i = 0; i < siblingIdsOrder.length; i++) {
      // Scope each update to the authorized target workspace so a forged
      // siblingIdsOrder can't rewrite sortOrder on rows in other workspaces.
      await tx
        .update(workspaceItems)
        .set({ sortOrder: i })
        .where(and(eq(workspaceItems.id, siblingIdsOrder[i]), eq(workspaceItems.workspaceId, targetWorkspaceId)));
    }
  });

  revalidatePath('/', 'layout');
  publish({ scope: 'sidebar', workspaceId: item.workspaceId, actorId: userId });
  if (targetWorkspaceId !== item.workspaceId) {
    publish({ scope: 'sidebar', workspaceId: targetWorkspaceId, actorId: userId });
  }
}

export async function moveWorkspaceItemToWorkspace(itemId: string, targetWorkspaceId: string, itemIdsOrder: string[]) {
  const item = await db.select({ workspaceId: workspaceItems.workspaceId }).from(workspaceItems).where(eq(workspaceItems.id, itemId)).limit(1);
  if (!item[0]) {
    const t = await getTranslations('Errors');
    throw new Error(t('itemNotFound'));
  }

  const userId = await assertWorkspaceAccess(item[0].workspaceId);
  await assertWorkspaceAccess(targetWorkspaceId);

  await db.update(workspaceItems).set({ workspaceId: targetWorkspaceId }).where(eq(workspaceItems.id, itemId));

  for (let i = 0; i < itemIdsOrder.length; i++) {
    const id = itemIdsOrder[i];
    await db.update(workspaceItems).set({ sortOrder: i }).where(eq(workspaceItems.id, id));
  }

  revalidatePath('/', 'layout');
  publish({ scope: 'sidebar', workspaceId: item[0].workspaceId, actorId: userId });
  publish({ scope: 'sidebar', workspaceId: targetWorkspaceId, actorId: userId });
}

export async function getAdminWorkspacesOverview() {
  const user = await getCurrentUser();
  if (user.role !== 'admin') {
    const t = await getTranslations('Errors');
    throw new Error(t('adminRequired'));
  }

  const allWorkspaces = await db
    .select()
    .from(workspaces)
    .orderBy(asc(workspaces.sortOrder), asc(workspaces.createdAt));

  const memberRows = await db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      role: workspaceMembers.role,
      userName: users.name,
      userEmail: users.email,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id));

  const itemCountRows = await db
    .select({
      workspaceId: workspaceItems.workspaceId,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(workspaceItems)
    .groupBy(workspaceItems.workspaceId);

  const itemCountMap = new Map(itemCountRows.map((r) => [r.workspaceId, r.count]));

  return allWorkspaces.map((ws) => {
    const members = memberRows.filter((m) => m.workspaceId === ws.id);
    const owner = members.find((m) => m.role === 'owner');
    return {
      ...ws,
      memberCount: members.length,
      itemCount: itemCountMap.get(ws.id) ?? 0,
      ownerName: owner?.userName ?? null,
      ownerEmail: owner?.userEmail ?? null,
    };
  });
}

export async function adminDeleteWorkspace(workspaceId: string) {
  const user = await getCurrentUser();
  if (user.role !== 'admin') {
    const t = await getTranslations('Errors');
    throw new Error(t('adminRequired'));
  }

  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  revalidatePath('/', 'layout');
  return { success: true };
}
