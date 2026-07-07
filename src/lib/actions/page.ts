'use server';
import { db } from '@/db';
import { pages, databases, workspaceItems, workspaceMembers, agentTokens, oauthAccessTokens, oauthClients } from '@/db/schema';
import { eq, asc, and, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/session';
import { deleteWorkspaceItem } from './workspace';
import { publish } from '@/lib/realtime/publish';
import { isCloudinaryUrl, deleteCloudinaryImage } from '@/lib/cloudinary';
import { recordDeletionTombstone } from '@/lib/services/workspace';
import { syncPageLinks, removePageLinksFor } from '@/lib/services/pageLinks';

// Verify user has access to the workspace that owns this database.
// Returns { userId, workspaceId } so callers can emit realtime events.
async function assertDatabaseAccess(databaseId: string): Promise<{ userId: string; workspaceId: string }> {
  const user = await getCurrentUser();

  const [row] = await db
    .select({ workspaceId: workspaceItems.workspaceId })
    .from(databases)
    .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
    .where(eq(databases.id, databaseId))
    .limit(1);

  if (!row) throw new Error('Database not found');

  if (user.role !== 'admin') {
    const [member] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, row.workspaceId),
          eq(workspaceMembers.userId, user.id),
        ),
      )
      .limit(1);

    if (!member) throw new Error('Unauthorized: no access to this database');
  }

  return { userId: user.id, workspaceId: row.workspaceId };
}

export async function createPage(
  databaseId: string,
  title: string,
  initialProperties?: Record<string, any>,
  icon?: string | null,
  iconColor?: string | null
) {
  const { userId, workspaceId } = await assertDatabaseAccess(databaseId);

  const id = crypto.randomUUID();
  const existing = await db.select({ sortOrder: pages.sortOrder }).from(pages).where(eq(pages.databaseId, databaseId));
  const maxSort = existing.reduce((max, p) => p.sortOrder > max ? p.sortOrder : max, 0);

  const defaultProps = { title: title, status: 'To Do', ...initialProperties };

  const now = new Date();
  await db.insert(pages).values({
    id,
    databaseId,
    title,
    content: '',
    properties: defaultProps,
    sortOrder: maxSort + 1,
    icon: icon || null,
    iconColor: iconColor || null,
    createdAt: now,
    updatedAt: now,
  });
  revalidatePath(`/db/${databaseId}`);
  publish({ scope: 'database', workspaceId, resourceId: databaseId, actorId: userId });
  return id;
}

export async function getPages(databaseId: string) {
  await assertDatabaseAccess(databaseId);
  return db
    .select({
      id: pages.id,
      databaseId: pages.databaseId,
      title: pages.title,
      content: pages.content,
      properties: pages.properties,
      sortOrder: pages.sortOrder,
      icon: pages.icon,
      iconColor: pages.iconColor,
      createdAt: pages.createdAt,
      updatedAt: pages.updatedAt,
      agentEditedAt: pages.agentEditedAt,
      agentTokenId: pages.agentTokenId,
      agentName: sql<string | null>`coalesce(${agentTokens.agentName}, ${oauthAccessTokens.agentName})`,
      agentTokenName: sql<string | null>`coalesce(${agentTokens.name}, ${oauthClients.clientName})`,
    })
    .from(pages)
    .leftJoin(agentTokens, eq(pages.agentTokenId, agentTokens.id))
    .leftJoin(oauthAccessTokens, eq(pages.agentTokenId, oauthAccessTokens.id))
    .leftJoin(oauthClients, eq(oauthAccessTokens.clientId, oauthClients.clientId))
    .where(eq(pages.databaseId, databaseId))
    .orderBy(asc(pages.sortOrder), asc(pages.createdAt));
}

export async function updatePageProperties(id: string, properties: any) {
  const page = await db.select().from(pages).where(eq(pages.id, id));
  if (!page[0]) return;

  await assertDatabaseAccess(page[0].databaseId);

  const title = typeof properties.title === 'string' ? properties.title : page[0].title;
  await db
    .update(pages)
    .set({ title, properties, updatedAt: new Date() })
    .where(eq(pages.id, id));
}

