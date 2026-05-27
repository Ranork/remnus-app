/**
 * Cookie-free service layer for MCP tool handlers.
 * All functions take an explicit workspaceId and verify ownership without touching
 * Next.js session cookies. Every function enforces workspace isolation.
 */
import { db } from '@/db';
import {
  workspaceItems,
  standalonePages,
  databases,
  pages,
} from '@/db/schema';
import { eq, and, like, asc, sql } from 'drizzle-orm';

// ── Internal boundary check ───────────────────────────────────────────────────

async function assertItemInWorkspace(itemId: string, workspaceId: string) {
  const [item] = await db
    .select({ workspaceId: workspaceItems.workspaceId })
    .from(workspaceItems)
    .where(eq(workspaceItems.id, itemId))
    .limit(1);
  if (!item || item.workspaceId !== workspaceId) {
    throw new Error('Not found or access denied');
  }
}

async function assertDatabaseInWorkspace(databaseId: string, workspaceId: string): Promise<string> {
  // Accept both databases.id and workspace_items.id (itemId)
  const [row] = await db
    .select({ workspaceId: workspaceItems.workspaceId, dbId: databases.id })
    .from(databases)
    .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
    .where(eq(databases.id, databaseId))
    .limit(1);

  if (row) {
    if (row.workspaceId !== workspaceId) throw new Error('Database not found or access denied');
    return row.dbId;
  }

  // Try lookup by workspace_items.id (itemId)
  const [byItem] = await db
    .select({ workspaceId: workspaceItems.workspaceId, dbId: databases.id })
    .from(databases)
    .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
    .where(eq(workspaceItems.id, databaseId))
    .limit(1);

  if (!byItem || byItem.workspaceId !== workspaceId) {
    throw new Error('Database not found or access denied');
  }
  return byItem.dbId;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function searchWorkspace(
  workspaceId: string,
  query: string,
  limit = 10,
) {
  const pattern = `%${query}%`;

  const rows = await db
    .select({
      id: workspaceItems.id,
      type: workspaceItems.type,
      title: workspaceItems.title,
      content: standalonePages.content,
    })
    .from(workspaceItems)
    .leftJoin(standalonePages, eq(standalonePages.itemId, workspaceItems.id))
    .where(
      and(
        eq(workspaceItems.workspaceId, workspaceId),
        like(workspaceItems.title, pattern),
      ),
    )
    .orderBy(asc(workspaceItems.sortOrder))
    .limit(limit);

  return rows.map(({ content, ...item }) => {
    let snippet = '';
    if (item.type === 'page' && content) {
      const idx = content.toLowerCase().indexOf(query.toLowerCase());
      snippet = idx >= 0
        ? content.slice(Math.max(0, idx - 40), idx + 80).replace(/\n/g, ' ')
        : content.slice(0, 100).replace(/\n/g, ' ');
    }
    return { id: item.id, type: item.type, title: item.title, snippet };
  });
}

export async function getPageById(workspaceId: string, itemId: string) {
  await assertItemInWorkspace(itemId, workspaceId);

  const [item] = await db
    .select()
    .from(workspaceItems)
    .where(eq(workspaceItems.id, itemId))
    .limit(1);

  if (!item) throw new Error('Not found');

  if (item.type === 'page') {
    const [sp] = await db
      .select()
      .from(standalonePages)
      .where(eq(standalonePages.itemId, itemId))
      .limit(1);
    return {
      id: item.id,
      type: 'page' as const,
      title: item.title,
      content: sp?.content ?? '',
      icon: item.icon,
      properties: undefined,
    };
  }

  // Database item — find the associated DB record via item
  const [db_row] = await db
    .select({ id: databases.id })
    .from(databases)
    .where(eq(databases.itemId, itemId))
    .limit(1);

  return {
    id: item.id,
    type: 'database' as const,
    title: item.title,
    content: '',
    icon: item.icon,
    properties: undefined,
    databaseId: db_row?.id ?? null,
  };
}

export async function getDatabasePageById(workspaceId: string, pageId: string) {
  const [page] = await db
    .select()
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1);

  if (!page) throw new Error('Not found');

  // Verify the database belongs to this workspace
  await assertDatabaseInWorkspace(page.databaseId, workspaceId);

  return {
    id: page.id,
    type: 'page' as const,
    title: page.title,
    content: page.content,
    icon: page.icon,
    properties: page.properties,
  };
}

