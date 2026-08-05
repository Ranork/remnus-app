// Daily cron: reverts expired Prospect Invite gift plans back to Free.
// Authorized the same way as /api/cron/emails — `Authorization: Bearer
// ${CRON_SECRET}` (Vercel attaches this automatically when CRON_SECRET is
// set). No card was ever collected for these gifts (see prospectInvites.ts),
// so "expiry" just means a silent tier downgrade, not a billing event.
//
// A claimed-but-not-yet-due invite is left alone; a due invite only gets
// downgraded if the user's CURRENT tier still matches what the gift granted
// and isn't Stripe-managed (setOwnerPlanTier's own guard) — if they upgraded
// for real or an admin changed their plan since claiming, that's left
// untouched. Either way `reverted_at` is stamped so the row stops being
// re-checked on future runs.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { prospectInvites } from '@/db/schema';
import { getOwnerPlan, setOwnerPlanTier } from '@/lib/services/billing';

const MAX_PER_RUN = 200;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const candidates = await db
    .select({
      id: prospectInvites.id,
      claimedAt: prospectInvites.claimedAt,
      giftDays: prospectInvites.giftDays,
      giftTier: prospectInvites.giftTier,
      claimedByUserId: prospectInvites.claimedByUserId,
    })
    .from(prospectInvites)
    .where(and(isNotNull(prospectInvites.claimedAt), isNull(prospectInvites.revertedAt)))
    .limit(MAX_PER_RUN);

  let reverted = 0;
  let skipped = 0;
  let notDue = 0;

  for (const row of candidates) {
    if (!row.claimedAt || !row.claimedByUserId) continue;
    const dueAt = row.claimedAt.getTime() + row.giftDays * 24 * 60 * 60 * 1000;
    if (dueAt > now.getTime()) { notDue++; continue; }

    const plan = await getOwnerPlan(row.claimedByUserId);
    if (plan.tier === row.giftTier) {
      const result = await setOwnerPlanTier(row.claimedByUserId, 'free');
      if (result.ok) reverted++; else skipped++;
    } else {
      skipped++; // already changed since claiming — nothing to revert
    }

    await db.update(prospectInvites).set({ revertedAt: now }).where(eq(prospectInvites.id, row.id));
  }

  console.log(`[cron/prospect-gifts] reverted:${reverted} skipped:${skipped} notDue:${notDue} checked:${candidates.length}`);
  return NextResponse.json({ ok: true, reverted, skipped, notDue, checked: candidates.length });
}
