'use server';

// Admin-gated mailing actions: dashboard data for /admin/mailing, newsletter
// draft CRUD, preview rendering and test sends. The actual send-to-all loop
// lives in POST /api/admin/mailing/send-campaign (needs a long maxDuration).

import { and, count, desc, eq, gte, isNotNull, isNull, ne } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { db } from '@/db';
import { emailCampaigns, emailLog, users } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/session';
import { renderNewsletterHtml } from '@/lib/email/templates';
import { sendEmail, type EmailKind } from '@/lib/email/send';

async function assertAdmin() {
  const user = await getCurrentUser();
  if (user.role !== 'admin') {
    const t = await getTranslations('Errors');
    throw new Error(t('adminRequired'));
  }
  return user;
}

export interface EmailLogRow {
  id: string;
  email: string;
  kind: EmailKind;
  subject: string;
  status: 'sent' | 'failed';
  error: string | null;
  createdAt: Date;
}

export interface CampaignSummary {
  id: string;
  subject: string;
  preheader: string | null;
  bodyMd: string;
  status: 'draft' | 'sending' | 'sent';
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: Date;
  sentAt: Date | null;
}

export interface MailingOverview {
  /** Successful sends in the last 30 days, per kind. */
  kindCounts: Record<string, number>;
  sent30d: number;
  failed30d: number;
  unsubscribedCount: number;
  suppressedCount: number;
  /** How many users a newsletter would reach right now. */
  newsletterAudience: number;
  recent: EmailLogRow[];
  campaigns: CampaignSummary[];
}

export async function getMailingOverview(): Promise<MailingOverview> {
  await assertAdmin();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [kindRows, failedRow, unsubRow, suppressedRow, audienceRow, recent, campaigns] = await Promise.all([
    db
      .select({ kind: emailLog.kind, n: count() })
      .from(emailLog)
      .where(and(eq(emailLog.status, 'sent'), gte(emailLog.createdAt, since)))
      .groupBy(emailLog.kind),
    db
      .select({ n: count() })
      .from(emailLog)
      .where(and(eq(emailLog.status, 'failed'), gte(emailLog.createdAt, since))),
    db.select({ n: count() }).from(users).where(isNotNull(users.emailUnsubscribedAt)),
    db.select({ n: count() }).from(users).where(isNotNull(users.emailSuppressed)),
    db
      .select({ n: count() })
      .from(users)
      .where(
        and(
          ne(users.role, 'demo'),
          isNotNull(users.email),
          isNull(users.emailUnsubscribedAt),
          isNull(users.emailSuppressed),
        ),
      ),
    db
      .select({
        id: emailLog.id,
        email: emailLog.email,
        kind: emailLog.kind,
        subject: emailLog.subject,
        status: emailLog.status,
        error: emailLog.error,
        createdAt: emailLog.createdAt,
      })
      .from(emailLog)
      .orderBy(desc(emailLog.createdAt))
      .limit(50),
    db.select().from(emailCampaigns).orderBy(desc(emailCampaigns.createdAt)),
  ]);

  const kindCounts: Record<string, number> = {};
  let sent30d = 0;
  for (const r of kindRows) {
    kindCounts[r.kind] = r.n;
    sent30d += r.n;
  }

  return {
    kindCounts,
    sent30d,
    failed30d: failedRow[0]?.n ?? 0,
    unsubscribedCount: unsubRow[0]?.n ?? 0,
    suppressedCount: suppressedRow[0]?.n ?? 0,
    newsletterAudience: audienceRow[0]?.n ?? 0,
    recent: recent as EmailLogRow[],
    campaigns: campaigns as CampaignSummary[],
  };
}

export interface CampaignInput {
  id?: string | null;
  subject: string;
  preheader?: string | null;
  bodyMd: string;
}

export async function saveCampaign(input: CampaignInput): Promise<CampaignSummary> {
  const admin = await assertAdmin();
  const subject = input.subject.trim();
  const bodyMd = input.bodyMd.trim();
  const preheader = input.preheader?.trim() || null;
  if (!subject || !bodyMd) throw new Error('Subject and body are required');

  if (input.id) {
    const [existing] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, input.id)).limit(1);
    if (!existing) throw new Error('Campaign not found');
    if (existing.status !== 'draft') throw new Error('Only drafts can be edited');
    await db
      .update(emailCampaigns)
      .set({ subject, preheader, bodyMd })
      .where(eq(emailCampaigns.id, input.id));
    const [updated] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, input.id)).limit(1);
    return updated as CampaignSummary;
  }

  const [created] = await db
    .insert(emailCampaigns)
    .values({ subject, preheader, bodyMd, createdBy: admin.id, createdAt: new Date() })
    .returning();
  return created as CampaignSummary;
}

export async function deleteCampaign(id: string): Promise<void> {
  await assertAdmin();
  const [existing] = await db.select({ status: emailCampaigns.status }).from(emailCampaigns).where(eq(emailCampaigns.id, id)).limit(1);
  if (!existing) return;
  if (existing.status !== 'draft') throw new Error('Only drafts can be deleted');
  await db.delete(emailCampaigns).where(eq(emailCampaigns.id, id));
}

/** Rendered HTML for the composer's live preview iframe. */
export async function previewCampaignHtml(input: { subject: string; preheader?: string | null; bodyMd: string }): Promise<string> {
  await assertAdmin();
  return renderNewsletterHtml(
    { subject: input.subject || 'Untitled update', preheader: input.preheader ?? null, bodyMd: input.bodyMd },
    '#',
  );
}

/** Sends the draft to the admin's own address with a [TEST] prefix. */
export async function sendTestCampaign(input: { subject: string; preheader?: string | null; bodyMd: string }): Promise<{ ok: boolean; error?: string }> {
  const admin = await assertAdmin();
  if (!admin.email) return { ok: false, error: 'no_admin_email' };
  const html = renderNewsletterHtml(
    { subject: input.subject, preheader: input.preheader ?? null, bodyMd: input.bodyMd },
    '#',
  );
  return sendEmail({
    to: process.env.MAIL_TEST_EMAIL || admin.email,
    userId: admin.id,
    kind: 'test',
    subject: `[TEST] ${input.subject}`,
    html,
  });
}