export async function getPage(id: string) {
  const [row] = await db
    .select({
      id: pages.id,
      databaseId: pages.databaseId,
      title: pages.title,
      content: pages.content,
      properties: pages.properties,
      sortOrder: pages.sortOrder,
      icon: pages.icon,
      iconColor: pages.iconColor,
      createdAt: pages.createdAt,
      updatedAt: pages.updatedAt,
      agentEditedAt: pages.agentEditedAt,
      agentTokenId: pages.agentTokenId,
      agentName: sql<string | null>`coalesce(${agentTokens.agentName}, ${oauthAccessTokens.agentName})`,
      agentTokenName: sql<string | null>`coalesce(${agentTokens.name}, ${oauthClients.clientName})`,
    })
    .from(pages)
    .leftJoin(agentTokens, eq(pages.agentTokenId, agentTokens.id))
    .leftJoin(oauthAccessTokens, eq(pages.agentTokenId, oauthAccessTokens.id))
    .leftJoin(oauthClients, eq(oauthAccessTokens.clientId, oauthClients.clientId))
    .where(eq(pages.id, id))
    .limit(1);

  if (!row) return undefined;

  await assertDatabaseAccess(row.databaseId);
  return row;
}

export async function updatePageContent(id: string, content: string) {
  const page = await db.select({ databaseId: pages.databaseId }).from(pages).where(eq(pages.id, id)).limit(1);
  let workspaceId: string | null = null;
  if (page[0]) ({ workspaceId } = await assertDatabaseAccess(page[0].databaseId));
  await db.update(pages).set({ content, updatedAt: new Date() }).where(eq(pages.id, id));
  if (workspaceId) await syncPageLinks(workspaceId, id, 'database_row', content);
}

export async function deletePage(id: string, databaseId: string) {
  const { userId, workspaceId } = await assertDatabaseAccess(databaseId);

  // Clean up any nested workspace items under this page
  const subItems = await db.select({ id: workspaceItems.id }).from(workspaceItems).where(eq(workspaceItems.parentId, id));
  for (const item of subItems) {
    await deleteWorkspaceItem(item.id);
  }

  const [row] = await db.select({ title: pages.title }).from(pages).where(eq(pages.id, id)).limit(1);
  await db.delete(pages).where(eq(pages.id, id));
  await recordDeletionTombstone(workspaceId, id, 'database_row', row?.title ?? '');
  await removePageLinksFor(id);
  revalidatePath(`/db/${databaseId}`);
  publish({ scope: 'database', workspaceId, resourceId: databaseId, actorId: userId });
}

export async function duplicatePage(id: string, databaseId: string) {
  const { userId, workspaceId } = await assertDatabaseAccess(databaseId);

  const source = await db.select().from(pages).where(eq(pages.id, id));
  if (!source[0]) return;

  const newId = crypto.randomUUID();
  const sourcePage = source[0];

  const existing = await db.select({ sortOrder: pages.sortOrder }).from(pages).where(eq(pages.databaseId, databaseId));
  const maxSort = existing.reduce((max, p) => p.sortOrder > max ? p.sortOrder : max, 0);

  const copiedTitle = `${sourcePage.title} (Copy)`;
  const copiedProps = { ...((sourcePage.properties as Record<string, any>) || {}) };
  if (copiedProps.title) copiedProps.title = `${copiedProps.title} (Copy)`;

  const now = new Date();
  await db.insert(pages).values({
    id: newId,
    databaseId,
    title: copiedTitle,
    content: sourcePage.content || '',
    properties: copiedProps,
    sortOrder: maxSort + 1,
    icon: sourcePage.icon,
    iconColor: sourcePage.iconColor,
    createdAt: now,
    updatedAt: now,
  });

  if (sourcePage.content) await syncPageLinks(workspaceId, newId, 'database_row', sourcePage.content);
  revalidatePath(`/db/${databaseId}`);
  publish({ scope: 'database', workspaceId, resourceId: databaseId, actorId: userId });
  return newId;
}

export async function reorderPages(databaseId: string, orderedIds: string[]) {
  const { userId, workspaceId } = await assertDatabaseAccess(databaseId);

  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.update(pages).set({ sortOrder: i }).where(eq(pages.id, orderedIds[i]));
    }
  });
  revalidatePath(`/db/${databaseId}`);
  publish({ scope: 'database', workspaceId, resourceId: databaseId, actorId: userId });
}

export async function updatePageIcon(id: string, icon: string | null, iconColor: string | null) {
  const page = await db.select().from(pages).where(eq(pages.id, id));
  if (!page[0]) return;

  const { userId, workspaceId } = await assertDatabaseAccess(page[0].databaseId);

  if (isCloudinaryUrl(page[0].icon) && page[0].icon !== icon) {
    deleteCloudinaryImage(page[0].icon!);
  }

  await db.update(pages)
    .set({ icon, iconColor, updatedAt: new Date() })
    .where(eq(pages.id, id));

  revalidatePath(`/db/${page[0].databaseId}`);
  revalidatePath(`/db/${page[0].databaseId}/${id}`);
  publish({ scope: 'database', workspaceId, resourceId: page[0].databaseId, actorId: userId });
}