export async function listWorkspaceItems(workspaceId: string, parentId?: string) {
  const conditions = parentId
    ? and(eq(workspaceItems.workspaceId, workspaceId), eq(workspaceItems.parentId, parentId))
    : and(eq(workspaceItems.workspaceId, workspaceId));

  const rows = await db
    .select({
      id: workspaceItems.id,
      type: workspaceItems.type,
      title: workspaceItems.title,
      parentId: workspaceItems.parentId,
      icon: workspaceItems.icon,
      databaseId: databases.id,
    })
    .from(workspaceItems)
    .leftJoin(databases, eq(databases.itemId, workspaceItems.id))
    .where(conditions)
    .orderBy(asc(workspaceItems.sortOrder), asc(workspaceItems.createdAt));

  return rows.map(r => ({
    id: r.id,
    type: r.type,
    title: r.title,
    parentId: r.parentId,
    icon: r.icon,
    ...(r.databaseId ? { databaseId: r.databaseId } : {}),
  }));
}

export async function getDatabaseSchema(workspaceId: string, databaseId: string) {
  const resolvedId = await assertDatabaseInWorkspace(databaseId, workspaceId);

  const [dbRecord] = await db
    .select({ schema: databases.schema, name: databases.name })
    .from(databases)
    .where(eq(databases.id, resolvedId))
    .limit(1);

  if (!dbRecord) throw new Error('Database not found');
  return { name: dbRecord.name, schema: dbRecord.schema };
}

export async function queryDatabaseRows(
  workspaceId: string,
  databaseId: string,
  limit = 50,
  filters?: Record<string, unknown>,
) {
  const resolvedId = await assertDatabaseInWorkspace(databaseId, workspaceId);

  const [dbRecord] = await db
    .select({ schema: databases.schema, name: databases.name })
    .from(databases)
    .where(eq(databases.id, resolvedId))
    .limit(1);

  if (!dbRecord) throw new Error('Database not found');

  // Push property filters into SQL using json_extract so limit is applied after filtering.
  // Handles both scalar fields (select, text, number) and array fields (multi_select)
  // by checking both direct equality and json_each membership in one condition.
  const filterConditions = filters
    ? Object.entries(filters).map(([key, value]) =>
        sql`(
          json_extract(${pages.properties}, ${'$.' + key}) = ${value}
          OR EXISTS (
            SELECT 1 FROM json_each(json_extract(${pages.properties}, ${'$.' + key}))
            WHERE value = ${value}
          )
        )`,
      )
    : [];

  const whereCondition = filterConditions.length > 0
    ? and(eq(pages.databaseId, resolvedId), ...filterConditions)
    : eq(pages.databaseId, resolvedId);

  const rows = await db
    .select({
      id: pages.id,
      title: pages.title,
      properties: pages.properties,
      content: pages.content,
    })
    .from(pages)
    .where(whereCondition)
    .orderBy(asc(pages.sortOrder))
    .limit(limit);

  return { schema: dbRecord.schema, rows };
}

export async function getAnyPageById(workspaceId: string, pageId: string) {
  // Try as workspace item first
  const [item] = await db
    .select({ workspaceId: workspaceItems.workspaceId, type: workspaceItems.type })
    .from(workspaceItems)
    .where(eq(workspaceItems.id, pageId))
    .limit(1);

  if (item) {
    if (item.workspaceId !== workspaceId) throw new Error('Access denied');
    return getPageById(workspaceId, pageId);
  }

  // Fall back to DB row (pages table)
  return getDatabasePageById(workspaceId, pageId);
}

export async function bulkUpdatePages(
  workspaceId: string,
  updates: { pageId: string; title?: string; content?: string; properties?: Record<string, unknown> }[],
) {
  const results = await Promise.all(
    updates.map(({ pageId, ...patch }) => updatePageById(workspaceId, pageId, patch)),
  );
  return results.map((r, i) => ({ id: updates[i].pageId, updated: r.updated }));
}

