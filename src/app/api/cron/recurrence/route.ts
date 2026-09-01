// Daily cron: extends every recurring series' materialization horizon.
//
// The primary top-up is read-triggered (CalendarView calls
// `loadRecurrenceState` with the visible window), which is what lets the
// feature work on a self-hosted install with no scheduler at all. This job
// only covers the case that path cannot: someone whose repeating tasks should
// keep appearing even though nobody has opened that calendar in months — and,
// for shared workspaces, so a teammate's cards are already there when they
// look rather than being conjured by their own page load.
//
// Idempotent by construction: `materializeSeries` skips dates that already
// have a card, and the UNIQUE (series_id, occurrence_date) index is the
// backstop if this ever overlaps with a read-triggered run.
//
// Authorized the same way as the other crons — `Authorization: Bearer
// ${CRON_SECRET}`, which Vercel attaches automatically when CRON_SECRET is set.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { recurrenceSeries } from '@/db/schema';
import { defaultHorizon } from '@/lib/recurrence/rule';
import { materializeSeries } from '@/lib/services/recurrence';
import { purgeExpiredSnapshots } from '@/lib/services/snapshots';

/** Bounded so one run always finishes inside `maxDuration`. Series whose
 *  horizon is already far enough out are filtered in-process and cost nothing,
 *  so this ceiling only ever bites on a genuine backlog — which the next
 *  night's run picks up. */
const MAX_SERIES_PER_RUN = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const horizon = defaultHorizon();

  const rows = await db
    .select({ id: recurrenceSeries.id, materializedUntil: recurrenceSeries.materializedUntil })
    .from(recurrenceSeries);

  const stale = rows
    .filter((row) => !row.materializedUntil || row.materializedUntil < horizon)
    .slice(0, MAX_SERIES_PER_RUN);

  let created = 0;
  let failed = 0;

  for (const row of stale) {
    try {
      const result = await materializeSeries(row.id, horizon);
      created += result.created;
    } catch {
      // One broken series (a rule that no longer normalizes, a deleted
      // database mid-run) must not abort the rest of the batch.
      failed += 1;
    }
  }

  // Trash cleanup rides along on this same daily cron rather than getting its
  // own scheduler (`.ai/FEATURE_BULK_AND_TRASH.md` explicitly says reuse an
  // existing daily job) — this is the only maintenance-only cron of the three
  // (emails/prospect-gifts are both product-facing lifecycle jobs).
  const snapshotsPurged = await purgeExpiredSnapshots().catch(() => 0);

  return NextResponse.json({
    ok: true,
    horizon,
    seriesTotal: rows.length,
    seriesProcessed: stale.length,
    cardsCreated: created,
    failed,
    snapshotsPurged,
  });
}
