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
  workspaceMembers,
  users,
  agentActivity,
  agentTokens,
  oauthAccessTokens,
  sharedPages,
  deletedItems,
  pageLinks,
} from '@/db/schema';
import { eq, ne, and, or, like, asc, desc, gte, lte, sql, inArray } from 'drizzle-orm';
import { syncPageLinks, removePageLinksFor } from './pageLinks';

// ── Cursor pagination utilities ───────────────────────────────────────────────

function encodeCursor(sortOrder: number, id: string): string {
  return Buffer.from(JSON.stringify({ so: sortOrder, id })).toString('base64url');
}

function decodeCursor(cursor: string): { so: number; id: string } {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString());
}

function encodeChangeCursor(ts: number, id: string): string {
  return Buffer.from(JSON.stringify({ ts, id })).toString('base64url');
}

function decodeChangeCursor(cursor: string): { ts: number; id: string } {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString());
}

// Legacy rows created before this app consistently passed explicit Date()
// values can carry CURRENT_TIMESTAMP-as-text (see the createdAt gotcha in
// AGENTS.md), which surfaces here as an Invalid Date rather than a throw.
function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

// ── Select option auto-coloring ───────────────────────────────────────────────

const COLOR_CYCLE = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'] as const;

function autoColorOptions(options: any[]): { value: string; color: string; group?: string }[] {
  return options.map((opt, i) => {
    const value = typeof opt === 'string' ? opt : opt.value ?? String(opt);
    const color = typeof opt === 'object' && opt.color ? opt.color : COLOR_CYCLE[i % COLOR_CYCLE.length];
    // Preserve the status group when present (status columns).
    const group = typeof opt === 'object' && opt.group ? opt.group : undefined;
    return group ? { value, color, group } : { value, color };
  });
}

function normalizeSchemaColumns(
  cols: Array<{ id?: string; name: string; type: string; options?: any[] }>,
): any[] {
  return cols.map(col => ({
    ...col,
    ...(col.options && (col.type === 'select' || col.type === 'multi_select' || col.type === 'status')
      ? { options: autoColorOptions(col.options) }
      : {}),
  }));
}

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

export async function queryAuditLog(
  workspaceId: string,
  filters?: {
    tool?: string;
    status?: 'success' | 'error';
    from?: string;
    to?: string;
  },
  limit = 50,
) {
  const conditions = [eq(agentActivity.workspaceId, workspaceId)];

  if (filters?.tool) conditions.push(eq(agentActivity.tool, filters.tool));
  if (filters?.status) conditions.push(eq(agentActivity.status, filters.status));
  if (filters?.from) conditions.push(gte(agentActivity.createdAt, new Date(filters.from)));
  if (filters?.to) conditions.push(lte(agentActivity.createdAt, new Date(filters.to)));

  // PAT rows resolve names via agent_tokens; OAuth rows (token_id null since
  // migration 0034) via oauth_access_tokens.
  const rows = await db
    .select({
      id: agentActivity.id,
      tool: agentActivity.tool,
      status: agentActivity.status,
      targetType: agentActivity.targetType,
      targetId: agentActivity.targetId,
      createdAt: agentActivity.createdAt,
      agentName: sql<string | null>`coalesce(${agentTokens.agentName}, ${oauthAccessTokens.agentName})`,
      tokenName: sql<string | null>`coalesce(${agentTokens.name}, ${oauthAccessTokens.displayName})`,
    })
    .from(agentActivity)
    .leftJoin(agentTokens, eq(agentTokens.id, agentActivity.tokenId))
    .leftJoin(oauthAccessTokens, eq(oauthAccessTokens.id, agentActivity.oauthTokenId))
    .where(and(...conditions))
    .orderBy(desc(agentActivity.createdAt))
    .limit(limit);

  return rows;
}

export async function listWorkspaceMembers(workspaceId: string) {
  const rows = await db
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.createdAt,
      name: users.name,
      email: users.email,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(asc(workspaceMembers.createdAt));

  return rows.map(r => ({
    userId: r.userId,
    name: r.name,
    email: r.email,
    role: r.role,
    joinedAt: r.joinedAt,
  }));
}

