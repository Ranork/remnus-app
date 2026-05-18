'use server';
import { db } from '@/db';
import { workspaces, workspaceItems, standalonePages, databases } from '@/db/schema';
import { eq, isNull, asc, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

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

export async function getActiveWorkspaceId(): Promise<string> {
  const cookieStore = await cookies();
  let workspaceId = cookieStore.get('remna_workspace_id')?.value;

  if (!workspaceId) {
    const list = await db.select().from(workspaces).orderBy(asc(workspaces.createdAt)).limit(1);
    if (list[0]) {
      workspaceId = list[0].id;
    } else {
      workspaceId = 'default-workspace';
      // Fallback in case table is empty or default workspace isn't created yet
      await db.insert(workspaces).values({
        id: workspaceId,
        name: 'My Workspace',
      });
    }
  }
  return workspaceId;
}

export async function getWorkspaces() {
  return db.select().from(workspaces).orderBy(asc(workspaces.createdAt));
}

export async function createWorkspace(name: string) {
  const id = crypto.randomUUID();
  await db.insert(workspaces).values({
    id,
    name: name.trim() || 'Untitled Workspace',
  });

  const cookieStore = await cookies();
  cookieStore.set('remna_workspace_id', id, { path: '/' });
  revalidatePath('/');
  return { id };
}

export async function deleteWorkspace(id: string) {
  const all = await db.select().from(workspaces).orderBy(asc(workspaces.createdAt));
  if (all.length <= 1) {
    return { error: 'Cannot delete the only workspace' };
  }

  await db.delete(workspaces).where(eq(workspaces.id, id));

  const cookieStore = await cookies();
  if (cookieStore.get('remna_workspace_id')?.value === id) {
    const remaining = all.find(w => w.id !== id);
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
  await db.update(workspaces)
    .set({ name: name.trim() || 'Untitled Workspace', updatedAt: new Date() })
    .where(eq(workspaces.id, id));

  revalidatePath('/');
  return { success: true };
}

export async function switchWorkspace(workspaceId: string) {
  const cookieStore = await cookies();
  cookieStore.set('remna_workspace_id', workspaceId, { path: '/' });
  revalidatePath('/');
  return { success: true };
}

export async function getWorkspaceItems(workspaceId: string): Promise<WorkspaceItemRow[]> {
  const items = await db.select().from(workspaceItems)
    .where(and(eq(workspaceItems.workspaceId, workspaceId), isNull(workspaceItems.parentId)))
    .orderBy(asc(workspaceItems.sortOrder), asc(workspaceItems.createdAt));

  const dbRows = await db.select({ itemId: databases.itemId, dbId: databases.id }).from(databases);
  const dbMap = new Map(dbRows.filter(r => r.itemId).map(r => [r.itemId!, r.dbId]));

  return items.map(item => ({
    ...item,
    databaseId: item.type === 'database' ? (dbMap.get(item.id) ?? null) : null,
  }));
}

export async function getAllWorkspaceItems(): Promise<WorkspaceItemRow[]> {
  const items = await db.select().from(workspaceItems)
    .where(isNull(workspaceItems.parentId))
    .orderBy(asc(workspaceItems.sortOrder), asc(workspaceItems.createdAt));

  const dbRows = await db.select({ itemId: databases.itemId, dbId: databases.id }).from(databases);
  const dbMap = new Map(dbRows.filter(r => r.itemId).map(r => [r.itemId!, r.dbId]));

  return items.map(item => ({
    ...item,
    databaseId: item.type === 'database' ? (dbMap.get(item.id) ?? null) : null,
  }));
}

export async function createStandalonePage(workspaceId: string, title: string, parentId?: string) {
  const itemId = crypto.randomUUID();
  const pageId = crypto.randomUUID();

  await db.insert(workspaceItems).values({
    id: itemId,
    workspaceId,
    type: 'page',
    title: title || 'Untitled',
    parentId: parentId ?? null,
    sortOrder: 0,
  });

  await db.insert(standalonePages).values({
    id: pageId,
    itemId,
    content: '',
  });

  revalidatePath('/');
  return { itemId, pageId };
}

export async function createWorkspaceDatabase(workspaceId: string, name: string) {
  const itemId = crypto.randomUUID();
  const dbId = crypto.randomUUID();

  await db.insert(workspaceItems).values({
    id: itemId,
    workspaceId,
    type: 'database',
    title: name,
    sortOrder: 0,
  });

  await db.insert(databases).values({
    id: dbId,
    name,
    itemId,
    schema: [
      { id: 'title', name: 'Title', type: 'text' },
      { id: 'status', name: 'Status', type: 'select', options: ['To Do', 'In Progress', 'Done'] },
    ],
  });

  revalidatePath('/');
  return { itemId, dbId };
}

export async function getStandalonePageByItemId(itemId: string) {
  const item = await db.select().from(workspaceItems).where(eq(workspaceItems.id, itemId));
  if (!item[0] || item[0].type !== 'page') return null;
  const page = await db.select().from(standalonePages).where(eq(standalonePages.itemId, itemId));
  return { item: item[0], page: page[0] ?? null };
}

export async function updateStandalonePageContent(itemId: string, content: string) {
  await db.update(standalonePages)
    .set({ content, updatedAt: new Date() })
    .where(eq(standalonePages.itemId, itemId));
}

export async function updateWorkspaceItemTitle(itemId: string, title: string) {
  await db.update(workspaceItems)
    .set({ title, updatedAt: new Date() })
    .where(eq(workspaceItems.id, itemId));

  await db.update(databases)
    .set({ name: title, updatedAt: new Date() })
    .where(eq(databases.itemId, itemId));

  revalidatePath('/');
}

export async function getDatabaseByItemId(itemId: string) {
  const result = await db.select().from(databases).where(eq(databases.itemId, itemId));
  return result[0] ?? null;
}

export async function updateWorkspaceItemIcon(itemId: string, icon: string | null, iconColor: string | null) {
  await db.update(workspaceItems)
    .set({ icon, iconColor, updatedAt: new Date() })
    .where(eq(workspaceItems.id, itemId));

  revalidatePath('/');
}
