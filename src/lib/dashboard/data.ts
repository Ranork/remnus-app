import { db } from '@/db';
import { agentActivity, agentTokens, databases, dashboards, oauthAccessTokens, pages, workspaceItems, workspaces } from '@/db/schema';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { DatabaseView } from '@/lib/types/views';
import { applyFilters, applySorts, type FilterSpec, type SortSpec } from '@/lib/tableFilters';
import { activityAtOrAfter, auditVisibleSince } from '@/lib/services/auditRetention';
import { getAgentMetrics, type AgentMetrics } from '@/lib/services/agentMetrics';
import {
  parseDashboardSpec,
  type ActivityBlock,
  type ChartBlock,
  type DashboardBlock,
  type DatabaseEmbedBlock,
  type LinksBlock,
  type ListBlock,
  type MetricBlock,
  type ProjectBlock,
  type SavingsBlock,
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
/**
 * `colorIndex`: the category's palette slot. For a select/status column it is the
 * option's position in the column, so a category keeps its colour when a filter changes
 * the counts or the ranking (colour follows the entity, never its rank); other columns
 * fall back to rank order.
 */
export type ChartPoint = { label: string; value: number; isOther?: boolean; isEmpty?: boolean; colorIndex?: number };

/** One agent call as the activity block lists it; `target` is the page/row/database title. */
export type ActivityCall = { id: string; tool: string; status: 'success' | 'error'; createdAt: Date; target: string | null };

/**
 * A run of calls by one agent connection with no pause longer than SESSION_GAP_MS —
 * what a person means by "Claude worked on this for twenty minutes". Counts cover the
 * calls in the read window; `countsCapped` says the session runs past its edge.
 */
export type ActivitySession = {
  key: string;
  actor: string | null;
  /** Canonical agent id or client name, for the agent's mark. */
  agentName: string | null;
  calls: ActivityCall[];
  callCount: number;
  writeCount: number;
  lastAt: Date;
  /** The agent acted within LIVE_MS of the render: the session gets the steady signal dot. */
  live: boolean;
  countsCapped: boolean;
};

/** Tools that change the workspace — what a human scans an agent's run for. */
export const WRITE_TOOL = /^(create|update|delete|bulk|move|add|restore|set)_/;

const SESSION_GAP_MS = 30 * 60 * 1000;
/** Same "live" window as the project block's last-agent dot. */
const LIVE_MS = 15 * 60 * 1000;
/** Calls read to build sessions: enough to count a long run, cheap on the (workspace, created_at) index. */
const ACTIVITY_WINDOW = 100;
/** Sessions shown in one block. */
const MAX_SESSIONS = 4;

export type TrendResult = { direction: 'up' | 'down' | 'flat'; percent: number | null; current: number; previous: number };

export type ResolvedBlock =
  | { kind: 'metric'; block: MetricBlock; value: number | null; matched: number; trend: TrendResult | null }
  | { kind: 'chart'; block: ChartBlock; points: ChartPoint[]; total: number }
  | { kind: 'database_embed'; block: DatabaseEmbedBlock; database: DashboardDatabase; view: DatabaseView; rows: DashboardRowLike[]; truncated: number }
  | { kind: 'list'; block: ListBlock; rows: DashboardRowLike[]; total: number; columns: { id: string; name: string; type: string }[] }
  | { kind: 'text'; block: TextBlock }
  | { kind: 'links'; block: LinksBlock; links: { itemId: string; label: string; href: string | null; icon: string | null; iconColor: string | null; type: 'page' | 'database' | 'dashboard' | null }[] }
  | { kind: 'activity'; block: ActivityBlock; sessions: ActivitySession[] }
  /** `agentRecent`: an agent called Remnus here in the last 15 minutes. */
  | { kind: 'project'; block: ProjectBlock; workspaceName: string; lastAgentAt: Date | null; agentRecent: boolean }
  | { kind: 'savings'; block: SavingsBlock; metrics: AgentMetrics }
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

  // 4. Agent activity, once: the latest ACTIVITY_WINDOW calls, grouped into sessions,
  //    with the titles of the calls a block will list resolved in one batch.
  const activityLimit = goodBlocks.reduce((max, b) => (b.type === 'activity' ? Math.max(max, b.limit) : max), 0);
  let activitySessions: ActivitySession[] = [];
  if (activityLimit > 0) {
    const rows = await db
      .select({
        id: agentActivity.id,
        tool: agentActivity.tool,
        status: agentActivity.status,
        targetType: agentActivity.targetType,
        targetId: agentActivity.targetId,
        sessionKey: sql<string | null>`coalesce(${agentActivity.tokenId}, ${agentActivity.oauthTokenId})`,
        actor: sql<string | null>`coalesce(${agentTokens.name}, ${oauthAccessTokens.agentName})`,
        agentName: sql<string | null>`coalesce(${agentTokens.agentName}, ${oauthAccessTokens.agentName})`,
        createdAt: agentActivity.createdAt,
      })
      .from(agentActivity)
      .leftJoin(agentTokens, eq(agentActivity.tokenId, agentTokens.id))
      .leftJoin(oauthAccessTokens, eq(agentActivity.oauthTokenId, oauthAccessTokens.id))
      // Same audit window as the audit log itself (services/auditRetention.ts).
      .where(and(eq(agentActivity.workspaceId, workspaceId), activityAtOrAfter(await auditVisibleSince(workspaceId))))
      .orderBy(desc(agentActivity.createdAt))
      .limit(ACTIVITY_WINDOW);
    activitySessions = groupSessions(rows, rows.length === ACTIVITY_WINDOW, activityLimit);
    await resolveCallTargets(workspaceId, activitySessions, rows);
  }

  // 5. The home-dashboard blocks: the workspace's own name, when an agent last
  //    worked here, and the measured savings — each read only if a block asks.
  const wantsProject = goodBlocks.some((b) => b.type === 'project');
  const wantsSavings = goodBlocks.some((b) => b.type === 'savings');
  const [projectInfo, savings] = await Promise.all([
    wantsProject
      ? Promise.all([
          db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1),
          db
            .select({ at: agentActivity.createdAt })
            .from(agentActivity)
            .where(eq(agentActivity.workspaceId, workspaceId))
            .orderBy(desc(agentActivity.createdAt))
            .limit(1),
        ]).then(([[ws], [last]]) => ({ name: ws?.name ?? '', lastAgentAt: last?.at ?? null }))
      : null,
    wantsSavings ? getAgentMetrics({ workspaceId }) : null,
  ]);

  // 6. Per-block computation over the already-loaded data.
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
        return {
          kind: 'activity',
          block,
          sessions: activitySessions.map((session) => ({ ...session, calls: session.calls.slice(0, block.limit) })),
        };

      case 'project':
        return {
          kind: 'project',
          block,
          workspaceName: projectInfo?.name ?? '',
          lastAgentAt: projectInfo?.lastAgentAt ?? null,
          agentRecent: !!projectInfo?.lastAgentAt && Date.now() - projectInfo.lastAgentAt.getTime() < 15 * 60 * 1000,
        };

      case 'savings':
        return { kind: 'savings', block, metrics: savings! };

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

