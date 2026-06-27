import { stripe, tierForPriceId } from '@/lib/stripe';
import { db } from '@/db';
import { subscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { PlanTier } from './plans';

// Self-healing: derive a customer's effective plan from Stripe's LIVE state
// rather than trusting a single webhook event. Handles duplicate subscriptions
// (picks the highest active tier) and cancellation (no active sub → Free),
// regardless of event ordering.

const RANK: Record<PlanTier, number> = { free: 0, startup: 1, professional: 2, enterprise: 3 };
const ACTIVE_STATUSES = ['active', 'trialing', 'past_due', 'unpaid'];

export async function syncSubscriptionForCustomer(customerId: string, ownerUserId?: string | null) {
  if (!stripe) return;

  const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 50 });
  const live = list.data.filter((s) => ACTIVE_STATUSES.includes(s.status));

  // Highest active tier wins (so leftover duplicates never downgrade a paid user).
  let best: { tier: PlanTier; sub: (typeof live)[number] } | null = null;
  for (const s of live) {
    const tier = tierForPriceId(s.items?.data?.[0]?.price?.id);
    if (!tier) continue;
    if (!best || RANK[tier] > RANK[best.tier]) best = { tier, sub: s };
  }

  const now = new Date();
  let set: {
    tier: PlanTier;
    status: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string | null;
    currentPeriodEnd: Date | null;
    updatedAt: Date;
  };

  if (best) {
    const st = best.sub.status;
    const status = st === 'active' || st === 'trialing' ? 'active' : st === 'past_due' || st === 'unpaid' ? 'past_due' : st;
    // current_period_end lives on the subscription (older API) or its items (newer API)
     
    const periodUnix = (best.sub as any).current_period_end ?? (best.sub.items?.data?.[0] as any)?.current_period_end ?? null;
    set = {
      tier: best.tier,
      status,
      stripeCustomerId: customerId,
      stripeSubscriptionId: best.sub.id,
      currentPeriodEnd: periodUnix ? new Date(Number(periodUnix) * 1000) : null,
      updatedAt: now,
    };
  } else {
    set = { tier: 'free', status: 'canceled', stripeCustomerId: customerId, stripeSubscriptionId: null, currentPeriodEnd: null, updatedAt: now };
  }

  let owner = ownerUserId ?? null;
  if (!owner) {
    const [row] = await db
      .select({ id: subscriptions.ownerUserId })
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, customerId))
      .limit(1);
    owner = row?.id ?? null;
  }

  if (owner) {
    await db.insert(subscriptions).values({ ownerUserId: owner, createdAt: now, ...set }).onConflictDoUpdate({ target: subscriptions.ownerUserId, set });
  } else {
    await db.update(subscriptions).set(set).where(eq(subscriptions.stripeCustomerId, customerId));
  }
}