export async function createPageInWorkspace(
  workspaceId: string,
  input: {
    title: string;
    content?: string;
    parentId?: string;
    databaseId?: string;
    properties?: Record<string, any>;
  },
) {
  if (input.databaseId) {
    // Database row — resolve workspace_items.id → databases.id if needed
    const resolvedDbId = await assertDatabaseInWorkspace(input.databaseId, workspaceId);

    const existing = await db
      .select({ sortOrder: pages.sortOrder })
      .from(pages)
      .where(eq(pages.databaseId, resolvedDbId));
    const maxSort = existing.reduce((max, p) => (p.sortOrder > max ? p.sortOrder : max), 0);

    const id = crypto.randomUUID();
    await db.insert(pages).values({
      id,
      databaseId: resolvedDbId,
      title: input.title,
      content: input.content ?? '',
      properties: { title: input.title, ...input.properties },
      sortOrder: maxSort + 1,
    });
    return { id, type: 'db-row' as const };
  }

  // Standalone page
  if (input.parentId) {
    await assertItemInWorkspace(input.parentId, workspaceId);
  }

  const itemId = crypto.randomUUID();
  const pageId = crypto.randomUUID();

  await db.insert(workspaceItems).values({
    id: itemId,
    workspaceId,
    type: 'page',
    title: input.title,
    parentId: input.parentId ?? null,
    sortOrder: 0,
  });

  await db.insert(standalonePages).values({
    id: pageId,
    itemId,
    content: input.content ?? '',
  });

  return { id: itemId, type: 'page' as const };
}

// ── Internal recursive delete ─────────────────────────────────────────────────

async function deleteWorkspaceItemAndDescendants(itemId: string, type: 'page' | 'database') {
  const children = await db
    .select({ id: workspaceItems.id, type: workspaceItems.type })
    .from(workspaceItems)
    .where(eq(workspaceItems.parentId, itemId));

  for (const child of children) {
    await deleteWorkspaceItemAndDescendants(child.id, child.type);
  }

  if (type === 'database') {
    await db.delete(databases).where(eq(databases.itemId, itemId));
  } else {
    await db.delete(standalonePages).where(eq(standalonePages.itemId, itemId));
  }

  await db.delete(workspaceItems).where(eq(workspaceItems.id, itemId));
}

export async function deleteItemFromWorkspace(workspaceId: string, itemId: string) {
  const [item] = await db
    .select({ workspaceId: workspaceItems.workspaceId, type: workspaceItems.type })
    .from(workspaceItems)
    .where(eq(workspaceItems.id, itemId))
    .limit(1);

  if (item) {
    if (item.workspaceId !== workspaceId) throw new Error('Access denied');
    await deleteWorkspaceItemAndDescendants(itemId, item.type);
    return { deleted: true, type: item.type as 'page' | 'database' };
  }

  const [page] = await db
    .select({ databaseId: pages.databaseId })
    .from(pages)
    .where(eq(pages.id, itemId))
    .limit(1);

  if (!page) throw new Error('Item not found');
  await assertDatabaseInWorkspace(page.databaseId, workspaceId);
  await db.delete(pages).where(eq(pages.id, itemId));
  return { deleted: true, type: 'db-row' as const };
}

export async function moveItemInWorkspace(
  workspaceId: string,
  itemId: string,
  newParentId: string | null,
) {
  await assertItemInWorkspace(itemId, workspaceId);

  if (newParentId !== null) {
    await assertItemInWorkspace(newParentId, workspaceId);
    let cursor: string | null = newParentId;
    while (cursor !== null) {
      if (cursor === itemId) throw new Error('Cannot move an item into its own subtree');
      const [row] = await db
        .select({ parentId: workspaceItems.parentId })
        .from(workspaceItems)
        .where(eq(workspaceItems.id, cursor))
        .limit(1);
      cursor = row?.parentId ?? null;
    }
  }

  await db
    .update(workspaceItems)
    .set({ parentId: newParentId, updatedAt: new Date() })
    .where(eq(workspaceItems.id, itemId));

  return { moved: true };
}

