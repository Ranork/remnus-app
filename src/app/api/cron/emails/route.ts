// Daily lifecycle-email cron (Vercel Cron → GET, authorized via the
// `Authorization: Bearer ${CRON_SECRET}` header Vercel attaches automatically
// when the CRON_SECRET env var is set). Two jobs, each capped per run and
// throttled to MAIL_SEND_RATE:
//
//   agent_nudge — users who signed up 24h–7d ago and never connected an agent
//                 (no PAT, no OAuth token). Sent once per user, ever.
//   inactivity  — users whose last activity (latest user_sessions heartbeat,
//                 falling back to signup) is 4–30 days old. Sent once per
//                 inactivity episode: only if no inactivity email was sent
//                 AFTER their last activity.
//
// Suppression rules (canReceiveEmail): demo/admin excluded via role filter,
// unsubscribed + bounced/complained users skipped.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { agentTokens, emailLog, oauthAccessTokens, users, userSessions } from '@/db/schema';
import { agentNudgeEmail, inactivityEmail } from '@/lib/email/templates';
import { buildUnsubUrl, isMailConfigured, sendEmail, sleep, throttleDelayMs } from '@/lib/email/send';

const NUDGE_MIN_AGE_MS = 24 * 60 * 60 * 1000;       // signed up at least 1 day ago
const NUDGE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;   // ...but no longer than a week (no backfill)
const INACTIVITY_MS = 4 * 24 * 60 * 60 * 1000;      // considered away after 4 days
const INACTIVITY_MAX_MS = 30 * 24 * 60 * 60 * 1000; // don't email accounts dormant > 30 days
const MAX_PER_JOB = 50;                              // per-run send cap per job

type Candidate = {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: Date;
};

async function runAgentNudge(now: Date): Promise<{ sent: number; failed: number }> {
  const candidates: Candidate[] = await db
    .select({ id: users.id, email: users.email, name: users.name, createdAt: users.createdAt })
    .from(users)
    .where(
      and(
        eq(users.role, 'user'),
        isNull(users.emailSuppressed),
        isNull(users.emailUnsubscribedAt),
        lt(users.createdAt, new Date(now.getTime() - NUDGE_MIN_AGE_MS)),
        gte(users.createdAt, new Date(now.getTime() - NUDGE_MAX_AGE_MS)),
      ),
    )
    .limit(200);
  if (candidates.length === 0) return { sent: 0, failed: 0 };

  const ids = candidates.map((c) => c.id);
  const [pats, oauths, alreadyNudged] = await Promise.all([
    db.select({ userId: agentTokens.createdBy }).from(agentTokens).where(inArray(agentTokens.createdBy, ids)),
    db.select({ userId: oauthAccessTokens.userId }).from(oauthAccessTokens).where(inArray(oauthAccessTokens.userId, ids)),
    db
      .select({ userId: emailLog.userId })
      .from(emailLog)
      .where(and(inArray(emailLog.userId, ids), eq(emailLog.kind, 'agent_nudge'), eq(emailLog.status, 'sent'))),
  ]);
  const skip = new Set<string | null>([
    ...pats.map((r) => r.userId),
    ...oauths.map((r) => r.userId),
    ...alreadyNudged.map((r) => r.userId),
  ]);

  let sent = 0;
  let failed = 0;
  for (const user of candidates) {
    if (sent + failed >= MAX_PER_JOB) break;
    if (!user.email || skip.has(user.id)) continue;
    const { subject, html } = agentNudgeEmail(user.name, buildUnsubUrl(user.id, user.email));
    const res = await sendEmail({
      to: user.email,
      userId: user.id,
      kind: 'agent_nudge',
      subject,
      html,
      unsubUserId: user.id,
    });
    if (res.ok) sent++; else failed++;
    await sleep(throttleDelayMs());
  }
  return { sent, failed };
}

async function runInactivity(now: Date): Promise<{ sent: number; failed: number }> {
  const candidates: Candidate[] = await db
    .select({ id: users.id, email: users.email, name: users.name, createdAt: users.createdAt })
    .from(users)
    .where(and(eq(users.role, 'user'), isNull(users.emailSuppressed), isNull(users.emailUnsubscribedAt)))
    .limit(1000);
  if (candidates.length === 0) return { sent: 0, failed: 0 };

  const ids = candidates.map((c) => c.id);

  // Latest heartbeat per user (raw epoch seconds via SQLite max()).
  const lastSeenRows = await db
    .select({ userId: userSessions.userId, last: sql<number>`max(${userSessions.lastSeenAt})` })
    .from(userSessions)
    .where(inArray(userSessions.userId, ids))
    .groupBy(userSessions.userId);
  const lastSeen = new Map(lastSeenRows.map((r) => [r.userId, new Date(Number(r.last) * 1000)]));

  // Latest successful inactivity email per user (epoch seconds).
  const lastMailRows = await db
    .select({ userId: emailLog.userId, last: sql<number>`max(${emailLog.createdAt})` })
    .from(emailLog)
    .where(and(inArray(emailLog.userId, ids), eq(emailLog.kind, 'inactivity'), eq(emailLog.status, 'sent')))
    .groupBy(emailLog.userId);
  const lastMailed = new Map(lastMailRows.map((r) => [r.userId, new Date(Number(r.last) * 1000)]));

  let sent = 0;
  let failed = 0;
  for (const user of candidates) {
    if (sent + failed >= MAX_PER_JOB) break;
    if (!user.email) continue;

    const activity = lastSeen.get(user.id) ?? user.createdAt;
    const awayMs = now.getTime() - activity.getTime();
    if (awayMs < INACTIVITY_MS || awayMs > INACTIVITY_MAX_MS) continue;

    // One email per inactivity episode: skip if already mailed after their
    // last activity (they must come back before we'd ever nudge again).
    const mailedAt = lastMailed.get(user.id);
    if (mailedAt && mailedAt > activity) continue;

    const { subject, html } = inactivityEmail(user.name, buildUnsubUrl(user.id, user.email));
    const res = await sendEmail({
      to: user.email,
      userId: user.id,
      kind: 'inactivity',
      subject,
      html,
      unsubUserId: user.id,
    });
    if (res.ok) sent++; else failed++;
    await sleep(throttleDelayMs());
  }
  return { sent, failed };
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isMailConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'mail_not_configured' });
  }

  const now = new Date();
  const nudge = await runAgentNudge(now);
  const inactivity = await runInactivity(now);

  console.log(`[cron/emails] nudge sent:${nudge.sent} failed:${nudge.failed} — inactivity sent:${inactivity.sent} failed:${inactivity.failed}`);
  return NextResponse.json({ ok: true, nudge, inactivity });
}
