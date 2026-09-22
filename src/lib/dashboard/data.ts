import { db } from '@/db';
import { agentActivity, agentTokens, databases, dashboards, oauthAccessTokens, pages, workspaceItems } from '@/db/schema';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { DatabaseView } from '@/lib/types/views';
import { applyFilters, applySorts, type FilterSpec, type SortSpec } from '@/lib/tableFilters';
import {
  parseDashboardSpec,
  type ActivityBlock,
  type ChartBlock,
  type DashboardBlock,
  type DatabaseEmbedBlock,
  type LinksBlock,
  type ListBlock,
  type MetricBlock,
  type TextBlock,
} from './schema';

/**
 * Server-side resolution of a dashboard spec into everything its blocks need
 * to render — cookie-free, so the same module serves the web route today and
 * an MCP preview later.
 *
 * Resolution is done ONCE for the whole dashboard, not once per block:
 * every block's source database is collected up front and each database's rows
 * are read a single time, then filtered in memory per block. Ten metrics over
 * one database cost one row query, not ten. A per-block client fetch would be
 * both slower and, by P4's yardstick, more expensive.
 *
 * Access control is structural rather than a check per block: the database
 * lookup is already constrained to this workspace, so a block naming another
 * workspace's database simply finds nothing and renders as unavailable. There
 * is no code path by which a foreign database's rows reach the page.
 */

export type DashboardRowLike = {
  id: string;
  databaseId: string;
  title: string;
  properties: Record<string, unknown>;
  sortOrder: number;
  icon: string | null;
  iconColor: string | null;
  cardCollapsed: boolean;
  seriesId: string | null;
  occurrenceDate: string | null;
  seriesDetached: boolean;
  createdAt: Date;
  updatedAt: Date;
  agentEditedAt: Date | null;
};

export type DashboardDatabase = {
  id: string;
  name: string;
  itemId: string | null;
  schema: Record<string, unknown>[];
  views: DatabaseView[] | null;
  workspaceId: string;
  icon: string | null;
  iconColor: string | null;
};

/** `label` is raw data (a column value or a date bucket); the two flags mark the
 *  synthetic categories, whose wording is the renderer's job, not the query's. */
export type ChartPoint = { label: string; value: number; isOther?: boolean; isEmpty?: boolean };

export type TrendResult = { direction: 'up' | 'down' | 'flat'; percent: number | null; current: number; previous: number };

export type ResolvedBlock =
  | { kind: 'metric'; block: MetricBlock; value: number | null; matched: number; trend: TrendResult | null }
  | { kind: 'chart'; block: ChartBlock; points: ChartPoint[]; total: number }
  | { kind: 'database_embed'; block: DatabaseEmbedBlock; database: DashboardDatabase; view: DatabaseView; rows: DashboardRowLike[]; truncated: number }
  | { kind: 'list'; block: ListBlock; rows: DashboardRowLike[]; total: number; columns: { id: string; name: string; type: string }[] }
  | { kind: 'text'; block: TextBlock }
  | { kind: 'links'; block: LinksBlock; links: { itemId: string; label: string; href: string | null; icon: string | null; iconColor: string | null; type: 'page' | 'database' | 'dashboard' | null }[] }
  | { kind: 'activity'; block: ActivityBlock; entries: { id: string; tool: string; status: 'success' | 'error'; actor: string | null; createdAt: Date }[] }
  /** The block is well-formed, but what it points at is gone or unreachable. */
  | { kind: 'unavailable'; block: DashboardBlock; reason: 'database_missing' | 'view_missing' | 'column_missing' }
  /** The block itself could not be read — see `parseDashboardSpec`. */
  | { kind: 'invalid'; id: string | null; error: string };

export type ResolvedDashboard = {
  blocks: ResolvedBlock[];
  /** Set when the whole spec was unreadable; `blocks` is then empty. */
  fatal?: string;
};

// -- helpers ------------------------------------------------------------------

