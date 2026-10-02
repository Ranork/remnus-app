import { eq, inArray, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { workspaces, workspaceMembers } from '@/db/schema';
import { AGENT_ACTIVE_WINDOW_MS } from '@/lib/agentPresence';

/**
 * The "did anything change?" signal behind live UI refresh.
 *
 * A single monotonic epoch-seconds number per caller. Clients poll it (see
 * `/api/activity/changes`, and the heartbeat at `/api/activity/ping` which
 * carries the same number) and only call `router.refresh()` when it actually
 * advances — so a quiet tab transfers a few bytes per tick instead of
 * re-fetching the full RSC payload (~100 KB). That blind poll was the main
 * driver of Vercel Fast Origin Transfer, which is why the cheap version number
 * exists at all.
 *
 * Rows written before the explicit-timestamp fix (see the createdAt gotcha in
 * AGENTS.md) store `updated_at` as TEXT ('YYYY-MM-DD HH:MM:SS') rather than an
 * epoch integer. SQLite's type ordering ranks TEXT above INTEGER, so a bare
 * `max()` returns that TEXT value for the whole table and pins it there forever
 * — `Number()` then yields NaN, which JSON serializes to `null`, and the client
 * drops the tick. The result was that live refresh silently never fired in any
 * workspace containing even one legacy row. Only integer timestamps may count.
 *
 * How they are kept out matters for cost (V2 R9). This was
 * `max(case when typeof(col) = 'integer' then col else 0 end)`: correct, but an
 * expression SQLite cannot answer from an index, so every poll read every row of
 * the caller's workspaces — all their items, every row of every database — and,
 * for comments, which had no workspace index, the whole table across all tenants.
 * Now each maximum is `max(col) … where col < EPOCH_CEILING`: TEXT compares above
 * every number in SQLite, so the bound drops exactly the legacy rows the CASE
 * zeroed, and a plain max under a range on an index's second column is one seek
 * to the end of that range (migration 0055 adds the `(…, updated_at)` indexes).
 * Same number, a few index entries per workspace and database instead of a scan.
 */
const EPOCH_CEILING = 100_000_000_000; // epoch seconds: the year 5138

/** Coerce a possibly-null/NaN aggregate into a comparable epoch number. */
function toEpoch(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** The workspaces a change signal may report on: the caller's memberships, narrowed
 *  to the single workspace when this is a project window (workspace-locked session). */
export async function visibleWorkspaceIds(
  userId: string,
  workspaceLock: string | null,
): Promise<string[]> {
  const memberships = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId));

  return memberships
    .map((m) => m.workspaceId)
    .filter((id) => !workspaceLock || id === workspaceLock);
}

/** The same set as `visibleWorkspaceIds`, as a subquery — so the signal endpoints
 *  need no separate membership read before the version (one round trip, not two). */
function visibleWorkspacesSql(userId: string, workspaceLock: string | null): SQL {
  return workspaceLock
    ? sql`select workspace_id as id from workspace_members where user_id = ${userId} and workspace_id = ${workspaceLock}`
    : sql`select workspace_id as id from workspace_members where user_id = ${userId}`;
}

function idListSql(ids: string[]): SQL {
  return sql`select value as id from json_each(${JSON.stringify(ids)})`;
}

/**
 * Highest change timestamp (epoch seconds) across everything in the workspace set:
 * workspace items, standalone-page content, database schema/views, database rows,
 * comments, deletions, and the workspace rows themselves. Returns one row
 * `{ m, n }`: the version and how many workspaces the set holds.
 *
 * **Deletions matter.** Without the `deleted_items` tombstone maximum this is a
 * `max(updatedAt)` over surviving rows only — and removing the newest row lowers
 * that maximum rather than raising it, so a delete never advanced the version and
 * never triggered a refresh. Tombstones are insert-only (`services/workspace.ts`
 * writes them, nothing deletes them), so folding `max(deleted_at)` in keeps the
 * number monotonic as well as correct.
 *
 * ONE statement: it runs on every poll — as often as every few seconds in a project
 * window watching an agent write — and against Turso the round-trips are a cost of
 * their own. Per workspace: one seek each into items, comments and tombstones, and the
 * workspace row — nothing grows with the workspace (V2 R9.8). Body, schema/view and row
 * edits arrive through `workspaces.content_updated_at`, which SQLite triggers keep at the
 * newest such `updated_at` on every write path (migration 0056, `src/db/contentClock.ts`);
 * before it, each poll sought every item's body, database and rows.
 */
function changeVersionSql(workspaceSet: SQL): SQL {
  const c = sql.raw(String(EPOCH_CEILING));
  // Branches, in order: items; comments (they carry their own workspace_id, so an agent's
  // add_comment reaches a viewer already on that page); tombstones (the only trace a
  // hard-deleted page leaves); the workspace row (rename, icon, home dashboard, every
  // touchWorkspaces() bump); then the content clock — content edits (standalone pages),
  // schema/view edits (databases) and rows, kept by the 0056 triggers.
  return sql`with ws(id) as (${workspaceSet})
select max(m) as m, (select count(*) from ws) as n from (
  select (select max(updated_at) from workspace_items where workspace_id = ws.id and updated_at < ${c}) as m from ws
  union all
  select (select max(updated_at) from page_comments where workspace_id = ws.id and updated_at < ${c}) from ws
  union all
  select (select max(deleted_at) from deleted_items where workspace_id = ws.id and deleted_at < ${c}) from ws
  union all
  select max(updated_at) from workspaces where id in (select id from ws) and updated_at < ${c}
  union all
  select max(content_updated_at) from workspaces where id in (select id from ws) and content_updated_at < ${c}
)`;
}

