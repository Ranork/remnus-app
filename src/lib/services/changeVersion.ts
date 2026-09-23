import { eq, inArray, sql } from 'drizzle-orm';
import { unionAll, type SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { db } from '@/db';
import {
  workspaceMembers,
  workspaceItems,
  standalonePages,
  databases,
  pages,
  pageComments,
  deletedItems,
} from '@/db/schema';

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
 * comments, and deletions.
 *
 * **Deletions matter.** Without the `deleted_items` tombstone aggregate this is a
 * `max(updatedAt)` over surviving rows only — and removing the newest row lowers
 * that maximum rather than raising it, so a delete never advanced the version and
 * never triggered a refresh. Tombstones are insert-only (`services/workspace.ts`
 * writes them, nothing deletes them), so folding `max(deleted_at)` in keeps the
 * number monotonic as well as correct.
 *
 * Emitted as ONE `UNION ALL` statement rather than six awaited queries: this runs
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
  );
}

/** Convenience wrapper: resolve the caller's visible workspaces, then version them. */
export async function changeVersionForUser(
  userId: string,
  workspaceLock: string | null,
): Promise<number> {
  return computeChangeVersion(await visibleWorkspaceIds(userId, workspaceLock));
}
