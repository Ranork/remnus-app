/**
 * Cookie-free service layer for MCP tool handlers.
 * All functions take an explicit workspaceId and verify ownership without touching
 * Next.js session cookies. Every function enforces workspace isolation.
 */
import { db } from '@/db';
import { exdateOccurrenceForPage, getOccurrenceInfo } from '@/lib/services/recurrence';
import {
  workspaceItems,
  standalonePages,
  databases,
  dashboards,
  pages,
  workspaceMembers,
  users,
  agentActivity,
  agentTokens,
  oauthAccessTokens,
  sharedPages,
  deletedItems,
  pageLinks,
  pageComments,
} from '@/db/schema';
import { eq, ne, and, or, asc, desc, gte, lte, sql, inArray } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { syncPageLinks, syncPageLinksBulk, removePageLinksFor, purgeReferencesTo } from './pageLinks';
import { snapshotBeforeDelete, maybeSnapshotContentUpdate, type SnapshotActor } from './snapshots';
import { recordGeneratedKnowledgeBulk, type KnowledgeMetadataInput } from './knowledge';
import { activityAtOrAfter, auditVisibleSince } from './auditRetention';
import { chunkRows } from './sqlChunk';
import { computeChangeVersion } from './changeVersion';
import { foldText, foldTextWithOffsets, foldingSearchPatterns } from './textFold';
import { iconInputError } from '@/lib/icons';
import type { StatusGroup } from '@/lib/types/properties';

export type { SnapshotActor } from './snapshots';

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

// Agents copy option shapes from other tools — Notion's `{ name, color }` above all —
// so `name`/`label` count as the value. Before this, `{ name }` was stored as the
// literal text "[object Object]" (found in the P9.5 calibration field test).
const OPTION_TEXT_KEYS = ['value', 'name', 'label'] as const;

const STATUS_GROUP_ALIASES: Record<string, StatusGroup> = {
  todo: 'todo', 'to do': 'todo', to_do: 'todo', not_started: 'todo', 'not started': 'todo',
  in_progress: 'in_progress', 'in progress': 'in_progress', doing: 'in_progress',
  complete: 'complete', completed: 'complete', done: 'complete',
};

function autoColorOptions(options: any[], columnName: string): { value: string; color: string; group?: string }[] {
  return options.map((opt, i) => {
    const isObject = typeof opt === 'object' && opt !== null;
    const value = typeof opt === 'string'
      ? opt
      : isObject ? OPTION_TEXT_KEYS.map((k) => opt[k]).find((v) => typeof v === 'string' && v.trim()) : undefined;
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(
        `Option ${i + 1} of column "${columnName}" has no text. ` +
        `Pass a string, or { value: "Name", group: "todo" | "in_progress" | "complete" } for a status option.`,
      );
    }
    const color = isObject && opt.color ? opt.color : COLOR_CYCLE[i % COLOR_CYCLE.length];
    // Preserve the status group when present (status columns).
    let group: StatusGroup | undefined;
    if (isObject && opt.group) {
      group = STATUS_GROUP_ALIASES[String(opt.group).trim().toLowerCase()];
      if (!group) {
        throw new Error(
          `Option "${value}" of column "${columnName}" has an unknown group "${opt.group}". ` +
          `Use "todo", "in_progress" or "complete".`,
        );
      }
    }
    return group ? { value, color, group } : { value, color };
  });
}

