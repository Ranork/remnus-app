# Remnus — Core Memory

Notion-like workspace app. Pages (title + markdown) and databases (dynamic columns, table/kanban/calendar views) in a unified sidebar. Each database row is also a page.

## Source Map

```
src/
  app/                      # Next.js App Router
    layout.tsx              # Root passthrough (no HTML/body)
    [locale]/
      layout.tsx            # Full locale-aware layout, auth check, sidebar
      page.tsx              # Home — unauthenticated: marketing landing page; authenticated: redirect to first workspace item
      pricing/page.tsx      # Public pricing page (MarketingShell + PricingSection)
      contact/page.tsx      # Public contact page (MarketingShell + ContactSection)
      download/page.tsx     # Public desktop download page (LandingNav/Footer + DownloadView)
      login/page.tsx        # Auth page (client component)
      register/page.tsx     # Auth page (client component)
      db/[id]/page.tsx      # Database view (table/kanban/calendar)
      db/[id]/[pageId]/     # Database row page editor
      page/[itemId]/        # Standalone workspace page editor
      admin/page.tsx        # Admin-only dashboard
    api/auth/[...nextauth]/ # Auth.js HTTP handler
  auth.config.ts            # Edge-compatible Auth.js config (no DB)
  auth.ts                   # Full Auth.js config (DrizzleAdapter + callbacks)
  middleware.ts             # Route protection + locale rewrite
  components/marketing/     # Marketing/landing page components (public, no auth)
    # MarketingShell (auth-aware wrapper), MarketingHeader (client, sticky nav),
    # MarketingFooter, HeroSection, FeaturesSection, PricingSection, ContactSection
    # DownloadView (client, OS detection + static releases/latest/download links; stable asset names from tauri-release.yml)
  components/features/      # All feature React components (see mem:conventions)
    # Key components: WorkspaceSidebar, DatabaseView, MobileNavWrapper, ViewsBar,
    # StandalonePageEditor, PageEditor, TemplatePickerModal, WorkspaceSettingsModal,
    # DatabasePropertiesSidebar, TableLayout, KanbanBoard, CalendarView,
    # InlineCellEditor, IconPicker, PageIcon, SaveStatus, LanguageSwitcher,
    # AdminUsersTable (sortable/filterable cols + last-active/time-spent/storage + clickable rows; perUser activity carries storageBytes), admin/AdminUserDetailModal (per-user: account+role toggle, activity summary, workspaces+items), admin/format.ts (formatDate/Duration/Relative). AdminWorkspacesTable REMOVED — workspaces now in the user detail modal.
    # editor/: BlockEditor, ChildBlockExtension, ChildBlockView, YoutubeEmbedExtension/YoutubeEmbedView (youtubeEmbed node: /\"YouTube Video\" slash cmd, iframe embed, URL input until videoId set, extractYouTubeId, serializes <div data-yt-id>), media blocks ImageBlock(div[data-img-src], upload kind=image/URL/paste/drop)+CalloutBlock(div[data-callout-color], emoji+theme color+plain text)+BookmarkBlock(div[data-bm-url], OG card via /api/og)+FileBlock(div[data-file-url], upload kind=file), each Extension+View atom node, all /-slash + single-line <div data-*> round-trip, BubbleMenuBar, BlockDragHandle (Notion-style left gutter handle; editable-only; tracks hovered block via posAtCoords sampled at pointer Y, targets innermost list/task item else top-level block, handle positioned at node's own DOM (view.nodeDOM), drag reorders via view.dragging NodeSelection slice + native PM drop, click menu = Delete/Duplicate/Turn-into; i18n keys blockHandleTooltip/blockDuplicate/blockDelete; replaced old orphaned BlockTypeMenu),
    #           SlashCommandMenu, SlashCommandList (3 divider groups: basic·media·pages; exports SLASH_KEYWORDS for /h1 //img-style shortcut matching + MEDIA_IDS), PageMentionExtension/PageMentionList (@ inline page links), PagePickerPanel + pagePicker.ts (block "Link to page" picker; arrow/Enter/Esc handled via document capture-phase keydown so nav works while editor holds focus), pageLinkData.ts (cached index)
    # Page linking: inline "@" inserts a pageLink atomic node (PageLinkNode, atom:true — label non-editable, one Backspace deletes whole link; renders <a data-page-link>, round-trips via inline-HTML token); block "Link to page" slash cmd inserts a link-only childBlock (data-cb-link=1, delete removes block only, not target). Typed/pasted URLs auto-link; BlockEditor handleClick routes internal /… via SPA router (after onImmediateSave), external opens new tab. StarterKit link openOnClick:false.
  components/providers/     # QueryProvider (TanStack Query), ActivityTracker (engagement heartbeat → /api/activity/ping every 30s while tab visible; mounted for authed users in [locale]/layout.tsx)
  db/
    schema.ts               # Drizzle ORM schema (all tables)
    index.ts                # DB connection + SQLite PRAGMAs
    migrate.ts              # Migration runner
    migrations/             # SQL migration files (0000–0013)
  i18n/
    routing.ts              # defineRouting (locales, localePrefix:'never')
    request.ts              # getRequestConfig (message loader)
  lib/
    actions/                # Server Actions (auth, workspace, database, page, demo, locale, agentToken, analytics, sharing).
    # sharing.ts: createShare/createShareWithChildren/updateShare(cascades inSitemap)/revokeShare/getShare*/updateSharedPageContent analytics.ts: admin-gated getEngagementOverview (session time, DAU/WAU/MAU, signup trend, per-user map) + getUserDetail (account/activity/workspaces) for the admin panel.
    auth/session.ts         # getCurrentUser() — React.cache wrapper around auth()
    types/properties.ts     # SelectOption, color system, helpers
    types/views.ts          # DatabaseView, ViewFilter, ViewSort types
    templates.ts            # TEMPLATES array for TemplatePickerModal
    seed.ts                 # createSeedWorkspace + createDemoSeedData
messages/                   # i18n JSON (en, tr, hi, es, fr, de)
```

