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
  components/features/      # All feature React components (see mem:conventions)
    # Key components: WorkspaceSidebar, DatabaseView, MobileNavWrapper, ViewsBar,
    # StandalonePageEditor, PageEditor, TemplatePickerModal, WorkspaceSettingsModal,
    # DatabasePropertiesSidebar, TableLayout, KanbanBoard, CalendarView,
    # InlineCellEditor, IconPicker, PageIcon, SaveStatus, LanguageSwitcher,
    # AdminUsersTable, AdminWorkspacesTable
    # editor/: BlockEditor, ChildBlockExtension, ChildBlockView, BubbleMenuBar,
    #           SlashCommandMenu, SlashCommandList
  components/providers/     # QueryProvider (TanStack Query)
  db/
    schema.ts               # Drizzle ORM schema (all tables)
    index.ts                # DB connection + SQLite PRAGMAs
    migrate.ts              # Migration runner
    migrations/             # SQL migration files (0000–0010)
  i18n/
    routing.ts              # defineRouting (locales, localePrefix:'never')
    request.ts              # getRequestConfig (message loader)
  lib/
    actions/                # Server Actions (auth, workspace, database, page, demo, locale)
    auth/session.ts         # getCurrentUser() — React.cache wrapper around auth()
    types/properties.ts     # SelectOption, color system, helpers
    types/views.ts          # DatabaseView, ViewFilter, ViewSort types
    templates.ts            # TEMPLATES array for TemplatePickerModal
    seed.ts                 # createSeedWorkspace + createDemoSeedData
messages/                   # i18n JSON (en, tr, hi, es, fr, de)
```

## DB Tables
- `workspaces` — workspace list
- `workspace_items` — sidebar items (pages + databases), recursive nesting via `parent_id`
- `standalone_pages` — markdown content for page-type items
- `databases` — schema (JSON) + views (JSON) config
- `pages` — database rows; `properties` JSON column
- `user`, `account`, `session`, `verificationToken` — Auth.js tables
- `workspace_members` — user↔workspace join with role
- `agent_tokens` — MCP bearer tokens scoped to workspace; columns: id, workspace_id (CASCADE), name, token_prefix (8-char, indexed), token_hash (bcrypt cost 12), scope ('read'|'write'), created_by, created_at, last_used_at, revoked_at
- `agent_activity` — audit log per MCP tool call; columns: id, token_id (CASCADE), workspace_id, tool, target_type, target_id, status ('success'|'error'), created_at

## New files (MCP feature)
- `src/app/api/mcp/route.ts` — MCP route handler (Node runtime, stateless Streamable HTTP). Bearer token auth, rate limit 60/min, 6 tools: search, list_workspace, get_page, query_database (read), create_page, update_page (write-scope only). Audit logs every call.
- `src/lib/services/workspace.ts` — Cookie-free service layer for MCP. All fns take explicit workspaceId, no session cookies.
- `src/lib/actions/agentToken.ts` — mintAgentToken / getAgentTokens / revokeAgentToken (owner/admin only).

See `mem:tech_stack` for stack. See `mem:conventions` for code patterns.
