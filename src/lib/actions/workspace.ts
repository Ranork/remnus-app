'use server';
import { db } from '@/db';
import { workspaceItems, standalonePages, databases } from '@/db/schema';
import { eq, isNull, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type WorkspaceItemRow = {
  id: string;
  type: 'page' | 'database';
  title: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  databaseId: string | null;
};

export async function getWorkspaceItems(): Promise<WorkspaceItemRow[]> {
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

export async function createStandalonePage(title: string, parentId?: string) {
  const itemId = crypto.randomUUID();
  const pageId = crypto.randomUUID();

  await db.insert(workspaceItems).values({
    id: itemId,
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

export async function createWorkspaceDatabase(name: string) {
  const itemId = crypto.randomUUID();
  const dbId = crypto.randomUUID();

  await db.insert(workspaceItems).values({
    id: itemId,
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
