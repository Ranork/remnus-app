// Central email dispatch (AWS SES via nodemailer) + suppression / idempotency
// helpers. Every send — success or failure — is recorded in `email_log`, which
// doubles as the idempotency guard for the one-shot lifecycle emails and the
// admin dashboard's send history.
//
// Env (names only): SES_REGION, SES_ACCESS_KEY_ID, SES_SECRET_ACCESS_KEY,
// MAIL_FROM_EMAIL, MAIL_FROM_NAME, MAIL_REPLY_TO, SES_CONFIGURATION_SET,
// UNSUB_SECRET, MAIL_SEND_RATE. When MAIL_FROM_EMAIL/SES_REGION are unset the
// module degrades to a console-warning no-op (safe for local dev / forks).

import crypto from 'crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { emailLog, users } from '@/db/schema';
import { SITE_URL } from './theme';

export type EmailKind = 'welcome' | 'inactivity' | 'agent_nudge' | 'agent_connected' | 'newsletter' | 'test';

// ── Transport (lazy singleton) ────────────────────────────────────────────────

let transportCache: Transporter | null = null;

export function isMailConfigured(): boolean {
  return Boolean(process.env.MAIL_FROM_EMAIL && process.env.SES_REGION);
}

function transport(): Transporter {
  if (transportCache) return transportCache;
  const region = process.env.SES_REGION;
  if (!region) throw new Error('SES_REGION is not configured');
  const accessKeyId = process.env.SES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SES_SECRET_ACCESS_KEY;
  const sesClient = new SESv2Client({
    region,
    ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
  });
  transportCache = nodemailer.createTransport({ SES: { sesClient, SendEmailCommand } });
  return transportCache;
}

/** Per-send delay derived from MAIL_SEND_RATE (emails/sec, default 10). */
export function throttleDelayMs(): number {
  const rate = Math.max(1, parseInt(process.env.MAIL_SEND_RATE || '10', 10));
  return Math.ceil(1000 / rate);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Unsubscribe tokens (HMAC, same scheme as ScoutForge) ──────────────────────

export function unsubToken(userId: string, email: string): string {
  const secret = process.env.UNSUB_SECRET || process.env.AUTH_SECRET || 'unsub-dev-secret';
  return crypto.createHmac('sha256', secret).update(`${userId}:${email.toLowerCase()}`).digest('hex');
}

export function verifyUnsubToken(userId: string, email: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(unsubToken(userId, email));
  const given = Buffer.from(String(token));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

/** Human-facing unsubscribe page (email footer link). */
export function buildUnsubUrl(userId: string, email: string): string {
  return `${SITE_URL}/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubToken(userId, email)}`;
}

/** RFC 8058 one-click endpoint (List-Unsubscribe header target). */
function buildOneClickUnsubUrl(userId: string, email: string): string {
  return `${SITE_URL}/api/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubToken(userId, email)}`;
}

// ── Recipient gating ──────────────────────────────────────────────────────────

export interface MailableUser {
  id: string;
  email: string | null;
  name?: string | null;
  role: string;
  emailUnsubscribedAt: Date | null;
  emailSuppressed: string | null;
}

/**
 * Whether a user may receive an email of the given kind. Bounced/complained
 * addresses are muted entirely (shared SES reputation); unsubscribed users
 * still get the transactional welcome but nothing else; demo accounts never
 * get email.
 */
export function canReceiveEmail(user: MailableUser, kind: EmailKind): boolean {
  if (!user.email || user.role === 'demo') return false;
  if (user.emailSuppressed) return false;
  if (user.emailUnsubscribedAt && kind !== 'welcome') return false;
  return true;
}

/** Idempotency guard: has this user already received a `kind` email (optionally after a date)? */
export async function wasEmailSent(userId: string, kind: EmailKind, after?: Date): Promise<boolean> {
  const [row] = await db
    .select({ id: emailLog.id, createdAt: emailLog.createdAt })
    .from(emailLog)
    .where(and(eq(emailLog.userId, userId), eq(emailLog.kind, kind), eq(emailLog.status, 'sent')))
    .orderBy(desc(emailLog.createdAt))
    .limit(1);
  if (!row) return false;
  if (!after) return true;
  return row.createdAt > after;
}

// ── Send ──────────────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  to: string;
  userId: string | null;
  kind: EmailKind;
  subject: string;
  html: string;
  campaignId?: string | null;
  /** When set, adds List-Unsubscribe + one-click headers (marketing sends). */
  unsubUserId?: string | null;
}

/**
 * Sends one email via SES and records it in `email_log`. Never throws — a
 * failure is logged (status 'failed') and returned. When mail env is missing
 * the send becomes a console-warning no-op (nothing logged).
 */
export async function sendEmail({ to, userId, kind, subject, html, campaignId, unsubUserId }: SendEmailOptions): Promise<{ ok: boolean; error?: string }> {
  if (!isMailConfigured()) {
    console.warn(`[mail] skipped ${kind} to ${to} — MAIL_FROM_EMAIL/SES_REGION not configured`);
    return { ok: false, error: 'not_configured' };
  }

  const fromEmail = process.env.MAIL_FROM_EMAIL!;
  const fromName = process.env.MAIL_FROM_NAME || 'Remnus';
  const oneClickUrl = unsubUserId ? buildOneClickUnsubUrl(unsubUserId, to) : null;

  let ok = true;
  let error: string | undefined;
  try {
    await transport().sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      replyTo: process.env.MAIL_REPLY_TO || fromEmail,
      subject,
      html,
      ...(oneClickUrl
        ? {
            list: { unsubscribe: { url: oneClickUrl, comment: 'Unsubscribe' } },
            headers: { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
          }
        : {}),
      ses: {
        ...(process.env.SES_CONFIGURATION_SET ? { ConfigurationSetName: process.env.SES_CONFIGURATION_SET } : {}),
        ...(campaignId ? { EmailTags: [{ Name: 'campaign', Value: campaignId }] } : {}),
      },
    } as Parameters<Transporter['sendMail']>[0]);
  } catch (e) {
    ok = false;
    error = e instanceof Error ? e.message : String(e);
    console.error(`[mail] send failed (${kind} → ${to}): ${error}`);
  }

  try {
    await db.insert(emailLog).values({
      userId,
      email: to,
      kind,
      campaignId: campaignId ?? null,
      subject,
      status: ok ? 'sent' : 'failed',
      error: error ?? null,
      createdAt: new Date(),
    });
  } catch (e) {
    console.error('[mail] email_log write failed: ' + (e instanceof Error ? e.message : e));
  }

  return { ok, error };
}

/**
 * Verifies an unsubscribe token and mutes the user's marketing email. Shared
 * by the one-click POST endpoint and the confirm button on /unsubscribe.
 */
export async function performUnsubscribe(userId: string, token: string | null | undefined): Promise<{ ok: boolean; reason?: 'notfound' | 'badtoken' }> {
  const user = await getMailableUser(userId);
  if (!user || !user.email) return { ok: false, reason: 'notfound' };
  if (!verifyUnsubToken(user.id, user.email, token)) return { ok: false, reason: 'badtoken' };
  if (!user.emailUnsubscribedAt) {
    await db.update(users).set({ emailUnsubscribedAt: new Date() }).where(eq(users.id, user.id));
    console.log('[mail] unsubscribed: ' + user.email);
  }
  return { ok: true };
}

/** Loads the mailing-relevant columns for one user (null when missing). */
export async function getMailableUser(userId: string): Promise<MailableUser | null> {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      emailUnsubscribedAt: users.emailUnsubscribedAt,
      emailSuppressed: users.emailSuppressed,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user ?? null;
}