type ActivityRow = {
  id: string;
  tool: string;
  status: 'success' | 'error';
  targetType: string | null;
  targetId: string | null;
  sessionKey: string | null;
  actor: string | null;
  agentName: string | null;
  createdAt: Date;
};

/**
 * Newest-first calls → sessions. A call joins its connection's open session when the
 * gap to that session's oldest call so far is under SESSION_GAP_MS; otherwise it starts
 * an older session. Two agents working at once keep separate sessions.
 */
function groupSessions(rows: ActivityRow[], windowFull: boolean, keepCalls: number): ActivitySession[] {
  const now = Date.now();
  const sessions: ActivitySession[] = [];
  const open = new Map<string, ActivitySession>();
  /** Each session's oldest call so far — the edge a still-older call has to be near. */
  const oldestAt = new Map<ActivitySession, Date>();
  for (const row of rows) {
    const key = row.sessionKey ?? `actor:${row.actor ?? ''}`;
    let session = open.get(key);
    if (!session || oldestAt.get(session)!.getTime() - row.createdAt.getTime() > SESSION_GAP_MS) {
      if (sessions.length >= MAX_SESSIONS && !session) continue;
      if (sessions.length >= MAX_SESSIONS) {
        open.delete(key);
        continue;
      }
      session = {
        key: `${key}:${row.createdAt.getTime()}`,
        actor: row.actor,
        agentName: row.agentName,
        calls: [],
        callCount: 0,
        writeCount: 0,
        lastAt: row.createdAt,
        live: now - row.createdAt.getTime() < LIVE_MS,
        countsCapped: false,
      };
      sessions.push(session);
      open.set(key, session);
    }
    session.callCount++;
    if (WRITE_TOOL.test(row.tool)) session.writeCount++;
    oldestAt.set(session, row.createdAt);
    if (session.calls.length < keepCalls) {
      session.calls.push({ id: row.id, tool: row.tool, status: row.status, createdAt: row.createdAt, target: null });
    }
  }
  // The window's oldest call may belong to a run that started earlier still.
  const last = rows[rows.length - 1];
  if (windowFull && last) {
    const key = last.sessionKey ?? `actor:${last.actor ?? ''}`;
    const session = open.get(key);
    if (session) session.countsCapped = true;
  }
  return sessions;
}