export async function searchWorkspace(
  workspaceId: string,
  query: string,
  limit = 10,
) {
  const pattern = `%${query}%`;
  const q = query.toLowerCase();

  const snippetFrom = (content: string | null | undefined): string => {
    if (!content) return '';
    const idx = content.toLowerCase().indexOf(q);
    const slice = idx >= 0
      ? content.slice(Math.max(0, idx - 40), idx + 80)
      : content.slice(0, 100);
    return slice.replace(/\n/g, ' ').trim();
  };

  const matchedOn = (title: string | null, content: string | null): 'title' | 'content' =>
    title && title.toLowerCase().includes(q) ? 'title' : 'content';

  // Sidebar items (standalone pages + databases): match on title OR page content.
  const itemRows = await db
    .select({
      id: workspaceItems.id,
      type: workspaceItems.type,
      title: workspaceItems.title,
      parentId: workspaceItems.parentId,
      content: standalonePages.content,
    })
    .from(workspaceItems)
    .leftJoin(standalonePages, eq(standalonePages.itemId, workspaceItems.id))
    .where(
      and(
        eq(workspaceItems.workspaceId, workspaceId),
        or(
          like(workspaceItems.title, pattern),
          like(standalonePages.content, pattern),
        ),
      ),
    )
    .orderBy(asc(workspaceItems.sortOrder))
    .limit(limit);

  // Database rows (each row is a page): match on title OR content, scoped to the
  // workspace via databases -> workspace_items. Without this, rows of a database
  // (e.g. tasks in a tracker) are invisible to search.
  const dbRows = await db
    .select({
      id: pages.id,
      title: pages.title,
      content: pages.content,
      databaseId: databases.id,
      dbItemId: workspaceItems.id,
    })
    .from(pages)
    .innerJoin(databases, eq(pages.databaseId, databases.id))
    .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
    .where(
      and(
        eq(workspaceItems.workspaceId, workspaceId),
        or(
          like(pages.title, pattern),
          like(pages.content, pattern),
        ),
      ),
    )
    .limit(limit);

  // Resolve a location breadcrumb (root -> ... -> parent) for any item by walking
  // the parent_id chain over a lightweight in-memory map of the workspace tree.
  const treeRows = await db
    .select({ id: workspaceItems.id, parentId: workspaceItems.parentId, title: workspaceItems.title })
    .from(workspaceItems)
    .where(eq(workspaceItems.workspaceId, workspaceId));
  const tree = new Map(treeRows.map((t) => [t.id, { parentId: t.parentId, title: t.title }]));
  const breadcrumbOf = (startId: string | null): string[] => {
    const path: string[] = [];
    let cur = startId;
    for (let guard = 0; cur && guard < 25; guard++) {
      const node = tree.get(cur);
      if (!node) break;
      path.unshift(node.title);
      cur = node.parentId;
    }
    return path;
  };

  const items = itemRows.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    parentId: item.parentId ?? undefined,
    breadcrumb: breadcrumbOf(item.parentId),
    matchedOn: matchedOn(item.title, item.content),
    snippet: item.type === 'page' ? snippetFrom(item.content) : '',
  }));

  // A row lives inside its database, so its breadcrumb is the path to that database
  // (ancestors + database name).
  const rows = dbRows.map((r) => ({
    id: r.id,
    type: 'database_row' as const,
    title: r.title,
    databaseId: r.databaseId,
    breadcrumb: breadcrumbOf(r.dbItemId),
    matchedOn: matchedOn(r.title, r.content),
    snippet: snippetFrom(r.content),
  }));

  return [...items, ...rows].slice(0, limit);
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

