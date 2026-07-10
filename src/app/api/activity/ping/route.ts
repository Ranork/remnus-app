import { NextResponse } from 'next/server';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { auth } from '@/auth';
import { db } from '@/db';
import {
  userSessions,
  workspaceMembers,
  workspaceItems,
  standalonePages,
  databases,
  pages,
} from '@/db/schema';
import { isTauriRequest } from '@/lib/server/platform';

// Heartbeat endpoint. The client pings while the user is active (see
// ActivityTracker). Each ping extends the most recent open session, or opens a
// new one if the last ping was longer than SESSION_GAP_MS ago. Best-effort:
// failures never surface to the user.
//
// The response also carries a cheap `changeVersion` — the max `updatedAt`
// (epoch seconds) across all of the caller's workspaces. Clients piggy-back on
// this single heartbeat to decide whether anything changed (e.g. an edit by
// another user or an MCP/AI agent) and only then call router.refresh(). This
// replaced an unconditional 10s router.refresh() poll that re-fetched the full
// RSC payload (~100 KB) every tick — the dominant Fast Origin Transfer driver.
const SESSION_GAP_MS = 2 * 60 * 1000; // 2 minutes of inactivity ends a session

/**
 * Highest `updatedAt` (epoch seconds) across the user's workspace items,
 * standalone-page content, and database rows. A few cheap indexed aggregates;
 * the returned number only ever needs to be compared for monotonic increase.
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

async function computeChangeVersion(userId: string): Promise<number> {
  const memberships = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId));

  const ids = memberships.map((m) => m.workspaceId);
  if (ids.length === 0) return 0;

  const [items, sps, dbs, rows] = await Promise.all([
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
  ]);

  return Math.max(
    toEpoch(items[0]?.m),
    toEpoch(sps[0]?.m),
    toEpoch(dbs[0]?.m),
    toEpoch(rows[0]?.m),
  );
}

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  // Cheap change-detection signal — computed for everyone (admins included) so
  // their tabs still reflect live edits.
  let changeVersion = 0;
  try {
    changeVersion = await computeChangeVersion(userId);
  } catch {
    // best-effort — a missing version just means "no refresh this tick"
  }

  // Don't track admins — their browsing would create noise rows in the
  // engagement stats they're meant to be reviewing. (Still return changeVersion.)
  if (session.user.role === 'admin') {
    return NextResponse.json({ ok: true, changeVersion });
  }

  try {
    const now = new Date();

    const [latest] = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.userId, userId))
      .orderBy(desc(userSessions.lastSeenAt))
      .limit(1);

    if (latest && now.getTime() - latest.lastSeenAt.getTime() <= SESSION_GAP_MS) {
      const durationSeconds = Math.round((now.getTime() - latest.startedAt.getTime()) / 1000);
      await db
        .update(userSessions)
        .set({ lastSeenAt: now, durationSeconds })
        .where(eq(userSessions.id, latest.id));
    } else {
      await db.insert(userSessions).values({
        userId,
        startedAt: now,
        lastSeenAt: now,
        durationSeconds: 0,
        platform: (await isTauriRequest()) ? 'tauri' : 'web',
      });
    }
  } catch {
    // best-effort tracking — swallow errors
  }

  return NextResponse.json({ ok: true, changeVersion });
}
