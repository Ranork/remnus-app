import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const workspaces = sqliteTable('workspaces', {
  id:        text('id').primaryKey(),
  name:      text('name').notNull(),
  icon:      text('icon'),
  iconColor: text('icon_color'),
  sortOrder: integer('sort_order').notNull().default(0),
  // The paying user whose plan governs this workspace's limits (seats/agents/storage).
  // Nullable for orphaned/admin-claimed workspaces. Migration 0027.
  billingOwnerId: text('billing_owner_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const workspaceItems = sqliteTable('workspace_items', {
  id:          text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  type:        text('type', { enum: ['page', 'database'] }).notNull(),
  title:       text('title').notNull(),
  parentId:    text('parent_id'),
  sortOrder:   integer('sort_order').notNull().default(0),
  icon:        text('icon'),
  iconColor:   text('icon_color'),
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt:   integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('workspace_items_workspace_id_idx').on(table.workspaceId),
  index('workspace_items_parent_id_idx').on(table.parentId),
]);

export const standalonePages = sqliteTable('standalone_pages', {
  id:        text('id').primaryKey(),
  itemId:    text('item_id').notNull().references(() => workspaceItems.id, { onDelete: 'cascade' }),
  content:   text('content').notNull().default(''),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('standalone_pages_item_id_idx').on(table.itemId),
]);

export const databases = sqliteTable('databases', {
  id:     text('id').primaryKey(),
  name:   text('name').notNull(),
  itemId: text('item_id').references(() => workspaceItems.id, { onDelete: 'set null' }),
  schema: text('schema', { mode: 'json' }).notNull().$type<any[]>(),
  views: text('views', { mode: 'json' }).$type<any[]>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('databases_item_id_idx').on(table.itemId),
]);

export const pages = sqliteTable('pages', {
  id: text('id').primaryKey(),
  databaseId: text('database_id').notNull().references(() => databases.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').notNull().default(''),
  properties: text('properties', { mode: 'json' }).notNull().$type<Record<string, any>>().default({}),
  sortOrder: integer('sort_order').notNull().default(0),
  icon: text('icon'),
  iconColor: text('icon_color'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  agentEditedAt: integer('agent_edited_at', { mode: 'timestamp' }),
  agentTokenId: text('agent_token_id'),
  // Per-row "compact card" preference for Kanban/Calendar — hides the card's
  // property list, showing just the title. Deliberately a dedicated column,
  // not a `properties` entry: it's presentation state, not a schema-driven
  // user field (would otherwise leak into Table columns/exports/MCP reads).
  // Migration 0042.
  cardCollapsed: integer('card_collapsed', { mode: 'boolean' }).notNull().default(false),
  // ── Recurrence (migration 0043) ────────────────────────────────────────────
  // A calendar card can be one occurrence of a repeating series. The occurrence
  // is a REAL row (not a virtual expansion) because in Remnus every database
  // row is also a page: it carries a body, sub-items, links, backlinks and MCP
  // addressability, none of which a computed ghost could hold.
  //
  // These are dedicated columns rather than `properties` entries for the same
  // reason `cardCollapsed` above is: they are system state, not schema-driven
  // user fields, and would otherwise leak into Table columns, exports, filters
  // and MCP row reads.
  seriesId: text('series_id'),
  // RECURRENCE-ID: the date the rule generated this row. Diverging from the
  // card's actual date is what marks it as manually moved.
  occurrenceDate: text('occurrence_date'),
  // Set when the occurrence was customized (body written, sub-page added,
  // agent-edited, ...) and a rule change would otherwise have destroyed it —
  // it keeps its content and stops following the series. See
  // `.ai/RECURRENCE_DESIGN.md` §4.
  seriesDetached: integer('series_detached', { mode: 'boolean' }).notNull().default(false),
}, (table) => [
  index('pages_database_id_idx').on(table.databaseId),
  index('pages_series_id_idx').on(table.seriesId),
  // Makes materialization idempotent: a concurrent top-up (read-triggered and
  // cron at once) can't produce a duplicate card for the same occurrence.
  uniqueIndex('pages_series_occurrence_idx').on(table.seriesId, table.occurrenceDate),
]);

// One repeating rule + the template its occurrences are stamped from. Splitting
// a series ("this and following") creates a NEW row here pointing back at the
// old one via `parentSeriesId`, instead of mutating the original rule — which
// is what makes already-materialized past cards immutable by construction.
export const recurrenceSeries = sqliteTable('recurrence_series', {
  id:         text('id').primaryKey(),
  databaseId: text('database_id').notNull().references(() => databases.id, { onDelete: 'cascade' }),
  // Which date/datetime column of the database the rule drives.
  dateColId:  text('date_col_id').notNull(),
  // `RecurrenceRule` from src/lib/recurrence/rule.ts — JSON, not an RRULE
  // string, so MCP clients can read and write it without a parser.
  rule:       text('rule', { mode: 'json' }).notNull().$type<Record<string, any>>(),
  // Title / properties / icon / body that every generated occurrence starts from.
  template:   text('template', { mode: 'json' }).notNull().$type<Record<string, any>>(),
  // Last date materialization has reached; the top-up extends it.
  materializedUntil: text('materialized_until'),
  parentSeriesId: text('parent_series_id'),
  // Plain text, no FK: `users` is declared further down this file, and the same
  // pattern is already used by `pages.agentTokenId`.
  createdBy:  text('created_by'),
  createdAt:  integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt:  integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('recurrence_series_database_id_idx').on(table.databaseId),
]);

// ── Auth tables (matching @auth/drizzle-adapter expected schema) ──────────────

export const users = sqliteTable('user', {
  id:            text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:          text('name'),
  email:         text('email').unique(),
  emailVerified: integer('emailVerified', { mode: 'timestamp_ms' }),
  image:         text('image'),
  passwordHash:  text('password_hash'),
  role:          text('role').notNull().default('user'),
  // Effective analytics-capture permission for server-side funnel events
  // (persisted by the client ConsentProvider): 'granted' | 'denied' | null.
  analyticsConsent: text('analytics_consent'),
  // First-touch acquisition attribution, copied off the `remnus_first_touch`
  // cookie at signup so the admin dashboard can break new users down by channel
  // without depending on PostHog. `signup_ref` is the raw `?ref=` param (e.g.
  // `scoutforge` from a partner link / email / ad); the rest mirror the UTM +
  // referrer captured client-side. All nullable (direct visits have none).
  signupRef:      text('signup_ref'),
  signupUtmSource:   text('signup_utm_source'),
  signupUtmMedium:   text('signup_utm_medium'),
  signupUtmCampaign: text('signup_utm_campaign'),
  signupReferrer:    text('signup_referrer'),
  // Mailing suppression (migration 0033): `emailUnsubscribedAt` = the user
  // clicked unsubscribe (mutes everything except the transactional welcome);
  // `emailSuppressed` = SES reported a hard bounce / spam complaint via the
  // SNS webhook (mutes ALL sends — protects the shared SES reputation).
  emailUnsubscribedAt: integer('email_unsubscribed_at', { mode: 'timestamp' }),
  emailSuppressed:     text('email_suppressed'), // 'bounced' | 'complained' | null
  createdAt:     integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const accounts = sqliteTable('account', {
  userId:            text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:              text('type').notNull(),
  provider:          text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token:     text('refresh_token'),
  access_token:      text('access_token'),
  expires_at:        integer('expires_at'),
  token_type:        text('token_type'),
  scope:             text('scope'),
  id_token:          text('id_token'),
  session_state:     text('session_state'),
}, (table) => [
  primaryKey({ columns: [table.provider, table.providerAccountId] }),
  index('account_user_id_idx').on(table.userId),
]);

export const sessions = sqliteTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId:       text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires:      integer('expires', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  index('session_user_id_idx').on(table.userId),
]);

export const verificationTokens = sqliteTable('verificationToken', {
  identifier: text('identifier').notNull(),
  token:      text('token').notNull(),
  expires:    integer('expires', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.identifier, table.token] }),
]);

// ── Workspace membership ──────────────────────────────────────────────────────

export const workspaceMembers = sqliteTable('workspace_members', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId:      text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role:        text('role').notNull().default('member'), // 'owner' | 'member' | 'viewer'
  hidden:      integer('hidden', { mode: 'boolean' }).notNull().default(false), // per-user: hide this workspace from the caller's sidebar
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('workspace_members_workspace_user_unique').on(table.workspaceId, table.userId),
  index('workspace_members_user_id_idx').on(table.userId),
]);

// Email invitations for people who don't have a Remnus account yet (or aren't
// members yet). Accepted via /invite/[token]. Pending invites reserve a seat.
// Migration 0028.
export const workspaceInvites = sqliteTable('workspace_invites', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  email:       text('email').notNull(),                 // lowercased
  role:        text('role').notNull().default('member'),// 'member' | 'viewer'
  token:       text('token').notNull(),                 // bearer secret in the invite link
  invitedBy:   text('invited_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull(),
  expiresAt:   integer('expires_at', { mode: 'timestamp' }),   // nullable = no expiry
  acceptedAt:  integer('accepted_at', { mode: 'timestamp' }),  // nullable until accepted
}, (table) => [
  uniqueIndex('workspace_invites_token_unique').on(table.token),
  index('workspace_invites_workspace_id_idx').on(table.workspaceId),
  index('workspace_invites_email_idx').on(table.email),
])

// Prospect invites — personalized, single-use gift-signup links for outreach
// campaigns (e.g. Scout Forge). Distinct from `workspace_invites`: this invites
// a NEW prospect into a fresh account (not into an existing workspace) and
// carries an editable snapshot of a Scout Forge app's public info alongside a
// time-boxed plan grant. Status is derived (pending/link_expired/active/reverted),
// not stored. Migration 0040.
export const prospectInvites = sqliteTable('prospect_invites', {
  id:              text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  token:           text('token').notNull(),                          // bearer secret in /welcome/[token]
  appIdstr:        text('app_idstr').notNull(),                      // Scout Forge slug — source for re-fetch
  appName:         text('app_name').notNull(),                       // editable snapshot
  appLogoUrl:      text('app_logo_url'),                             // editable snapshot, nullable
  appTagline:      text('app_tagline'),                              // editable snapshot (shortDescription)
  appUrl:          text('app_url'),                                  // nullable, app's own site (context only)
  giftTier:        text('gift_tier').notNull().default('startup'),   // PlanTier: 'startup' | 'professional'
  giftDays:        integer('gift_days').notNull().default(30),
  linkExpiresAt:   integer('link_expires_at', { mode: 'timestamp' }), // deadline to CLAIM the link, not the gift
  createdBy:       text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:       integer('created_at', { mode: 'timestamp' }).notNull(),
  // Funnel tracking (migration 0041) — recorded from the public claim page's
  // read path (getProspectInviteByToken), best-effort/fire-and-forget so a
  // tracking write never slows down or breaks the page render.
  firstOpenedAt:   integer('first_opened_at', { mode: 'timestamp' }), // first /welcome/[token] view, nullable until then
  openCount:       integer('open_count').notNull().default(0),       // total views, including repeats
  claimedAt:       integer('claimed_at', { mode: 'timestamp' }),
  claimedByUserId: text('claimed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  revertedAt:      integer('reverted_at', { mode: 'timestamp' }),    // when the cron rolled the gift back to Free
}, (table) => [
  uniqueIndex('prospect_invites_token_unique').on(table.token),
  index('prospect_invites_app_idstr_idx').on(table.appIdstr),
]);

// ── MCP Agent Tokens ──────────────────────────────────────────────────────────

export const agentTokens = sqliteTable('agent_tokens', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name:        text('name').notNull(),
  agentName:   text('agent_name'),
  tokenPrefix: text('token_prefix').notNull(),
  tokenHash:   text('token_hash').notNull(),
  scope:       text('scope', { enum: ['read', 'write'] }).notNull(),
  createdBy:   text('created_by').references(() => users.id),
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull(),
  expiresAt:   integer('expires_at', { mode: 'timestamp' }),
  lastUsedAt:  integer('last_used_at', { mode: 'timestamp' }),
  revokedAt:   integer('revoked_at', { mode: 'timestamp' }),
}, (table) => [
  index('agent_tokens_workspace_id_idx').on(table.workspaceId),
  index('agent_tokens_token_prefix_idx').on(table.tokenPrefix),
]);

export const clientAuthTokens = sqliteTable('client_auth_tokens', {
  deviceId:  text('device_id').primaryKey(),
  token:     text('token').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ── User engagement / session tracking ───────────────────────────────────────
// Heartbeat-based active-time tracking. The client pings /api/activity/ping
// while the user is active; each ping extends the most recent open session or
// opens a new one after an inactivity gap. Powers the admin engagement stats.

export const userSessions = sqliteTable('user_sessions', {
  id:              text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:          text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startedAt:       integer('started_at', { mode: 'timestamp' }).notNull(),
  lastSeenAt:      integer('last_seen_at', { mode: 'timestamp' }).notNull(),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  // 'web' | 'tauri'; null = legacy row predating this column (treat as web).
  // Stamped once at session creation from the `remnus_platform` cookie
  // (`isTauriRequest()`) — powers the admin desktop-usage stats. Migration 0037.
  platform:        text('platform'),
}, (table) => [
  index('user_sessions_user_id_idx').on(table.userId),
  index('user_sessions_last_seen_at_idx').on(table.lastSeenAt),
]);

// ── Uploaded assets (Cloudinary) ──────────────────────────────────────────────
// One row per file uploaded through /api/upload. Powers (a) reliable Cloudinary
// cleanup on delete — we keep the exact public_id + resource_type — and (b)
// storage-usage accounting per user and per workspace (future plan limits).

export const uploadedAssets = sqliteTable('uploaded_assets', {
  id:           text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  publicId:     text('public_id').notNull(),
  resourceType: text('resource_type').notNull(), // 'image' | 'raw' | 'video'
  kind:         text('kind').notNull(),           // 'icon' | 'image' | 'file'
  bytes:        integer('bytes').notNull().default(0),
  url:          text('url').notNull(),
  userId:       text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  workspaceId:  text('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
  createdAt:    integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('uploaded_assets_public_id_unique').on(table.publicId),
  index('uploaded_assets_user_id_idx').on(table.userId),
  index('uploaded_assets_workspace_id_idx').on(table.workspaceId),
]);

// ── Public page sharing ───────────────────────────────────────────────────────
// Maps a slug (URL segment) to a workspace item or DB row, with read/write permission.
// Regular users get a UUID slug; admins can set a custom slug (e.g. "docs/mcp-intro").

export const sharedPages = sqliteTable('shared_pages', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug:        text('slug').notNull(),
  pageId:      text('page_id').notNull(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  permission:  text('permission', { enum: ['read', 'write'] }).notNull().default('read'),
  width:       text('width', { enum: ['narrow', 'wide', 'full'] }).notNull().default('narrow'),
  inSitemap:   integer('in_sitemap', { mode: 'boolean' }).notNull().default(false),
  createdBy:   text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('shared_pages_slug_unique').on(table.slug),
  index('shared_pages_workspace_id_idx').on(table.workspaceId),
  index('shared_pages_page_id_idx').on(table.pageId),
]);

// ── OAuth 2.1 + PKCE tables ───────────────────────────────────────────────────

export const oauthClients = sqliteTable('oauth_clients', {
  clientId:                text('client_id').primaryKey(),
  clientName:              text('client_name').notNull(),
  redirectUris:            text('redirect_uris', { mode: 'json' }).notNull().$type<string[]>(),
  grantTypes:              text('grant_types', { mode: 'json' }).notNull().$type<string[]>(),
  responseTypes:           text('response_types', { mode: 'json' }).notNull().$type<string[]>(),
  tokenEndpointAuthMethod: text('token_endpoint_auth_method').notNull().default('none'),
  createdAt:               integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const oauthAuthCodes = sqliteTable('oauth_auth_codes', {
  code:                text('code').primaryKey(),
  clientId:            text('client_id').notNull(),
  userId:              text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  workspaceId:         text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  redirectUri:         text('redirect_uri').notNull(),
  codeChallenge:       text('code_challenge').notNull(),
  codeChallengeMethod: text('code_challenge_method').notNull().default('S256'),
  scope:               text('scope').notNull().default('read'),
  // Agent brand (canonical AGENT_MARKS id) + friendly label chosen on the consent
  // screen; copied onto the access token at exchange. Both nullable. Migration 0030.
  agentName:           text('agent_name'),
  displayName:         text('display_name'),
  expiresAt:           integer('expires_at', { mode: 'timestamp' }).notNull(),
  usedAt:              integer('used_at', { mode: 'timestamp' }),
});

export const oauthAccessTokens = sqliteTable('oauth_access_tokens', {
  id:                 text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  tokenPrefix:        text('token_prefix').notNull(),
  tokenHash:          text('token_hash').notNull(),
  refreshTokenPrefix: text('refresh_token_prefix'),
  refreshTokenHash:   text('refresh_token_hash'),
  clientId:           text('client_id').notNull(),
  userId:             text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  workspaceId:        text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  scope:              text('scope').notNull().default('read'),
  // User-set canonical agent id override (AGENT_MARKS id) for icon display; nullable. Migration 0024.
  agentName:          text('agent_name'),
  // Friendly label chosen on the consent screen; falls back to client_name in the UI. Migration 0030.
  displayName:        text('display_name'),
  expiresAt:          integer('expires_at', { mode: 'timestamp' }).notNull(),
  revokedAt:          integer('revoked_at', { mode: 'timestamp' }),
  createdAt:          integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('oauth_access_tokens_prefix_idx').on(table.tokenPrefix),
  index('oauth_access_tokens_refresh_prefix_idx').on(table.refreshTokenPrefix),
]);

export const agentActivity = sqliteTable('agent_activity', {
  id:           text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  // Exactly one of tokenId (PAT call) / oauthTokenId (OAuth call) is set. Migration 0034.
  tokenId:      text('token_id').references(() => agentTokens.id, { onDelete: 'cascade' }),
  oauthTokenId: text('oauth_token_id').references(() => oauthAccessTokens.id, { onDelete: 'set null' }),
  // Token owner (PAT creator / OAuth grantee) — denormalized for per-user usage sums. Migration 0034.
  ownerUserId:  text('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
  workspaceId:  text('workspace_id').notNull(),
  tool:         text('tool').notNull(),
  targetType:   text('target_type'),
  targetId:     text('target_id'),
  status:       text('status', { enum: ['success', 'error'] }).notNull(),
  // Serialized response payload size in bytes (token estimate ≈ bytes/4). Migration 0034.
  responseBytes: integer('response_bytes'),
  createdAt:    integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('agent_activity_workspace_id_idx').on(table.workspaceId),
  index('agent_activity_token_id_idx').on(table.tokenId),
  index('agent_activity_owner_created_idx').on(table.ownerUserId, table.createdAt),
]);

// Subscription — bound to the paying user (billing owner), NOT a workspace.
// Covers all workspaces where `workspaces.billing_owner_id = owner_user_id`.
// No row = implicit Free plan. Migration 0027.
export const subscriptions = sqliteTable('subscriptions', {
  ownerUserId:          text('owner_user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  tier:                 text('tier').notNull().default('free'),     // free | startup | professional | enterprise
  status:               text('status').notNull().default('active'), // active | past_due | canceled
  stripeCustomerId:     text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  currentPeriodEnd:     integer('current_period_end', { mode: 'timestamp' }),
  // Enterprise/custom overrides — null = use PLAN_LIMITS[tier].
  seatLimitOverride:    integer('seat_limit_override'),
  agentLimitOverride:   integer('agent_limit_override'),
  storageBytesOverride: integer('storage_bytes_override'),
  createdAt:            integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt:            integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('subscriptions_stripe_customer_idx').on(table.stripeCustomerId),
]);

// In-app feedback left by demo visitors (the "how are you liking it?" prompt that
// fires a few minutes into a demo session). `userId` is SET NULL on delete so the
// feedback survives the demo account's periodic cleanup (purgeDemoUser) — the
// admin dashboard must keep showing it after the ephemeral account is reaped.
// Migration 0032.
export const demoFeedback = sqliteTable('demo_feedback', {
  id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:    text('user_id').references(() => users.id, { onDelete: 'set null' }),
  sentiment: text('sentiment', { enum: ['positive', 'neutral', 'negative'] }).notNull(),
  comment:   text('comment'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('demo_feedback_created_at_idx').on(table.createdAt),
]);

// One row per "Try the demo" click — the DURABLE record of demo usage. It has to
// be its own table rather than a query over `user`/`user_sessions`, because both
// of those are wiped for a demo visitor 6h after signup (purgeDemoUser), which
// left the admin panel with no history at all: only whatever demos happened to
// be alive right now. `user_id` is ON DELETE SET NULL for exactly that reason —
// the row must outlive the ephemeral account it describes.
//
// `activeSeconds` is ACCUMULATED presence, not `lastSeenAt - startedAt`: the
// /api/activity/ping heartbeat adds each tick's delta only when it lands within
// the 2-min presence window, so a visitor who leaves the tab open for an hour
// isn't recorded as an hour-long demo. Migration 0044.
export const demoSessions = sqliteTable('demo_sessions', {
  id:            text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:        text('user_id').references(() => users.id, { onDelete: 'set null' }),
  startedAt:     integer('started_at', { mode: 'timestamp' }).notNull(),
  lastSeenAt:    integer('last_seen_at', { mode: 'timestamp' }).notNull(),
  activeSeconds: integer('active_seconds').notNull().default(0),
}, (table) => [
  index('demo_sessions_started_at_idx').on(table.startedAt),
  index('demo_sessions_user_id_idx').on(table.userId),
]);

// ── Mailing (AWS SES) ─────────────────────────────────────────────────────────
// Migration 0033. Manually composed newsletters written by an admin in the
// /admin/mailing UI (markdown body rendered into the branded email layout).
// Lifecycle emails (welcome / agent_nudge / agent_connected / inactivity) don't
// need a campaign row — they only log into `email_log`.

export const emailCampaigns = sqliteTable('email_campaigns', {
  id:             text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  subject:        text('subject').notNull(),
  preheader:      text('preheader'),
  bodyMd:         text('body_md').notNull(),
  status:         text('status', { enum: ['draft', 'sending', 'sent'] }).notNull().default('draft'),
  recipientCount: integer('recipient_count').notNull().default(0),
  sentCount:      integer('sent_count').notNull().default(0),
  failedCount:    integer('failed_count').notNull().default(0),
  createdBy:      text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:      integer('created_at', { mode: 'timestamp' }).notNull(),
  sentAt:         integer('sent_at', { mode: 'timestamp' }),
});

// One row per sent (or failed) email — idempotency guard for the one-shot
// lifecycle emails + the admin dashboard's send history. `userId` is SET NULL
// on delete so the log survives user/demo cleanup.
export const emailLog = sqliteTable('email_log', {
  id:         text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:     text('user_id').references(() => users.id, { onDelete: 'set null' }),
  email:      text('email').notNull(),
  kind:       text('kind', { enum: ['welcome', 'inactivity', 'agent_nudge', 'agent_connected', 'account_deletion', 'contact', 'newsletter', 'test'] }).notNull(),
  campaignId: text('campaign_id').references(() => emailCampaigns.id, { onDelete: 'set null' }),
  subject:    text('subject').notNull(),
  status:     text('status', { enum: ['sent', 'failed'] }).notNull(),
  error:      text('error'),
  createdAt:  integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('email_log_user_kind_idx').on(table.userId, table.kind),
  index('email_log_created_at_idx').on(table.createdAt),
  index('email_log_campaign_id_idx').on(table.campaignId),
]);

// Tombstones for hard-deleted pages/databases/rows — powers the MCP
// get_changes_since delta-sync tool (a "deleted" entry has no surviving row to
// read updatedAt from). Written best-effort alongside every hard delete path
// (services/workspace.ts, actions/workspace.ts, actions/page.ts). Migration 0035.
export const deletedItems = sqliteTable('deleted_items', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  itemId:      text('item_id').notNull(),
  itemType:    text('item_type', { enum: ['page', 'database', 'database_row'] }).notNull(),
  title:       text('title'),
  deletedAt:   integer('deleted_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('deleted_items_workspace_deleted_idx').on(table.workspaceId, table.deletedAt),
]);

// Content-derived link graph: one row per pageLink (<a data-page-link>) or
// childBlock (<div data-cb-id>) reference found in a page's markdown body.
// Re-synced (delete + insert per from_id) on every content write — web save
// actions AND MCP write tools — by syncPageLinks() in
// src/lib/services/pageLinks.ts; existing content backfilled via
// src/db/backfill-page-links.ts. Powers the MCP get_related_pages tool
// (outgoing links + backlinks). Target ids are stored as-written, unresolved:
// to_type 'page' = workspace item id, 'database' = databases.id (page_link)
// OR workspace item id (child_block), 'database_row' = pages row id —
// getRelatedPages resolves both database id forms at read time. Migration 0036.
export const pageLinks = sqliteTable('page_links', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  fromId:      text('from_id').notNull(),
  fromType:    text('from_type', { enum: ['page', 'database_row'] }).notNull(),
  toId:        text('to_id').notNull(),
  toType:      text('to_type', { enum: ['page', 'database', 'database_row'] }).notNull(),
  linkKind:    text('link_kind', { enum: ['page_link', 'child_block'] }).notNull(),
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('page_links_from_idx').on(table.fromId),
  index('page_links_to_idx').on(table.toId),
  uniqueIndex('page_links_from_to_kind_idx').on(table.fromId, table.toId, table.linkKind),
]);

// Canonical, storage-independent knowledge metadata for every Remnus page,
// database, and database row. OKF frontmatter is an import/export projection of
// this model; raw imported assertions remain external until a Remnus user
// reviews the exact content revision. Migration 0039.
export const knowledgeMetadata = sqliteTable('knowledge_metadata', {
  id:                text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId:       text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  itemId:            text('item_id').notNull(),
  itemType:          text('item_type', { enum: ['page', 'database', 'database_row'] }).notNull(),
  conceptType:       text('concept_type'),
  description:       text('description'),
  tags:              text('tags', { mode: 'json' }).notNull().$type<string[]>().default([]),
  sources:           text('sources', { mode: 'json' }).notNull().$type<Array<{ resource: string; title?: string }>>().default([]),
  status:            text('status', { enum: ['draft', 'stable', 'deprecated'] }),
  staleAfter:        text('stale_after'),
  ownerUserId:       text('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
  generatedBy:       text('generated_by'),
  generatedAt:       integer('generated_at', { mode: 'timestamp' }),
  externalVerified:  text('external_verified', { mode: 'json' }).notNull().$type<Array<{ by: string; at?: string }>>().default([]),
  externalFrontmatter: text('external_frontmatter'),
  createdAt:         integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt:         integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  uniqueIndex('knowledge_metadata_workspace_item_unique').on(table.workspaceId, table.itemId, table.itemType),
  index('knowledge_metadata_workspace_status_idx').on(table.workspaceId, table.status),
  index('knowledge_metadata_owner_idx').on(table.ownerUserId),
]);

// A human review is bound to the exact title+content hash. Editing the concept
// automatically makes the old review historical without mutating it. Imported
// `verified: human:*` values never create rows here. Migration 0039.
export const knowledgeReviews = sqliteTable('knowledge_reviews', {
  id:             text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  metadataId:     text('metadata_id').notNull().references(() => knowledgeMetadata.id, { onDelete: 'cascade' }),
  reviewerUserId: text('reviewer_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  contentHash:    text('content_hash').notNull(),
  reviewedAt:     integer('reviewed_at', { mode: 'timestamp' }).notNull(),
  revokedAt:      integer('revoked_at', { mode: 'timestamp' }),
}, (table) => [
  index('knowledge_reviews_metadata_idx').on(table.metadataId, table.reviewedAt),
  index('knowledge_reviews_reviewer_idx').on(table.reviewerUserId),
]);

// Workspace-level context behavior. `smart` is guidance/automation where the
// client supports it; `strict` additionally requires a recent context run for
// Remnus MCP mutations. It never replaces authorization or confirmation.
export const workspaceContextPolicies = sqliteTable('workspace_context_policies', {
  workspaceId:  text('workspace_id').primaryKey().references(() => workspaces.id, { onDelete: 'cascade' }),
  mode:         text('mode', { enum: ['manual', 'smart', 'strict'] }).notNull().default('smart'),
  autoMaxTokens: integer('auto_max_tokens').notNull().default(2000),
  trustPolicy:  text('trust_policy', { enum: ['any', 'prefer-human-reviewed', 'human-reviewed-only'] }).notNull().default('prefer-human-reviewed'),
  createdAt:    integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt:    integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Opaque task-preflight handles minted by prepare_context. The task itself is
// not persisted; only hashes and compact audit facts are stored. Migration 0039.
export const contextRuns = sqliteTable('context_runs', {
  id:               text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId:      text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  tokenId:          text('token_id').references(() => agentTokens.id, { onDelete: 'cascade' }),
  oauthTokenId:     text('oauth_token_id').references(() => oauthAccessTokens.id, { onDelete: 'cascade' }),
  ownerUserId:      text('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
  taskHash:         text('task_hash').notNull(),
  conceptSetHash:   text('concept_set_hash').notNull(),
  knowledgeRevision: text('knowledge_revision').notNull(),
  trustPolicy:      text('trust_policy').notNull(),
  estimatedTokens: integer('estimated_tokens').notNull(),
  expiresAt:        integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt:        integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('context_runs_workspace_created_idx').on(table.workspaceId, table.createdAt),
  index('context_runs_token_expires_idx').on(table.tokenId, table.expiresAt),
  index('context_runs_oauth_expires_idx').on(table.oauthTokenId, table.expiresAt),
]);

// Short-lived, single-use, DB-backed (not stateless-HMAC like the unsubscribe
// token — a destructive action needs an expiry + a way to mark it consumed)
// confirmation token for GDPR self-service account deletion. requestAccountDeletion()
// mints one + emails a confirm link; confirmAccountDeletion() re-validates
// (unused, unexpired, session matches userId) before actually deleting. Migration 0038.
export const accountDeletionTokens = sqliteTable('account_deletion_tokens', {
  token:     text('token').primaryKey(),
  userId:    text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  usedAt:    integer('used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('account_deletion_tokens_user_id_idx').on(table.userId),
]);