export async function listWorkspaceItems(
  workspaceId: string,
  parentId?: string,
  limit = 100,
  cursor?: string,
) {
  const cursorData = cursor ? decodeCursor(cursor) : null;

  const baseCondition = parentId
    ? and(eq(workspaceItems.workspaceId, workspaceId), eq(workspaceItems.parentId, parentId))
    : eq(workspaceItems.workspaceId, workspaceId);

  const cursorCondition = cursorData
    ? sql`(${workspaceItems.sortOrder} > ${cursorData.so} OR (${workspaceItems.sortOrder} = ${cursorData.so} AND ${workspaceItems.id} > ${cursorData.id}))`
    : undefined;

  const rows = await db
    .select({
      id: workspaceItems.id,
      type: workspaceItems.type,
      title: workspaceItems.title,
      parentId: workspaceItems.parentId,
      icon: workspaceItems.icon,
      sortOrder: workspaceItems.sortOrder,
      databaseId: databases.id,
    })
    .from(workspaceItems)
    .leftJoin(databases, eq(databases.itemId, workspaceItems.id))
    .where(cursorCondition ? and(baseCondition, cursorCondition) : baseCondition)
    .orderBy(asc(workspaceItems.sortOrder), asc(workspaceItems.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  return {
    items: page.map(r => ({
      id: r.id,
      type: r.type,
      title: r.title,
      parentId: r.parentId,
      icon: r.icon,
      ...(r.databaseId ? { databaseId: r.databaseId } : {}),
    })),
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(last.sortOrder, last.id) : undefined,
  };
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
  cursor?: string,
  fields?: string[],
) {
  const resolvedId = await assertDatabaseInWorkspace(databaseId, workspaceId);

  const [dbRecord] = await db
    .select({ schema: databases.schema, name: databases.name })
    .from(databases)
    .where(eq(databases.id, resolvedId))
    .limit(1);

  if (!dbRecord) throw new Error('Database not found');

  // Optional field projection — trims each row's properties (and the returned
  // schema) to the requested columns. Entries match column ids OR names
  // (case-insensitive); row markdown content is included only when 'content'
  // is explicitly requested. Cuts response payload dramatically on wide tables.
  let allowedColIds: Set<string> | null = null;
  let includeContent = true;
  let projectedSchema: typeof dbRecord.schema = dbRecord.schema;
  if (fields && fields.length > 0) {
    const schemaCols = (Array.isArray(dbRecord.schema) ? dbRecord.schema : []) as { id?: string; name?: string }[];
    const wanted = new Set(fields.map(f => f.toLowerCase()));
    includeContent = wanted.has('content');
    allowedColIds = new Set(
      schemaCols
        .filter(c =>
          (c.id != null && wanted.has(String(c.id).toLowerCase())) ||
          (c.name != null && wanted.has(String(c.name).toLowerCase())))
        .map(c => String(c.id)),
    );
    projectedSchema = schemaCols.filter(c => allowedColIds!.has(String(c.id)));
  }

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

  const cursorData = cursor ? decodeCursor(cursor) : null;
  const cursorCondition = cursorData
    ? sql`(${pages.sortOrder} > ${cursorData.so} OR (${pages.sortOrder} = ${cursorData.so} AND ${pages.id} > ${cursorData.id}))`
    : undefined;

  const allConditions = [
    eq(pages.databaseId, resolvedId),
    ...filterConditions,
    ...(cursorCondition ? [cursorCondition] : []),
  ];

  const rows = await db
    .select({
      id: pages.id,
      title: pages.title,
      properties: pages.properties,
      content: pages.content,
      sortOrder: pages.sortOrder,
    })
    .from(pages)
    .where(and(...allConditions))
    .orderBy(asc(pages.sortOrder), asc(pages.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  return {
    schema: projectedSchema,
    rows: page.map(({ sortOrder: _so, ...r }) => {
      if (!allowedColIds) return r;
      const source = (r.properties ?? {}) as Record<string, unknown>;
      const properties: Record<string, unknown> = {};
      for (const key of Object.keys(source)) {
        if (allowedColIds.has(key)) properties[key] = source[key];
      }
      return { id: r.id, title: r.title, properties, ...(includeContent ? { content: r.content } : {}) };
    }),
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(last.sortOrder, last.id) : undefined,
  };
}

/**
 * Collapses markdown to an outline: headings plus the first line of each
 * section (fenced code skipped), for token-cheap page skims. Headingless
 * content falls back to its first few lines.
 */
export function buildContentOutline(markdown: string, snippetLength = 150): string {
  const truncate = (s: string) => (s.length > snippetLength ? s.slice(0, snippetLength - 1).trimEnd() + '…' : s);
  const out: string[] = [];
  let awaitingSnippet = true; // capture the leading paragraph before any heading too
  let inCode = false;

  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) { inCode = !inCode; continue; }
    if (inCode) continue;
    if (/^#{1,6}\s/.test(trimmed)) {
      out.push(trimmed);
      awaitingSnippet = true;
      continue;
    }
    if (awaitingSnippet && trimmed) {
      out.push(truncate(trimmed));
      awaitingSnippet = false;
    }
  }

  if (out.length === 0) {
    return markdown
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .slice(0, 3)
      .map(truncate)
      .join('\n');
  }
  return out.join('\n');
}

/**
 * Compact one-line-per-item map of the whole workspace (title · type · ids ·
 * row counts · last-updated), indented by nesting. One cheap read orients an
 * agent without paginating list_workspace or fetching page bodies.
 */
export async function getWorkspaceDigest(workspaceId: string): Promise<string> {
  const [items, rowCounts] = await Promise.all([
    db
      .select({
        id: workspaceItems.id,
        type: workspaceItems.type,
        title: workspaceItems.title,
        parentId: workspaceItems.parentId,
        updatedAt: workspaceItems.updatedAt,
        sortOrder: workspaceItems.sortOrder,
        databaseId: databases.id,
      })
      .from(workspaceItems)
      .leftJoin(databases, eq(databases.itemId, workspaceItems.id))
      .where(eq(workspaceItems.workspaceId, workspaceId))
      .orderBy(asc(workspaceItems.sortOrder), asc(workspaceItems.id)),
    db
      .select({ databaseId: pages.databaseId, c: sql<number>`cast(count(*) as int)` })
      .from(pages)
      .innerJoin(databases, eq(pages.databaseId, databases.id))
      .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
      .where(eq(workspaceItems.workspaceId, workspaceId))
      .groupBy(pages.databaseId),
  ]);

  const counts = new Map(rowCounts.map(r => [r.databaseId, Number(r.c ?? 0)]));
  const byParent = new Map<string | null, typeof items>();
  for (const item of items) {
    const key = item.parentId ?? null;
    const bucket = byParent.get(key);
    if (bucket) bucket.push(item);
    else byParent.set(key, [item]);
  }

  const lines: string[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const item of byParent.get(parentId) ?? []) {
      // Legacy rows can carry CURRENT_TIMESTAMP-as-text → Invalid Date (see the
      // createdAt gotcha in AGENTS.md); omit the date segment for those.
      const updated = isValidDate(item.updatedAt) ? `, updated: ${item.updatedAt.toISOString().slice(0, 10)}` : '';
      const extra = item.type === 'database'
        ? `, databaseId: ${item.databaseId}, rows: ${counts.get(item.databaseId!) ?? 0}`
        : '';
      lines.push(`${'  '.repeat(depth)}- [${item.type}] ${item.title || 'Untitled'} (id: ${item.id}${extra}${updated})`);
      walk(item.id, depth + 1);
    }
  };
  walk(null, 0);

  const pageCount = items.filter(i => i.type === 'page').length;
  return (
    `# Workspace digest\n\n` +
    `${items.length} items (${pageCount} pages, ${items.length - pageCount} databases). Dates are last-updated (YYYY-MM-DD).\n` +
    `Read a page with get_page(id) — use mode:"outline" for a cheap skim — and rows with query_database(databaseId, fields:[…]).\n\n` +
    lines.join('\n')
  );
}

export type ChangeEntry = {
  id: string;
  type: 'page' | 'database' | 'database_row';
  title: string;
  changeType: 'created' | 'updated' | 'deleted';
  updatedAt: string;
  databaseId?: string;
};

/**
 * Compact delta feed: everything that changed in the workspace after `since`
 * (ISO timestamp) or a previous response's `nextCursor`. Merges three sources
 * — workspace items (title/content/schema edits), database rows, and delete
 * tombstones — into one time-ordered, keyset-paginated list, so a recurring
 * agent (daily report, standup, memory refresh) can sync incrementally
 * instead of re-reading the whole workspace every run.
 *
 * Item/row timestamps are read in bulk and filtered/sorted in memory (like
 * getWorkspaceDigest) rather than pushed into a SQL WHERE, because legacy rows
 * can carry CURRENT_TIMESTAMP-as-text (Invalid Date, see the createdAt gotcha
 * in AGENTS.md) that would otherwise corrupt a raw integer comparison —
 * isValidDate() guards each one and such rows sort as if last-changed at the
 * epoch, so they surface once on a full crawl and never spuriously again.
 * Tombstones are always written with a real Date, so they're filtered in SQL.
 */
export async function getChangesSince(
  workspaceId: string,
  since?: string,
  cursor?: string,
  limit = 100,
): Promise<{ changes: ChangeEntry[]; hasMore: boolean; nextCursor?: string }> {
  const cursorData = cursor ? decodeChangeCursor(cursor) : null;
  let thresholdTs = 0;
  let thresholdId = '';
  if (cursorData) {
    thresholdTs = cursorData.ts;
    thresholdId = cursorData.id;
  } else if (since) {
    const parsed = new Date(since);
    if (isValidDate(parsed)) thresholdTs = parsed.getTime();
  }

  type Candidate = {
    id: string;
    type: ChangeEntry['type'];
    title: string;
    databaseId?: string;
    effective: Date;
    created: Date;
  };
  const candidates: Candidate[] = [];

  // Source 1: workspace items (pages + databases). Effective change time is
  // the max across the item row and its content/schema sub-row, since a
  // content-only or schema-only edit never touches workspace_items.updated_at.
  const itemRows = await db
    .select({
      id: workspaceItems.id,
      type: workspaceItems.type,
      title: workspaceItems.title,
      databaseId: databases.id,
      createdAt: workspaceItems.createdAt,
      itemUpdatedAt: workspaceItems.updatedAt,
      pageUpdatedAt: standalonePages.updatedAt,
      dbUpdatedAt: databases.updatedAt,
    })
    .from(workspaceItems)
    .leftJoin(standalonePages, eq(standalonePages.itemId, workspaceItems.id))
    .leftJoin(databases, eq(databases.itemId, workspaceItems.id))
    .where(eq(workspaceItems.workspaceId, workspaceId));

  for (const r of itemRows) {
    const stamps = [r.itemUpdatedAt, r.pageUpdatedAt, r.dbUpdatedAt].filter(isValidDate);
    const effective = stamps.length ? new Date(Math.max(...stamps.map(d => d.getTime()))) : new Date(0);
    candidates.push({
      id: r.id,
      type: r.type,
      title: r.title,
      ...(r.databaseId ? { databaseId: r.databaseId } : {}),
      effective,
      created: isValidDate(r.createdAt) ? r.createdAt : new Date(0),
    });
  }

  // Source 2: database rows (each row is a page), scoped to this workspace via
  // its databases — same in-memory guard as source 1.
  const rowRows = await db
    .select({
      id: pages.id,
      title: pages.title,
      databaseId: pages.databaseId,
      createdAt: pages.createdAt,
      updatedAt: pages.updatedAt,
    })
    .from(pages)
    .innerJoin(databases, eq(pages.databaseId, databases.id))
    .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
    .where(eq(workspaceItems.workspaceId, workspaceId));

  for (const r of rowRows) {
    candidates.push({
      id: r.id,
      type: 'database_row',
      title: r.title,
      databaseId: r.databaseId,
      effective: isValidDate(r.updatedAt) ? r.updatedAt : new Date(0),
      created: isValidDate(r.createdAt) ? r.createdAt : new Date(0),
    });
  }

  const changes: ChangeEntry[] = candidates
    .filter(c => {
      const t = c.effective.getTime();
      return t > thresholdTs || (t === thresholdTs && c.id > thresholdId);
    })
    .map(c => ({
      id: c.id,
      type: c.type,
      title: c.title,
      changeType: (c.created.getTime() > thresholdTs ? 'created' : 'updated') as 'created' | 'updated',
      updatedAt: c.effective.toISOString(),
      ...(c.databaseId ? { databaseId: c.databaseId } : {}),
    }));

  // Source 3: deletion tombstones. Always written with a real Date (we control
  // every insert), so a SQL-level threshold is safe here.
  const tombstoneRows = await db
    .select({ id: deletedItems.itemId, type: deletedItems.itemType, title: deletedItems.title, deletedAt: deletedItems.deletedAt })
    .from(deletedItems)
    .where(and(eq(deletedItems.workspaceId, workspaceId), gte(deletedItems.deletedAt, new Date(thresholdTs))));

  for (const t of tombstoneRows) {
    const ts = t.deletedAt.getTime();
    if (ts === thresholdTs && t.id <= thresholdId) continue;
    changes.push({ id: t.id, type: t.type, title: t.title ?? '', changeType: 'deleted', updatedAt: t.deletedAt.toISOString() });
  }

  changes.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id));

  const hasMore = changes.length > limit;
  const page = hasMore ? changes.slice(0, limit) : changes;
  const last = page[page.length - 1];

  return {
    changes: page,
    hasMore,
    nextCursor: hasMore && last ? encodeChangeCursor(new Date(last.updatedAt).getTime(), last.id) : undefined,
  };
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