## DB Tables
- `workspaces` — workspace list; `icon` (emoji/lucide/https URL), `icon_color`
- `workspace_items` — sidebar items (pages + databases), recursive nesting via `parent_id`
- `standalone_pages` — markdown content for page-type items
- `databases` — schema (JSON) + views (JSON) config
- `pages` — database rows; `properties` JSON column
- `user`, `account`, `session`, `verificationToken` — Auth.js tables
- `workspace_members` — user↔workspace join with role
- `agent_tokens` — MCP bearer tokens scoped to workspace; columns: id, workspace_id (CASCADE), name, agent_name, token_prefix (8-char, indexed), token_hash (bcrypt cost 12), scope ('read'|'write'), created_by, created_at, expires_at (nullable, null = no expiry), last_used_at, revoked_at
- `uploaded_assets` — one row per Cloudinary upload (public_id, resource_type, kind icon|image|file, bytes, url, user_id, workspace_id nullable). Powers Cloudinary cleanup on delete + storage accounting per user/workspace. Migration 0019, applied via `src/db/apply-0019-uploaded-assets.ts`. Service: `src/lib/services/assets.ts` (recordAsset/deleteAssetByUrl/getUserStorageBytes/getWorkspaceStorageBytes). Surfaced in admin user-detail modal (storageBytes + per-ws) and WorkspaceSettings GeneralTab (getWorkspaceStorageUsage).
- `agent_activity` — audit log per MCP tool call; columns: id, token_id (CASCADE), workspace_id, tool, target_type, target_id, status ('success'|'error'), created_at
- `shared_pages` — public page sharing; slug (unique — UUID for users, custom path for admins), page_id, workspace_id (CASCADE), permission ('read'|'write'), width ('narrow'|'wide'|'full'), in_sitemap (boolean, admin-only, cascades to children via updateShare), created_by (CASCADE), created_at. Powers `/share/[...slug]` public route. Migrations 0020/0021/0022, scripts `src/db/apply-002{0,1,2}-*.ts`. New child pages under a shared parent are auto-shared (same permission/width/inSitemap) via `autoShareIfParentShared` in workspace.ts and services/workspace.ts.
- `src/lib/server/sharing-internals.ts` — server-only (NOT 'use server'). `import 'server-only'`. Contains `getShareMapForWorkspace` and `checkUserHasWorkspaceAccess`. Import only from server components — never from 'use server' files (IDOR risk).
- `client_auth_tokens` — short-lived desktop OAuth tokens; device_id (PK), token (JWT), expires_at (5 min TTL)
- `oauth_clients` — RFC 7591 dynamic client registration; client_id (PK), client_name, redirect_uris (JSON), grant_types, response_types, token_endpoint_auth_method
- `oauth_auth_codes` — short-lived PKCE auth codes (10 min TTL); code (PK), client_id, user_id, workspace_id, redirect_uri, code_challenge, code_challenge_method (S256), scope, expires_at, used_at (single-use). Migration 0023.
- `oauth_access_tokens` — OAuth 2.1 issued tokens; token_prefix+token_hash (oa_ prefix, bcrypt), refresh_token_prefix+refresh_token_hash (or_ prefix, rotated on use, 30d TTL), client_id, user_id, workspace_id, scope, expires_at (1hr), revoked_at. Migration 0023, script: `src/db/apply-0023-oauth.ts`.
- `user_sessions` — engagement/time-in-app tracking; user_id, started_at, last_seen_at, duration_seconds. Extended by `/api/activity/ping` heartbeat (ActivityTracker); new row after 2-min gap. Migration 0018, applied manually via `src/db/apply-0018-user-sessions.ts` (not in journal). Powers admin engagement stats.

