'use server';
import { db } from '@/db';
import {
  users, accounts, userSessions, workspaceMembers, workspaces, workspaceItems, uploadedAssets, subscriptions,
  agentTokens, oauthAccessTokens, agentActivity, databases, pages,
} from '@/db/schema';
import { eq, ne, and, inArray, asc, desc, isNull, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/session';
import { getTranslations } from 'next-intl/server';
import { isPlanTier, type PlanTier } from '@/lib/billing/plans';
import { runHogQL } from '@/lib/analytics/posthog-query';

async function assertAdmin() {
  const user = await getCurrentUser();
  if (user.role !== 'admin') {
    const t = await getTranslations('Errors');
    throw new Error(t('adminRequired'));
  }
  return user;
}

export type PerUserActivity = {
  totalSeconds: number;
  sessionCount: number;
  lastActive: number | null; // epoch ms
  storageBytes: number;
  mcpCalls: number; // MCP tool calls across the user's workspaces
  usesDesktop: boolean; // has ever had a session with platform === 'tauri'
};

export type EngagementOverview = {
  totalSeconds: number;
  sessionCount: number;
  avgSessionSeconds: number;
  dau: number;
  wau: number;
  mau: number;
  newThisWeek: number;
  newThisMonth: number;
  signupTrend: { date: string; count: number }[]; // last 30 days, oldest → newest
  perUser: Record<string, PerUserActivity>;
  // Demo is excluded from every metric above. These surface it separately:
  demoActiveSessions: number; // distinct demo users active in the last 15 min
  demoTotal: number;          // current ephemeral demo accounts (≈ last 6h)
  // Desktop (Tauri) usage — see user_sessions.platform (migration 0035).
  desktopUsersTotal: number;     // distinct non-demo users with any 'tauri' session, ever
  desktopUsersActive30d: number; // of those, active in the last 30 days
};

const DAY = 24 * 60 * 60;

// Timestamp columns are stored as integer Unix seconds, but the createdAt
// gotcha (see AGENTS.md) means some legacy rows hold a CURRENT_TIMESTAMP text
// value instead. Normalize both forms to epoch ms, returning null when invalid
// so callers never feed NaN into new Date().toISOString().
function toEpochMs(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === 'number') {
    if (!isFinite(val)) return null;
    return val < 1e12 ? val * 1000 : val; // seconds vs already-ms heuristic
  }
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d.getTime();
}