// ── Related pages (link graph) ────────────────────────────────────────────────

export type RelatedPageRef = {
  id: string;
  title: string;
  type: 'page' | 'database' | 'database_row';
  databaseId?: string;
  linkKind?: 'page_link' | 'child_block';
};

/**
 * One-call neighborhood view of a page: parent, children, outgoing links,
 * backlinks (from the page_links graph), and — for database rows — sibling
 * rows in the same database. All referenced ids are usable with get_page /
 * query_database, so an agent can walk the graph without re-reading bodies.
 */
export async function getRelatedPages(workspaceId: string, pageId: string) {
  // Resolve the subject — workspace item first, then database row.
  const [item] = await db
    .select({
      id: workspaceItems.id,
      workspaceId: workspaceItems.workspaceId,
      type: workspaceItems.type,
      title: workspaceItems.title,
      parentId: workspaceItems.parentId,
    })
    .from(workspaceItems)
    .where(eq(workspaceItems.id, pageId))
    .limit(1);

  let subject: { id: string; title: string; type: 'page' | 'database' | 'database_row'; parentId: string | null };
  let rowDatabaseId: string | null = null; // subject is a row of this database
  let itemDatabaseId: string | null = null; // subject is a database item; its databases.id

  if (item) {
    if (item.workspaceId !== workspaceId) throw new Error('Access denied');
    subject = { id: item.id, title: item.title, type: item.type, parentId: item.parentId };
    if (item.type === 'database') {
      const [d] = await db
        .select({ id: databases.id })
        .from(databases)
        .where(eq(databases.itemId, item.id))
        .limit(1);
      itemDatabaseId = d?.id ?? null;
    }
  } else {
    const [row] = await db
      .select({ id: pages.id, title: pages.title, databaseId: pages.databaseId })
      .from(pages)
      .where(eq(pages.id, pageId))
      .limit(1);
    if (!row) throw new Error('Page not found');
    await assertDatabaseInWorkspace(row.databaseId, workspaceId);
    subject = { id: row.id, title: row.title, type: 'database_row', parentId: null };
    rowDatabaseId = row.databaseId;
  }

  // Parent — for a row it's the owning database; for an item it's parentId,
  // which can point at another item OR at a database row (rows can nest items).
  let parent: RelatedPageRef | null = null;
  if (subject.type === 'database_row') {
    const [p] = await db
      .select({ id: workspaceItems.id, title: workspaceItems.title, dbId: databases.id })
      .from(databases)
      .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
      .where(eq(databases.id, rowDatabaseId!))
      .limit(1);
    if (p) parent = { id: p.id, title: p.title, type: 'database', databaseId: p.dbId };
  } else if (subject.parentId) {
    const [p] = await db
      .select({ id: workspaceItems.id, title: workspaceItems.title, type: workspaceItems.type, workspaceId: workspaceItems.workspaceId })
      .from(workspaceItems)
      .where(eq(workspaceItems.id, subject.parentId))
      .limit(1);
    if (p && p.workspaceId === workspaceId) {
      parent = { id: p.id, title: p.title, type: p.type };
    } else if (!p) {
      const [pr] = await db
        .select({ id: pages.id, title: pages.title, ws: workspaceItems.workspaceId })
        .from(pages)
        .innerJoin(databases, eq(pages.databaseId, databases.id))
        .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
        .where(eq(pages.id, subject.parentId))
        .limit(1);
      if (pr && pr.ws === workspaceId) parent = { id: pr.id, title: pr.title, type: 'database_row' };
    }
  }

  const children: RelatedPageRef[] = (
    await db
      .select({ id: workspaceItems.id, title: workspaceItems.title, type: workspaceItems.type })
      .from(workspaceItems)
      .where(and(eq(workspaceItems.parentId, subject.id), eq(workspaceItems.workspaceId, workspaceId)))
      .orderBy(asc(workspaceItems.sortOrder), asc(workspaceItems.id))
      .limit(100)
  ).map(c => ({ id: c.id, title: c.title, type: c.type }));

  const outgoingRows = await db
    .select({ toId: pageLinks.toId, linkKind: pageLinks.linkKind })
    .from(pageLinks)
    .where(and(eq(pageLinks.fromId, subject.id), eq(pageLinks.workspaceId, workspaceId)))
    .limit(100);

  // A database target may be stored under either id form (databases.id from a
  // /db/<dbId> href, workspace item id from a childBlock) — match both.
  const subjectIds = itemDatabaseId ? [subject.id, itemDatabaseId] : [subject.id];
  const backlinkRows = await db
    .select({ fromId: pageLinks.fromId, linkKind: pageLinks.linkKind })
    .from(pageLinks)
    .where(and(inArray(pageLinks.toId, subjectIds), eq(pageLinks.workspaceId, workspaceId)))
    .limit(100);

  // Resolve stored link ids (any of the three id forms) to workspace-scoped
  // refs. Dangling ids (deleted targets) and foreign-workspace ids drop out.
  const resolveMany = async (ids: string[]): Promise<Map<string, RelatedPageRef>> => {
    const out = new Map<string, RelatedPageRef>();
    if (ids.length === 0) return out;

    const items = await db
      .select({ id: workspaceItems.id, title: workspaceItems.title, type: workspaceItems.type })
      .from(workspaceItems)
      .where(and(inArray(workspaceItems.id, ids), eq(workspaceItems.workspaceId, workspaceId)));
    for (const i of items) out.set(i.id, { id: i.id, title: i.title, type: i.type });

    const dbItemIds = items.filter(i => i.type === 'database').map(i => i.id);
    if (dbItemIds.length) {
      const dbs = await db
        .select({ id: databases.id, itemId: databases.itemId })
        .from(databases)
        .where(inArray(databases.itemId, dbItemIds));
      for (const d of dbs) {
        const ref = d.itemId ? out.get(d.itemId) : undefined;
        if (ref) ref.databaseId = d.id;
      }
    }

    let missing = ids.filter(id => !out.has(id));
    if (missing.length) {
      const dbRows = await db
        .select({ dbId: databases.id, itemId: workspaceItems.id, title: workspaceItems.title })
        .from(databases)
        .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
        .where(and(inArray(databases.id, missing), eq(workspaceItems.workspaceId, workspaceId)));
      for (const d of dbRows) out.set(d.dbId, { id: d.itemId, title: d.title, type: 'database', databaseId: d.dbId });
    }

    missing = ids.filter(id => !out.has(id));
    if (missing.length) {
      const rowRows = await db
        .select({ id: pages.id, title: pages.title })
        .from(pages)
        .innerJoin(databases, eq(pages.databaseId, databases.id))
        .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
        .where(and(inArray(pages.id, missing), eq(workspaceItems.workspaceId, workspaceId)));
      for (const r of rowRows) out.set(r.id, { id: r.id, title: r.title, type: 'database_row' });
    }

    return out;
  };

  const refMap = await resolveMany([
    ...new Set([...outgoingRows.map(r => r.toId), ...backlinkRows.map(r => r.fromId)]),
  ]);

  // Children are already reported under `children`; the parent embedding this
  // page is already reported as `parent` — skip both to keep categories disjoint.
  const childIds = new Set(children.map(c => c.id));
  const outgoingLinks: RelatedPageRef[] = [];
  const seenOut = new Set<string>();
  for (const r of outgoingRows) {
    const ref = refMap.get(r.toId);
    if (!ref || ref.id === subject.id || childIds.has(ref.id) || seenOut.has(ref.id)) continue;
    seenOut.add(ref.id);
    outgoingLinks.push({ ...ref, linkKind: r.linkKind });
  }

  const backlinks: RelatedPageRef[] = [];
  const seenBack = new Set<string>();
  for (const r of backlinkRows) {
    const ref = refMap.get(r.fromId);
    if (!ref || ref.id === subject.id || (parent && ref.id === parent.id) || seenBack.has(ref.id)) continue;
    seenBack.add(ref.id);
    backlinks.push({ ...ref, linkKind: r.linkKind });
  }

  let siblings: { total: number; items: { id: string; title: string }[] } | null = null;
  if (subject.type === 'database_row' && rowDatabaseId) {
    const [cnt] = await db
      .select({ n: sql<number>`count(*)` })
      .from(pages)
      .where(eq(pages.databaseId, rowDatabaseId));
    const sibRows = await db
      .select({ id: pages.id, title: pages.title })
      .from(pages)
      .where(and(eq(pages.databaseId, rowDatabaseId), ne(pages.id, subject.id)))
      .orderBy(asc(pages.sortOrder), asc(pages.id))
      .limit(10);
    siblings = { total: Math.max(0, Number(cnt?.n ?? 1) - 1), items: sibRows };
  }

  return {
    page: { id: subject.id, title: subject.title, type: subject.type },
    parent,
    children,
    outgoingLinks,
    backlinks,
    siblings,
  };
}

