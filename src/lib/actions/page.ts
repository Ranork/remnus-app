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
import { syncPageLinks, removePageLinksFor, purgeReferencesTo } from '@/lib/services/pageLinks';
import { coerceRowValues, extractRowContent, assignOptionColors, type DatabaseColumn } from '@/lib/utils/propertyCoercion';

const MAX_BULK_ROWS = 500;

function getSchemaDefaults(schema: DatabaseColumn[]): Record<string, any> {
  const defaults: Record<string, any> = {};
  for (const col of schema) {
    if ((col.type === 'select' || col.type === 'status') && col.defaultValue) {
      defaults[col.id] = col.defaultValue;
    }
  }
  return defaults;
}

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
      cardCollapsed: pages.cardCollapsed,
      // Recurrence link (migration 0043) — the calendar needs these to badge a
      // card as part of a series and to pick the series-aware delete flow.
      seriesId: pages.seriesId,
      occurrenceDate: pages.occurrenceDate,
      seriesDetached: pages.seriesDetached,
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
      cardCollapsed: pages.cardCollapsed,
      // Recurrence link (migration 0043) — the calendar needs these to badge a
      // card as part of a series and to pick the series-aware delete flow.
      seriesId: pages.seriesId,
      occurrenceDate: pages.occurrenceDate,
      seriesDetached: pages.seriesDetached,
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
  // Strip dead links to this row out of the pages that referenced it, before
  // dropping the graph rows the purge needs to find them.
  await purgeReferencesTo([id]);
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

  const copiedTitle = sourcePage.title;
  const copiedProps = { ...((sourcePage.properties as Record<string, any>) || {}) };

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

  // A single Kanban/Calendar/Table drag only actually moves one card, but
  // `orderedIds` is the full page list re-expressed in its new order — most
  // rows keep the same index they already had. Diff against current sortOrder
  // first so the transaction only writes rows that actually shifted, instead
  // of one sequential UPDATE per page in the database (previously: moving one
  // card in a database of, say, 200 rows meant 200 awaited round-trips, which
  // is what made a single drag feel slow to "Saved").
  const current = await db
    .select({ id: pages.id, sortOrder: pages.sortOrder })
    .from(pages)
    .where(eq(pages.databaseId, databaseId));
  const currentSortOrder = new Map(current.map((p) => [p.id, p.sortOrder]));

  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      if (currentSortOrder.get(orderedIds[i]) === i) continue;
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

export async function updatePageCardCollapsed(id: string, collapsed: boolean) {
  const page = await db.select({ databaseId: pages.databaseId }).from(pages).where(eq(pages.id, id));
  if (!page[0]) return;

  const { userId, workspaceId } = await assertDatabaseAccess(page[0].databaseId);

  await db.update(pages)
    .set({ cardCollapsed: collapsed })
    .where(eq(pages.id, id));

  revalidatePath(`/db/${page[0].databaseId}`);
  publish({ scope: 'database', workspaceId, resourceId: page[0].databaseId, actorId: userId });
}

// ── Bulk add / update (paste-driven, for fast web-based bulk entry) ───────────────

export interface BulkAddedOption {
  column: string;
  values: string[];
}

export async function bulkCreatePages(
  databaseId: string,
  rows: Record<string, unknown>[],
): Promise<{ created: number; errors: { row: number; message: string }[]; addedOptions: BulkAddedOption[] }> {
  const { userId, workspaceId } = await assertDatabaseAccess(databaseId);

  if (!rows.length) return { created: 0, errors: [], addedOptions: [] };
  if (rows.length > MAX_BULK_ROWS) throw new Error(`Too many rows: max ${MAX_BULK_ROWS} per import`);

  const [dbRecord] = await db.select({ schema: databases.schema }).from(databases).where(eq(databases.id, databaseId)).limit(1);
  if (!dbRecord) throw new Error('Database not found');
  const schema = (dbRecord.schema ?? []) as DatabaseColumn[];
  const schemaDefaults = getSchemaDefaults(schema);

  const existing = await db.select({ sortOrder: pages.sortOrder }).from(pages).where(eq(pages.databaseId, databaseId));
  let nextSort = existing.reduce((max, p) => (p.sortOrder > max ? p.sortOrder : max), 0);

  const errors: { row: number; message: string }[] = [];
  const newOptionsByColumn = new Map<string, Set<string>>();
  const toInsert: (typeof pages.$inferInsert)[] = [];
  // Bodies to feed syncPageLinks once the rows exist — the link graph can only be
  // written after the insert, and never inside the transaction (it's best-effort).
  const linkSyncs: { id: string; content: string }[] = [];
  const now = new Date();

  rows.forEach((rawRow, idx) => {
    const { properties, newOptionsByColumn: rowOptions } = coerceRowValues(schema, rawRow as Record<string, string>);
    const title = typeof properties.title === 'string' ? (properties.title as string).trim() : '';
    if (!title) {
      errors.push({ row: idx, message: 'Missing title' });
      return;
    }
    for (const [colId, values] of rowOptions) {
      const set = newOptionsByColumn.get(colId) ?? new Set<string>();
      values.forEach((v) => set.add(v));
      newOptionsByColumn.set(colId, set);
    }
    const content = extractRowContent(schema, rawRow) ?? '';
    const id = crypto.randomUUID();
    nextSort += 1;
    toInsert.push({
      id,
      databaseId,
      title,
      content,
      properties: { ...schemaDefaults, ...properties, title },
      sortOrder: nextSort,
      createdAt: now,
      updatedAt: now,
    });
    if (content) linkSyncs.push({ id, content });
  });

  const addedOptions: BulkAddedOption[] = [];

  await db.transaction(async (tx) => {
    if (newOptionsByColumn.size > 0) {
      const nextSchema = schema.map((col) => {
        const additions = newOptionsByColumn.get(col.id);
        if (!additions || additions.size === 0) return col;
        const values = [...additions];
        addedOptions.push({ column: col.name, values });
        return { ...col, options: [...(col.options ?? []), ...assignOptionColors(values)] };
      });
      await tx.update(databases).set({ schema: nextSchema, updatedAt: now }).where(eq(databases.id, databaseId));
    }
    if (toInsert.length > 0) {
      await tx.insert(pages).values(toInsert);
    }
  });

  for (const { id, content } of linkSyncs) {
    await syncPageLinks(workspaceId, id, 'database_row', content);
  }

  if (toInsert.length > 0) {
    revalidatePath(`/db/${databaseId}`);
    publish({ scope: 'database', workspaceId, resourceId: databaseId, actorId: userId });
  }

  return { created: toInsert.length, errors, addedOptions };
}

