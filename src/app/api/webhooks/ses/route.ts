// SES → SNS event webhook: hard bounces and spam complaints suppress the
// user's email (user.email_suppressed) so we never send to that address again
// — protects the shared SES account reputation. Signature-verified via
// snsValidator; SubscriptionConfirmation is auto-confirmed by fetching the
// SubscribeURL. Whitelisted in auth.config.ts.
//
// AWS setup (names only): SES configuration set SES_CONFIGURATION_SET with an
// SNS event destination (Bounce + Complaint) whose topic has an HTTPS
// subscription pointing at this route.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { verifySnsMessage, type SnsMessage } from '@/lib/email/snsValidator';

async function suppress(email: string, reason: 'bounced' | 'complained'): Promise<void> {
  try {
    await db
      .update(users)
      .set({ emailSuppressed: reason })
      .where(and(eq(users.email, email.toLowerCase()), isNull(users.emailSuppressed)));
    console.log(`[ses-webhook] suppressed ${email} (${reason})`);
  } catch (e) {
    console.error('[ses-webhook] suppress failed: ' + (e instanceof Error ? e.message : e));
  }
}

export async function POST(req: NextRequest) {
  let msg: SnsMessage;
  try {
    msg = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ ok: false, reason: 'unparseable' }, { status: 400 });
  }

  if (!(await verifySnsMessage(msg))) {
    return NextResponse.json({ ok: false, reason: 'unverified' }, { status: 403 });
  }

  // Auto-confirm the topic subscription on first delivery.
  if (msg.Type === 'SubscriptionConfirmation' && msg.SubscribeURL) {
    try {
      await fetch(msg.SubscribeURL, { signal: AbortSignal.timeout(10000) });
      console.log('[ses-webhook] subscription confirmed for ' + msg.TopicArn);
    } catch (e) {
      console.error('[ses-webhook] subscription confirm failed: ' + (e instanceof Error ? e.message : e));
    }
    return NextResponse.json({ ok: true, type: 'SubscriptionConfirmation' });
  }

  if (msg.Type !== 'Notification' || !msg.Message) {
    return NextResponse.json({ ok: true, type: msg.Type ?? 'unknown' });
  }

  let event: any;
  try {
    event = JSON.parse(msg.Message);
  } catch {
    return NextResponse.json({ ok: false, reason: 'badmessage' }, { status: 400 });
  }

  const kind = event.eventType || event.notificationType; // Bounce | Complaint | ...
  let suppressed = 0;

  if (kind === 'Bounce' && event.bounce?.bounceType === 'Permanent') {
    for (const r of event.bounce?.bouncedRecipients ?? []) {
      if (r?.emailAddress) {
        await suppress(r.emailAddress, 'bounced');
        suppressed++;
      }
    }
  } else if (kind === 'Complaint') {
    for (const r of event.complaint?.complainedRecipients ?? []) {
      if (r?.emailAddress) {
        await suppress(r.emailAddress, 'complained');
        suppressed++;
      }
    }
  }

  return NextResponse.json({ ok: true, kind, suppressed });
}