export async function bulkUpdatePages(
  workspaceId: string,
  updates: { pageId: string; title?: string; content?: string; properties?: Record<string, unknown> }[],
  agentCtx?: { tokenId: string },
) {
  const results = await Promise.all(
    updates.map(({ pageId, ...patch }) => updatePageById(workspaceId, pageId, patch, agentCtx)),
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
    iconColor?: string;
  },
  agentCtx?: { tokenId: string },
) {
  if (input.databaseId) {
    // Database row — resolve workspace_items.id → databases.id if needed
    const resolvedDbId = await assertDatabaseInWorkspace(input.databaseId, workspaceId);

    const existing = await db
      .select({ sortOrder: pages.sortOrder })
      .from(pages)
      .where(eq(pages.databaseId, resolvedDbId));
    const maxSort = existing.reduce((max, p) => (p.sortOrder > max ? p.sortOrder : max), 0);

    const resolvedProps = input.properties
      ? await resolvePropertiesBySchema(resolvedDbId, input.properties)
      : {};

    const id = crypto.randomUUID();
    const now = new Date();
    await db.insert(pages).values({
      id,
      databaseId: resolvedDbId,
      title: input.title,
      content: input.content ?? '',
      properties: { title: input.title, ...resolvedProps },
      sortOrder: maxSort + 1,
      createdAt: now,
      updatedAt: now,
      ...(agentCtx ? { agentEditedAt: now, agentTokenId: agentCtx.tokenId } : {}),
    });
    if (input.content) await syncPageLinks(workspaceId, id, 'database_row', input.content);
    return { id, type: 'db-row' as const };
  }

  // Standalone page
  if (input.parentId) {
    await assertItemInWorkspace(input.parentId, workspaceId);
  }

  const itemId = crypto.randomUUID();
  const pageId = crypto.randomUUID();
  const now = new Date();

  await db.insert(workspaceItems).values({
    id: itemId,
    workspaceId,
    type: 'page',
    title: input.title,
    parentId: input.parentId ?? null,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    ...(input.iconColor ? { iconColor: input.iconColor } : {}),
  });

  await db.insert(standalonePages).values({
    id: pageId,
    itemId,
    content: input.content ?? '',
    createdAt: now,
    updatedAt: now,
  });

  if (input.content) await syncPageLinks(workspaceId, itemId, 'page', input.content);

  // Auto-share child if parent is shared
  if (input.parentId) {
    autoShareIfParentShared(itemId, input.parentId, agentCtx?.tokenId ?? 'system').catch(() => {});
  }

  return { id: itemId, type: 'page' as const };
}