## Public Page Sharing

- Route: `src/app/[locale]/share/[...slug]/page.tsx` — public (no auth). Workspace members redirected to real route. Builds shareMap + navTree + parentSlug server-side.
- Components: `share/SharedPageView.tsx` (renderer, navbar, width from share.width, editable Tiptap prop), `share/SharedPageNav.tsx` (tree sidebar + mobile dropdown), `share/ShareModal.tsx` (create/edit/revoke from ⋯ menu)
- `SharingTab.tsx` in workspace-settings — 4th tab of WorkspaceSettingsModal
- `BlockEditor` props: `editable?` (Tiptap editable, false still allows clicks), `shareMap?` (passed to ChildBlock extension so child blocks link to /share/[slug])
- `ChildBlockExtension` option `shareMap` — in shared view: navigate to /share/[slug] if shared, lock icon if not
- `StandalonePageEditor`/`PageEditor` both have `isAdmin` prop; header ⋯ menu contains width selector + Share button
- `sitemap.ts` async — includes shared_pages WHERE in_sitemap=true; child pages cascade automatically via updateShare

## MCP feature files
- `src/app/api/mcp/route.ts` — MCP route handler (Node runtime, stateless Streamable HTTP). Accepts both `rmns_` PAT tokens (agent_tokens table) and `oa_` OAuth tokens (oauth_access_tokens table). 401 response includes `WWW-Authenticate` header with resource_metadata pointer for OAuth discovery. Rate limit 60/min, **15 tools**, audit log every call.
- `src/app/.well-known/oauth-protected-resource/route.ts` — Edge. Returns `{ resource, authorization_servers }` for MCP OAuth discovery (RFC 9728).
- `src/app/.well-known/oauth-authorization-server/route.ts` — Edge. Returns full OAuth server metadata (authorization_endpoint, token_endpoint, registration_endpoint, scopes, PKCE methods).
- `src/app/api/oauth/register/route.ts` — POST, public. RFC 7591 dynamic client registration. Validates redirect_uris (https or localhost only). Returns client_id.
- `src/app/api/oauth/token/route.ts` — POST, public. authorization_code (PKCE S256 verify, single-use code) + refresh_token (rotation) grant types. Accepts form-urlencoded or JSON.
- `src/app/[locale]/oauth/authorize/page.tsx` — Public page (auth middleware redirects to login then back). Workspace-picker consent form. Server action creates oauth_auth_codes row + redirects to client. Deny → access_denied redirect.
  - Read: `search`, `list_workspace` (cursor pagination), `get_page`, `get_database_schema`, `query_database` (cursor pagination), `list_members` (workspace_members JOIN user; role/email/joinedAt), `query_audit_log` (agentActivity; tool/status/from/to filters)
  - Write (scope='write' required): `create_page`, `update_page`, `bulk_update`, `delete_page` (confirm flag), `move_item` (reparent; null → root), `create_database` (custom schema; title auto-prepended), `update_database_schema` (add/remove; remove requires confirm; title protected)
