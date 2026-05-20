'use server';
import { cache } from 'react';
import { db } from '@/db';
import { workspaces, workspaceItems, standalonePages, databases, pages, workspaceMembers, users } from '@/db/schema';
import { eq, isNull, asc, and, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import type { SchemaColumn } from '@/lib/templates';
import type { DatabaseView } from '@/lib/types/views';

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

const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return session.user as { id: string; role: string; name?: string | null; email?: string | null; image?: string | null };
});

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

  if (!member) throw new Error('Unauthorized: no access to this workspace');
  return user.id;
}

// ── Workspace ─────────────────────────────────────────────────────────────────

export async function getActiveWorkspaceId(): Promise<string | null> {
  const user = await getCurrentUser();

  const cookieStore = await cookies();
  let workspaceId = cookieStore.get('remna_workspace_id')?.value;

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
  return db
    .select()
    .from(workspaces)
    .where(inArray(workspaces.id, ids))
    .orderBy(asc(workspaces.sortOrder), asc(workspaces.createdAt));
}

export async function createWorkspace(name: string) {
  const user = await getCurrentUser();
  const id = crypto.randomUUID();

  await db.insert(workspaces).values({
    id,
    name: name.trim() || 'Untitled Workspace',
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
  cookieStore.set('remna_workspace_id', id, { path: '/' });
  revalidatePath('/');
  return { id };
}

export async function deleteWorkspace(id: string) {
  await assertWorkspaceAccess(id);

  const accessible = await getWorkspaces();
  if (accessible.length <= 1) {
    return { error: 'Cannot delete your only workspace' };
  }

  await db.delete(workspaces).where(eq(workspaces.id, id));

  const cookieStore = await cookies();
  if (cookieStore.get('remna_workspace_id')?.value === id) {
    const remaining = accessible.find((w) => w.id !== id);
    if (remaining) {
      cookieStore.set('remna_workspace_id', remaining.id, { path: '/' });
    } else {
      cookieStore.delete('remna_workspace_id');
    }
  }

  revalidatePath('/');
  return { success: true };
}

export async function renameWorkspace(id: string, name: string) {
  await assertWorkspaceAccess(id);
  await db.update(workspaces)
    .set({ name: name.trim() || 'Untitled Workspace', updatedAt: new Date() })
    .where(eq(workspaces.id, id));

  revalidatePath('/');
  return { success: true };
}

export async function switchWorkspace(workspaceId: string) {
  await assertWorkspaceAccess(workspaceId);
  const cookieStore = await cookies();
  cookieStore.set('remna_workspace_id', workspaceId, { path: '/' });
  revalidatePath('/');
  return { success: true };
}

// ── Workspace items ───────────────────────────────────────────────────────────

export async function getWorkspaceItems(workspaceId: string): Promise<WorkspaceItemRow[]> {
  await assertWorkspaceAccess(workspaceId);

  const items = await db.select().from(workspaceItems)
    .where(eq(workspaceItems.workspaceId, workspaceId))
    .orderBy(asc(workspaceItems.sortOrder), asc(workspaceItems.createdAt));

  const dbRows = await db.select({ itemId: databases.itemId, dbId: databases.id }).from(databases);
  const dbMap = new Map(dbRows.filter((r) => r.itemId).map((r) => [r.itemId!, r.dbId]));

  return items.map((item) => ({
    ...item,
    databaseId: item.type === 'database' ? (dbMap.get(item.id) ?? null) : null,
  }));
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

  const items = await db.select().from(workspaceItems)
    .where(inArray(workspaceItems.workspaceId, accessibleWorkspaceIds))
    .orderBy(asc(workspaceItems.sortOrder), asc(workspaceItems.createdAt));

  const dbRows = await db.select({ itemId: databases.itemId, dbId: databases.id }).from(databases);
  const dbMap = new Map(dbRows.filter((r) => r.itemId).map((r) => [r.itemId!, r.dbId]));

  return items.map((item) => ({
    ...item,
    databaseId: item.type === 'database' ? (dbMap.get(item.id) ?? null) : null,
  }));
}

export async function createStandalonePage(
  workspaceId: string,
  title: string,
  parentId?: string,
  options?: { initialContent?: string; icon?: string | null; iconColor?: string | null },
) {
  await assertWorkspaceAccess(workspaceId);

  const itemId = crypto.randomUUID();
  const pageId = crypto.randomUUID();

  await db.insert(workspaceItems).values({
    id: itemId,
    workspaceId,
    type: 'page',
    title: title || 'Untitled',
    parentId: parentId ?? null,
    sortOrder: 0,
    icon: options?.icon ?? null,
    iconColor: options?.iconColor ?? null,
  });

  await db.insert(standalonePages).values({
    id: pageId,
    itemId,
    content: options?.initialContent ?? '',
  });

  revalidatePath('/');
  return { itemId, pageId };
}

export async function createWorkspaceDatabase(
  workspaceId: string,
  name: string,
  options?: CreateDatabaseOptions & { parentId?: string | null },
) {
  await assertWorkspaceAccess(workspaceId);

  const itemId = crypto.randomUUID();
  const dbId = crypto.randomUUID();

  await db.insert(workspaceItems).values({
    id: itemId,
    workspaceId,
    type: 'database',
    title: name,
    parentId: options?.parentId ?? null,
    sortOrder: 0,
    icon: options?.icon ?? null,
    iconColor: options?.iconColor ?? null,
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
  });

  revalidatePath('/');
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
}

export async function updateWorkspaceItemTitle(itemId: string, title: string) {
  const item = await db.select({ workspaceId: workspaceItems.workspaceId }).from(workspaceItems).where(eq(workspaceItems.id, itemId)).limit(1);
  if (item[0]) await assertWorkspaceAccess(item[0].workspaceId);

  await db.update(workspaceItems)
    .set({ title, updatedAt: new Date() })
    .where(eq(workspaceItems.id, itemId));

  await db.update(databases)
    .set({ name: title, updatedAt: new Date() })
    .where(eq(databases.itemId, itemId));

  revalidatePath('/');
}

export async function getDatabaseByItemId(itemId: string) {
  const item = await db.select({ workspaceId: workspaceItems.workspaceId }).from(workspaceItems).where(eq(workspaceItems.id, itemId)).limit(1);
  if (item[0]) await assertWorkspaceAccess(item[0].workspaceId);

  const result = await db.select().from(databases).where(eq(databases.itemId, itemId));
  return result[0] ?? null;
}

export async function updateWorkspaceItemIcon(itemId: string, icon: string | null, iconColor: string | null) {
  const item = await db.select({ workspaceId: workspaceItems.workspaceId }).from(workspaceItems).where(eq(workspaceItems.id, itemId)).limit(1);
  if (item[0]) await assertWorkspaceAccess(item[0].workspaceId);

  await db.update(workspaceItems)
    .set({ icon, iconColor, updatedAt: new Date() })
    .where(eq(workspaceItems.id, itemId));

  revalidatePath('/');
}

export async function deleteWorkspaceItem(itemId: string) {
  const item = await db.select().from(workspaceItems).where(eq(workspaceItems.id, itemId)).limit(1);
  if (!item[0]) return;

  await assertWorkspaceAccess(item[0].workspaceId);

  await deleteWorkspaceItemRecursive(itemId, item[0].type);
  revalidatePath('/');
}

async function deleteWorkspaceItemRecursive(itemId: string, type: 'page' | 'database') {
  // Find all children
  const children = await db.select({ id: workspaceItems.id, type: workspaceItems.type })
    .from(workspaceItems)
    .where(eq(workspaceItems.parentId, itemId));

  for (const child of children) {
    await deleteWorkspaceItemRecursive(child.id, child.type);
  }

  if (type === 'database') {
    await db.delete(databases).where(eq(databases.itemId, itemId));
  } else {
    await db.delete(standalonePages).where(eq(standalonePages.itemId, itemId));
  }

  await db.delete(workspaceItems).where(eq(workspaceItems.id, itemId));
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

  const items = await db.select().from(workspaceItems)
    .where(eq(workspaceItems.parentId, parentId))
    .orderBy(asc(workspaceItems.sortOrder), asc(workspaceItems.createdAt));

  const dbRows = await db.select({ itemId: databases.itemId, dbId: databases.id }).from(databases);
  const dbMap = new Map(dbRows.filter((r) => r.itemId).map((r) => [r.itemId!, r.dbId]));

  return items.map((item) => ({
    ...item,
    databaseId: item.type === 'database' ? (dbMap.get(item.id) ?? null) : null,
  }));
}

export async function duplicateWorkspaceItem(itemId: string) {
  const item = await db.select().from(workspaceItems).where(eq(workspaceItems.id, itemId));
  if (!item[0]) return null;

  await assertWorkspaceAccess(item[0].workspaceId);

  const newItemId = crypto.randomUUID();
  await db.insert(workspaceItems).values({
    id: newItemId,
    workspaceId: item[0].workspaceId,
    type: item[0].type,
    title: `${item[0].title} (Copy)`,
    parentId: item[0].parentId,
    sortOrder: item[0].sortOrder + 1,
    icon: item[0].icon,
    iconColor: item[0].iconColor,
  });

  if (item[0].type === 'page') {
    const sp = await db.select().from(standalonePages).where(eq(standalonePages.itemId, itemId));
    await db.insert(standalonePages).values({
      id: crypto.randomUUID(),
      itemId: newItemId,
      content: sp[0]?.content ?? '',
    });
    revalidatePath('/');
    return { type: 'page' as const, itemId: newItemId };
  } else {
    const dbRow = await db.select().from(databases).where(eq(databases.itemId, itemId));
    if (!dbRow[0]) { revalidatePath('/'); return null; }

    const newDbId = crypto.randomUUID();
    await db.insert(databases).values({
      id: newDbId,
      name: `${dbRow[0].name} (Copy)`,
      itemId: newItemId,
      schema: dbRow[0].schema,
      views: dbRow[0].views,
    });

    const existingPages = await db.select().from(pages).where(eq(pages.databaseId, dbRow[0].id));
    for (const p of existingPages) {
      await db.insert(pages).values({
        id: crypto.randomUUID(),
        databaseId: newDbId,
        title: p.title,
        content: p.content,
        properties: p.properties,
        sortOrder: p.sortOrder,
        icon: p.icon,
        iconColor: p.iconColor,
      });
    }

    revalidatePath('/');
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
  revalidatePath('/');
}

export async function updateWorkspaceItemsOrder(itemIds: string[]) {
  for (let i = 0; i < itemIds.length; i++) {
    const itemId = itemIds[i];
    const item = await db.select({ workspaceId: workspaceItems.workspaceId }).from(workspaceItems).where(eq(workspaceItems.id, itemId)).limit(1);
    if (item[0]) {
      await assertWorkspaceAccess(item[0].workspaceId);
      await db.update(workspaceItems).set({ sortOrder: i }).where(eq(workspaceItems.id, itemId));
    }
  }
  revalidatePath('/');
}

export async function moveWorkspaceItemToWorkspace(itemId: string, targetWorkspaceId: string, itemIdsOrder: string[]) {
  const item = await db.select({ workspaceId: workspaceItems.workspaceId }).from(workspaceItems).where(eq(workspaceItems.id, itemId)).limit(1);
  if (!item[0]) throw new Error('Item not found');
  
  await assertWorkspaceAccess(item[0].workspaceId);
  await assertWorkspaceAccess(targetWorkspaceId);

  await db.update(workspaceItems).set({ workspaceId: targetWorkspaceId }).where(eq(workspaceItems.id, itemId));

  for (let i = 0; i < itemIdsOrder.length; i++) {
    const id = itemIdsOrder[i];
    await db.update(workspaceItems).set({ sortOrder: i }).where(eq(workspaceItems.id, id));
  }

  revalidatePath('/');
}

export async function getAdminWorkspacesOverview() {
  const user = await getCurrentUser();
  if (user.role !== 'admin') throw new Error('Admin access required');

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
  if (user.role !== 'admin') throw new Error('Admin access required');

  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  revalidatePath('/');
  return { success: true };
}
