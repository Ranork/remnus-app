import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getSessionAllowingWorkspaceLock } from '@/lib/auth/session';
import { lockClaimsOf } from '@/lib/auth/workspaceLock';
import { db } from '@/db';
import { userSessions, demoSessions } from '@/db/schema';
import { isTauriRequest } from '@/lib/server/platform';
import { changeVersionForUser } from '@/lib/services/changeVersion';

// Heartbeat endpoint. The client pings while the user is active (see
// ActivityTracker). Each ping extends the most recent open session, or opens a
// new one if the last ping was longer than SESSION_GAP_MS ago. Best-effort:
// failures never surface to the user.
//
// The response also carries the cheap `changeVersion` (see
// services/changeVersion.ts) so a tab that is only heartbeating still learns
// that something changed. The dedicated poll for it is GET
// /api/activity/changes, which runs at its own, much faster cadence and does no
// session bookkeeping — this endpoint must not be called every few seconds, as
// every call writes a session row.
const SESSION_GAP_MS = 2 * 60 * 1000; // 2 minutes of inactivity ends a session

/**
 * Extends the caller's durable demo-usage row (see `demo_sessions`, migration
 * 0044). Demo accounts — and their `user_sessions` rows — are reaped 6h after
 * signup, so this is the only record of demo usage that survives long enough for
 * the admin panel to chart it.
 *
 * One row per demo account (opened by `loginAsDemo`), NOT one per activity gap:
 * a "demo usage" is a visitor trying the product once, even if they wander off
 * and come back. `activeSeconds` therefore ACCUMULATES each tick's delta, and
 * only when that delta lands inside the presence window — a tab left open for an
 * hour must not be reported as an hour-long demo.
 */
async function touchDemoSession(userId: string, now: Date) {
  const [row] = await db
    .select()
    .from(demoSessions)
    .where(eq(demoSessions.userId, userId))
    .orderBy(desc(demoSessions.startedAt))
    .limit(1);

  // No row = a demo account predating migration 0044 (or an insert that failed
  // at login) — open one now rather than losing the visit entirely.
  if (!row) {
    await db.insert(demoSessions).values({
      userId,
      startedAt: now,
      lastSeenAt: now,
      activeSeconds: 0,
    });
    return;
  }

  const deltaMs = now.getTime() - row.lastSeenAt.getTime();
  const gained = deltaMs > 0 && deltaMs <= SESSION_GAP_MS ? Math.round(deltaMs / 1000) : 0;

  await db
    .update(demoSessions)
    .set({ lastSeenAt: now, activeSeconds: row.activeSeconds + gained })
    .where(eq(demoSessions.id, row.id));
}

export async function POST() {
  // Project windows heartbeat too — live refresh is how a human watches an agent work —
  // but only their own workspace counts toward the change signal.
  const session = await getSessionAllowingWorkspaceLock();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  // Cheap change-detection signal — computed for everyone (admins included) so
  // their tabs still reflect live edits.
  let changeVersion = 0;
  try {
    changeVersion = await changeVersionForUser(userId, lockClaimsOf(session?.user).workspaceLock ?? null);
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

    if (session.user.role === 'demo') await touchDemoSession(userId, now);
  } catch {
    // best-effort tracking — swallow errors
  }

  return NextResponse.json({ ok: true, changeVersion });
}