/** The version for an explicit workspace set (an MCP token's one workspace, the corpus key). */
export async function computeChangeVersion(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  return changeVersionFromRows(await changeVersionQuery(ids));
}

/** Fold the rows `changeVersionQuery` returns into one number. */
export function changeVersionFromRows(rows: Array<{ m: unknown }>): number {
  return rows.reduce<number>((max, row) => Math.max(max, toEpoch(row.m)), 0);
}

/**
 * The unawaited statement behind `computeChangeVersion`, so a caller that needs
 * the version next to other reads can ship both in one `db.batch` round-trip
 * (the prepare_context corpus key does). `ids` must be non-empty.
 */
export function changeVersionQuery(ids: string[]) {
  return db.all<{ m: unknown; n: unknown }>(changeVersionSql(idListSql(ids)));
}

/**
 * The change signal for a signed-in caller: `version` over every workspace they can
 * see (narrowed to the window's one in a project window) and `count`, the size of that
 * set (`n` on the wire — see `signalExtras`). Membership is resolved inside the same
 * statement, so this is one round trip.
 */
export async function changeSignalForUser(
  userId: string,
  workspaceLock: string | null,
): Promise<{ version: number; count: number }> {
  const [row] = await db.all<{ m: unknown; n: unknown }>(changeSignalSql(userId, workspaceLock));
  return { version: toEpoch(row?.m), count: toEpoch(row?.n) };
}

/** The statement behind `changeSignalForUser` (exported for `bench:change-signal`). */
export function changeSignalSql(userId: string, workspaceLock: string | null): SQL {
  return changeVersionSql(visibleWorkspacesSql(userId, workspaceLock));
}

/**
 * Advance the change signal for these workspaces without claiming any item
 * changed. For writes that land in no versioned column — reordering the
 * sidebar, a membership or access request, a deleted comment — and would
 * otherwise never reach another open tab. Deliberately NOT a bump of the items'
 * own `updatedAt`: that would report a reorder of thirty siblings as thirty
 * edits to `get_changes_since` and the "recently updated" lists.
 *
 * Also the joiner's signal: a workspace that just became visible to someone
 * carries a fresh `updatedAt`, so their version advances and it appears.
 */
export async function touchWorkspaces(...ids: Array<string | null | undefined>): Promise<void> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return;
  await db.update(workspaces).set({ updatedAt: new Date() }).where(inArray(workspaces.id, unique));
}

/**
 * The two small fields that ride with every change version:
 *
 * - `n` — how many workspaces the caller can see. A member REMOVED from a workspace
 *   never sees the version advance (their set only loses a branch), so the client
 *   treats a change in `n` as a change (`ActivityTracker`). Adds are caught too.
 * - `h: 1` — only while the version's second can still receive writes (+250 ms for
 *   clock skew). A consumer that refetches on its own clock and has no render time to
 *   compare (Tauri's `TabHost`) refetches once more after a hot version cools — the
 *   same-second write it may have missed. Absent otherwise, to keep the body tiny.
 */
export function signalExtras(version: number, visibleCount: number, now = Date.now()): { n: number; h?: 1 } {
  return now < (version + 1) * 1000 + 250 ? { n: visibleCount, h: 1 } : { n: visibleCount };
}

/** How recently an agent must have called Remnus for a normal tab to watch closely.
 *  Defined with the presence layer (`lib/agentPresence.ts`): the sidebar's "working"
 *  is this same window, so the two can never disagree. */
export { AGENT_ACTIVE_WINDOW_MS };

/**
 * The heartbeat's answer: the change signal plus whether an agent has called Remnus
 * in any of the caller's workspaces within `AGENT_ACTIVE_WINDOW_MS` — the cue for a
 * normal tab to poll as closely as a project window while it lasts (see
 * `ActivityTracker`). One batch, one round trip, membership included. The agent probe
 * is an index seek on `agent_activity (workspace_id, created_at)` stopped at the first
 * hit, so it reads a row or none however large the audit log grows. Every MCP call
 * logs a row, reads included, so an agent usually "arrives" before its first write
 * does.
 */
export async function heartbeatSignalsForUser(
  userId: string,
  workspaceLock: string | null,
  now = Date.now(),
): Promise<{ version: number; count: number; agentActive: boolean }> {
  const visible = visibleWorkspacesSql(userId, workspaceLock);
  const since = Math.floor((now - AGENT_ACTIVE_WINDOW_MS) / 1000);
  const [versionRows, agentRows] = await db.batch([
    db.all<{ m: unknown; n: unknown }>(changeVersionSql(visible)),
    db.all<{ one: number }>(sql`select 1 as one from agent_activity
      where workspace_id in (${visible}) and created_at >= ${since} and created_at < ${sql.raw(String(EPOCH_CEILING))} limit 1`),
  ]);
  return {
    version: toEpoch(versionRows[0]?.m),
    count: toEpoch(versionRows[0]?.n),
    agentActive: agentRows.length > 0,
  };
}
