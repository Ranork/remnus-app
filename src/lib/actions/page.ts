'use server';
import { db } from '@/db';
import { pages } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function createPage(
  databaseId: string, 
  title: string, 
  initialProperties?: Record<string, any>,
  icon?: string | null,
  iconColor?: string | null
) {
  const id = crypto.randomUUID();
  // Find the highest sort order to put the new page at the bottom
  const existing = await db.select({ sortOrder: pages.sortOrder }).from(pages).where(eq(pages.databaseId, databaseId));
  const maxSort = existing.reduce((max, p) => p.sortOrder > max ? p.sortOrder : max, 0);

  const defaultProps = { title: title, status: 'To Do', ...initialProperties };

  await db.insert(pages).values({
    id,
    databaseId,
    title,
    content: '',
    properties: defaultProps,
    sortOrder: maxSort + 1,
    icon: icon || null,
    iconColor: iconColor || null,
  });
  revalidatePath(`/db/${databaseId}`);
  return id;
}

export async function getPages(databaseId: string) {
  return db
    .select()
    .from(pages)
    .where(eq(pages.databaseId, databaseId))
    .orderBy(asc(pages.sortOrder), asc(pages.createdAt));
}

export async function updatePageProperties(id: string, properties: any) {
  const page = await db.select().from(pages).where(eq(pages.id, id));
  if (!page[0]) return;
  const title = typeof properties.title === 'string' ? properties.title : page[0].title;
  await db
    .update(pages)
    .set({
      title,
      properties,
      updatedAt: new Date(),
    })
    .where(eq(pages.id, id));
  revalidatePath(`/db/${page[0].databaseId}`);
}

export async function getPage(id: string) {
  const result = await db.select().from(pages).where(eq(pages.id, id));
  return result[0];
}

export async function updatePageContent(id: string, content: string) {
  await db.update(pages).set({ content, updatedAt: new Date() }).where(eq(pages.id, id));
}

export async function deletePage(id: string, databaseId: string) {
  await db.delete(pages).where(eq(pages.id, id));
  revalidatePath(`/db/${databaseId}`);
}

export async function duplicatePage(id: string, databaseId: string) {
  const source = await db.select().from(pages).where(eq(pages.id, id));
  if (!source[0]) return;

  const newId = crypto.randomUUID();
  const sourcePage = source[0];
  
  const existing = await db.select({ sortOrder: pages.sortOrder }).from(pages).where(eq(pages.databaseId, databaseId));
  const maxSort = existing.reduce((max, p) => p.sortOrder > max ? p.sortOrder : max, 0);

  const copiedTitle = `${sourcePage.title} (Copy)`;
  const copiedProps = { ...((sourcePage.properties as Record<string, any>) || {}) };
  if (copiedProps.title) {
    copiedProps.title = `${copiedProps.title} (Copy)`;
  }

  await db.insert(pages).values({
    id: newId,
    databaseId,
    title: copiedTitle,
    content: sourcePage.content || '',
    properties: copiedProps,
    sortOrder: maxSort + 1,
    icon: sourcePage.icon,
    iconColor: sourcePage.iconColor,
  });

  revalidatePath(`/db/${databaseId}`);
  return newId;
}

export async function reorderPages(databaseId: string, orderedIds: string[]) {
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(pages)
        .set({ sortOrder: i })
        .where(eq(pages.id, orderedIds[i]));
    }
  });
  revalidatePath(`/db/${databaseId}`);
}

export async function updatePageIcon(id: string, icon: string | null, iconColor: string | null) {
  const page = await db.select().from(pages).where(eq(pages.id, id));
  if (!page[0]) return;
  await db.update(pages)
    .set({ icon, iconColor, updatedAt: new Date() })
    .where(eq(pages.id, id));

  revalidatePath(`/db/${page[0].databaseId}`);
  revalidatePath(`/db/${page[0].databaseId}/${id}`);
}