function normalizeSchemaColumns(
  cols: Array<{ id?: string; name: string; type: string; options?: any[] }>,
): any[] {
  return cols.map(col => ({
    ...col,
    ...(col.options && (col.type === 'select' || col.type === 'multi_select' || col.type === 'status')
      ? { options: autoColorOptions(col.options, col.name) }
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
  // The plan's audit window (services/auditRetention.ts); a `from` earlier than it
  // simply finds nothing older.
  const conditions = [
    eq(agentActivity.workspaceId, workspaceId),
    activityAtOrAfter(await auditVisibleSince(workspaceId)),
  ];

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
  // Case- AND accent-insensitive: "cozum" finds "Çözüm Notları", "istanbul"
  // finds "İstanbul Ofisi" — see foldingSearchPatterns for the LIKE + GLOB pair.
  const patterns = foldingSearchPatterns(query);
  const matches = (column: SQLiteColumn) =>
    sql`(${column} LIKE ${patterns.like} ESCAPE '\\' AND ${column} GLOB ${patterns.glob})`;
  const q = foldText(query);

  const snippetFrom = (content: string | null | undefined): string => {
    if (!content) return '';
    const { folded, offsets } = foldTextWithOffsets(content);
    const at = q ? folded.indexOf(q) : -1;
    const idx = at >= 0 ? offsets[at] : -1;
    const slice = idx >= 0
      ? content.slice(Math.max(0, idx - 40), idx + 80)
      : content.slice(0, 100);
    return slice.replace(/\n/g, ' ').trim();
  };

  const matchedOn = (title: string | null, content: string | null): 'title' | 'content' =>
    title && foldText(title).includes(q) ? 'title' : 'content';

  // The three reads are independent: one db.batch, one round-trip.
  const [itemRows, dbRows, treeRows] = await db.batch([
    // Sidebar items (standalone pages + databases): match on title OR page content.
    db
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
            matches(workspaceItems.title),
            matches(standalonePages.content),
          ),
        ),
      )
      .orderBy(asc(workspaceItems.sortOrder))
      .limit(limit),
    // Database rows (each row is a page): match on title OR content, scoped to the
    // workspace via databases -> workspace_items. Without this, rows of a database
    // (e.g. tasks in a tracker) are invisible to search.
    db
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
            matches(pages.title),
            matches(pages.content),
          ),
        ),
      )
      .limit(limit),
    // Resolve a location breadcrumb (root -> ... -> parent) for any item by walking
    // the parent_id chain over a lightweight in-memory map of the workspace tree.
    db
      .select({ id: workspaceItems.id, parentId: workspaceItems.parentId, title: workspaceItems.title })
      .from(workspaceItems)
      .where(eq(workspaceItems.workspaceId, workspaceId)),
  ]);
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

  if (item.type === 'dashboard') {
    // Reading a dashboard returns its spec as the body. Without this branch it
    // fell through to the database case below and came back claiming to be a
    // database with a null databaseId — a silent lie to every MCP reader.
    const [dash] = await db
      .select({ spec: dashboards.spec })
      .from(dashboards)
      .where(eq(dashboards.itemId, itemId))
      .limit(1);
    // Compact on purpose: this string is what an agent pays for, and
    // indentation alone added about a third to it.
    return {
      id: item.id,
      type: 'dashboard' as const,
      title: item.title,
      content: dash ? JSON.stringify(dash.spec) : '',
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

  // Series membership travels with the row so an agent can tell it is editing
  // one occurrence of many — and that changing the rhythm needs a scope —
  // instead of treating it as a standalone task.
  const recurrence = await getOccurrenceInfo(page).catch(() => undefined);

  return {
    id: page.id,
    type: 'page' as const,
    title: page.title,
    content: page.content,
    icon: page.icon,
    properties: page.properties,
    databaseId: page.databaseId,
    ...(recurrence ? { recurrence } : {}),
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
    .select({ schema: databases.schema, name: databases.name, views: databases.views })
    .from(databases)
    .where(eq(databases.id, resolvedId))
    .limit(1);

  if (!dbRecord) throw new Error('Database not found');
  return { name: dbRecord.name, schema: dbRecord.schema, views: seedDefaultViews(dbRecord.views as any[] | null) };
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
  // (case-insensitive). Row markdown bodies are opt-in: included only when
  // 'content' is explicitly requested in fields (with or without a projection),
  // so unprojected queries stay cheap by default (bodies flipped to opt-in 2026-07-08).
  let allowedColIds: Set<string> | null = null;
  let includeContent = false;
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
  //
  // The two branches need DIFFERENT JSON accessors, not the same one twice:
  // json_extract (and ->>) DEQUOTES scalar leaf values ('"Done"' -> Done), which is
  // exactly what the equality branch wants (compares against a plain JS string param).
  // But feeding that same dequoted text into json_each() breaks — json_each requires
  // well-formed JSON, and a bare `Done` isn't valid JSON, so SQLite throws
  // "SQLITE_ERROR: malformed JSON" for every scalar-column filter (status/select/text/
  // number). Array values are unaffected (json_extract doesn't dequote arrays), which is
  // why multi_select filters ({"col_tags": ["Bug"]}) always worked and this went unnoticed.
  // Fix: use the `->` operator for the json_each argument — it preserves JSON encoding
  // (returns '"Done"', still valid JSON) instead of dequoting.
  const filterConditions = filters
    ? Object.entries(filters).map(([key, value]) =>
        sql`(
          json_extract(${pages.properties}, ${'$.' + key}) = ${value}
          OR EXISTS (
            SELECT 1 FROM json_each(${pages.properties} -> ${'$.' + key})
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
      // Series membership only — NOT the rule. A full rule per row would cost
      // ~25 tokens × page size; the marker tells an agent "this is one of many,
      // fetch get_page before changing the rhythm", which is the decision it
      // actually needs to make here.
      seriesId: pages.seriesId,
      seriesDetached: pages.seriesDetached,
    })
    .from(pages)
    .where(and(...allConditions))
    .orderBy(asc(pages.sortOrder), asc(pages.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  // One grouped query for the whole page of rows rather than N — costs
  // ~nothing, and a database with no commented rows pays for it once with an
  // empty result.
  const commentCounts = page.length > 0
    ? new Map(
        (
          await db
            .select({ pageId: pageComments.pageId, n: sql<number>`count(*)` })
            .from(pageComments)
            .where(inArray(pageComments.pageId, page.map((r) => r.id)))
            .groupBy(pageComments.pageId)
        ).map((r) => [r.pageId, Number(r.n)]),
      )
    : new Map<string, number>();

  const shapeRows = (projected: boolean) => page.map(({ sortOrder: _so, content, seriesId, seriesDetached, ...r }) => {
    let properties = (r.properties ?? {}) as Record<string, unknown>;
    if (projected && allowedColIds) {
      const trimmed: Record<string, unknown> = {};
      for (const key of Object.keys(properties)) {
        if (allowedColIds.has(key)) trimmed[key] = properties[key];
      }
      properties = trimmed;
    }
    const commentCount = commentCounts.get(r.id);
    return {
      id: r.id,
      title: r.title,
      properties,
      ...(includeContent ? { content } : {}),
      // Absent on ordinary rows, so a database with no recurring rows pays
      // nothing for this.
      ...(seriesId ? { recurring: true, ...(seriesDetached ? { recurringDetached: true } : {}) } : {}),
      // Absent when the row has no comments — a database with none pays
      // nothing for this either.
      ...(commentCount ? { commentCount } : {}),
    };
  });

  const result = {
    schema: projectedSchema,
    rows: shapeRows(true),
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(last.sortOrder, last.id) : undefined,
  };

  // What this same query would have returned WITHOUT the projection — every
  // column of every row, plus the full schema. Serialized from rows already in
  // memory, so it is an exact byte count, never an estimate. The savings card
  // sums these (AGENTS.md → "Agent Savings Metrics"); callers that serialize the
  // result strip the key first.
  const baselineBytes = allowedColIds
    ? Buffer.byteLength(JSON.stringify({ ...result, schema: dbRecord.schema, rows: shapeRows(false) }), 'utf8')
    : undefined;

  return { ...result, baselineBytes };
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
/**
 * The workspace map, plus what skipping it would have cost.
 *
 * `naiveBytes` is the size of the only other way to learn the same thing —
 * reading every page body and every database row. Summed with SQL `length()`
 * over the exact same rows the digest is built from, so it is measured, not
 * estimated. See AGENTS.md → "Agent Savings Metrics".
 */
export async function getWorkspaceDigest(workspaceId: string): Promise<{ text: string; naiveBytes: number }> {
  // The cursor is taken BEFORE the item queries, so anything written while the
  // digest is being assembled has a timestamp at or after it and shows up in the
  // next get_changes_since(cursor) call rather than falling between the two.
  const cursor = await getChangeHeadCursor(workspaceId);
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
        contentChars: sql<number | null>`length(${standalonePages.content})`,
      })
      .from(workspaceItems)
      .leftJoin(databases, eq(databases.itemId, workspaceItems.id))
      .leftJoin(standalonePages, eq(standalonePages.itemId, workspaceItems.id))
      .where(eq(workspaceItems.workspaceId, workspaceId))
      // Same order as the sidebar (actions/workspace.ts): new items all get sortOrder 0,
      // so the tie-break decides what comes first. Ordering by id instead showed agents a
      // shuffled tree, and calibration's "overview first" check could not be trusted.
      .orderBy(asc(workspaceItems.sortOrder), asc(workspaceItems.createdAt), asc(workspaceItems.id)),
    db
      .select({
        databaseId: pages.databaseId,
        c: sql<number>`cast(count(*) as int)`,
        bytes: sql<number>`cast(coalesce(sum(length(${pages.title}) + length(${pages.content}) + length(${pages.properties})), 0) as int)`,
      })
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
      // Body size lets an agent pick get_page mode:"outline" for a long page up
      // front instead of paying for a full read to find out it was long.
      const extra = item.type === 'database'
        ? `, databaseId: ${item.databaseId}, rows: ${counts.get(item.databaseId!) ?? 0}`
        // A dashboard has no markdown body, so a char count would always read 0
        // and invite a pointless get_page for it.
        : item.type === 'dashboard'
          ? ''
          : `, ${formatChars(item.contentChars ?? 0)}`;
      lines.push(`${'  '.repeat(depth)}- [${item.type}] ${item.title || 'Untitled'} (id: ${item.id}${extra}${updated})`);
      walk(item.id, depth + 1);
    }
  };
  walk(null, 0);

  const pageCount = items.filter(i => i.type === 'page').length;
  const databaseCount = items.filter(i => i.type === 'database').length;
  const dashboardCount = items.length - pageCount - databaseCount;
  // Reading the workspace the long way = every page body and title, plus every
  // row of every database. Both halves come straight off the queries above.
  const naiveBytes =
    items.reduce((sum, i) => sum + (i.contentChars ?? 0) + (i.title?.length ?? 0), 0) +
    rowCounts.reduce((sum, r) => sum + Number(r.bytes ?? 0), 0);

  const text =
    `# Workspace digest\n\n` +
    `cursor: ${cursor}\n` +
    `${items.length} items (${pageCount} pages, ${databaseCount} databases${dashboardCount ? `, ${dashboardCount} dashboards` : ''}). Dates are last-updated (YYYY-MM-DD); chars = body size.\n` +
    `Read a page with get_page(id) — mode:"outline" for a cheap skim of a long one — and rows with query_database(databaseId, fields:[…]).\n` +
    `Later, sync with get_changes_since(cursor) instead of re-reading this.\n\n` +
    lines.join('\n');

  return { text, naiveBytes };
}

function formatChars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k chars` : `${n} chars`;
}

/**
 * A get_changes_since cursor positioned at the workspace's newest change, for a
 * caller that has just read the current state (the digest, a local map) and wants
 * to pick up only what happens next. Built from the same monotonic max the live
 * UI polls, so it moves on deletes too.
 */
export async function getChangeHeadCursor(workspaceId: string): Promise<string> {
  const seconds = await computeChangeVersion([workspaceId]);
  return settledCursor(seconds * 1000);
}

// Timestamps are second-granular and writers concurrent, so a cursor that sits
// on the newest second has to decide whether more writes can still land in it.
// Within this margin of "now" the second is hot: the id half is left empty so
// entries stamped in it are reported once more next time rather than risk a
// miss (the keyset filter is `ts > cursor.ts || (ts == cursor.ts && id > cursor.id)`).
// Once the second is older than the margin, nothing new can be stamped with it
// and the id half becomes '~' — above every uuid — so an idle poll returns
// nothing instead of replaying the last second's writes forever.
const HOT_SECOND_MS = 2_000;

function settledCursor(ts: number, hotId = ''): string {
  return encodeChangeCursor(ts, Date.now() - ts >= HOT_SECOND_MS ? '~' : hotId);
}

export type ChangeEntry = {
  id: string;
  type: 'page' | 'database' | 'database_row' | 'dashboard';
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
): Promise<{ changes: ChangeEntry[]; hasMore: boolean; nextCursor: string }> {
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

  // A cursor comes back on every call, not only when there is another page:
  // the point of the feed is to save the cursor and ask for the delta next
  // time, and a bootstrap that fit in one page had nothing to save before.
  // Mid-pagination it is a keyset (ts + id) so the next page starts exactly
  // after this one. At the end it is going to be kept for a while, so it is
  // settled the same way as the digest's head cursor (see settledCursor).
  let nextCursor: string;
  if (hasMore && last) nextCursor = encodeChangeCursor(new Date(last.updatedAt).getTime(), last.id);
  else if (last) nextCursor = settledCursor(new Date(last.updatedAt).getTime());
  else nextCursor = settledCursor(thresholdTs, thresholdId); // nothing new: keep the caller's position

  return { changes: page, hasMore, nextCursor };
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

// Batch counterpart to getAnyPageById, for a specific known list of IDs (e.g. from
// search_workspace, get_related_pages, or get_changes_since) that may span multiple
// databases or mix standalone pages with database rows. Deliberately uses allSettled
// (not all, unlike bulkUpdatePages) — a read batch shouldn't lose every other id just
// because one is deleted/inaccessible; each entry reports its own ok/error instead.
export async function getPagesByIds(workspaceId: string, pageIds: string[]) {
  const settled = await Promise.allSettled(pageIds.map(id => getAnyPageById(workspaceId, id)));
  return settled.map((r, i) =>
    r.status === 'fulfilled'
      ? { id: pageIds[i], ok: true as const, page: r.value }
      : { id: pageIds[i], ok: false as const, error: String(r.reason) },
  );
}

// ── Related pages (link graph) ────────────────────────────────────────────────

export type RelatedPageRef = {
  id: string;
  title: string;
  /** 'dashboard' only ever appears as a parent/child in the tree walk — the
   *  page_links graph itself never records one (see editor/pageLinkData.ts). */
  type: 'page' | 'database' | 'database_row' | 'dashboard';
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
  // Everything that depends only on `pageId` ships in ONE batch — the subject
  // (as an item and as a row), both parent candidates, children, links and the
  // sibling window — and is sorted out in memory below. It used to be ~9
  // sequential awaits, and prepare_context pays for this call on every pack.
  // Reading before the access check is safe: every neighbour query is itself
  // scoped to `workspaceId`, and nothing is returned until the subject passes.
  const parentIdOf = db.select({ id: workspaceItems.parentId }).from(workspaceItems).where(eq(workspaceItems.id, pageId));
  const rowDatabaseIdOf = db.select({ id: pages.databaseId }).from(pages).where(eq(pages.id, pageId));
  // A database target may be stored under either id form (databases.id from a
  // /db/<dbId> href, workspace item id from a childBlock) — match both.
  const databaseIdOfItem = db.select({ id: databases.id }).from(databases).where(eq(databases.itemId, pageId));

  const [itemRows, rowRows, parentItemRows, parentRowRows, childRows, outgoingRows, backlinkRows, siblingCountRows, siblingRows] = await db.batch([
    db
      .select({
        id: workspaceItems.id,
        workspaceId: workspaceItems.workspaceId,
        type: workspaceItems.type,
        title: workspaceItems.title,
        parentId: workspaceItems.parentId,
      })
      .from(workspaceItems)
      .where(eq(workspaceItems.id, pageId))
      .limit(1),
    // Left joins so a row whose database (or its item) is gone is still told
    // apart from a missing row: the former is an access error, not "not found".
    db
      .select({
        id: pages.id,
        title: pages.title,
        databaseId: pages.databaseId,
        ws: workspaceItems.workspaceId,
        dbItemId: workspaceItems.id,
        dbItemTitle: workspaceItems.title,
      })
      .from(pages)
      .leftJoin(databases, eq(pages.databaseId, databases.id))
      .leftJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
      .where(eq(pages.id, pageId))
      .limit(1),
    // Parent of an item: parentId can point at another item OR at a database
    // row (rows can nest items), so both candidates are read.
    db
      .select({ id: workspaceItems.id, title: workspaceItems.title, type: workspaceItems.type, workspaceId: workspaceItems.workspaceId })
      .from(workspaceItems)
      .where(inArray(workspaceItems.id, parentIdOf))
      .limit(1),
    db
      .select({ id: pages.id, title: pages.title, ws: workspaceItems.workspaceId })
      .from(pages)
      .innerJoin(databases, eq(pages.databaseId, databases.id))
      .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
      .where(inArray(pages.id, parentIdOf))
      .limit(1),
    db
      .select({ id: workspaceItems.id, title: workspaceItems.title, type: workspaceItems.type })
      .from(workspaceItems)
      .where(and(eq(workspaceItems.parentId, pageId), eq(workspaceItems.workspaceId, workspaceId)))
      .orderBy(asc(workspaceItems.sortOrder), asc(workspaceItems.id))
      .limit(100),
    db
      .select({ toId: pageLinks.toId, linkKind: pageLinks.linkKind })
      .from(pageLinks)
      .where(and(eq(pageLinks.fromId, pageId), eq(pageLinks.workspaceId, workspaceId)))
      .limit(100),
    db
      .select({ fromId: pageLinks.fromId, linkKind: pageLinks.linkKind })
      .from(pageLinks)
      .where(and(
        or(eq(pageLinks.toId, pageId), inArray(pageLinks.toId, databaseIdOfItem)),
        eq(pageLinks.workspaceId, workspaceId),
      ))
      .limit(100),
    // Siblings only mean something for a row; for an item the subquery is NULL
    // and both statements come back empty.
    db
      .select({ n: sql<number>`count(*)` })
      .from(pages)
      .where(inArray(pages.databaseId, rowDatabaseIdOf)),
    db
      .select({ id: pages.id, title: pages.title })
      .from(pages)
      .where(and(inArray(pages.databaseId, rowDatabaseIdOf), ne(pages.id, pageId)))
      .orderBy(asc(pages.sortOrder), asc(pages.id))
      .limit(10),
  ]);

  let subject: { id: string; title: string; type: 'page' | 'database' | 'database_row' | 'dashboard' };
  let parent: RelatedPageRef | null = null;
  const item = itemRows[0];
  if (item) {
    if (item.workspaceId !== workspaceId) throw new Error('Access denied');
    subject = { id: item.id, title: item.title, type: item.type };
    if (item.parentId) {
      const p = parentItemRows[0];
      const pr = parentRowRows[0];
      if (p && p.workspaceId === workspaceId) parent = { id: p.id, title: p.title, type: p.type };
      else if (!p && pr && pr.ws === workspaceId) parent = { id: pr.id, title: pr.title, type: 'database_row' };
    }
  } else {
    const row = rowRows[0];
    if (!row) throw new Error('Page not found');
    // Same verdict assertDatabaseInWorkspace gave: the row's database must sit
    // on an item of this workspace.
    if (!row.dbItemId || row.ws !== workspaceId) throw new Error('Database not found or access denied');
    subject = { id: row.id, title: row.title, type: 'database_row' };
    parent = { id: row.dbItemId, title: row.dbItemTitle!, type: 'database', databaseId: row.databaseId };
  }

  const children: RelatedPageRef[] = childRows.map(c => ({ id: c.id, title: c.title, type: c.type }));

  // Resolve stored link ids (any of the three id forms) to workspace-scoped
  // refs, in one batch; precedence is item → database id → row. Dangling ids
  // (deleted targets) and foreign-workspace ids drop out.
  const resolveMany = async (ids: string[]): Promise<Map<string, RelatedPageRef>> => {
    const out = new Map<string, RelatedPageRef>();
    if (ids.length === 0) return out;

    const [items, dbRows, rowRefs] = await db.batch([
      db
        .select({ id: workspaceItems.id, title: workspaceItems.title, type: workspaceItems.type, databaseId: databases.id })
        .from(workspaceItems)
        .leftJoin(databases, eq(databases.itemId, workspaceItems.id))
        .where(and(inArray(workspaceItems.id, ids), eq(workspaceItems.workspaceId, workspaceId))),
      db
        .select({ dbId: databases.id, itemId: workspaceItems.id, title: workspaceItems.title })
        .from(databases)
        .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
        .where(and(inArray(databases.id, ids), eq(workspaceItems.workspaceId, workspaceId))),
      db
        .select({ id: pages.id, title: pages.title })
        .from(pages)
        .innerJoin(databases, eq(pages.databaseId, databases.id))
        .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
        .where(and(inArray(pages.id, ids), eq(workspaceItems.workspaceId, workspaceId))),
    ]);
    for (const i of items) {
      const ref: RelatedPageRef = out.get(i.id) ?? { id: i.id, title: i.title, type: i.type };
      if (i.type === 'database' && i.databaseId) ref.databaseId = i.databaseId;
      out.set(i.id, ref);
    }
    for (const d of dbRows) {
      if (!out.has(d.dbId)) out.set(d.dbId, { id: d.itemId, title: d.title, type: 'database', databaseId: d.dbId });
    }
    for (const r of rowRefs) {
      if (!out.has(r.id)) out.set(r.id, { id: r.id, title: r.title, type: 'database_row' });
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

  const siblings: { total: number; items: { id: string; title: string }[] } | null = subject.type === 'database_row'
    ? { total: Math.max(0, Number(siblingCountRows[0]?.n ?? 1) - 1), items: siblingRows }
    : null;

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
  updates: {
    pageId: string;
    title?: string;
    content?: string;
    properties?: Record<string, unknown>;
    icon?: string | null;
    iconColor?: string | null;
  }[],
  agentCtx?: { tokenId: string },
  actor?: SnapshotActor,
  /** Stamps agent provenance on every updated item, batched into one statement.
   *  The per-item `recordGeneratedKnowledge` needs a query just to learn each
   *  id's type; `updatePageById` already knows it, so it reports it back. */
  knowledge?: { generatedBy: string },
) {
  const results = await Promise.all(
    updates.map(({ pageId, ...patch }) => updatePageById(workspaceId, pageId, patch, agentCtx, actor)),
  );
  if (knowledge) {
    await recordGeneratedKnowledgeBulk(
      workspaceId,
      results.map((r, i) => ({ itemId: updates[i].pageId, itemType: r.itemType })),
      knowledge.generatedBy,
    ).catch(() => {});
  }
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
    icon?: string;
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
      ...(input.icon ? { icon: input.icon } : {}),
      ...(input.iconColor ? { iconColor: input.iconColor } : {}),
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
    ...(input.icon ? { icon: input.icon } : {}),
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
    autoShareIfParentShared(itemId, input.parentId).catch(() => {});
  }

  return { id: itemId, type: 'page' as const };
}

// ── Bulk create ───────────────────────────────────────────────────────────────

export type BulkCreateEntry = {
  ref?: string;
  title: string;
  content?: string;
  parentId?: string;
  parentRef?: string;
  databaseId?: string;
  properties?: Record<string, any>;
  icon?: string;
  iconColor?: string;
  /** Written with the provenance stamp, only when the caller stamps (`knowledge`). */
  knowledge?: Pick<KnowledgeMetadataInput, 'conceptType' | 'tags' | 'sources'>;
};

export type BulkCreateResult = {
  index: number;
  ok: boolean;
  id?: string;
  type?: 'page' | 'db-row';
  ref?: string;
  error?: string;
};

type ShareConfig = { permission: string; width: string | null; inSitemap: boolean; workspaceId: string; createdBy: string };

/**
 * `createPageInWorkspace` for a whole call, in a fixed number of round-trips.
 *
 * Why this exists: the sequential version costs ~7 statements per record
 * (parent/database checks, a full `sortOrder` scan of the target database, a
 * schema read, the inserts, a link sync, then a knowledge stamp), and against a
 * remote Turso every one of those is a network turn. 100 records meant ~750
 * sequential turns — minutes of watching nothing happen while an agent
 * calibrates a project. Here the shape is flat instead: resolve every reference
 * in one batched read, take every database's next sort position in one grouped
 * query, then write everything as multi-row inserts inside a single batch.
 *
 * The contract is deliberately unchanged from the sequential path:
 *   - Entries keep their own `ok`/`error`; one bad entry never sinks the rest.
 *   - Everything that can fail is caught in memory BEFORE the batch runs, so
 *     "valid entries are written, invalid ones report why" still holds.
 *   - `parentRef` still only resolves backwards, to a *page* created earlier in
 *     the same call. Input order is therefore already topological.
 *   - Ids are generated up front (`crypto.randomUUID`), which is what lets
 *     `ref`/`parentRef` be wired in memory instead of forcing serial inserts.
 *   - `createdAt`/`updatedAt` are written explicitly as `Date`s — never left to
 *     SQLite's `CURRENT_TIMESTAMP`, which writes TEXT into a timestamp-mode
 *     column and leaves the row reading `Invalid Date` forever.
 *
 * Side effects (link graph, knowledge stamp, share inheritance) stay
 * best-effort and run outside the content batch, so a failing link sync can
 * never roll back the pages it was describing.
 */
export async function createPagesInWorkspaceBulk(
  workspaceId: string,
  entries: BulkCreateEntry[],
  agentCtx?: { tokenId: string },
  knowledge?: { generatedBy: string },
): Promise<{ requested: number; succeeded: number; failed: number; results: BulkCreateResult[] }> {
  const now = new Date();
  const results: BulkCreateResult[] = entries.map((entry, index) => ({
    index, ok: false, ...(entry.ref ? { ref: entry.ref } : {}),
  }));

  type Plan = {
    index: number;
    kind: 'page' | 'row';
    /** workspace_items.id for a page, pages.id for a row. */
    id: string;
    /** standalone_pages.id — pages only. */
    contentRowId?: string;
    entry: BulkCreateEntry;
    /** Resolved parent workspace item, existing or created in this call. */
    parentId: string | null;
    /** Set once the database reference has been resolved to databases.id. */
    resolvedDbId?: string;
  };

  // ── 1. Validate in memory; nothing below touches the DB ─────────────────────
  const plans: Plan[] = [];
  const refToPlan = new Map<string, Plan>();
  const takenRefs = new Set<string>();
  const parentIdsToCheck = new Set<string>();
  const databaseRefs = new Set<string>();

  const fail = (index: number, message: string) => { results[index].error = message; };

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];

    const iconProblem = iconInputError(entry.icon, entry.iconColor);
    if (iconProblem) { fail(index, iconProblem); continue; }
    if (entry.parentRef && (entry.parentId || entry.databaseId)) {
      fail(index, 'Pass parentRef on its own, not together with parentId or databaseId.');
      continue;
    }
    if (entry.ref && takenRefs.has(entry.ref)) {
      fail(index, `ref "${entry.ref}" is already used by an earlier entry in this call.`);
      continue;
    }
    if (entry.ref) takenRefs.add(entry.ref);

    let parentId: string | null = entry.parentId ?? null;
    if (entry.parentRef) {
      // Backwards-only, pages only — same rule the sequential path enforced by
      // only registering a ref once its page had actually been created.
      const target = refToPlan.get(entry.parentRef);
      if (!target) {
        fail(index, `parentRef "${entry.parentRef}" does not name a page created earlier in this call.`);
        continue;
      }
      parentId = target.id;
    } else if (entry.parentId) {
      parentIdsToCheck.add(entry.parentId);
    }

    const plan: Plan = entry.databaseId
      ? { index, kind: 'row', id: crypto.randomUUID(), entry, parentId: null }
      : { index, kind: 'page', id: crypto.randomUUID(), contentRowId: crypto.randomUUID(), entry, parentId };
    if (entry.databaseId) databaseRefs.add(entry.databaseId);
    plans.push(plan);
    // A `ref` on a row entry is never addressable as a parent — rows are not
    // sidebar items. The sequential path had the same asymmetry.
    if (entry.ref && plan.kind === 'page') refToPlan.set(entry.ref, plan);
  }

  if (plans.length === 0) {
    return { requested: entries.length, succeeded: 0, failed: entries.length, results };
  }

  // ── 2. Resolve every reference in one round-trip ────────────────────────────
  const parentIdList = [...parentIdsToCheck];
  const databaseRefList = [...databaseRefs];

  // All three reads ship as one batch: parent existence, the databases named by
  // either id form (with their schema, so property resolution needs no second
  // query), and the share rows that drive inheritance.
  const reads: any[] = [];
  const parentsAt = parentIdList.length
    ? reads.push(
        db.select({ id: workspaceItems.id })
          .from(workspaceItems)
          .where(and(eq(workspaceItems.workspaceId, workspaceId), inArray(workspaceItems.id, parentIdList))),
      ) - 1
    : -1;
  const databasesAt = databaseRefList.length
    // Accepts both databases.id and workspace_items.id, like assertDatabaseInWorkspace.
    ? reads.push(
        db.select({ dbId: databases.id, itemId: workspaceItems.id, schema: databases.schema })
          .from(databases)
          .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
          .where(and(
            eq(workspaceItems.workspaceId, workspaceId),
            or(inArray(databases.id, databaseRefList), inArray(workspaceItems.id, databaseRefList)),
          )),
      ) - 1
    : -1;
  const sharesAt = parentIdList.length
    ? reads.push(
        db.select({
          pageId: sharedPages.pageId, permission: sharedPages.permission, width: sharedPages.width,
          workspaceId: sharedPages.workspaceId, inSitemap: sharedPages.inSitemap, createdBy: sharedPages.createdBy,
        })
          .from(sharedPages)
          .where(inArray(sharedPages.pageId, parentIdList)),
      ) - 1
    : -1;

  const read = reads.length ? await db.batch(reads as [any, ...any[]]) : [];
  const parentRows = (parentsAt >= 0 ? read[parentsAt] : []) as { id: string }[];
  const databaseRows = (databasesAt >= 0 ? read[databasesAt] : []) as { dbId: string; itemId: string; schema: any[] }[];
  const shareRows = (sharesAt >= 0 ? read[sharesAt] : []) as
    { pageId: string; permission: string; width: string | null; workspaceId: string; inSitemap: boolean | null; createdBy: string }[];

  const knownParents = new Set(parentRows.map(r => r.id));
  const dbByRef = new Map<string, { dbId: string; schema: any[] }>();
  for (const row of databaseRows) {
    dbByRef.set(row.dbId, { dbId: row.dbId, schema: row.schema ?? [] });
    dbByRef.set(row.itemId, { dbId: row.dbId, schema: row.schema ?? [] });
  }

  // ── 3. Resolve parents/databases, drop what does not exist ──────────────────
  const live: Plan[] = [];
  for (const plan of plans) {
    if (plan.kind === 'row') {
      const resolved = dbByRef.get(plan.entry.databaseId!);
      if (!resolved) { fail(plan.index, 'Database not found or access denied'); continue; }
      plan.resolvedDbId = resolved.dbId;
    } else if (plan.entry.parentId && !knownParents.has(plan.entry.parentId)) {
      fail(plan.index, 'Not found or access denied');
      continue;
    }
    live.push(plan);
  }

  // A page whose parent was created in this call but then failed validation
  // cannot be created either — cascade that, in order.
  const deadIds = new Set(plans.filter(p => !live.includes(p)).map(p => p.id));
  const created: Plan[] = [];
  for (const plan of live) {
    if (plan.parentId && deadIds.has(plan.parentId)) {
      fail(plan.index, `parentRef "${plan.entry.parentRef}" does not name a page created earlier in this call.`);
      deadIds.add(plan.id);
      continue;
    }
    created.push(plan);
  }

  if (created.length === 0) {
    return { requested: entries.length, succeeded: 0, failed: entries.length, results };
  }

  // ── 4. Next sort position per database, in one grouped query ────────────────
  // The sequential path pulled EVERY row of the target database and took the
  // max in JS — a cost that grew with the database. This reads one number per
  // database and walks the increments in memory for rows sharing a database.
  const rowPlans = created.filter(p => p.kind === 'row');
  const targetDbIds = [...new Set(rowPlans.map(p => p.resolvedDbId!))];
  const nextSort = new Map<string, number>();
  if (targetDbIds.length) {
    const maxima = await db
      .select({ databaseId: pages.databaseId, maxSort: sql<number | null>`max(${pages.sortOrder})` })
      .from(pages)
      .where(inArray(pages.databaseId, targetDbIds))
      .groupBy(pages.databaseId);
    for (const row of maxima) nextSort.set(row.databaseId, Math.max(0, row.maxSort ?? 0));
  }

  // ── 5. Build the rows, then write them in one batch ─────────────────────────
  const itemRows: (typeof workspaceItems.$inferInsert)[] = [];
  const contentRows: (typeof standalonePages.$inferInsert)[] = [];
  const dbRows: (typeof pages.$inferInsert)[] = [];

  for (const plan of created) {
    const entry = plan.entry;
    if (plan.kind === 'row') {
      const dbId = plan.resolvedDbId!;
      const base = nextSort.get(dbId) ?? 0;
      const sortOrder = base + 1;
      nextSort.set(dbId, sortOrder);
      const schema: Array<{ id: string; name: string }> = dbByRef.get(entry.databaseId!)?.schema ?? [];
      const resolvedProps = entry.properties ? resolvePropertiesWithSchema(schema, entry.properties) : {};
      dbRows.push({
        id: plan.id,
        databaseId: dbId,
        title: entry.title,
        content: entry.content ?? '',
        properties: { title: entry.title, ...resolvedProps },
        sortOrder,
        createdAt: now,
        updatedAt: now,
        ...(entry.icon ? { icon: entry.icon } : {}),
        ...(entry.iconColor ? { iconColor: entry.iconColor } : {}),
        ...(agentCtx ? { agentEditedAt: now, agentTokenId: agentCtx.tokenId } : {}),
      });
    } else {
      itemRows.push({
        id: plan.id,
        workspaceId,
        type: 'page',
        title: entry.title,
        parentId: plan.parentId,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
        ...(entry.icon ? { icon: entry.icon } : {}),
        ...(entry.iconColor ? { iconColor: entry.iconColor } : {}),
      });
      contentRows.push({
        id: plan.contentRowId!,
        itemId: plan.id,
        content: entry.content ?? '',
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Share inheritance, resolved in memory: a created page under a shared parent
  // is shared, and then itself becomes a shared parent for its own children in
  // this call. The sequential path fired one unawaited query per page for this,
  // which made a grandchild's inheritance a race it usually lost.
  const shareByParent = new Map<string, ShareConfig>();
  for (const row of shareRows) {
    shareByParent.set(row.pageId, {
      permission: row.permission, width: row.width, inSitemap: Boolean(row.inSitemap),
      workspaceId: row.workspaceId, createdBy: row.createdBy,
    });
  }
  const shareInserts: (typeof sharedPages.$inferInsert)[] = [];
  for (const plan of created) {
    if (plan.kind !== 'page' || !plan.parentId) continue;
    const inherited = shareByParent.get(plan.parentId);
    if (!inherited) continue;
    shareByParent.set(plan.id, inherited);
    shareInserts.push({
      id: crypto.randomUUID(),
      slug: crypto.randomUUID(),
      pageId: plan.id,
      workspaceId: inherited.workspaceId,
      permission: inherited.permission as 'read' | 'write',
      width: (inherited.width ?? 'narrow') as 'narrow' | 'wide' | 'full',
      inSitemap: inherited.inSitemap,
      // Inherited from the parent share, NOT from the caller. `created_by` is an
      // FK onto `user`, and an MCP caller has only a token id — writing that
      // silently violated the constraint, which is why agent-created sub-pages
      // never actually appeared in a published tree. The parent's owner is also
      // the semantically right answer: this row exists because of THEIR decision
      // to publish the subtree, and ON DELETE CASCADE should take the inherited
      // children with the parent rather than with whoever's agent made them.
      createdBy: inherited.createdBy,
      createdAt: now,
    });
  }

  // Parents before children — standalone_pages.item_id has an FK onto the item
  // row, and libsql runs a batch in order inside one transaction.
  const statements: any[] = [];
  for (const chunk of chunkRows(itemRows, 10)) statements.push(db.insert(workspaceItems).values(chunk));
  for (const chunk of chunkRows(contentRows, 5)) statements.push(db.insert(standalonePages).values(chunk));
  for (const chunk of chunkRows(dbRows, 12)) statements.push(db.insert(pages).values(chunk));
  await db.batch(statements as [any, ...any[]]);

  for (const plan of created) {
    results[plan.index].ok = true;
    results[plan.index].id = plan.id;
    results[plan.index].type = plan.kind === 'row' ? 'db-row' : 'page';
  }

  // ── 6. Best-effort side effects, outside the content batch ──────────────────
  const linkSources = created
    .filter(p => p.entry.content)
    .map(p => ({
      fromId: p.id,
      fromType: (p.kind === 'row' ? 'database_row' : 'page') as 'page' | 'database_row',
      content: p.entry.content!,
    }));
  await Promise.allSettled([
    syncPageLinksBulk(workspaceId, linkSources),
    knowledge
      ? recordGeneratedKnowledgeBulk(
          workspaceId,
          created.map(p => ({
            itemId: p.id,
            itemType: (p.kind === 'row' ? 'database_row' : 'page') as 'page' | 'database_row',
            metadata: p.entry.knowledge,
          })),
          knowledge.generatedBy,
        ).catch(() => {})
      : Promise.resolve(),
    // Outside the content batch on purpose: publishing a sub-page is a
    // convenience, and a failure here (a parent unshared between the read and
    // the write, a slug collision) must not roll back the pages themselves.
    // Same best-effort contract as the single-page `autoShareIfParentShared`.
    shareInserts.length
      ? db.batch(chunkRows(shareInserts, 9).map(chunk => db.insert(sharedPages).values(chunk)) as [any, ...any[]]).catch(() => {})
      : Promise.resolve(),
  ]);

  const succeeded = created.length;
  return { requested: entries.length, succeeded, failed: entries.length - succeeded, results };
}

/**
 * A page created under a publicly shared parent is published too — the public
 * `/share/[...slug]` tree is built ONLY from items that have their own
 * `shared_pages` row, so without this an agent's sub-page is invisible to
 * visitors and its child-block button in the parent dead-ends.
 *
 * `created_by` is inherited from the parent share rather than taken from the
 * caller: it is an FK onto `user`, and an MCP caller has only a token id. This
 * used to be written as `agentCtx?.tokenId ?? 'system'`, which violated the
 * constraint and made the whole insert fail silently (it is best-effort) — so
 * MCP-created pages never inherited sharing at all. The parent's owner is also
 * the right answer semantically: the row exists because THEY published the
 * subtree, and ON DELETE CASCADE should retire the inherited children with them.
 */
async function autoShareIfParentShared(itemId: string, parentId: string): Promise<void> {
  const [parentShare] = await db
    .select({
      permission: sharedPages.permission, width: sharedPages.width, workspaceId: sharedPages.workspaceId,
      inSitemap: sharedPages.inSitemap, createdBy: sharedPages.createdBy,
    })
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
    createdBy: parentShare.createdBy,
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
  itemType: 'page' | 'database' | 'database_row' | 'dashboard',
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
  type: 'page' | 'database' | 'dashboard',
  title: string,
  meta: { parentId: string | null; icon: string | null; iconColor: string | null; sortOrder: number },
  actor: SnapshotActor,
) {
  const children = await db
    .select({
      id: workspaceItems.id,
      type: workspaceItems.type,
      title: workspaceItems.title,
      parentId: workspaceItems.parentId,
      icon: workspaceItems.icon,
      iconColor: workspaceItems.iconColor,
      sortOrder: workspaceItems.sortOrder,
    })
    .from(workspaceItems)
    .where(eq(workspaceItems.parentId, itemId));

  for (const child of children) {
    await deleteWorkspaceItemAndDescendants(
      workspaceId, child.id, child.type, child.title,
      { parentId: child.parentId, icon: child.icon, iconColor: child.iconColor, sortOrder: child.sortOrder },
      actor,
    );
  }

  // Every id another page could have linked to: a database is reachable by its
  // workspace-item id (childBlock) and its databases.id (a /db/<id> href), and
  // its rows die with it. See purgeReferencesTo.
  const deadIds: string[] = [itemId];

  if (type === 'database') {
    const [dbRow] = await db
      .select({ id: databases.id, schema: databases.schema })
      .from(databases)
      .where(eq(databases.itemId, itemId))
      .limit(1);
    if (dbRow) {
      deadIds.push(dbRow.id);
      const rows = await db
        .select({
          id: pages.id, title: pages.title, content: pages.content, properties: pages.properties,
          icon: pages.icon, iconColor: pages.iconColor, sortOrder: pages.sortOrder,
        })
        .from(pages)
        .where(eq(pages.databaseId, dbRow.id));
      for (const r of rows) {
        deadIds.push(r.id);
        await snapshotBeforeDelete({
          workspaceId, originalId: r.id, itemType: 'database_row', title: r.title,
          content: r.content, properties: r.properties, icon: r.icon, iconColor: r.iconColor,
          databaseId: dbRow.id, sortOrder: r.sortOrder, deletedBy: actor,
        });
      }
      await snapshotBeforeDelete({
        workspaceId, originalId: itemId, itemType: 'database', title,
        schema: dbRow.schema as any[], icon: meta.icon, iconColor: meta.iconColor,
        parentId: meta.parentId, sortOrder: meta.sortOrder, databaseId: dbRow.id, deletedBy: actor,
      });
    }
    await db.delete(databases).where(eq(databases.itemId, itemId));
  } else if (type === 'dashboard') {
    // Mirrors the web delete path: the spec is snapshotted as JSON in the
    // `content` column so a restore brings the blocks back, not an empty shell.
    const [dash] = await db
      .select({ spec: dashboards.spec })
      .from(dashboards)
      .where(eq(dashboards.itemId, itemId))
      .limit(1);
    await snapshotBeforeDelete({
      workspaceId, originalId: itemId, itemType: 'dashboard', title,
      content: dash ? JSON.stringify(dash.spec) : undefined, icon: meta.icon, iconColor: meta.iconColor,
      parentId: meta.parentId, sortOrder: meta.sortOrder, deletedBy: actor,
    });
    await db.delete(dashboards).where(eq(dashboards.itemId, itemId));
  } else {
    const [content] = await db
      .select({ content: standalonePages.content })
      .from(standalonePages)
      .where(eq(standalonePages.itemId, itemId))
      .limit(1);
    await snapshotBeforeDelete({
      workspaceId, originalId: itemId, itemType: 'page', title,
      content: content?.content, icon: meta.icon, iconColor: meta.iconColor,
      parentId: meta.parentId, sortOrder: meta.sortOrder, deletedBy: actor,
    });
    await db.delete(standalonePages).where(eq(standalonePages.itemId, itemId));
  }

  await db.delete(workspaceItems).where(eq(workspaceItems.id, itemId));
  await recordDeletionTombstone(workspaceId, itemId, type, title);
  // Purge before removing the graph rows — the purge finds referencing pages
  // through them.
  await purgeReferencesTo(deadIds);
  await removePageLinksFor(deadIds);
}

export async function deleteItemFromWorkspace(workspaceId: string, itemId: string, actor: SnapshotActor) {
  const [item] = await db
    .select({
      workspaceId: workspaceItems.workspaceId, type: workspaceItems.type, title: workspaceItems.title,
      parentId: workspaceItems.parentId, icon: workspaceItems.icon, iconColor: workspaceItems.iconColor,
      sortOrder: workspaceItems.sortOrder,
    })
    .from(workspaceItems)
    .where(eq(workspaceItems.id, itemId))
    .limit(1);

  if (item) {
    if (item.workspaceId !== workspaceId) throw new Error('Access denied');
    await deleteWorkspaceItemAndDescendants(
      workspaceId, itemId, item.type, item.title,
      { parentId: item.parentId, icon: item.icon, iconColor: item.iconColor, sortOrder: item.sortOrder },
      actor,
    );
    return { deleted: true, type: item.type as 'page' | 'database' | 'dashboard' };
  }

  const [page] = await db
    .select({
      databaseId: pages.databaseId, title: pages.title, content: pages.content, properties: pages.properties,
      icon: pages.icon, iconColor: pages.iconColor, sortOrder: pages.sortOrder,
    })
    .from(pages)
    .where(eq(pages.id, itemId))
    .limit(1);

  if (!page) throw new Error('Item not found');
  await assertDatabaseInWorkspace(page.databaseId, workspaceId);
  // Same reason as the web delete path in `actions/page.ts`: a deleted
  // occurrence has to be recorded on its rule, or the next materialization
  // recreates it and the agent's delete silently undoes itself.
  await exdateOccurrenceForPage(itemId).catch(() => {});
  await snapshotBeforeDelete({
    workspaceId, originalId: itemId, itemType: 'database_row', title: page.title,
    content: page.content, properties: page.properties, icon: page.icon, iconColor: page.iconColor,
    databaseId: page.databaseId, sortOrder: page.sortOrder, deletedBy: actor,
  });
  await db.delete(pages).where(eq(pages.id, itemId));
  await recordDeletionTombstone(workspaceId, itemId, 'database_row', page.title);
  await purgeReferencesTo([itemId]);
  await removePageLinksFor(itemId);
  return { deleted: true, type: 'db-row' as const };
}

// Batch counterpart for the MCP `bulk_delete_pages` tool. Uses Promise.allSettled
// (like `getPagesByIds`) rather than `bulkUpdatePages`'s Promise.all — one bad id
// must not sink the rest of the batch, and the caller gets a per-item result
// instead of an all-or-nothing error (spec: the exact failure mode this feature
// exists to fix — see `.ai/FEATURE_BULK_AND_TRASH.md` §A.1).
export async function bulkDeleteItemsFromWorkspace(
  workspaceId: string,
  itemIds: string[],
  actor: SnapshotActor,
): Promise<{ id: string; ok: boolean; error?: string }[]> {
  const settled = await Promise.allSettled(
    itemIds.map((id) => deleteItemFromWorkspace(workspaceId, id, actor)),
  );
  return settled.map((result, i) => (
    result.status === 'fulfilled'
      ? { id: itemIds[i], ok: true }
      : { id: itemIds[i], ok: false, error: String(result.reason?.message ?? result.reason) }
  ));
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

// Batch counterpart for the MCP `bulk_move_items` tool, sidebar-reparent mode
// (mirrors move_item's semantics, batched, same per-item result contract as
// `bulkDeleteItemsFromWorkspace`). Workspace items (pages/databases) only —
// database rows go through `bulkMoveRowsToDatabase` instead.
//
// Every item in a call lands under the SAME parent, which is what makes this
// collapsible: the destination's ancestor chain — the only thing the subtree
// check needs — is read once for the whole call instead of being re-walked per
// item. Three statements total, whatever the batch size.
export async function bulkMoveItemsInWorkspace(
  workspaceId: string,
  itemIds: string[],
  newParentId: string | null,
): Promise<{ id: string; ok: boolean; error?: string }[]> {
  if (itemIds.length === 0) return [];
  const ids = [...new Set(itemIds)];
  const lookup = [...new Set([...ids, ...(newParentId ? [newParentId] : [])])];

  const present = new Set(
    (await db
      .select({ id: workspaceItems.id })
      .from(workspaceItems)
      .where(and(eq(workspaceItems.workspaceId, workspaceId), inArray(workspaceItems.id, lookup)))
    ).map(r => r.id),
  );

  // The destination itself plus everything above it. A moved item may not be
  // any of them, or it would become its own ancestor. `depth < 100` is a cycle
  // guard: the per-item walk this replaces would spin forever on corrupt data.
  let forbidden = new Set<string>();
  if (newParentId && present.has(newParentId)) {
    const chain = await db.all<{ id: string }>(sql`
      with recursive chain(id, parent_id, depth) as (
        select id, parent_id, 0 from workspace_items where id = ${newParentId}
        union all
        select wi.id, wi.parent_id, chain.depth + 1
          from workspace_items wi join chain on wi.id = chain.parent_id
         where chain.depth < 100
      )
      select id from chain
    `);
    forbidden = new Set(chain.map(r => r.id));
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];
  const movable: string[] = [];
  for (const id of itemIds) {
    if (!present.has(id) || (newParentId !== null && !present.has(newParentId))) {
      results.push({ id, ok: false, error: 'Not found or access denied' });
    } else if (forbidden.has(id)) {
      results.push({ id, ok: false, error: 'Cannot move an item into its own subtree' });
    } else {
      results.push({ id, ok: true });
      movable.push(id);
    }
  }

  if (movable.length) {
    await db
      .update(workspaceItems)
      .set({ parentId: newParentId, updatedAt: new Date() })
      .where(inArray(workspaceItems.id, [...new Set(movable)]));
  }
  return results;
}

// Cross-database row move (`.ai/FEATURE_BULK_AND_TRASH.md` §A.3): moving a row
// to a DIFFERENT database is a distinct operation from `moveItemInWorkspace`'s
// sidebar reparenting, because the target database's schema may not match the
// source's. Decision: reject the WHOLE call up front if it doesn't, naming the
// columns that don't line up — never silently drop a property. This is a
// stricter check than the bulk-paste-import path (`propertyCoercion.ts`'s
// `coerceRowValues`, which auto-appends unknown option values) — that
// leniency is exactly what this feature must not do.
export async function bulkMoveRowsToDatabase(
  workspaceId: string,
  itemIds: string[],
  targetDatabaseId: string,
): Promise<{ id: string; ok: boolean; error?: string }[]> {
  const targetDbId = await assertDatabaseInWorkspace(targetDatabaseId, workspaceId);
  const [targetRecord] = await db
    .select({ schema: databases.schema })
    .from(databases)
    .where(eq(databases.id, targetDbId))
    .limit(1);
  if (!targetRecord) throw new Error('Target database not found');
  const targetSchema: Array<{ id: string; name: string; type: string }> = targetRecord.schema ?? [];
  const targetByName = new Map(targetSchema.map((c) => [c.name.toLowerCase(), c]));

  const rows = await db
    .select({ id: pages.id, databaseId: pages.databaseId, properties: pages.properties })
    .from(pages)
    .where(inArray(pages.id, itemIds));
  const rowById = new Map(rows.map((r) => [r.id, r]));

  const sourceDatabaseIds = Array.from(new Set(rows.map((r) => r.databaseId)));
  const sourceSchemas = new Map<string, Array<{ id: string; name: string; type: string }>>();
  for (const dbId of sourceDatabaseIds) {
    const [record] = await db.select({ schema: databases.schema }).from(databases).where(eq(databases.id, dbId)).limit(1);
    sourceSchemas.set(dbId, record?.schema ?? []);
  }

  // Batch-level gate: every source database's columns (by name, case-insensitive)
  // must exist on the target with the SAME type, or nothing moves.
  const missing = new Set<string>();
  for (const dbId of sourceDatabaseIds) {
    for (const col of sourceSchemas.get(dbId) ?? []) {
      const match = targetByName.get(col.name.toLowerCase());
      if (!match || match.type !== col.type) missing.add(col.name);
    }
  }
  if (missing.size > 0) {
    throw new Error(`Target database is missing or has a different type for: ${Array.from(missing).join(', ')}`);
  }

  const [maxSortRow] = await db
    .select({ maxSort: sql<number>`coalesce(max(${pages.sortOrder}), -1)` })
    .from(pages)
    .where(eq(pages.databaseId, targetDbId));
  let nextSort = (maxSortRow?.maxSort ?? -1) + 1;

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const id of itemIds) {
    const row = rowById.get(id);
    if (!row) { results.push({ id, ok: false, error: 'Row not found' }); continue; }
    try {
      const sourceSchema = sourceSchemas.get(row.databaseId) ?? [];
      const sourceIdToName = new Map(sourceSchema.map((c) => [c.id, c.name.toLowerCase()]));
      const remapped: Record<string, any> = {};
      for (const [colId, value] of Object.entries(row.properties ?? {})) {
        const name = sourceIdToName.get(colId);
        const targetCol = name ? targetByName.get(name) : undefined;
        remapped[targetCol ? targetCol.id : colId] = value;
      }
      await db.update(pages)
        .set({ databaseId: targetDbId, properties: remapped, sortOrder: nextSort++, updatedAt: new Date() })
        .where(eq(pages.id, id));
      results.push({ id, ok: true });
    } catch (err) {
      results.push({ id, ok: false, error: String((err as Error).message ?? err) });
    }
  }
  return results;
}

export async function createDatabaseInWorkspace(
  workspaceId: string,
  input: {
    name: string;
    schema?: Array<{ name: string; type: string; options?: any[] }>;
    parentId?: string;
    icon?: string;
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
        { id: 'id', name: 'ID', type: 'id' },
      ];

  const resolvedSchema = normalizeSchemaColumns(rawSchema);

  if (!resolvedSchema.some((c: any) => c.id === 'title')) {
    resolvedSchema.unshift({ id: 'title', name: 'Title', type: 'text' });
  }
  if (!resolvedSchema.some((c: any) => c.id === 'id')) {
    resolvedSchema.push({ id: 'id', name: 'ID', type: 'id' });
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
    ...(input.icon ? { icon: input.icon } : {}),
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

function resolveColumnRef(schema: any[], ref: string | undefined): any | undefined {
  if (!ref) return undefined;
  return schema.find((c: any) => c.id === ref) ?? schema.find((c: any) => c.name?.toLowerCase() === ref.toLowerCase());
}

// The client (DatabaseView.tsx) never persists the implicit default Table view
// it shows for a database with no saved `views` — so a fresh database reads back
// `views: null`. Seed that same default before appending, so the first
// MCP-created view lands alongside a Table view exactly like a human adding a
// second view through the UI would, instead of silently replacing it.
function seedDefaultViews(existing: any[] | null | undefined): any[] {
  if (Array.isArray(existing) && existing.length > 0) return existing;
  return [{
    id: crypto.randomUUID().slice(0, 8),
    name: 'Table',
    config: { type: 'table', columnOrder: [], hiddenColumns: [], filters: [], sorts: [], openBehavior: 'center' },
  }];
}

export async function createDatabaseView(
  workspaceId: string,
  databaseId: string,
  input: { name: string; type: 'table' | 'kanban' | 'calendar'; groupByCol?: string; dateCol?: string; icon?: string; iconColor?: string },
) {
  const resolvedId = await assertDatabaseInWorkspace(databaseId, workspaceId);

  const [dbRecord] = await db
    .select({ schema: databases.schema, views: databases.views })
    .from(databases)
    .where(eq(databases.id, resolvedId))
    .limit(1);
  if (!dbRecord) throw new Error('Database not found');

  const schema: any[] = dbRecord.schema ?? [];
  let config: Record<string, any>;

  if (input.type === 'table') {
    config = { type: 'table', columnOrder: [], hiddenColumns: [], filters: [], sorts: [], openBehavior: 'center' };
  } else if (input.type === 'kanban') {
    const groupCol = resolveColumnRef(schema, input.groupByCol)
      ?? schema.find((c: any) => c.type === 'status') ?? schema.find((c: any) => c.type === 'select');
    if (!groupCol) throw new Error('A kanban view needs a select or status column to group by. Add one first, or pass groupByCol.');
    config = { type: 'kanban', groupByCol: groupCol.id, groupOrder: [], filters: [], sorts: [], openBehavior: 'center' };
  } else if (input.type === 'calendar') {
    const dateColumn = resolveColumnRef(schema, input.dateCol)
      ?? schema.find((c: any) => c.type === 'date' || c.type === 'datetime');
    if (!dateColumn) throw new Error('A calendar view needs a date or datetime column. Add one first, or pass dateCol.');
    config = { type: 'calendar', dateCol: dateColumn.id, viewMode: 'month', filters: [], sorts: [], openBehavior: 'center' };
  } else {
    throw new Error(`Unknown view type: ${input.type}`);
  }

  const newView = {
    id: crypto.randomUUID().slice(0, 8),
    name: input.name,
    config,
    ...(input.icon ? { icon: input.icon } : {}),
    ...(input.iconColor ? { iconColor: input.iconColor } : {}),
  };
  const nextViews = [...seedDefaultViews(dbRecord.views as any[] | null), newView];

  await db.update(databases).set({ views: nextViews, updatedAt: new Date() }).where(eq(databases.id, resolvedId));
  return { created: true, view: newView };
}

export async function updateDatabaseView(
  workspaceId: string,
  databaseId: string,
  viewId: string,
  patch: { name?: string; icon?: string; iconColor?: string; config?: Record<string, any> },
) {
  const resolvedId = await assertDatabaseInWorkspace(databaseId, workspaceId);

  const [dbRecord] = await db
    .select({ views: databases.views })
    .from(databases)
    .where(eq(databases.id, resolvedId))
    .limit(1);
  if (!dbRecord) throw new Error('Database not found');

  const views = seedDefaultViews(dbRecord.views as any[] | null);
  const idx = views.findIndex((v: any) => v.id === viewId);
  if (idx === -1) throw new Error(`View not found: ${viewId}`);

  const current = views[idx];
  const nextView = {
    ...current,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
    ...(patch.iconColor !== undefined ? { iconColor: patch.iconColor } : {}),
    // The view type is fixed at creation — a patch can only tweak fields within it.
    config: patch.config ? { ...current.config, ...patch.config, type: current.config.type } : current.config,
  };
  const nextViews = [...views];
  nextViews[idx] = nextView;

  await db.update(databases).set({ views: nextViews, updatedAt: new Date() }).where(eq(databases.id, resolvedId));
  return { updated: true, view: nextView };
}

export async function deleteDatabaseView(
  workspaceId: string,
  databaseId: string,
  viewId: string,
  confirm: boolean,
) {
  const resolvedId = await assertDatabaseInWorkspace(databaseId, workspaceId);

  const [dbRecord] = await db
    .select({ views: databases.views })
    .from(databases)
    .where(eq(databases.id, resolvedId))
    .limit(1);
  if (!dbRecord) throw new Error('Database not found');

  const views = seedDefaultViews(dbRecord.views as any[] | null);
  const target = views.find((v: any) => v.id === viewId);
  if (!target) throw new Error(`View not found: ${viewId}`);
  if (views.length <= 1) throw new Error('Cannot delete the only remaining view — a database must keep at least one.');
  if (!confirm) throw new Error(`This will permanently delete the view "${target.name}". Set confirm: true to proceed.`);

  const nextViews = views.filter((v: any) => v.id !== viewId);
  await db.update(databases).set({ views: nextViews, updatedAt: new Date() }).where(eq(databases.id, resolvedId));
  return { deleted: true };
}

/** Column-name → column-id property mapping, with the schema already in hand.
 *  Split out so the bulk path can reuse a schema it fetched once for the whole
 *  call instead of re-reading it per row. */
function resolvePropertiesWithSchema(
  schema: Array<{ id: string; name: string }>,
  properties: Record<string, any>,
): Record<string, any> {
  const nameToId = new Map(schema.map(col => [col.name.toLowerCase(), col.id]));
  const resolved: Record<string, any> = {};
  for (const [key, value] of Object.entries(properties)) {
    const colId = nameToId.get(key.toLowerCase());
    resolved[colId ?? key] = value;
  }
  return resolved;
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

  return resolvePropertiesWithSchema(dbRecord?.schema ?? [], properties);
}

export async function updatePageById(
  workspaceId: string,
  itemId: string,
  patch: {
    title?: string;
    content?: string;
    properties?: Record<string, any>;
    /** `null` clears; omitted leaves the current icon as it is. */
    icon?: string | null;
    iconColor?: string | null;
  },
  agentCtx?: { tokenId: string },
  /** Versioning-only actor — separate from `agentCtx` (which only feeds the
   *  unrelated `agentEditedAt`/`agentTokenId` columns and has no display
   *  name). Undefined means no version is recorded for this write (e.g. the
   *  OKF import route's post-import link rewrite has no resolvable actor
   *  and isn't a meaningful edit worth versioning). */
  actor?: SnapshotActor,
) {
  // Try as workspace item first
  const [item] = await db
    .select({ type: workspaceItems.type, workspaceId: workspaceItems.workspaceId, title: workspaceItems.title })
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
    // Pages and databases keep their icon on the sidebar item itself.
    if (patch.icon !== undefined || patch.iconColor !== undefined) {
      await db
        .update(workspaceItems)
        .set({
          ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
          ...(patch.iconColor !== undefined ? { iconColor: patch.iconColor } : {}),
          updatedAt: new Date(),
        })
        .where(eq(workspaceItems.id, itemId));
    }
    if (patch.content !== undefined && item.type === 'page') {
      if (actor) {
        const [current] = await db
          .select({ content: standalonePages.content })
          .from(standalonePages)
          .where(eq(standalonePages.itemId, itemId))
          .limit(1);
        await maybeSnapshotContentUpdate({
          workspaceId, originalId: itemId, itemType: 'page', title: item.title,
          priorContent: current?.content ?? '', newContent: patch.content,
          // Human callers here (the write-share editor, `sharing.ts`) still
          // autosave continuously like the owner's own editor, so they get
          // the same session+size gate. Agent callers (MCP) never debounce
          // — every real content change is a discrete deliberate action.
          changedBy: actor, debounced: actor.kind === 'human',
        });
      }
      await db
        .update(standalonePages)
        .set({ content: patch.content, updatedAt: new Date() })
        .where(eq(standalonePages.itemId, itemId));
      await syncPageLinks(workspaceId, itemId, 'page', patch.content);
    }
    return { updated: true, itemType: item.type as 'page' | 'database' };
  }

  // Try as DB row (pages table)
  const [page] = await db
    .select({ databaseId: pages.databaseId, properties: pages.properties, title: pages.title, content: pages.content })
    .from(pages)
    .where(eq(pages.id, itemId))
    .limit(1);

  if (!page) throw new Error('Page not found');
  await assertDatabaseInWorkspace(page.databaseId, workspaceId);

  if (patch.content !== undefined && actor) {
    await maybeSnapshotContentUpdate({
      workspaceId, originalId: itemId, itemType: 'database_row', title: page.title,
      priorContent: page.content ?? '', newContent: patch.content,
      // Same human-vs-agent debounce split as the workspace-item branch above.
      changedBy: actor, debounced: actor.kind === 'human',
    });
  }

  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (patch.title !== undefined) updateData.title = patch.title;
  if (patch.content !== undefined) updateData.content = patch.content;
  if (patch.icon !== undefined) updateData.icon = patch.icon;
  if (patch.iconColor !== undefined) updateData.iconColor = patch.iconColor;
  if (patch.title !== undefined || patch.properties !== undefined) {
    // `title` is mirrored into `properties.title` too — table views render a row's
    // name from `properties.title`, not `pages.title`, so writing only the former
    // (as an MCP caller naturally would via `title:`) used to leave the visible
    // title unchanged. An explicit `properties.title` in the same patch still wins.
    const resolved = patch.properties !== undefined
      ? await resolvePropertiesBySchema(page.databaseId, patch.properties)
      : {};
    updateData.properties = {
      ...(page.properties ?? {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...resolved,
    };
  }
  if (agentCtx) {
    updateData.agentEditedAt = new Date();
    updateData.agentTokenId = agentCtx.tokenId;
  }

  await db.update(pages).set(updateData).where(eq(pages.id, itemId));
  if (patch.content !== undefined) await syncPageLinks(workspaceId, itemId, 'database_row', patch.content);
  return { updated: true, itemType: 'database_row' as const };
}