export async function createDatabaseInWorkspace(
  workspaceId: string,
  input: {
    name: string;
    schema?: Array<{ name: string; type: string; options?: any[] }>;
    parentId?: string;
  },
) {
  if (input.parentId) {
    await assertItemInWorkspace(input.parentId, workspaceId);
  }

  const itemId = crypto.randomUUID();
  const dbId = crypto.randomUUID();

  const resolvedSchema: any[] = input.schema?.length
    ? input.schema.map(col => ({
        id: `col_${crypto.randomUUID().slice(0, 8)}`,
        name: col.name,
        type: col.type,
        ...(col.options ? { options: col.options } : {}),
      }))
    : [
        { id: 'title', name: 'Title', type: 'text' },
        { id: 'status', name: 'Status', type: 'select', options: ['To Do', 'In Progress', 'Done'] },
      ];

  if (!resolvedSchema.some((c: any) => c.id === 'title')) {
    resolvedSchema.unshift({ id: 'title', name: 'Title', type: 'text' });
  }

  await db.insert(workspaceItems).values({
    id: itemId,
    workspaceId,
    type: 'database',
    title: input.name,
    parentId: input.parentId ?? null,
    sortOrder: 0,
  });

  await db.insert(databases).values({
    id: dbId,
    name: input.name,
    itemId,
    schema: resolvedSchema,
    views: null,
  });

  return { id: itemId, databaseId: dbId };
}

export async function updateDatabaseSchemaById(
  workspaceId: string,
  databaseId: string,
  changes: {
    addColumns?: Array<{ name: string; type: string; options?: any[] }>;
    removeColumnIds?: string[];
  },
  confirm: boolean,
) {
  const resolvedId = await assertDatabaseInWorkspace(databaseId, workspaceId);

  const [dbRecord] = await db
    .select({ schema: databases.schema })
    .from(databases)
    .where(eq(databases.id, resolvedId))
    .limit(1);

  if (!dbRecord) throw new Error('Database not found');

  const currentSchema: any[] = dbRecord.schema ?? [];
  const safeRemoveIds = (changes.removeColumnIds ?? []).filter((id: string) => id !== 'title');

  if (safeRemoveIds.length > 0 && !confirm) {
    const toRemove = currentSchema.filter((c: any) => safeRemoveIds.includes(c.id));
    throw new Error(
      `Removing columns is destructive and permanently deletes all data in those columns. ` +
      `Columns to remove: ${toRemove.map((c: any) => c.name).join(', ')}. ` +
      `Set confirm: true to proceed.`,
    );
  }

  let newSchema = currentSchema.filter((c: any) => !safeRemoveIds.includes(c.id));

  if (changes.addColumns?.length) {
    const added = changes.addColumns.map(col => ({
      id: `col_${crypto.randomUUID().slice(0, 8)}`,
      name: col.name,
      type: col.type,
      ...(col.options ? { options: col.options } : {}),
    }));
    newSchema = [...newSchema, ...added];
  }

  await db.update(databases)
    .set({ schema: newSchema, updatedAt: new Date() })
    .where(eq(databases.id, resolvedId));

  return { updated: true, schema: newSchema };
}

export async function updatePageById(
  workspaceId: string,
  itemId: string,
  patch: { title?: string; content?: string; properties?: Record<string, any> },
) {
  // Try as workspace item first
  const [item] = await db
    .select({ type: workspaceItems.type, workspaceId: workspaceItems.workspaceId })
    .from(workspaceItems)
    .where(eq(workspaceItems.id, itemId))
    .limit(1);

  if (item) {
    if (item.workspaceId !== workspaceId) throw new Error('Access denied');

    if (patch.title !== undefined) {
      await db
        .update(workspaceItems)
        .set({ title: patch.title, updatedAt: new Date() })
        .where(eq(workspaceItems.id, itemId));
    }
    if (patch.content !== undefined && item.type === 'page') {
      await db
        .update(standalonePages)
        .set({ content: patch.content, updatedAt: new Date() })
        .where(eq(standalonePages.itemId, itemId));
    }
    return { updated: true };
  }

  // Try as DB row (pages table)
  const [page] = await db
    .select({ databaseId: pages.databaseId })
    .from(pages)
    .where(eq(pages.id, itemId))
    .limit(1);

  if (!page) throw new Error('Page not found');
  await assertDatabaseInWorkspace(page.databaseId, workspaceId);

  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (patch.title !== undefined) updateData.title = patch.title;
  if (patch.content !== undefined) updateData.content = patch.content;
  if (patch.properties !== undefined) {
    const [existing] = await db
      .select({ properties: pages.properties })
      .from(pages)
      .where(eq(pages.id, itemId))
      .limit(1);
    updateData.properties = { ...(existing?.properties ?? {}), ...patch.properties };
  }

  await db.update(pages).set(updateData).where(eq(pages.id, itemId));
  return { updated: true };
}
