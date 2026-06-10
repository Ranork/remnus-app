import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const workspaces = sqliteTable('workspaces', {
  id:        text('id').primaryKey(),
  name:      text('name').notNull(),
  icon:      text('icon'),
  iconColor: text('icon_color'),
  sortOrder: integer('sort_order').notNull().default(0),
  hidden:    integer('hidden', { mode: 'boolean' }).notNull().default(false),
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
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('workspace_members_workspace_user_unique').on(table.workspaceId, table.userId),
  index('workspace_members_user_id_idx').on(table.userId),
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