function sourceDatabaseId(block: DashboardBlock): string | null {
  if (block.type === 'metric' || block.type === 'chart' || block.type === 'list') return block.source.databaseId;
  if (block.type === 'database_embed') return block.databaseId;
  return null;
}

function toNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function toDate(raw: unknown): Date | null {
  if (!raw) return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

function columnExists(schema: Record<string, unknown>[], columnId: string): boolean {
  return schema.some((c) => c && (c as { id?: unknown }).id === columnId);
}

function bucketLabel(date: Date, bucket: 'day' | 'week' | 'month'): string {
  const iso = date.toISOString().slice(0, 10);
  if (bucket === 'day') return iso;
  if (bucket === 'month') return iso.slice(0, 7);
  // ISO-ish week start (Monday), labelled by that Monday's date.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - weekday);
  return d.toISOString().slice(0, 10);
}

/** Sentinel for "this row has no value in the grouping column" — never a real
 *  column value, and translated at render time. */
const EMPTY_GROUP = '__remnus_empty_group__';

/** Multi-select values fan out into one category each; everything else is one. */
function groupValues(raw: unknown): string[] {
  if (raw == null || raw === '') return [EMPTY_GROUP];
  if (Array.isArray(raw)) return raw.length ? raw.map((v) => String(v)) : [EMPTY_GROUP];
  return [String(raw)];
}

// -- resolution ---------------------------------------------------------------

export async function resolveDashboard(workspaceId: string, rawSpec: unknown): Promise<ResolvedDashboard> {
  const parsed = parseDashboardSpec(rawSpec);
  if (parsed.fatal) return { blocks: [], fatal: parsed.fatal };

  const goodBlocks = parsed.blocks.filter((b): b is { ok: true; block: DashboardBlock } => b.ok).map((b) => b.block);

  // 1. Every database any block points at — scoped to THIS workspace, which is
  //    what makes a cross-workspace source impossible rather than merely checked.
  const wantedDbIds = Array.from(
    new Set(goodBlocks.map(sourceDatabaseId).filter((id): id is string => !!id)),
  );

  const dbRecords: DashboardDatabase[] = wantedDbIds.length
    ? (
        await db
          .select({
            id: databases.id,
            name: databases.name,
            itemId: databases.itemId,
            schema: databases.schema,
            views: databases.views,
            workspaceId: workspaceItems.workspaceId,
            icon: workspaceItems.icon,
            iconColor: workspaceItems.iconColor,
          })
          .from(databases)
          .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
          .where(and(inArray(databases.id, wantedDbIds), eq(workspaceItems.workspaceId, workspaceId)))
      ).map((r) => ({
        ...r,
        schema: (r.schema ?? []) as Record<string, unknown>[],
        views: (r.views ?? null) as DatabaseView[] | null,
      }))
    : [];

  const dbById = new Map(dbRecords.map((d) => [d.id, d]));
  const reachableDbIds = dbRecords.map((d) => d.id);

  // 2. One row read for the whole dashboard. `content` is deliberately not
  //    selected — no block renders row bodies, and it is by far the largest
  //    column.
  const rowsByDb = new Map<string, DashboardRowLike[]>();
  if (reachableDbIds.length) {
    const rows = await db
      .select({
        id: pages.id,
        databaseId: pages.databaseId,
        title: pages.title,
        properties: pages.properties,
        sortOrder: pages.sortOrder,
        icon: pages.icon,
        iconColor: pages.iconColor,
        cardCollapsed: pages.cardCollapsed,
        seriesId: pages.seriesId,
        occurrenceDate: pages.occurrenceDate,
        seriesDetached: pages.seriesDetached,
        createdAt: pages.createdAt,
        updatedAt: pages.updatedAt,
        agentEditedAt: pages.agentEditedAt,
      })
      .from(pages)
      .where(inArray(pages.databaseId, reachableDbIds))
      .orderBy(asc(pages.sortOrder), asc(pages.createdAt));

    for (const row of rows) {
      const shaped: DashboardRowLike = { ...row, properties: (row.properties ?? {}) as Record<string, unknown> };
      const bucket = rowsByDb.get(row.databaseId);
      if (bucket) bucket.push(shaped);
      else rowsByDb.set(row.databaseId, [shaped]);
    }
  }

  // 3. Link targets, resolved in one query (and only inside this workspace).
  const wantedItemIds = Array.from(
    new Set(goodBlocks.flatMap((b) => (b.type === 'links' ? b.items.map((i) => i.itemId) : []))),
  );
  const linkTargets = new Map<
    string,
    { title: string; type: 'page' | 'database' | 'dashboard'; icon: string | null; iconColor: string | null; databaseId: string | null }
  >();
  if (wantedItemIds.length) {
    const found = await db
      .select({
        id: workspaceItems.id,
        title: workspaceItems.title,
        type: workspaceItems.type,
        icon: workspaceItems.icon,
        iconColor: workspaceItems.iconColor,
        databaseId: databases.id,
      })
      .from(workspaceItems)
      .leftJoin(databases, eq(databases.itemId, workspaceItems.id))
      .where(and(inArray(workspaceItems.id, wantedItemIds), eq(workspaceItems.workspaceId, workspaceId)));
    for (const item of found) {
      linkTargets.set(item.id, {
        title: item.title,
        type: item.type,
        icon: item.icon,
        iconColor: item.iconColor,
        databaseId: item.databaseId ?? null,
      });
    }
  }

  // 4. Agent activity, once, for however many rows the hungriest block wants.
  const activityLimit = goodBlocks.reduce((max, b) => (b.type === 'activity' ? Math.max(max, b.limit) : max), 0);
  let activityRows: { id: string; tool: string; status: 'success' | 'error'; actor: string | null; createdAt: Date }[] = [];
  if (activityLimit > 0) {
    activityRows = await db
      .select({
        id: agentActivity.id,
        tool: agentActivity.tool,
        status: agentActivity.status,
        actor: sql<string | null>`coalesce(${agentTokens.name}, ${oauthAccessTokens.agentName})`,
        createdAt: agentActivity.createdAt,
      })
      .from(agentActivity)
      .leftJoin(agentTokens, eq(agentActivity.tokenId, agentTokens.id))
      .leftJoin(oauthAccessTokens, eq(agentActivity.oauthTokenId, oauthAccessTokens.id))
      .where(eq(agentActivity.workspaceId, workspaceId))
      .orderBy(desc(agentActivity.createdAt))
      .limit(activityLimit);
  }

  // 5. Per-block computation over the already-loaded data.
  const blocks: ResolvedBlock[] = parsed.blocks.map((entry) => {
    if (!entry.ok) return { kind: 'invalid', id: entry.id, error: entry.error };
    const block = entry.block;

    switch (block.type) {
      case 'text':
        return { kind: 'text', block };

      case 'links':
        return {
          kind: 'links',
          block,
          links: block.items.map((item) => {
            const target = linkTargets.get(item.itemId);
            if (!target) {
              return { itemId: item.itemId, label: item.label ?? item.itemId, href: null, icon: null, iconColor: null, type: null };
            }
            const href =
              target.type === 'database'
                ? `/db/${target.databaseId ?? item.itemId}`
                : target.type === 'dashboard'
                  ? `/dashboard/${item.itemId}`
                  : `/page/${item.itemId}`;
            return {
              itemId: item.itemId,
              label: item.label ?? target.title,
              href,
              icon: target.icon,
              iconColor: target.iconColor,
              type: target.type,
            };
          }),
        };

      case 'activity':
        return { kind: 'activity', block, entries: activityRows.slice(0, block.limit) };

      case 'metric': {
        const database = dbById.get(block.source.databaseId);
        if (!database) return { kind: 'unavailable', block, reason: 'database_missing' };
        if (block.columnId && !columnExists(database.schema, block.columnId)) {
          return { kind: 'unavailable', block, reason: 'column_missing' };
        }
        const all = rowsByDb.get(database.id) ?? [];
        const rows = applyFilters(all, block.source.filters ?? []);
        const value = aggregate(rows, block.aggregate, block.columnId);

        let trend: TrendResult | null = null;
        if (block.trend && columnExists(database.schema, block.trend.columnId)) {
          trend = computeTrend(rows, block, block.trend.columnId, block.trend.days);
        }
        return { kind: 'metric', block, value, matched: rows.length, trend };
      }

      case 'chart': {
        const database = dbById.get(block.source.databaseId);
        if (!database) return { kind: 'unavailable', block, reason: 'database_missing' };
        if (!columnExists(database.schema, block.groupBy)) {
          return { kind: 'unavailable', block, reason: 'column_missing' };
        }
        if (block.valueColumnId && !columnExists(database.schema, block.valueColumnId)) {
          return { kind: 'unavailable', block, reason: 'column_missing' };
        }
        const all = rowsByDb.get(database.id) ?? [];
        const rows = applyFilters(all, block.source.filters ?? []);
        const points = buildChartPoints(rows, block, database.schema);
        return { kind: 'chart', block, points, total: points.reduce((s, p) => s + p.value, 0) };
      }

      case 'list': {
        const database = dbById.get(block.source.databaseId);
        if (!database) return { kind: 'unavailable', block, reason: 'database_missing' };
        const all = rowsByDb.get(database.id) ?? [];
        let rows = applyFilters(all, block.source.filters ?? []);
        const total = rows.length;
        if (block.sort) rows = applySorts(rows, [block.sort]);
        const columns = (block.showColumns ?? [])
          .map((id) => database.schema.find((c) => (c as { id?: unknown }).id === id) as { id: string; name: string; type: string } | undefined)
          .filter((c): c is { id: string; name: string; type: string } => !!c);
        return { kind: 'list', block, rows: rows.slice(0, block.limit), total, columns };
      }

      case 'database_embed': {
        const database = dbById.get(block.databaseId);
        if (!database) return { kind: 'unavailable', block, reason: 'database_missing' };
        const view = pickEmbedView(database, block.viewId);
        if (!view) return { kind: 'unavailable', block, reason: 'view_missing' };

        const all = rowsByDb.get(database.id) ?? [];
        // `pickEmbedView` only ever returns a table or kanban view, but the
        // DatabaseView union also covers calendars — read the two fields every
        // variant shares rather than narrowing the whole config.
        const config = view.config as { filters?: FilterSpec[]; sorts?: SortSpec[] };
        let rows = applyFilters(all, config.filters ?? []);
        rows = applySorts(rows, config.sorts ?? []);
        const truncated = Math.max(rows.length - block.limit, 0);
        return { kind: 'database_embed', block, database, view, rows: rows.slice(0, block.limit), truncated };
      }
    }
  });

  return { blocks };
}

/** A dashboard embed shows a saved view as-is; only table and kanban are supported. */
function pickEmbedView(database: DashboardDatabase, viewId?: string): DatabaseView | null {
  const views = (database.views ?? []).filter(
    (v) => v?.config?.type === 'table' || v?.config?.type === 'kanban',
  );
  if (viewId) return views.find((v) => v.id === viewId) ?? null;
  if (views.length) return views[0];
  // A database with no saved view at all still embeds, as a plain table of its
  // schema — the same fallback `seedDefaultViews` gives the database route.
  return {
    id: 'default',
    name: database.name,
    config: { type: 'table', columnOrder: [], hiddenColumns: [], filters: [], sorts: [], openBehavior: 'center' },
  } as DatabaseView;
}

function aggregate(
  rows: DashboardRowLike[],
  kind: 'count' | 'sum' | 'avg' | 'min' | 'max',
  columnId?: string,
): number | null {
  if (kind === 'count') return rows.length;
  if (!columnId) return null;
  const numbers = rows.map((r) => toNumber(r.properties[columnId])).filter((n): n is number => n != null);
  if (!numbers.length) return null;
  switch (kind) {
    case 'sum':
      return numbers.reduce((s, n) => s + n, 0);
    case 'avg':
      return numbers.reduce((s, n) => s + n, 0) / numbers.length;
    case 'min':
      return Math.min(...numbers);
    case 'max':
      return Math.max(...numbers);
  }
}

function computeTrend(
  rows: DashboardRowLike[],
  block: MetricBlock,
  dateColumnId: string,
  days: number,
): TrendResult | null {
  const now = Date.now();
  const windowMs = days * 24 * 60 * 60 * 1000;
  const currentRows: DashboardRowLike[] = [];
  const previousRows: DashboardRowLike[] = [];

  for (const row of rows) {
    const date = toDate(row.properties[dateColumnId]);
    if (!date) continue;
    const age = now - date.getTime();
    if (age < 0) continue;
    if (age <= windowMs) currentRows.push(row);
    else if (age <= windowMs * 2) previousRows.push(row);
  }

  const current = aggregate(currentRows, block.aggregate, block.columnId);
  const previous = aggregate(previousRows, block.aggregate, block.columnId);
  if (current == null) return null;
  const prev = previous ?? 0;
  const delta = current - prev;
  // No previous period to compare against is not a 100% rise — it is no trend.
  const percent = prev === 0 ? null : (delta / Math.abs(prev)) * 100;
  return { direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat', percent, current, previous: prev };
}

function buildChartPoints(
  rows: DashboardRowLike[],
  block: ChartBlock,
  schema: Record<string, unknown>[],
): ChartPoint[] {
  const column = schema.find((c) => (c as { id?: unknown }).id === block.groupBy) as { type?: string } | undefined;
  const isDateColumn = column?.type === 'date' || column?.type === 'datetime';
  const bucket = block.bucket ?? (isDateColumn ? 'day' : undefined);

  const totals = new Map<string, number>();
  const add = (label: string, amount: number) => totals.set(label, (totals.get(label) ?? 0) + amount);

  for (const row of rows) {
    const amount =
      block.aggregate === 'sum' && block.valueColumnId ? (toNumber(row.properties[block.valueColumnId]) ?? 0) : 1;

    if (isDateColumn && bucket) {
      const date = toDate(row.properties[block.groupBy]);
      if (!date) continue;
      add(bucketLabel(date, bucket), amount);
    } else {
      for (const label of groupValues(row.properties[block.groupBy])) add(label, amount);
    }
  }

  const entries: ChartPoint[] = Array.from(totals.entries()).map(([label, value]) =>
    label === EMPTY_GROUP ? { label: '', value, isEmpty: true } : { label, value },
  );

  // A date axis is chronological and complete; a category axis is ranked and
  // capped, with the tail collapsed so a long-tailed column stays readable.
  if (isDateColumn && bucket) return entries.sort((a, b) => a.label.localeCompare(b.label));

  entries.sort((a, b) => b.value - a.value);
  if (entries.length <= block.limit) return entries;
  const kept = entries.slice(0, block.limit);
  const other = entries.slice(block.limit).reduce((s, e) => s + e.value, 0);
  if (other > 0) kept.push({ label: '', value: other, isOther: true });
  return kept;
}

// -- storage ------------------------------------------------------------------

/** The stored spec for a dashboard item, or null when the item isn't one. */
export async function getDashboardSpecByItemId(
  itemId: string,
): Promise<{ workspaceId: string; item: typeof workspaceItems.$inferSelect; spec: unknown } | null> {
  const [item] = await db.select().from(workspaceItems).where(eq(workspaceItems.id, itemId)).limit(1);
  if (!item || item.type !== 'dashboard') return null;

  const [row] = await db.select({ spec: dashboards.spec }).from(dashboards).where(eq(dashboards.itemId, itemId)).limit(1);
  return { workspaceId: item.workspaceId, item, spec: row?.spec ?? null };
}
