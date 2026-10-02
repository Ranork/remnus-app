import { NextResponse } from 'next/server';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { getSessionAllowingWorkspaceLock } from '@/lib/auth/session';
import { lockClaimsOf } from '@/lib/auth/workspaceLock';
import { db } from '@/db';
import { userSessions, demoSessions } from '@/db/schema';
import { isTauriRequest } from '@/lib/server/platform';
import { heartbeatSignalsForUser, signalExtras } from '@/lib/services/changeVersion';

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
//
// `agent: true` (sent only when set, to keep the body small) says an agent has
// called Remnus in one of the caller's workspaces in the last few minutes; a
// normal tab then polls the change signal as closely as a project window until
// the flag drops. The heartbeat is the one place that asks — every 30s, not every
// poll.
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
  // their tabs still reflect live edits. It (one round trip) and the session
  // bookkeeping below are independent, so they run side by side: the reply waits for
  // the slower of the two, not their sum.
  const signal = heartbeatSignalsForUser(userId, lockClaimsOf(session?.user).workspaceLock ?? null)
    .catch(() => null); // best-effort — a missing version just means "no refresh this tick"

  // Don't track admins — their browsing would create noise rows in the
  // engagement stats they're meant to be reviewing. (Still return changeVersion.)
  if (session.user.role !== 'admin') await trackSession(userId, session.user.role);

  const result = await signal;
  const changeVersion = result?.version ?? 0;
  const extras = result ? signalExtras(changeVersion, result.count) : {};
  return NextResponse.json({ ok: true, changeVersion, ...extras, ...(result?.agentActive ? { agent: true } : {}) });
}

async function trackSession(userId: string, role: string) {
  try {
    const now = new Date();

    // Extend the latest session in ONE statement (V2 R9.8) — it used to be a read, then
    // an update. Nothing matches when the latest session is older than the gap (or a
    // legacy TEXT stamp), and only then does a new session cost a second statement.
    const latest = db
      .select({ id: userSessions.id })
      .from(userSessions)
      .where(eq(userSessions.userId, userId))
      .orderBy(desc(userSessions.lastSeenAt))
      .limit(1);
    const extended = await db
      .update(userSessions)
      .set({ lastSeenAt: now, durationSeconds: sql`${Math.floor(now.getTime() / 1000)} - ${userSessions.startedAt}` })
      .where(and(
        sql`${userSessions.id} = (${latest})`,
        sql`typeof(${userSessions.lastSeenAt}) = 'integer'`,
        gte(userSessions.lastSeenAt, new Date(now.getTime() - SESSION_GAP_MS)),
      ))
      .returning({ id: userSessions.id });

    if (extended.length === 0) {
      await db.insert(userSessions).values({
        userId,
        startedAt: now,
        lastSeenAt: now,
        durationSeconds: 0,
        platform: (await isTauriRequest()) ? 'tauri' : 'web',
      });
    }

    if (role === 'demo') await touchDemoSession(userId, now);
  } catch {
    // best-effort tracking — swallow errors
  }
}