/**
 * Titles for the calls the block lists — one batched read per kind of target (an item,
 * a database row, a database), scoped to this workspace. A target that is gone stays
 * null and the call shows its tool alone.
 */
async function resolveCallTargets(workspaceId: string, sessions: ActivitySession[], rows: ActivityRow[]): Promise<void> {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ids = new Set<string>();
  for (const session of sessions) {
    for (const call of session.calls) {
      const targetId = byId.get(call.id)?.targetId;
      if (targetId && targetId !== workspaceId) ids.add(targetId);
    }
  }
  if (!ids.size) return;
  const list = [...ids];

  const [items, rowsTitles, dbs] = await Promise.all([
    db
      .select({ id: workspaceItems.id, title: workspaceItems.title })
      .from(workspaceItems)
      .where(and(eq(workspaceItems.workspaceId, workspaceId), inArray(workspaceItems.id, list))),
    db
      .select({ id: pages.id, title: pages.title })
      .from(pages)
      .innerJoin(databases, eq(pages.databaseId, databases.id))
      .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
      .where(and(eq(workspaceItems.workspaceId, workspaceId), inArray(pages.id, list))),
    db
      .select({ id: databases.id, title: databases.name })
      .from(databases)
      .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
      .where(and(eq(workspaceItems.workspaceId, workspaceId), inArray(databases.id, list))),
  ]);
  const titles = new Map<string, string>();
  for (const r of [...items, ...rowsTitles, ...dbs]) if (r.title) titles.set(r.id, r.title);

  for (const session of sessions) {
    for (const call of session.calls) {
      const targetId = byId.get(call.id)?.targetId;
      call.target = targetId ? titles.get(targetId) ?? null : null;
    }
  }
}

function buildChartPoints(
  rows: DashboardRowLike[],
  block: ChartBlock,
  schema: Record<string, unknown>[],
): ChartPoint[] {
  const column = schema.find((c) => (c as { id?: unknown }).id === block.groupBy) as
    | { type?: string; options?: (string | { value?: string })[] }
    | undefined;
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
  let kept = entries.slice(0, block.limit);
  const other = entries.slice(block.limit).reduce((s, e) => s + e.value, 0);

  // Palette slots: an option keeps its own slot (its place in the column); anything else
  // takes the next one by rank. Past eight distinct slots a chart would have to cycle
  // hues, so it falls back to plain rank order instead.
  const optionOrder = (column?.options ?? []).map((o) => (typeof o === 'string' ? o : String(o?.value ?? '')));
  const slotOf = (label: string) => optionOrder.indexOf(label);
  const usesOptionSlots = kept.every((p) => p.isEmpty || slotOf(p.label) < 8);
  const taken = new Set(usesOptionSlots ? kept.map((p) => slotOf(p.label)).filter((i) => i >= 0) : []);
  let free = 0;
  kept = kept.map((p, i) => {
    if (!usesOptionSlots) return { ...p, colorIndex: i };
    if (slotOf(p.label) >= 0) return { ...p, colorIndex: slotOf(p.label) };
    while (taken.has(free)) free++;
    taken.add(free);
    return { ...p, colorIndex: free };
  });

  // A stacked bar reads left to right in the column's own order (to-do → done), not by size.
  if (block.variant === 'stack' && optionOrder.length) {
    const rank = (p: ChartPoint) => (p.isEmpty ? Infinity : slotOf(p.label) >= 0 ? slotOf(p.label) : optionOrder.length);
    kept.sort((a, b) => rank(a) - rank(b));
  }

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
