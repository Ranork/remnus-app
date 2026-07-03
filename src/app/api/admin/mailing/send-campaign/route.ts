// Newsletter send-to-all. Lives in an API route (not a server action) so it
// can declare a long maxDuration for the throttled send loop. Admin-gated via
// the session; double-send protected by only accepting 'draft' campaigns.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNotNull, isNull, ne } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { emailCampaigns, users } from '@/db/schema';
import { renderNewsletterHtml } from '@/lib/email/templates';
import { buildUnsubUrl, isMailConfigured, sendEmail, sleep, throttleDelayMs } from '@/lib/email/send';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
  }
  if (!isMailConfigured()) {
    return NextResponse.json({ error: 'mail_not_configured' }, { status: 400 });
  }

  let campaignId: string | undefined;
  try {
    ({ campaignId } = await req.json());
  } catch {
    // fall through to the missing-id error
  }
  if (!campaignId) return NextResponse.json({ error: 'missing_campaign_id' }, { status: 400 });

  const [campaign] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, campaignId)).limit(1);
  if (!campaign) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (campaign.status !== 'draft') {
    return NextResponse.json({ error: 'already_sent' }, { status: 409 });
  }

  const recipients = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(
      and(
        ne(users.role, 'demo'),
        isNotNull(users.email),
        isNull(users.emailUnsubscribedAt),
        isNull(users.emailSuppressed),
      ),
    );

  await db
    .update(emailCampaigns)
    .set({ status: 'sending', recipientCount: recipients.length })
    .where(eq(emailCampaigns.id, campaign.id));

  let sent = 0;
  let failed = 0;
  const delay = throttleDelayMs();
  for (const r of recipients) {
    if (!r.email) continue;
    const html = renderNewsletterHtml(
      { subject: campaign.subject, preheader: campaign.preheader, bodyMd: campaign.bodyMd },
      buildUnsubUrl(r.id, r.email),
    );
    const res = await sendEmail({
      to: r.email,
      userId: r.id,
      kind: 'newsletter',
      subject: campaign.subject,
      html,
      campaignId: campaign.id,
      unsubUserId: r.id,
    });
    if (res.ok) sent++; else failed++;
    await sleep(delay);
  }

  await db
    .update(emailCampaigns)
    .set({ status: 'sent', sentCount: sent, failedCount: failed, sentAt: new Date() })
    .where(eq(emailCampaigns.id, campaign.id));

  console.log(`[mailing] campaign ${campaign.id} sent:${sent} failed:${failed} of ${recipients.length}`);
  return NextResponse.json({ ok: true, recipientCount: recipients.length, sent, failed });
}
