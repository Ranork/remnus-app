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
}, (table) => [
  index('pages_database_id_idx').on(table.databaseId),
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
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  tokenId:     text('token_id').notNull().references(() => agentTokens.id, { onDelete: 'cascade' }),
  workspaceId: text('workspace_id').notNull(),
  tool:        text('tool').notNull(),
  targetType:  text('target_type'),
  targetId:    text('target_id'),
  status:      text('status', { enum: ['success', 'error'] }).notNull(),
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('agent_activity_workspace_id_idx').on(table.workspaceId),
  index('agent_activity_token_id_idx').on(table.tokenId),
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
  kind:       text('kind', { enum: ['welcome', 'inactivity', 'agent_nudge', 'agent_connected', 'newsletter', 'test'] }).notNull(),
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