- `src/lib/services/workspace.ts` — Cookie-free service layer for MCP. All fns take explicit workspaceId, no session cookies. Exports: searchWorkspace, listWorkspaceItems (returns `{ items, hasMore, nextCursor }` — keyset pagination by sort_order+id), getPageById, getAnyPageById, getDatabasePageById, getDatabaseSchema, queryDatabaseRows (returns `{ schema, rows, hasMore, nextCursor }` — keyset pagination; optional filters), listWorkspaceMembers (workspace_members JOIN user), queryAuditLog (agentActivity; tool/status/from/to filters; agentTokens LEFT JOIN), createPageInWorkspace, updatePageById, bulkUpdatePages, deleteItemFromWorkspace (recursive cascade), moveItemInWorkspace (subtree cycle-check), createDatabaseInWorkspace, updateDatabaseSchemaById.
- `src/lib/actions/agentToken.ts` — mintAgentToken (accepts expiresInDays: number|null) / getAgentTokens / revokeAgentToken (owner/admin only).
- `src/components/marketing/LandingTools.tsx` — Tool reference table on the landing page. TOOLS array lists all 15 tools with scope/desc/return.
- `src/lib/mcp/deeplinks.ts` — shared MCP client connection builders: `buildCursorUrl`/`buildVscodeUrl`/`buildClaudeCmd`/`buildJsonConfig`, all `(mcpUrl, token?)`. token omitted = OAuth mode (URL-only, editor runs its own OAuth flow); token present = PAT mode (embedded Authorization header). Also EDITORS list, OAUTH_READY map, CONFIG_PATHS, TEST_PROMPT. Imported by ConnectFlow, TokensTab, McpOnboarding (dedup — local builders removed).
- `AgentsModal` — global token modal. Each workspace row shows BOTH PAT (rmns_) and OAuth (oa_) tokens unified (TokenRow = discriminated union kind:'pat'|'oauth'; OAuth rows show 🔄 Auto-renewing badge not a 1h countdown). Header "Connect editor" button opens `ConnectFlow`. Fetches getUserWorkspacesWithTokens + getUserOAuthTokens + getUserAgentActivity.
- `src/components/features/agents/ConnectFlow.tsx` — 3-step in-modal onboarding (editor→connect→test). OAuth primary/recommended (token-less), PAT in collapsible Advanced. onUseToken mints PAT in first manageable workspace.
- `TokensTab` — after token creation, shows one-click install deeplinks via deeplinks.ts builders.
- agentToken.ts also exports getUserOAuthTokens / revokeOAuthToken (OAuth tokens are user-owned).
- **`.well-known/oauth-protected-resource`, `.well-known/oauth-authorization-server`, and the MCP 401 `WWW-Authenticate` header all derive base URL from the request host (`new URL(req.url)`), NOT `NEXTAUTH_URL`** — prevents resource-indicator mismatch (e.g. www vs apex) that makes clients withhold the Authorization header. MCP route Bearer parse is case-insensitive (`/^Bearer\s+(.+)$/i`).

See `mem:tech_stack` for stack. See `mem:conventions` for code patterns.