async function autoShareIfParentShared(itemId: string, parentId: string, createdBy: string): Promise<void> {
  const [parentShare] = await db
    .select({ permission: sharedPages.permission, width: sharedPages.width, workspaceId: sharedPages.workspaceId, inSitemap: sharedPages.inSitemap })
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
    workspaceId: parentShare.workspaceId,
    permission: parentShare.permission,
    width: parentShare.width ?? 'narrow',
    inSitemap: Boolean(parentShare.inSitemap),
    createdBy,
    createdAt: new Date(),
  });
}

// ── Internal recursive delete ─────────────────────────────────────────────────

/**
 * Best-effort tombstone insert so get_changes_since can report a deletion —
 * a lost tombstone degrades delta-sync freshness, not data integrity, so
 * failures are swallowed rather than surfaced to the caller of the delete.
 * Exported so the web-UI delete actions (actions/workspace.ts, actions/page.ts)
 * can write the same tombstones the MCP delete path does.
 */
export async function recordDeletionTombstone(
  workspaceId: string,
  itemId: string,
  itemType: 'page' | 'database' | 'database_row',
  title: string,
): Promise<void> {
  try {
    await db.insert(deletedItems).values({
      workspaceId,
      itemId,
      itemType,
      title,
      deletedAt: new Date(),
    });
  } catch {
    // Swallow — see doc comment above.
  }
}

