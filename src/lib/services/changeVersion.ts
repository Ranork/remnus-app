import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { unionAll, type SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { db } from '@/db';
import {
  workspaces,
  workspaceMembers,
  workspaceItems,
  standalonePages,
  databases,
  pages,
  pageComments,
  deletedItems,
  agentActivity,
} from '@/db/schema';
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
 * workspace containing even one legacy row. Ignore non-integer values so the
 * aggregate only ever considers real epoch timestamps.
 */
const epochMax = (col: SQLiteColumn) =>
  sql<number>`max(case when typeof(${col}) = 'integer' then ${col} else 0 end)`;

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

/**
 * Highest change timestamp (epoch seconds) across everything the caller can see:
 * workspace items, standalone-page content, database schema/views, database rows,
 * comments, deletions, and the workspace rows themselves.
 *
 * **Deletions matter.** Without the `deleted_items` tombstone aggregate this is a
 * `max(updatedAt)` over surviving rows only — and removing the newest row lowers
 * that maximum rather than raising it, so a delete never advanced the version and
 * never triggered a refresh. Tombstones are insert-only (`services/workspace.ts`
 * writes them, nothing deletes them), so folding `max(deleted_at)` in keeps the
 * number monotonic as well as correct.
 *
 * Emitted as ONE `UNION ALL` statement rather than seven awaited queries: this runs
 * on every poll — as often as every few seconds in a project window watching an
 * agent write — and against Turso the round-trips, not the aggregates, are the
 * cost. Every branch is an indexed aggregate.
 */
export async function computeChangeVersion(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  return changeVersionFromRows(await changeVersionQuery(ids));
}

/** Fold the per-table maxima `changeVersionQuery` returns into one number. */
export function changeVersionFromRows(rows: Array<{ m: unknown }>): number {
  return rows.reduce<number>((max, row) => Math.max(max, toEpoch(row.m)), 0);
}

/**
 * The unawaited statement behind `computeChangeVersion`, so a caller that needs
 * the version next to other reads can ship both in one `db.batch` round-trip
 * (the prepare_context corpus key does). `ids` must be non-empty.
 */
export function changeVersionQuery(ids: string[]) {
  return unionAll(
    db
      .select({ m: epochMax(workspaceItems.updatedAt) })
      .from(workspaceItems)
      .where(inArray(workspaceItems.workspaceId, ids)),
    db
      .select({ m: epochMax(standalonePages.updatedAt) })
      .from(standalonePages)
      .innerJoin(workspaceItems, eq(standalonePages.itemId, workspaceItems.id))
      .where(inArray(workspaceItems.workspaceId, ids)),
    // Database schema/view edits (e.g. renaming a view, adding a column) bump
    // only `databases.updatedAt`, so without this a view change never refreshed.
    db
      .select({ m: epochMax(databases.updatedAt) })
      .from(databases)
      .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
      .where(inArray(workspaceItems.workspaceId, ids)),
    db
      .select({ m: epochMax(pages.updatedAt) })
      .from(pages)
      .innerJoin(databases, eq(pages.databaseId, databases.id))
      .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
      .where(inArray(workspaceItems.workspaceId, ids)),
    // page_comments carries its own workspaceId (it can point at either a
    // standalone page or a database row) so no join is needed — otherwise an
    // agent's MCP add_comment call would never show up for a viewer already
    // on that page until they manually reloaded.
    db
      .select({ m: epochMax(pageComments.updatedAt) })
      .from(pageComments)
      .where(inArray(pageComments.workspaceId, ids)),
    // Tombstones — the only trace a hard-deleted page leaves behind.
    db
      .select({ m: epochMax(deletedItems.deletedAt) })
      .from(deletedItems)
      .where(inArray(deletedItems.workspaceId, ids)),
    // The workspace row itself: rename, icon and home dashboard write it, and
    // `touchWorkspaces` bumps it for every change that has no versioned column
    // of its own (sidebar order, membership, access requests …). A primary-key
    // lookup over a handful of rows, so it costs the poll next to nothing.
    db
      .select({ m: epochMax(workspaces.updatedAt) })
      .from(workspaces)
      .where(inArray(workspaces.id, ids)),
  );
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
 * The heartbeat's answer: the change version plus whether an agent has called
 * Remnus in any of these workspaces within `AGENT_ACTIVE_WINDOW_MS` — the cue for a
 * normal tab to poll as closely as a project window while it lasts (see
 * `ActivityTracker`). One batch, one round trip. The agent probe is an index seek on
 * `agent_activity (workspace_id, created_at)` stopped at the first hit, so it reads
 * a row or none however large the audit log grows. Every MCP call logs a row, reads
 * included, so an agent usually "arrives" before its first write does.
 */
export async function heartbeatSignals(
  ids: string[],
  now = Date.now(),
): Promise<{ version: number; agentActive: boolean }> {
  if (ids.length === 0) return { version: 0, agentActive: false };
  const [versionRows, agentRows] = await db.batch([
    changeVersionQuery(ids),
    db
      .select({ one: sql<number>`1` })
      .from(agentActivity)
      .where(and(
        inArray(agentActivity.workspaceId, ids),
        gte(agentActivity.createdAt, new Date(now - AGENT_ACTIVE_WINDOW_MS)),
      ))
      .limit(1),
  ]);
  return { version: changeVersionFromRows(versionRows), agentActive: agentRows.length > 0 };
}
