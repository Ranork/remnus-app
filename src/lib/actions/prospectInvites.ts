'use server';

// Prospect Invites: personalized, single-use gift-signup links for cold
// outreach (e.g. Scout Forge app owners). Admin-gated CRUD + Scout Forge
// lookup live here, alongside the two PUBLIC functions the /welcome/[token]
// claim page needs (getProspectInviteByToken/claimProspectInvite) — same
// split as invites.ts between owner-gated and public invite-token functions.
// Admin-only error strings stay plain English (mirrors mailing.ts's
// assertAdmin/saveCampaign convention — admin-only surface, not user-facing
// i18n); the public claimProspectInvite uses getTranslations('Errors') since
// real prospects see those messages, mirroring acceptInvite in invites.ts.

import { db } from '@/db';
import { prospectInvites, users } from '@/db/schema';
import { eq, desc, gte, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { getCurrentUser } from '@/lib/auth/session';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { fetchScoutForgeApp, type ScoutForgeAppInfo } from '@/lib/services/scoutforge';
import { getOwnerPlan, setOwnerPlanTier } from '@/lib/services/billing';
import type { PlanTier } from '@/lib/billing/plans';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

type GiftTier = Extract<PlanTier, 'startup' | 'professional'>;

function isGiftTier(value: string): value is GiftTier {
  return value === 'startup' || value === 'professional';
}

async function assertAdmin() {
  const user = await getCurrentUser();
  if (user.role !== 'admin') {
    const t = await getTranslations('Errors');
    throw new Error(t('adminRequired'));
  }
  return user;
}

export type ProspectInviteStatus = 'pending' | 'link_expired' | 'active' | 'reverted';

export interface ProspectInviteSummary {
  id: string;
  token: string;
  appIdstr: string;
  appName: string;
  appLogoUrl: string | null;
  appTagline: string | null;
  appUrl: string | null;
  giftTier: GiftTier;
  giftDays: number;
  linkExpiresAt: Date | null;
  createdAt: Date;
  firstOpenedAt: Date | null;
  openCount: number;
  claimedAt: Date | null;
  claimedByEmail: string | null;
  revertedAt: Date | null;
  status: ProspectInviteStatus;
  inviteLink: string;
}

export interface ProspectInvitesOverview {
  invites: ProspectInviteSummary[];
  counts: { total: number; opened: number; pending: number; active: number; reverted: number; linkExpired: number };
}

function deriveStatus(row: { linkExpiresAt: Date | null; claimedAt: Date | null; revertedAt: Date | null }): ProspectInviteStatus {
  if (row.revertedAt) return 'reverted';
  if (row.claimedAt) return 'active';
  if (row.linkExpiresAt && row.linkExpiresAt.getTime() < Date.now()) return 'link_expired';
  return 'pending';
}

/**
 * @param sinceMs When set (epoch ms), scopes both the list and the counts to
 * invites CREATED on/after this instant — e.g. to see the funnel since a
 * specific campaign batch. Omit for the all-time view. Mirrors
 * getActivationFunnel's sinceMs param/UX (AdminActivationFunnel.tsx).
 */
export async function getProspectInvitesOverview(sinceMs?: number): Promise<ProspectInvitesOverview> {
  await assertAdmin();

  const query = db
    .select({
      id: prospectInvites.id,
      token: prospectInvites.token,
      appIdstr: prospectInvites.appIdstr,
      appName: prospectInvites.appName,
      appLogoUrl: prospectInvites.appLogoUrl,
      appTagline: prospectInvites.appTagline,
      appUrl: prospectInvites.appUrl,
      giftTier: prospectInvites.giftTier,
      giftDays: prospectInvites.giftDays,
      linkExpiresAt: prospectInvites.linkExpiresAt,
      createdAt: prospectInvites.createdAt,
      firstOpenedAt: prospectInvites.firstOpenedAt,
      openCount: prospectInvites.openCount,
      claimedAt: prospectInvites.claimedAt,
      claimedByEmail: users.email,
      revertedAt: prospectInvites.revertedAt,
    })
    .from(prospectInvites)
    .leftJoin(users, eq(prospectInvites.claimedByUserId, users.id))
    .orderBy(desc(prospectInvites.createdAt));

  const rows = sinceMs != null ? await query.where(gte(prospectInvites.createdAt, new Date(sinceMs))) : await query;

  const counts = { total: rows.length, opened: 0, pending: 0, active: 0, reverted: 0, linkExpired: 0 };
  const invites: ProspectInviteSummary[] = rows.map((r) => {
    const status = deriveStatus(r);
    if (r.firstOpenedAt) counts.opened++;
    if (status === 'pending') counts.pending++;
    else if (status === 'active') counts.active++;
    else if (status === 'reverted') counts.reverted++;
    else counts.linkExpired++;
    return {
      ...r,
      giftTier: (isGiftTier(r.giftTier) ? r.giftTier : 'startup') as GiftTier,
      status,
      inviteLink: `${APP_URL}/welcome/${r.token}`,
    };
  });

  return { invites, counts };
}

/** Looks up a Scout Forge app by idstr for the "Fetch" button — saves nothing. */
export async function lookupScoutForgeApp(idstr: string): Promise<{ ok: true; app: ScoutForgeAppInfo } | { ok: false; error: string }> {
  await assertAdmin();
  const app = await fetchScoutForgeApp(idstr);
  if (!app) return { ok: false, error: 'App not found on Scout Forge' };
  return { ok: true, app };
}

export interface ProspectInviteInput {
  appIdstr: string;
  appName: string;
  appLogoUrl?: string | null;
  appTagline?: string | null;
  appUrl?: string | null;
  giftTier: GiftTier;
  giftDays: number;
  /** Days until the LINK itself expires (unclaimed). null/undefined = never. */
  linkExpiresInDays?: number | null;
}

export async function createProspectInvite(input: ProspectInviteInput): Promise<{ id: string; token: string; inviteLink: string }> {
  const admin = await assertAdmin();
  const appIdstr = input.appIdstr.trim();
  const appName = input.appName.trim();
  if (!appIdstr || !appName) throw new Error('App idstr and name are required');
  if (!isGiftTier(input.giftTier)) throw new Error('Gift tier must be startup or professional');
  if (!Number.isFinite(input.giftDays) || input.giftDays <= 0) throw new Error('Gift days must be a positive number');

  const token = crypto.randomUUID();
  const linkExpiresAt = input.linkExpiresInDays
    ? new Date(Date.now() + input.linkExpiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const [created] = await db
    .insert(prospectInvites)
    .values({
      token,
      appIdstr,
      appName,
      appLogoUrl: input.appLogoUrl?.trim() || null,
      appTagline: input.appTagline?.trim() || null,
      appUrl: input.appUrl?.trim() || null,
      giftTier: input.giftTier,
      giftDays: Math.round(input.giftDays),
      linkExpiresAt,
      createdBy: admin.id,
      createdAt: new Date(),
    })
    .returning();

  return { id: created.id, token, inviteLink: `${APP_URL}/welcome/${token}` };
}

export async function updateProspectInvite(id: string, patch: Partial<ProspectInviteInput>): Promise<void> {
  await assertAdmin();
  const [existing] = await db.select({ claimedAt: prospectInvites.claimedAt }).from(prospectInvites).where(eq(prospectInvites.id, id)).limit(1);
  if (!existing) throw new Error('Invite not found');
  if (existing.claimedAt) throw new Error('Claimed invites can no longer be edited');

  const set: Partial<typeof prospectInvites.$inferInsert> = {};
  if (patch.appIdstr !== undefined) set.appIdstr = patch.appIdstr.trim();
  if (patch.appName !== undefined) set.appName = patch.appName.trim();
  if (patch.appLogoUrl !== undefined) set.appLogoUrl = patch.appLogoUrl?.trim() || null;
  if (patch.appTagline !== undefined) set.appTagline = patch.appTagline?.trim() || null;
  if (patch.appUrl !== undefined) set.appUrl = patch.appUrl?.trim() || null;
  if (patch.giftTier !== undefined) {
    if (!isGiftTier(patch.giftTier)) throw new Error('Gift tier must be startup or professional');
    set.giftTier = patch.giftTier;
  }
  if (patch.giftDays !== undefined) set.giftDays = Math.round(patch.giftDays);
  if (patch.linkExpiresInDays !== undefined) {
    set.linkExpiresAt = patch.linkExpiresInDays ? new Date(Date.now() + patch.linkExpiresInDays * 24 * 60 * 60 * 1000) : null;
  }
  if (Object.keys(set).length === 0) return;

  await db.update(prospectInvites).set(set).where(eq(prospectInvites.id, id));
}

/** Re-fetches the stored app_idstr from Scout Forge and overwrites the editable snapshot. */
export async function refreshFromScoutForge(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertAdmin();
  const [existing] = await db.select().from(prospectInvites).where(eq(prospectInvites.id, id)).limit(1);
  if (!existing) return { ok: false, error: 'Invite not found' };
  if (existing.claimedAt) return { ok: false, error: 'Claimed invites can no longer be edited' };

  const app = await fetchScoutForgeApp(existing.appIdstr);
  if (!app) return { ok: false, error: 'App not found on Scout Forge' };

  await db
    .update(prospectInvites)
    .set({ appName: app.name, appLogoUrl: app.logoUrl, appTagline: app.shortDescription, appUrl: app.url })
    .where(eq(prospectInvites.id, id));

  return { ok: true };
}

// Deletes an unclaimed invite (pending or link-expired), or a claimed one
// whose gift was ALREADY reverted (nothing live left to lose). Refuses on a
// still-active claimed invite — deleting that row would orphan the gift with
// no record and no way for the cron to ever revert it. Use
// revokeClaimedInvite for that case instead (it reverts, then deletes).
export async function deleteProspectInvite(id: string): Promise<void> {
  await assertAdmin();
  const [existing] = await db
    .select({ claimedAt: prospectInvites.claimedAt, revertedAt: prospectInvites.revertedAt })
    .from(prospectInvites)
    .where(eq(prospectInvites.id, id))
    .limit(1);
  if (!existing) return;
  if (existing.claimedAt && !existing.revertedAt) {
    throw new Error('This invite has an active gift — use Revoke instead so the plan is reverted first');
  }
  await db.delete(prospectInvites).where(eq(prospectInvites.id, id));
}

// Claws back a claimed-but-still-active gift, then deletes the invite.
// Only downgrades the user if they're still on exactly the tier THIS invite
// granted (setOwnerPlanTier upserts to 'free' only in that case) — if they
// changed plans some other way since claiming, there's nothing of ours left
// to remove. setOwnerPlanTier's own Stripe-managed guard additionally
// refuses to touch a real paying subscription: per the product decision, a
// revoke NEVER cancels a real membership, only our own free gift grant.
export async function revokeClaimedInvite(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertAdmin();
  const [existing] = await db.select().from(prospectInvites).where(eq(prospectInvites.id, id)).limit(1);
  if (!existing) return { ok: false, error: 'Invite not found' };
  if (!existing.claimedAt) return { ok: false, error: 'This invite was never claimed — delete it instead' };
  if (existing.revertedAt) return { ok: false, error: 'This gift was already reverted' };

  if (existing.claimedByUserId) {
    const plan = await getOwnerPlan(existing.claimedByUserId);
    const giftTier = isGiftTier(existing.giftTier) ? existing.giftTier : 'startup';
    if (plan.tier === giftTier) {
      await setOwnerPlanTier(existing.claimedByUserId, 'free');
    }
  }

  await db.delete(prospectInvites).where(eq(prospectInvites.id, id));
  return { ok: true };
}

// ── Public: consumed by the /welcome/[token] claim page ──────────────────

export interface PublicProspectInvite {
  appName: string;
  appLogoUrl: string | null;
  appTagline: string | null;
  giftTier: GiftTier;
  giftDays: number;
  claimed: boolean;
  /** True when `claimed` is true AND it was this viewer who claimed it — lets
   *  the page tell "you already have this, welcome back" apart from "someone
   *  else already used this link" instead of showing the same cold error for
   *  both (e.g. the same user refreshing/revisiting after a successful claim). */
  claimedByViewer: boolean;
  linkExpired: boolean;
  /** Days left to CLAIM the link (not the gift period) — null when the
   *  invite has no link expiry set. Powers the urgency line on the claim
   *  page; rounded up so "expires in 1 day" never reads as 0. */
  daysUntilLinkExpiry: number | null;
}

// Funnel tracking (migration 0041) — best-effort, fire-and-forget so a write
// hiccup never slows down or breaks the claim page's render. openCount always
// increments; firstOpenedAt is set only the first time (checked here in JS,
// not via a raw SQL literal, so it's a normal Date write like every other
// timestamp column in this file — no risk of bypassing Drizzle's ms/seconds
// handling with a hand-rolled epoch value).
async function recordProspectInviteOpen(id: string, alreadyOpened: boolean): Promise<void> {
  // Inlined rather than built up via an intermediate typed object: $inferInsert
  // types openCount as a plain number, which rejects the SQL<unknown> fragment
  // even though Drizzle's own .set() signature accepts it at the call site.
  if (alreadyOpened) {
    await db.update(prospectInvites).set({ openCount: sql`${prospectInvites.openCount} + 1` }).where(eq(prospectInvites.id, id));
  } else {
    await db.update(prospectInvites).set({ openCount: sql`${prospectInvites.openCount} + 1`, firstOpenedAt: new Date() }).where(eq(prospectInvites.id, id));
  }
}

export async function getProspectInviteByToken(token: string, viewerUserId?: string | null): Promise<PublicProspectInvite | null> {
  const [row] = await db.select().from(prospectInvites).where(eq(prospectInvites.token, token)).limit(1);
  if (!row) return null;

  recordProspectInviteOpen(row.id, !!row.firstOpenedAt).catch(() => {});

  const daysUntilLinkExpiry = row.linkExpiresAt
    ? Math.max(0, Math.ceil((row.linkExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;
  return {
    appName: row.appName,
    appLogoUrl: row.appLogoUrl,
    appTagline: row.appTagline,
    giftTier: isGiftTier(row.giftTier) ? row.giftTier : 'startup',
    giftDays: row.giftDays,
    claimed: !!row.claimedAt,
    claimedByViewer: !!(row.claimedAt && viewerUserId && row.claimedByUserId === viewerUserId),
    daysUntilLinkExpiry,
    linkExpired: !!(row.linkExpiresAt && row.linkExpiresAt.getTime() < Date.now()),
  };
}

// Accept a prospect invite for the logged-in user — bearer token, not
// email-locked (whoever holds the link and signs in can claim it once).
// Uses auth() directly rather than getCurrentUser(): same deliberate
// exception acceptInvite() takes in invites.ts, since it must tell "not
// authenticated" apart from "authenticated" without getCurrentUser's
// redirect-to-login.
export async function claimProspectInvite(token: string): Promise<{ ok?: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'not_authenticated' };
  const t = await getTranslations('Errors');

  const [inv] = await db.select().from(prospectInvites).where(eq(prospectInvites.token, token)).limit(1);
  if (!inv) return { error: t('prospectInviteInvalid') };
  if (inv.claimedAt) {
    // Idempotent for the SAME claimant: re-invoking an already-successful
    // claim (React Strict Mode's dev double-effect-invoke, a re-mount, a
    // retry) must look like success, not an error. Only a genuinely
    // different account trying the same token hits the real "someone else
    // already has this" case.
    if (inv.claimedByUserId === session.user.id) return { ok: true };
    return { error: t('prospectInviteAlreadyClaimed') };
  }
  if (inv.linkExpiresAt && inv.linkExpiresAt.getTime() < Date.now()) return { error: t('prospectInviteExpired') };

  // Skips silently if the user already has a Stripe-managed subscription —
  // they're already a paying customer, nothing to grant — but the claim is
  // still recorded so the admin table reflects it was opened/confirmed.
  await setOwnerPlanTier(session.user.id, inv.giftTier as PlanTier);

  await db
    .update(prospectInvites)
    .set({ claimedAt: new Date(), claimedByUserId: session.user.id })
    .where(eq(prospectInvites.id, inv.id));
  (await cookies()).delete('pending_prospect_invite');
  return { ok: true };
}