async function deleteWorkspaceItemAndDescendants(
  workspaceId: string,
  itemId: string,
  type: 'page' | 'database',
  title: string,
) {
  const children = await db
    .select({ id: workspaceItems.id, type: workspaceItems.type, title: workspaceItems.title })
    .from(workspaceItems)
    .where(eq(workspaceItems.parentId, itemId));

  for (const child of children) {
    await deleteWorkspaceItemAndDescendants(workspaceId, child.id, child.type, child.title);
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

export async function deleteItemFromWorkspace(workspaceId: string, itemId: string) {
  const [item] = await db
    .select({ workspaceId: workspaceItems.workspaceId, type: workspaceItems.type, title: workspaceItems.title })
    .from(workspaceItems)
    .where(eq(workspaceItems.id, itemId))
    .limit(1);

  if (item) {
    if (item.workspaceId !== workspaceId) throw new Error('Access denied');
    await deleteWorkspaceItemAndDescendants(workspaceId, itemId, item.type, item.title);
    return { deleted: true, type: item.type as 'page' | 'database' };
  }

  const [page] = await db
    .select({ databaseId: pages.databaseId, title: pages.title })
    .from(pages)
    .where(eq(pages.id, itemId))
    .limit(1);

  if (!page) throw new Error('Item not found');
  await assertDatabaseInWorkspace(page.databaseId, workspaceId);
  await db.delete(pages).where(eq(pages.id, itemId));
  await recordDeletionTombstone(workspaceId, itemId, 'database_row', page.title);
  await removePageLinksFor(itemId);
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
    iconColor?: string;
  },
) {
  if (input.parentId) {
    await assertItemInWorkspace(input.parentId, workspaceId);
  }

  const itemId = crypto.randomUUID();
  const dbId = crypto.randomUUID();

  const rawSchema: any[] = input.schema?.length
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

  const resolvedSchema = normalizeSchemaColumns(rawSchema);

  if (!resolvedSchema.some((c: any) => c.id === 'title')) {
    resolvedSchema.unshift({ id: 'title', name: 'Title', type: 'text' });
  }

  const now = new Date();

  await db.insert(workspaceItems).values({
    id: itemId,
    workspaceId,
    type: 'database',
    title: input.name,
    parentId: input.parentId ?? null,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    ...(input.iconColor ? { iconColor: input.iconColor } : {}),
  });

  await db.insert(databases).values({
    id: dbId,
    name: input.name,
    itemId,
    schema: resolvedSchema,
    views: null,
    createdAt: now,
    updatedAt: now,
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
    const added = normalizeSchemaColumns(
      changes.addColumns.map(col => ({
        id: `col_${crypto.randomUUID().slice(0, 8)}`,
        name: col.name,
        type: col.type,
        ...(col.options ? { options: col.options } : {}),
      })),
    );
    newSchema = [...newSchema, ...added];
  }

  await db.update(databases)
    .set({ schema: newSchema, updatedAt: new Date() })
    .where(eq(databases.id, resolvedId));

  return { updated: true, schema: newSchema };
}

async function resolvePropertiesBySchema(
  databaseId: string,
  properties: Record<string, any>,
): Promise<Record<string, any>> {
  const [dbRecord] = await db
    .select({ schema: databases.schema })
    .from(databases)
    .where(eq(databases.id, databaseId))
    .limit(1);

  const schema: Array<{ id: string; name: string }> = dbRecord?.schema ?? [];
  const nameToId = new Map(schema.map(col => [col.name.toLowerCase(), col.id]));

  const resolved: Record<string, any> = {};
  for (const [key, value] of Object.entries(properties)) {
    const colId = nameToId.get(key.toLowerCase());
    resolved[colId ?? key] = value;
  }
  return resolved;
}

export async function updatePageById(
  workspaceId: string,
  itemId: string,
  patch: { title?: string; content?: string; properties?: Record<string, any> },
  agentCtx?: { tokenId: string },
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
      if (item.type === 'database') {
        await db
          .update(databases)
          .set({ name: patch.title, updatedAt: new Date() })
          .where(eq(databases.itemId, itemId));
      }
    }
    if (patch.content !== undefined && item.type === 'page') {
      await db
        .update(standalonePages)
        .set({ content: patch.content, updatedAt: new Date() })
        .where(eq(standalonePages.itemId, itemId));
      await syncPageLinks(workspaceId, itemId, 'page', patch.content);
    }
    return { updated: true };
  }

  // Try as DB row (pages table)
  const [page] = await db
    .select({ databaseId: pages.databaseId, properties: pages.properties })
    .from(pages)
    .where(eq(pages.id, itemId))
    .limit(1);

  if (!page) throw new Error('Page not found');
  await assertDatabaseInWorkspace(page.databaseId, workspaceId);

  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (patch.title !== undefined) updateData.title = patch.title;
  if (patch.content !== undefined) updateData.content = patch.content;
  if (patch.properties !== undefined) {
    const resolved = await resolvePropertiesBySchema(page.databaseId, patch.properties);
    updateData.properties = { ...(page.properties ?? {}), ...resolved };
  }
  if (agentCtx) {
    updateData.agentEditedAt = new Date();
    updateData.agentTokenId = agentCtx.tokenId;
  }

  await db.update(pages).set(updateData).where(eq(pages.id, itemId));
  if (patch.content !== undefined) await syncPageLinks(workspaceId, itemId, 'database_row', patch.content);
  return { updated: true };
}
