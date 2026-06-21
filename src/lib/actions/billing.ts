'use server';
import { db } from '@/db';
import { subscriptions, workspaceMembers, workspaces, users, workspaceInvites } from '@/db/schema';
import { eq, and, inArray, isNull, or, gt, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/session';
import { getTranslations } from 'next-intl/server';
import { stripe, priceIdForTier } from '@/lib/stripe';
import { syncSubscriptionForCustomer } from '@/lib/billing/sync';
import { getOwnerUsage, getOwnerPlan, countSeats, resolveBillingOwner } from '@/lib/services/billing';
import { isPlanTier, type PlanTier } from '@/lib/billing/plans';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function getOrCreateCustomer(userId: string, email?: string | null, name?: string | null): Promise<string> {
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.ownerUserId, userId)).limit(1);
  if (row?.stripeCustomerId) return row.stripeCustomerId;

  const customer = await stripe!.customers.create({
    email: email ?? undefined,
    name: name ?? undefined,
    metadata: { ownerUserId: userId },
  });

  const now = new Date();
  if (row) {
    await db.update(subscriptions).set({ stripeCustomerId: customer.id, updatedAt: now }).where(eq(subscriptions.ownerUserId, userId));
  } else {
    await db.insert(subscriptions).values({
      ownerUserId: userId,
      tier: 'free',
      status: 'active',
      stripeCustomerId: customer.id,
      createdAt: now,
      updatedAt: now,
    });
  }
  return customer.id;
}