export async function bulkUpdatePagesByMatch(
  databaseId: string,
  matchColumnId: string,
  rows: Record<string, unknown>[],
): Promise<{ updated: number; unmatched: number[]; errors: { row: number; message: string }[]; addedOptions: BulkAddedOption[] }> {
  const { userId, workspaceId } = await assertDatabaseAccess(databaseId);

  if (!rows.length) return { updated: 0, unmatched: [], errors: [], addedOptions: [] };
  if (rows.length > MAX_BULK_ROWS) throw new Error(`Too many rows: max ${MAX_BULK_ROWS} per import`);

  const [dbRecord] = await db.select({ schema: databases.schema }).from(databases).where(eq(databases.id, databaseId)).limit(1);
  if (!dbRecord) throw new Error('Database not found');
  const schema = (dbRecord.schema ?? []) as DatabaseColumn[];
  const matchCol = schema.find((c) => c.id === matchColumnId);
  if (!matchCol) throw new Error('Match column not found in schema');

  const existingRows = await db
    .select({ id: pages.id, title: pages.title, properties: pages.properties })
    .from(pages)
    .where(eq(pages.databaseId, databaseId));

  const matchValueOf = (id: string, title: string, properties: Record<string, any>): string => {
    if (matchCol.type === 'id') return id.toLowerCase();
    const v = matchColumnId === 'title' ? title : properties?.[matchColumnId];
    return typeof v === 'string' ? v.trim().toLowerCase() : '';
  };

  const byMatch = new Map<string, string>();
  const existingById = new Map<string, { title: string; properties: Record<string, any> }>();
  for (const p of existingRows) {
    const properties = (p.properties ?? {}) as Record<string, any>;
    existingById.set(p.id, { title: p.title, properties });
    const key = matchValueOf(p.id, p.title, properties);
    if (key) byMatch.set(key, p.id);
  }

  const errors: { row: number; message: string }[] = [];
  const unmatched: number[] = [];
  const newOptionsByColumn = new Map<string, Set<string>>();
  const updates: { pageId: string; properties: Record<string, unknown>; content?: string }[] = [];

  rows.forEach((rawRow, idx) => {
    const { properties, rawByColumnId, newOptionsByColumn: rowOptions } = coerceRowValues(schema, rawRow as Record<string, string>);
    const rawMatch = matchCol.type === 'id' ? rawByColumnId[matchColumnId] : properties[matchColumnId];
    const key = typeof rawMatch === 'string'
      ? rawMatch.trim().toLowerCase()
      : (rawMatch != null ? String(rawMatch).toLowerCase() : '');
    if (!key) {
      errors.push({ row: idx, message: 'Missing match value' });
      return;
    }
    const pageId = byMatch.get(key);
    if (!pageId) {
      unmatched.push(idx);
      return;
    }
    for (const [colId, values] of rowOptions) {
      const set = newOptionsByColumn.get(colId) ?? new Set<string>();
      values.forEach((v) => set.add(v));
      newOptionsByColumn.set(colId, set);
    }
    updates.push({ pageId, properties, content: extractRowContent(schema, rawRow) });
  });

  const addedOptions: BulkAddedOption[] = [];
  const now = new Date();

  await db.transaction(async (tx) => {
    if (newOptionsByColumn.size > 0) {
      const nextSchema = schema.map((col) => {
        const additions = newOptionsByColumn.get(col.id);
        if (!additions || additions.size === 0) return col;
        const values = [...additions];
        addedOptions.push({ column: col.name, values });
        return { ...col, options: [...(col.options ?? []), ...assignOptionColors(values)] };
      });
      await tx.update(databases).set({ schema: nextSchema, updatedAt: now }).where(eq(databases.id, databaseId));
    }
    for (const u of updates) {
      const existingPage = existingById.get(u.pageId);
      if (!existingPage) continue;
      const mergedProperties = { ...existingPage.properties, ...u.properties };
      const nextTitle = typeof u.properties.title === 'string' ? (u.properties.title as string) : existingPage.title;
      // Omitted `content` leaves the existing body untouched — same partial-patch
      // semantics the properties merge above already has.
      await tx.update(pages).set({
        title: nextTitle,
        properties: mergedProperties,
        ...(u.content !== undefined ? { content: u.content } : {}),
        updatedAt: now,
      }).where(eq(pages.id, u.pageId));
    }
  });

  for (const u of updates) {
    if (u.content !== undefined) await syncPageLinks(workspaceId, u.pageId, 'database_row', u.content);
  }

  if (updates.length > 0) {
    revalidatePath(`/db/${databaseId}`);
    publish({ scope: 'database', workspaceId, resourceId: databaseId, actorId: userId });
  }

  return { updated: updates.length, unmatched, errors, addedOptions };
}