export async function getEngagementOverview(): Promise<EngagementOverview> {
  await assertAdmin();

  const nowSec = Math.floor(Date.now() / 1000);
  const dayCut = nowSec - DAY;
  const weekCut = nowSec - 7 * DAY;
  const monthCut = nowSec - 30 * DAY;

  const [signups] = await db
    .select({
      week: sql<number>`count(case when ${users.createdAt} >= ${weekCut} then 1 end)`,
      month: sql<number>`count(case when ${users.createdAt} >= ${monthCut} then 1 end)`,
    })
    .from(users)
    .where(ne(users.role, 'demo'));

  const [agg] = await db
    .select({
      totalSeconds: sql<number>`coalesce(sum(${userSessions.durationSeconds}), 0)`,
      sessionCount: sql<number>`cast(count(*) as int)`,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(ne(users.role, 'demo'));

  const [active] = await db
    .select({
      dau: sql<number>`count(distinct case when ${userSessions.lastSeenAt} >= ${dayCut} then ${userSessions.userId} end)`,
      wau: sql<number>`count(distinct case when ${userSessions.lastSeenAt} >= ${weekCut} then ${userSessions.userId} end)`,
      mau: sql<number>`count(distinct case when ${userSessions.lastSeenAt} >= ${monthCut} then ${userSessions.userId} end)`,
      desktopTotal: sql<number>`count(distinct case when ${userSessions.platform} = 'tauri' then ${userSessions.userId} end)`,
      desktopActive30d: sql<number>`count(distinct case when ${userSessions.platform} = 'tauri' and ${userSessions.lastSeenAt} >= ${monthCut} then ${userSessions.userId} end)`,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(ne(users.role, 'demo'));

  const perUserRows = await db
    .select({
      userId: userSessions.userId,
      totalSeconds: sql<number>`coalesce(sum(${userSessions.durationSeconds}), 0)`,
      sessionCount: sql<number>`cast(count(*) as int)`,
      lastSeen: sql<number>`max(${userSessions.lastSeenAt})`,
      usesDesktop: sql<number>`max(case when ${userSessions.platform} = 'tauri' then 1 else 0 end)`,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(ne(users.role, 'demo'))
    .groupBy(userSessions.userId);

  // Storage per user (uploaders) — independent of whether they have sessions.
  const storageRows = await db
    .select({ userId: uploadedAssets.userId, total: sql<number>`coalesce(sum(${uploadedAssets.bytes}), 0)` })
    .from(uploadedAssets)
    .innerJoin(users, eq(uploadedAssets.userId, users.id))
    .where(ne(users.role, 'demo'))
    .groupBy(uploadedAssets.userId);
  const storageByUser: Record<string, number> = {};
  for (const r of storageRows) storageByUser[r.userId] = Number(r.total ?? 0);

  // MCP tool calls — logged per workspace, so count per workspace then attribute
  // to each (non-demo) member, mirroring getUserDetail's "calls across the user's
  // workspaces" definition.
  const callsByWsRows = await db
    .select({ workspaceId: agentActivity.workspaceId, c: sql<number>`cast(count(*) as int)` })
    .from(agentActivity)
    .groupBy(agentActivity.workspaceId);
  const callsByWs: Record<string, number> = {};
  for (const r of callsByWsRows) callsByWs[r.workspaceId] = Number(r.c ?? 0);

  const memberRows = await db
    .select({ userId: workspaceMembers.userId, workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(ne(users.role, 'demo'));
  const mcpCallsByUser: Record<string, number> = {};
  for (const m of memberRows) {
    const c = callsByWs[m.workspaceId] ?? 0;
    if (c) mcpCallsByUser[m.userId] = (mcpCallsByUser[m.userId] ?? 0) + c;
  }

  const perUser: Record<string, PerUserActivity> = {};
  const ensure = (userId: string): PerUserActivity =>
    (perUser[userId] ??= { totalSeconds: 0, sessionCount: 0, lastActive: null, storageBytes: 0, mcpCalls: 0, usesDesktop: false });

  for (const r of perUserRows) {
    const e = ensure(r.userId);
    e.totalSeconds = r.totalSeconds;
    e.sessionCount = r.sessionCount;
    e.lastActive = toEpochMs(r.lastSeen);
    e.usesDesktop = !!r.usesDesktop;
  }
  // Include users who uploaded / made MCP calls but have no sessions yet.
  for (const [userId, bytes] of Object.entries(storageByUser)) ensure(userId).storageBytes = bytes;
  for (const [userId, calls] of Object.entries(mcpCallsByUser)) ensure(userId).mcpCalls = calls;

  // Acquisition trend: signups per day over the last 30 days, bucketed in JS.
  const signupRows = await db
    .select({ createdAt: sql<number>`${users.createdAt}` })
    .from(users)
    .where(and(sql`${users.createdAt} >= ${monthCut}`, ne(users.role, 'demo')));

  const buckets = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date((nowSec - i * DAY) * 1000);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of signupRows) {
    const ms = toEpochMs(row.createdAt);
    if (ms == null) continue;
    const key = new Date(ms).toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const signupTrend = [...buckets.entries()].map(([date, count]) => ({ date, count }));

  // Demo activity — deliberately kept OUT of every metric above; reported on its own.
  const demoActiveCut = nowSec - 15 * 60; // "active" = a heartbeat in the last 15 min
  const [demoActive] = await db
    .select({ count: sql<number>`count(distinct ${userSessions.userId})` })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(and(eq(users.role, 'demo'), sql`${userSessions.lastSeenAt} >= ${demoActiveCut}`));
  const [demoCount] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(users)
    .where(eq(users.role, 'demo'));

  const sessionCount = agg?.sessionCount ?? 0;
  const totalSeconds = agg?.totalSeconds ?? 0;

  return {
    totalSeconds,
    sessionCount,
    avgSessionSeconds: sessionCount > 0 ? Math.round(totalSeconds / sessionCount) : 0,
    dau: active?.dau ?? 0,
    wau: active?.wau ?? 0,
    mau: active?.mau ?? 0,
    newThisWeek: signups?.week ?? 0,
    newThisMonth: signups?.month ?? 0,
    signupTrend,
    perUser,
    demoActiveSessions: demoActive?.count ?? 0,
    demoTotal: demoCount?.count ?? 0,
    desktopUsersTotal: active?.desktopTotal ?? 0,
    desktopUsersActive30d: active?.desktopActive30d ?? 0,
  };
}

/** Coarse marketing-channel buckets a referring domain rolls up into. */
export type TrafficChannel = 'direct' | 'organic' | 'social' | 'referral';

export type TrafficSourcesData = {
  /** Channel-type rollup (Direct / Organic Search / Social / Referral), most visitors first. */
  channels: { channel: TrafficChannel; visitors: number }[];
  /** Per-referring-domain detail. `source === '$direct'` means no referrer. */
  domains: { source: string; visitors: number; views: number }[];
  /**
   * Per-campaign-tag detail — `?ref=<tag>` (simple partner/campaign links) falling
   * back to `?utm_source=<tag>` when no `ref` is present. Referrer-domain breakdown
   * above can't surface this: a `ref=scoutforge` link clicked from scoutforge.com
   * shows up there as `scoutforge.com`, and a referrer-less click (email, DM, app)
   * shows up as `$direct` — the tag itself is only visible by reading the URL's
   * query string, which this breakdown does directly via HogQL's
   * `extractURLParameter`. Empty when nobody has landed with a tagged link yet.
   */
  campaigns: { tag: string; visitors: number; views: number }[];
  days: number;
  /** False when the PostHog read creds are missing — card shows an "unavailable" state. */
  available: boolean;
};

/** Classify a referring domain into a coarse marketing channel. */
function classifyChannel(domain: string): TrafficChannel {
  if (domain === '$direct') return 'direct';
  const d = domain.toLowerCase();
  const has = (...keys: string[]) => keys.some((k) => d.includes(k));
  if (has('google', 'bing', 'yahoo', 'duckduckgo', 'yandex', 'baidu', 'ecosia')) return 'organic';
  if (
    has(
      'reddit', 'twitter', 't.co', 'x.com', 'facebook', 'fb.com', 'linkedin', 'lnkd',
      'youtube', 'youtu.be', 'instagram', 'mastodon', 'bsky', 'threads', 'ycombinator', 'tiktok',
    )
  )
    return 'social';
  return 'referral';
}

/**
 * Where landing (`/`) visitors came from over the last N days, read from PostHog
 * ($pageview + $referring_domain) — the top-of-funnel counterpart to the
 * DB-based activation funnel. Covers ALL visitors, not just signups. Admin-only.
 *
 * Internal navigations (referrer on our own domain) are filtered out so this
 * reflects real entry sources. Returns `available: false` when PostHog read creds
 * aren't configured (local dev / forks) or the query fails.
 */
export async function getTrafficSources(days = 30): Promise<TrafficSourcesData> {
  await assertAdmin();
  const window = Math.max(1, Math.min(365, Math.floor(days)));
  const [rows, campaignRows] = await Promise.all([
    runHogQL<[string, number, number]>(`
      SELECT
        coalesce(nullIf(properties.$referring_domain, ''), '$direct') AS domain,
        count(DISTINCT person_id) AS visitors,
        count() AS views
      FROM events
      WHERE event = '$pageview'
        AND timestamp > now() - INTERVAL ${window} DAY
        AND properties.$pathname = '/'
        AND coalesce(properties.$referring_domain, '') NOT ILIKE '%remnus%'
      GROUP BY domain
      ORDER BY visitors DESC
      LIMIT 50
    `),
    // `?ref=<tag>` (our own simple partner/campaign links) falling back to
    // `?utm_source=<tag>`. Read straight off $current_url via extractURLParameter
    // since neither tag is broken out as its own event property today — see
    // AttributionCapture.tsx, which only ever forwards this to PostHog/DB at
    // signup time, so anonymous (non-signup) landings had no other way to surface it.
    runHogQL<[string | null, number, number]>(`
      SELECT
        coalesce(
          nullIf(extractURLParameter(properties.$current_url, 'ref'), ''),
          nullIf(extractURLParameter(properties.$current_url, 'utm_source'), '')
        ) AS tag,
        count(DISTINCT person_id) AS visitors,
        count() AS views
      FROM events
      WHERE event = '$pageview'
        AND timestamp > now() - INTERVAL ${window} DAY
        AND properties.$pathname = '/'
      GROUP BY tag
      ORDER BY visitors DESC
      LIMIT 50
    `),
  ]);
  if (rows == null) {
    return { channels: [], domains: [], campaigns: [], days: window, available: false };
  }

  const channelTotals = new Map<TrafficChannel, number>();
  const domains = rows.map(([domain, visitors, views]) => {
    const v = Number(visitors) || 0;
    const ch = classifyChannel(domain);
    channelTotals.set(ch, (channelTotals.get(ch) ?? 0) + v);
    return { source: domain, visitors: v, views: Number(views) || 0 };
  });

  const order: TrafficChannel[] = ['direct', 'organic', 'social', 'referral'];
  const channels = order
    .map((channel) => ({ channel, visitors: channelTotals.get(channel) ?? 0 }))
    .filter((c) => c.visitors > 0)
    .sort((a, b) => b.visitors - a.visitors);

  const campaigns = (campaignRows ?? [])
    .filter(([tag]) => !!tag)
    .map(([tag, visitors, views]) => ({
      tag: tag as string,
      visitors: Number(visitors) || 0,
      views: Number(views) || 0,
    }));

  return { channels, domains, campaigns, days: window, available: true };
}

export type DesktopDownloadStats = {
  byOs: { os: string; clicks: number; visitors: number }[];
  totalClicks: number;
  totalVisitors: number;
  days: number;
  /** False when the PostHog read creds are missing — card shows an "unavailable" state. */
  available: boolean;
};

/**
 * Desktop (Tauri) download-click stats, read from PostHog's `desktop_download_clicked`
 * event (captured client-side from /download and the landing page — see DownloadView.tsx
 * / LandingDownload.tsx) — the download itself is a static GitHub release link with no
 * server round-trip, so a click capture is the only signal we can get for "how many
 * people downloaded it". Mirrors {@link getTrafficSources}'s shape/fallback contract.
 */
export async function getDesktopDownloadStats(days = 30): Promise<DesktopDownloadStats> {
  await assertAdmin();
  const window = Math.max(1, Math.min(365, Math.floor(days)));
  const rows = await runHogQL<[string, number, number]>(`
    SELECT
      coalesce(nullIf(properties.os, ''), 'unknown') AS os,
      count() AS clicks,
      count(DISTINCT person_id) AS visitors
    FROM events
    WHERE event = 'desktop_download_clicked'
      AND timestamp > now() - INTERVAL ${window} DAY
    GROUP BY os
    ORDER BY clicks DESC
  `);
  if (rows == null) {
    return { byOs: [], totalClicks: 0, totalVisitors: 0, days: window, available: false };
  }

  const byOs = rows.map(([os, clicks, visitors]) => ({
    os,
    clicks: Number(clicks) || 0,
    visitors: Number(visitors) || 0,
  }));
  const totalClicks = byOs.reduce((sum, r) => sum + r.clicks, 0);
  const totalVisitors = byOs.reduce((sum, r) => sum + r.visitors, 0);

  return { byOs, totalClicks, totalVisitors, days: window, available: true };
}

/**
 * The planted seed token prefix (see onboarding.ts / seed.ts). Excluded from the
 * activation funnel so a freshly-seeded workspace's demo token/activity doesn't
 * count as a real connection.
 */
const SEED_TOKEN_PREFIX = 'rmns-demo';

/**
 * Activation funnel, reconstructed from DB state (independent of PostHog): how
 * many real users signed up → connected an agent (minted a real MCP token) →
 * made a first real agent call. Each stage is a subset of the previous one, so
 * the conversion rates are monotonic. The granular OAuth/consent sub-steps
 * (`oauth_authorize_viewed`, …) live only in PostHog; this surfaces the three
 * DB-observable milestones in the admin panel.
 *
 * NOTE: OAuth-path tool calls aren't recorded in `agent_activity` (see the known
 * gap in onboarding.ts), so `activated` reflects the PAT path. A user who only
 * ever connected over OAuth counts toward `connected` but not `activated`.
 */
export type ActivationFunnel = {
  signups: number;   // real (non-demo) users
  connected: number; // created a real MCP token (PAT createdBy or active OAuth)
  activated: number; // made a real agent tool call (PAT or OAuth path; migration 0034)
};

export async function getActivationFunnel(): Promise<ActivationFunnel> {
  await assertAdmin();

  // Real (non-demo) user id set — every funnel stage is scoped to these.
  const realUsers = await db.select({ id: users.id }).from(users).where(ne(users.role, 'demo'));
  const realSet = new Set(realUsers.map((u) => u.id));

  // "Connected" = minted a real PAT (by creator) OR holds an OAuth token.
  const [patCreators, oauthOwners, callCreators, callOwners] = await Promise.all([
    db
      .select({ userId: agentTokens.createdBy })
      .from(agentTokens)
      .where(ne(agentTokens.tokenPrefix, SEED_TOKEN_PREFIX)),
    db.select({ userId: oauthAccessTokens.userId }).from(oauthAccessTokens),
    // "Activated" = a real agent call, attributed to the token's creator.
    db
      .select({ userId: agentTokens.createdBy })
      .from(agentActivity)
      .innerJoin(agentTokens, eq(agentActivity.tokenId, agentTokens.id))
      .where(ne(agentTokens.tokenPrefix, SEED_TOKEN_PREFIX)),
    // OAuth-path calls attribute via owner_user_id (migration 0034; null on
    // seed/legacy rows, so no seed filter needed here).
    db
      .selectDistinct({ userId: agentActivity.ownerUserId })
      .from(agentActivity)
      .where(sql`${agentActivity.ownerUserId} IS NOT NULL`),
  ]);

  const connectedSet = new Set<string>();
  for (const r of [...patCreators, ...oauthOwners]) {
    if (r.userId && realSet.has(r.userId)) connectedSet.add(r.userId);
  }
  const activatedSet = new Set<string>();
  for (const r of [...callCreators, ...callOwners]) {
    if (r.userId && realSet.has(r.userId)) activatedSet.add(r.userId);
  }

  return {
    signups: realSet.size,
    connected: connectedSet.size,
    activated: activatedSet.size,
  };
}

export type UserDetailWorkspace = {
  id: string;
  name: string;
  role: string;
  storageBytes: number; // total bytes uploaded into this workspace (all members)
  items: { id: string; type: 'page' | 'database'; title: string; icon: string | null }[];
};

export type UserSubscription = {
  tier: PlanTier;
  status: string; // active | past_due | canceled
  // 'stripe' = paid via Stripe (don't override manually); 'manual' = admin-activated;
  // 'none' = no paid plan (implicit Free).
  source: 'stripe' | 'manual' | 'none';
  currentPeriodEnd: number | null; // epoch ms
};

export type UserContentStats = {
  pages: number;      // standalone + page-type workspace items the user can see
  databases: number;  // database-type workspace items
  records: number;    // rows across those databases
};

export type AgentTokenSummary = {
  id: string;
  name: string;
  agentName: string | null;
  scope: string; // 'read' | 'write'
  status: 'active' | 'revoked' | 'expired';
  lastUsedAt: number | null; // epoch ms
  createdAt: number | null;  // epoch ms
};

export type UserAgents = {
  active: number;            // active PAT tokens + active OAuth connections
  oauthActive: number;       // active (non-revoked) OAuth connections
  calls: number;             // MCP tool calls logged across the user's workspaces
  lastCall: number | null;   // epoch ms of the most recent call
  responseBytes: number;     // total serialized response payload bytes (~tokens = /4); migration 0034
  tokens: AgentTokenSummary[]; // long-lived PAT tokens, newest first
};

export type UserDetail = {
  account: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: string;
    createdAt: number | null; // epoch ms
    authType: 'google' | 'github' | 'email' | 'unknown';
    ownedWorkspaces: number;  // workspaces where this user is owner
  };
  activity: PerUserActivity;
  storageBytes: number; // total bytes this user has uploaded
  content: UserContentStats;
  agents: UserAgents;
  subscription: UserSubscription;
  workspaces: UserDetailWorkspace[];
};

export async function getUserDetail(userId: string): Promise<UserDetail> {
  await assertAdmin();

  const [u] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: users.role,
      createdAt: sql<number>`${users.createdAt}`,
      hasPassword: sql<number>`case when ${users.passwordHash} is not null then 1 else 0 end`,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!u) {
    const t = await getTranslations('Errors');
    throw new Error(t('userNotFound'));
  }

  const providerRows = await db
    .select({ provider: accounts.provider })
    .from(accounts)
    .where(eq(accounts.userId, userId));
  const providers = providerRows.map((p) => p.provider);
  const authType = providers.includes('google')
    ? ('google' as const)
    : providers.includes('github')
      ? ('github' as const)
      : u.hasPassword
        ? ('email' as const)
        : ('unknown' as const);

  const [act] = await db
    .select({
      totalSeconds: sql<number>`coalesce(sum(${userSessions.durationSeconds}), 0)`,
      sessionCount: sql<number>`cast(count(*) as int)`,
      lastSeen: sql<number>`max(${userSessions.lastSeenAt})`,
      usesDesktop: sql<number>`max(case when ${userSessions.platform} = 'tauri' then 1 else 0 end)`,
    })
    .from(userSessions)
    .where(eq(userSessions.userId, userId));

  // Workspaces the user belongs to, with their membership role.
  const memberships = await db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      role: workspaceMembers.role,
      name: workspaces.name,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId));

  const wsIds = memberships.map((m) => m.workspaceId);
  const itemRows = wsIds.length
    ? await db
        .select({
          id: workspaceItems.id,
          workspaceId: workspaceItems.workspaceId,
          type: workspaceItems.type,
          title: workspaceItems.title,
          icon: workspaceItems.icon,
        })
        .from(workspaceItems)
        .where(inArray(workspaceItems.workspaceId, wsIds))
        .orderBy(asc(workspaceItems.sortOrder), asc(workspaceItems.createdAt))
    : [];

  const itemsByWs = itemRows.reduce<Record<string, UserDetailWorkspace['items']>>((acc, it) => {
    (acc[it.workspaceId] ??= []).push({ id: it.id, type: it.type, title: it.title, icon: it.icon });
    return acc;
  }, {});

  // Storage: total uploaded by this user, and per-workspace totals (all members).
  const [userStorage] = await db
    .select({ total: sql<number>`coalesce(sum(${uploadedAssets.bytes}), 0)` })
    .from(uploadedAssets)
    .where(eq(uploadedAssets.userId, userId));

  // Subscription / plan — belongs to the user as a billing owner. No row → implicit Free.
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.ownerUserId, userId))
    .limit(1);

  const subTier: PlanTier = sub && isPlanTier(sub.tier) ? sub.tier : 'free';
  const subscription: UserSubscription = {
    tier: subTier,
    status: sub?.status ?? 'active',
    source: sub?.stripeSubscriptionId ? 'stripe' : subTier !== 'free' ? 'manual' : 'none',
    currentPeriodEnd: sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : null,
  };

  const wsStorageRows = wsIds.length
    ? await db
        .select({ workspaceId: uploadedAssets.workspaceId, total: sql<number>`coalesce(sum(${uploadedAssets.bytes}), 0)` })
        .from(uploadedAssets)
        .where(inArray(uploadedAssets.workspaceId, wsIds))
        .groupBy(uploadedAssets.workspaceId)
    : [];
  const storageByWs = wsStorageRows.reduce<Record<string, number>>((acc, r) => {
    if (r.workspaceId) acc[r.workspaceId] = Number(r.total ?? 0);
    return acc;
  }, {});

  const workspacesDetail: UserDetailWorkspace[] = memberships.map((m) => ({
    id: m.workspaceId,
    name: m.name,
    role: m.role,
    storageBytes: storageByWs[m.workspaceId] ?? 0,
    items: itemsByWs[m.workspaceId] ?? [],
  }));

  const ownedWorkspaces = memberships.filter((m) => m.role === 'owner').length;

  // ── Content stats — counted across the user's workspaces ──
  const itemTypeRows = wsIds.length
    ? await db
        .select({ type: workspaceItems.type, c: sql<number>`cast(count(*) as int)` })
        .from(workspaceItems)
        .where(inArray(workspaceItems.workspaceId, wsIds))
        .groupBy(workspaceItems.type)
    : [];
  let pageCount = 0;
  let databaseCount = 0;
  for (const r of itemTypeRows) {
    if (r.type === 'database') databaseCount = Number(r.c);
    else pageCount = Number(r.c);
  }
  const [recordAgg] = wsIds.length
    ? await db
        .select({ c: sql<number>`cast(count(*) as int)` })
        .from(pages)
        .innerJoin(databases, eq(pages.databaseId, databases.id))
        .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
        .where(inArray(workspaceItems.workspaceId, wsIds))
    : [{ c: 0 }];

  // ── MCP agents — PAT tokens live in the user's workspaces; OAuth tokens are
  // bound to the user. Activity is logged per workspace, so count across wsIds. ──
  const nowMs = Date.now();
  const patRows = wsIds.length
    ? await db
        .select({
          id: agentTokens.id,
          name: agentTokens.name,
          agentName: agentTokens.agentName,
          scope: agentTokens.scope,
          createdAt: agentTokens.createdAt,
          lastUsedAt: agentTokens.lastUsedAt,
          expiresAt: agentTokens.expiresAt,
          revokedAt: agentTokens.revokedAt,
        })
        .from(agentTokens)
        .where(inArray(agentTokens.workspaceId, wsIds))
        .orderBy(desc(agentTokens.createdAt))
    : [];

  const patTokens: AgentTokenSummary[] = patRows.map((r) => {
    const expMs = r.expiresAt ? new Date(r.expiresAt).getTime() : null;
    const status: AgentTokenSummary['status'] = r.revokedAt
      ? 'revoked'
      : expMs != null && expMs < nowMs
        ? 'expired'
        : 'active';
    return {
      id: r.id,
      name: r.name,
      agentName: r.agentName,
      scope: r.scope,
      status,
      lastUsedAt: r.lastUsedAt ? new Date(r.lastUsedAt).getTime() : null,
      createdAt: r.createdAt ? new Date(r.createdAt).getTime() : null,
    };
  });
  const patActive = patTokens.filter((t) => t.status === 'active').length;

  const [oauthAgg] = await db
    .select({ c: sql<number>`cast(count(*) as int)` })
    .from(oauthAccessTokens)
    .where(and(eq(oauthAccessTokens.userId, userId), isNull(oauthAccessTokens.revokedAt)));
  const oauthActive = Number(oauthAgg?.c ?? 0);

  const [callAgg] = wsIds.length
    ? await db
        .select({
          c: sql<number>`cast(count(*) as int)`,
          last: sql<number>`max(${agentActivity.createdAt})`,
          bytes: sql<number>`coalesce(sum(${agentActivity.responseBytes}), 0)`,
        })
        .from(agentActivity)
        .where(inArray(agentActivity.workspaceId, wsIds))
    : [{ c: 0, last: null, bytes: 0 }];

  const agents: UserAgents = {
    active: patActive + oauthActive,
    oauthActive,
    calls: Number(callAgg?.c ?? 0),
    lastCall: toEpochMs(callAgg?.last),
    responseBytes: Number(callAgg?.bytes ?? 0),
    tokens: patTokens,
  };

  return {
    account: {
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      role: u.role,
      createdAt: toEpochMs(u.createdAt),
      authType,
      ownedWorkspaces,
    },
    activity: {
      totalSeconds: act?.totalSeconds ?? 0,
      sessionCount: act?.sessionCount ?? 0,
      lastActive: toEpochMs(act?.lastSeen),
      storageBytes: Number(userStorage?.total ?? 0),
      mcpCalls: agents.calls,
      usesDesktop: !!act?.usesDesktop,
    },
    storageBytes: Number(userStorage?.total ?? 0),
    content: {
      pages: pageCount,
      databases: databaseCount,
      records: Number(recordAgg?.c ?? 0),
    },
    agents,
    subscription,
    workspaces: workspacesDetail,
  };
}
