import { db } from '@/db';
import {
  subscriptions,
  workspaces,
  workspaceMembers,
  workspaceInvites,
  users,
  agentTokens,
  oauthAccessTokens,
  uploadedAssets,
} from '@/db/schema';
import { eq, and, or, gt, sql, inArray, isNull } from 'drizzle-orm';
import { PLAN_LIMITS, DEFAULT_TIER, isPlanTier, type PlanTier, type PlanLimits } from '@/lib/billing/plans';

// Cookie-free billing accounting. Callers (server actions / API routes) authenticate
// first and pass an explicit owner id. The subscription belongs to the billing OWNER
// (a user); a workspace's limits are read from its `billing_owner_id`'s plan.

export type BillingLimitCode =
  | 'seatLimitReached'
  | 'agentLimitReached'
  | 'storageLimitReached'
  | 'workspaceLimitReached';

export interface ResolvedPlan {
  tier: PlanTier;
  status: string;
  limits: PlanLimits;
}

/** Resolve a billing owner's effective plan (limits + enterprise overrides). No row → Free. */
export async function getOwnerPlan(ownerId: string): Promise<ResolvedPlan> {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.ownerUserId, ownerId))
    .limit(1);

  const tier: PlanTier = row && isPlanTier(row.tier) ? row.tier : DEFAULT_TIER;
  // Canceled/past_due still keep their tier limits until the webhook downgrades them;
  // the webhook sets tier='free' on subscription.deleted.
  const base = PLAN_LIMITS[tier];
  const limits: PlanLimits = {
    ...base,
    seats:        row?.seatLimitOverride ?? base.seats,
    agents:       row?.agentLimitOverride ?? base.agents,
    storageBytes: row?.storageBytesOverride ?? base.storageBytes,
  };
  return { tier, status: row?.status ?? 'active', limits };
}

/** The billing owner for a workspace (explicit column, falling back to earliest owner member). */
export async function resolveBillingOwner(workspaceId: string): Promise<string | null> {
  const [ws] = await db
    .select({ billingOwnerId: workspaces.billingOwnerId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (ws?.billingOwnerId) return ws.billingOwnerId;

  const [owner] = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.role, 'owner')))
    .orderBy(workspaceMembers.createdAt)
    .limit(1);
  return owner?.userId ?? null;
}

export async function getPlanForWorkspace(workspaceId: string): Promise<ResolvedPlan> {
  const ownerId = await resolveBillingOwner(workspaceId);
  if (!ownerId) return { tier: DEFAULT_TIER, status: 'active', limits: PLAN_LIMITS[DEFAULT_TIER] };
  return getOwnerPlan(ownerId);
}

/** All workspace ids whose billing owner is this user. */
async function ownerWorkspaceIds(ownerId: string): Promise<string[]> {
  const rows = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.billingOwnerId, ownerId));
  return rows.map(r => r.id);
}

/**
 * Distinct people (seats) across all the owner's workspaces — counts the owner too,
 * AND pending email invites (which reserve a seat). De-duplicated by email.
 */
export async function countSeats(ownerId: string): Promise<number> {
  const now = new Date();
  const [memberRows, inviteRows] = await Promise.all([
    db
      .select({ email: users.email })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaces.billingOwnerId, ownerId)),
    db
      .select({ email: workspaceInvites.email })
      .from(workspaceInvites)
      .innerJoin(workspaces, eq(workspaces.id, workspaceInvites.workspaceId))
      .where(and(
        eq(workspaces.billingOwnerId, ownerId),
        isNull(workspaceInvites.acceptedAt),
        or(isNull(workspaceInvites.expiresAt), gt(workspaceInvites.expiresAt, now)),
      )),
  ]);

  const emails = new Set<string>();
  for (const r of memberRows) if (r.email) emails.add(r.email.toLowerCase());
  for (const r of inviteRows) if (r.email) emails.add(r.email.toLowerCase());
  return emails.size;
}

/** Is there a pending (unaccepted, unexpired) invite for this email in the owner's pool? */
export async function hasPendingInvite(ownerId: string, email: string): Promise<boolean> {
  const now = new Date();
  const [row] = await db
    .select({ id: workspaceInvites.id })
    .from(workspaceInvites)
    .innerJoin(workspaces, eq(workspaces.id, workspaceInvites.workspaceId))
    .where(and(
      eq(workspaces.billingOwnerId, ownerId),
      eq(workspaceInvites.email, email.toLowerCase()),
      isNull(workspaceInvites.acceptedAt),
      or(isNull(workspaceInvites.expiresAt), gt(workspaceInvites.expiresAt, now)),
    ))
    .limit(1);
  return !!row;
}