// Start a Checkout for a paid tier. The caller buys for their OWN seat pool.
export async function createCheckoutSession(tier: PlanTier): Promise<{ url?: string; error?: string }> {
  const user = await getCurrentUser();
  const t = await getTranslations('Errors');
  // Demo accounts are throwaway — never let them open Checkout, even if the UI is bypassed.
  if (user.role === 'demo') return { error: t('billingDemoBlocked') };
  if (!stripe) return { error: t('billingUnavailable') };
  if (tier !== 'startup' && tier !== 'professional') return { error: t('billingInvalidTier') };

  const priceId = priceIdForTier(tier);
  if (!priceId) return { error: t('billingUnavailable') };

  const customerId = await getOrCreateCustomer(user.id, user.email, user.name);

  // If an active subscription already exists, SWITCH its price in place instead of
  // creating a second subscription (which would double-bill). Stripe Checkout in
  // subscription mode always creates a new sub, so a plan change must go via the API.
  const existing = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 });
  const current = existing.data[0];
  if (current) {
    const itemId = current.items.data[0]?.id;
    const currentPrice = current.items.data[0]?.price?.id;
    if (itemId && currentPrice !== priceId) {
      await stripe.subscriptions.update(current.id, {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: 'create_prorations',
        metadata: { ownerUserId: user.id },
      });
    }
    // Always reconcile the DB from Stripe's live state — covers the "already on this
    // plan" case too (no update fires, but the DB row can still be stale at Free if an
    // earlier webhook never landed), not just the in-place price switch above.
    await syncSubscriptionForCustomer(customerId, user.id);
    revalidatePath('/');
    // Already on this plan (or just switched) → straight to the success screen.
    return { url: `${APP_URL}/app?billing=success` };
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/app?billing=success`,
    cancel_url: `${APP_URL}/pricing?billing=cancel`,
    client_reference_id: user.id,
    allow_promotion_codes: true,
    metadata: { ownerUserId: user.id, tier },
    subscription_data: { metadata: { ownerUserId: user.id } },
  });

  return session.url ? { url: session.url } : { error: t('billingUnavailable') };
}

// Open the Stripe Customer Portal (change plan, update card, cancel).
export async function createPortalSession(): Promise<{ url?: string; error?: string }> {
  const user = await getCurrentUser();
  const t = await getTranslations('Errors');
  if (user.role === 'demo') return { error: t('billingDemoBlocked') };
  if (!stripe) return { error: t('billingUnavailable') };

  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.ownerUserId, user.id)).limit(1);
  if (!row?.stripeCustomerId) return { error: t('billingNoCustomer') };

  const session = await stripe.billingPortal.sessions.create({
    customer: row.stripeCustomerId,
    return_url: `${APP_URL}/app`,
  });
  return session.url ? { url: session.url } : { error: t('billingUnavailable') };
}

// Current plan + usage meters for the Billing UI.
export async function getMySubscription() {
  const user = await getCurrentUser();
  return getOwnerUsage(user.id);
}

// Pull the caller's live subscription state from Stripe and persist it, then return
// fresh usage. Stripe is the source of truth — this is what the post-Checkout success
// screen calls so the plan reflects immediately even when the webhook is delayed,
// unreachable (e.g. local dev without `stripe listen`), or its secret is misconfigured.
export async function reconcileMySubscription() {
  const user = await getCurrentUser();
  if (stripe) {
    const [row] = await db
      .select({ customerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.ownerUserId, user.id))
      .limit(1);
    if (row?.customerId) {
      try {
        await syncSubscriptionForCustomer(row.customerId, user.id);
        revalidatePath('/');
      } catch (err) {
        console.error('[billing] reconcile_failed', err);
      }
    }
  }
  return getOwnerUsage(user.id);
}

// Lightweight: just the caller's current tier (for the sidebar plan badge).
export async function getMyTier(): Promise<PlanTier> {
  const user = await getCurrentUser();
  const { tier } = await getOwnerPlan(user.id);
  return tier;
}

// Downgrade to Free = cancel every active subscription immediately, then sync to Free.
export async function cancelSubscription(): Promise<{ ok?: boolean; error?: string }> {
  const user = await getCurrentUser();
  const t = await getTranslations('Errors');
  if (user.role === 'demo') return { error: t('billingDemoBlocked') };
  if (!stripe) return { error: t('billingUnavailable') };

  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.ownerUserId, user.id)).limit(1);
  if (!row?.stripeCustomerId) return { error: t('billingNoCustomer') };

  const subs = await stripe.subscriptions.list({ customer: row.stripeCustomerId, status: 'active', limit: 50 });
  for (const s of subs.data) {
    await stripe.subscriptions.cancel(s.id);
  }
  await syncSubscriptionForCustomer(row.stripeCustomerId, user.id);
  return { ok: true };
}

// Admin-only: manually activate (or change) a user's plan without going through Stripe.
// Stripe-managed subscriptions are left alone — the self-healing webhook sync would
// overwrite any manual tier on the next event, so we refuse to fight it here.
export async function adminSetUserPlan(
  userId: string,
  tier: PlanTier,
): Promise<{ ok?: boolean; error?: string }> {
  const admin = await getCurrentUser();
  const t = await getTranslations('Errors');
  if (admin.role !== 'admin') return { error: t('adminRequired') };
  if (!isPlanTier(tier)) return { error: t('billingInvalidTier') };

  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.ownerUserId, userId)).limit(1);
  if (row?.stripeSubscriptionId) return { error: t('billingStripeManaged') };

  const now = new Date();
  if (row) {
    await db
      .update(subscriptions)
      .set({ tier, status: 'active', updatedAt: now })
      .where(eq(subscriptions.ownerUserId, userId));
  } else {
    await db.insert(subscriptions).values({
      ownerUserId: userId,
      tier,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  }
  revalidatePath('/admin');
  return { ok: true };
}

// Seat usage for a specific workspace's billing owner pool (for the Members tab).
// Auth-gated: caller must be a member of the workspace.
export async function getWorkspaceSeatUsage(
  workspaceId: string,
): Promise<{ used: number; limit: number; tier: PlanTier } | null> {
  const user = await getCurrentUser();
  if (user.role !== 'admin') {
    const [m] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id)))
      .limit(1);
    if (!m) return null;
  }
  const ownerId = await resolveBillingOwner(workspaceId);
  if (!ownerId) return null;
  const { tier, limits } = await getOwnerPlan(ownerId);
  const used = await countSeats(ownerId);
  return { used, limit: limits.seats, tier };
}

// Central "People & Seats" — everyone across the caller's owned workspaces, grouped,
// plus pending email invites. The caller is the billing owner of these workspaces.
export async function getPoolMembers() {
  const owner = await getCurrentUser();
  const { limits } = await getOwnerPlan(owner.id);

  const wsRows = await db.select({ id: workspaces.id, name: workspaces.name }).from(workspaces).where(eq(workspaces.billingOwnerId, owner.id));
  const wsIds = wsRows.map((w) => w.id);
  const wsName = new Map(wsRows.map((w) => [w.id, w.name]));

  if (wsIds.length === 0) {
    return { members: [], invites: [], usage: { used: 0, limit: limits.seats } };
  }

  const memberRows = await db
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      workspaceId: workspaceMembers.workspaceId,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(inArray(workspaceMembers.workspaceId, wsIds));

  type Member = { userId: string; name: string | null; email: string | null; image: string | null; isOwner: boolean; workspaces: { id: string; name: string; role: string }[] };
  const byUser = new Map<string, Member>();
  for (const r of memberRows) {
    let m = byUser.get(r.userId);
    if (!m) {
      m = { userId: r.userId, name: r.name, email: r.email, image: r.image, isOwner: r.userId === owner.id, workspaces: [] };
      byUser.set(r.userId, m);
    }
    m.workspaces.push({ id: r.workspaceId, name: wsName.get(r.workspaceId) ?? '', role: r.role });
  }

  const now = new Date();
  const inviteRows = await db
    .select({ id: workspaceInvites.id, email: workspaceInvites.email, role: workspaceInvites.role, token: workspaceInvites.token, workspaceId: workspaceInvites.workspaceId })
    .from(workspaceInvites)
    .where(and(
      inArray(workspaceInvites.workspaceId, wsIds),
      isNull(workspaceInvites.acceptedAt),
      or(isNull(workspaceInvites.expiresAt), gt(workspaceInvites.expiresAt, now)),
    ))
    .orderBy(desc(workspaceInvites.createdAt));

  const invites = inviteRows.map((r) => ({
    id: r.id, email: r.email, role: r.role,
    workspaceId: r.workspaceId, workspaceName: wsName.get(r.workspaceId) ?? '',
    inviteLink: `${APP_URL}/invite/${r.token}`,
  }));

  // Sort owner first, then by name/email.
  const members = Array.from(byUser.values()).sort((a, b) =>
    (a.isOwner ? -1 : b.isOwner ? 1 : (a.name || a.email || '').localeCompare(b.name || b.email || '')));

  return { members, invites, usage: { used: await countSeats(owner.id), limit: limits.seats } };
}

// Revoke a seat: remove the user from ALL of the caller's workspaces (frees the seat).
export async function removeUserFromPool(userId: string): Promise<{ success?: boolean; error?: string }> {
  const owner = await getCurrentUser();
  const t = await getTranslations('Errors');
  if (userId === owner.id) return { error: t('cannotRemoveSelf') };

  const wsRows = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.billingOwnerId, owner.id));
  const wsIds = wsRows.map((w) => w.id);
  if (wsIds.length === 0) return { success: true };

  await db.delete(workspaceMembers).where(and(inArray(workspaceMembers.workspaceId, wsIds), eq(workspaceMembers.userId, userId)));
  revalidatePath('/');
  return { success: true };
}