/** Is the user already a member of any workspace in the owner's pool? (adding them again is free) */
export async function isUserInOwnerPool(ownerId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(eq(workspaces.billingOwnerId, ownerId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  return !!row;
}

/** Active connected AI agents (PAT + OAuth) across the owner's workspaces. */
export async function countAgents(ownerId: string): Promise<number> {
  const wsIds = await ownerWorkspaceIds(ownerId);
  if (wsIds.length === 0) return 0;

  const [pat, oauth] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(agentTokens)
      .where(and(inArray(agentTokens.workspaceId, wsIds), isNull(agentTokens.revokedAt))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(oauthAccessTokens)
      .where(and(
        inArray(oauthAccessTokens.workspaceId, wsIds),
        isNull(oauthAccessTokens.revokedAt),
        // Access tokens that expired without ever being refreshed (e.g. the client
        // abandoned the session and re-authenticated from scratch) are functionally
        // dead — don't let them permanently occupy an agent slot.
        gt(oauthAccessTokens.expiresAt, new Date()),
      )),
  ]);
  return Number(pat[0]?.n ?? 0) + Number(oauth[0]?.n ?? 0);
}

/** Pooled storage in bytes across all the owner's workspaces. */
export async function getOwnerStorageBytes(ownerId: string): Promise<number> {
  const wsIds = await ownerWorkspaceIds(ownerId);
  if (wsIds.length === 0) return 0;
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${uploadedAssets.bytes}), 0)` })
    .from(uploadedAssets)
    .where(inArray(uploadedAssets.workspaceId, wsIds));
  return Number(row?.total ?? 0);
}

/** How many workspaces this user owns (billing owner). */
export async function countOwnedWorkspaces(ownerId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(workspaces)
    .where(eq(workspaces.billingOwnerId, ownerId));
  return Number(row?.n ?? 0);
}

// ── Limit checks. Return a code when blocked, null when allowed. ──
// Callers translate the code (actions via getTranslations('Errors'), routes via JSON).

export async function checkCanAddSeat(workspaceId: string, targetUserId: string): Promise<BillingLimitCode | null> {
  const ownerId = await resolveBillingOwner(workspaceId);
  if (!ownerId) return null;
  // Re-adding someone already in the pool never consumes a new seat.
  if (await isUserInOwnerPool(ownerId, targetUserId)) return null;
  const { limits } = await getOwnerPlan(ownerId);
  if (limits.seats === Infinity) return null;
  const used = await countSeats(ownerId);
  return used >= limits.seats ? 'seatLimitReached' : null;
}

/** Seat check that also covers people without an account yet (by email + optional userId). */
export async function checkCanAddSeatForEmail(
  workspaceId: string,
  email: string,
  existingUserId?: string | null,
): Promise<BillingLimitCode | null> {
  const ownerId = await resolveBillingOwner(workspaceId);
  if (!ownerId) return null;
  // Already in the pool (member) or already invited (pending) → no new seat.
  if (existingUserId && (await isUserInOwnerPool(ownerId, existingUserId))) return null;
  if (await hasPendingInvite(ownerId, email)) return null;
  const { limits } = await getOwnerPlan(ownerId);
  if (limits.seats === Infinity) return null;
  const used = await countSeats(ownerId);
  return used >= limits.seats ? 'seatLimitReached' : null;
}

export async function checkCanAddAgent(workspaceId: string): Promise<BillingLimitCode | null> {
  const ownerId = await resolveBillingOwner(workspaceId);
  if (!ownerId) return null;
  const { limits } = await getOwnerPlan(ownerId);
  if (limits.agents === Infinity) return null;
  const used = await countAgents(ownerId);
  return used >= limits.agents ? 'agentLimitReached' : null;
}

export async function checkCanCreateWorkspace(ownerId: string): Promise<BillingLimitCode | null> {
  const { limits } = await getOwnerPlan(ownerId);
  if (limits.workspaces === Infinity) return null;
  const used = await countOwnedWorkspaces(ownerId);
  return used >= limits.workspaces ? 'workspaceLimitReached' : null;
}

export async function checkWithinStorage(workspaceId: string, addBytes: number): Promise<BillingLimitCode | null> {
  const ownerId = await resolveBillingOwner(workspaceId);
  if (!ownerId) return null;
  const { limits } = await getOwnerPlan(ownerId);
  if (limits.storageBytes === Infinity) return null;
  const used = await getOwnerStorageBytes(ownerId);
  return used + addBytes > limits.storageBytes ? 'storageLimitReached' : null;
}

/** Full usage snapshot for the Billing UI. */
export async function getOwnerUsage(ownerId: string) {
  const { tier, status, limits } = await getOwnerPlan(ownerId);
  const [seats, agents, storageBytes, ownedWorkspaces] = await Promise.all([
    countSeats(ownerId),
    countAgents(ownerId),
    getOwnerStorageBytes(ownerId),
    countOwnedWorkspaces(ownerId),
  ]);
  return {
    tier,
    status,
    limits,
    usage: {
      seats: { used: seats, limit: limits.seats },
      agents: { used: agents, limit: limits.agents },
      storageBytes: { used: storageBytes, limit: limits.storageBytes },
      workspaces: { used: ownedWorkspaces, limit: limits.workspaces },
    },
  };
}
