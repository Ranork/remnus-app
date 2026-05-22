<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Keeping This File Up to Date

**Every agent that makes structural changes to the project MUST update this file before finishing.**
Structural changes include: adding/removing tables, adding routes, adding/removing components, adding server actions, or changing architectural patterns.
If you skip this step, future agents will work from a stale map and make mistakes.

## Serena Memory Sync

Serena is an MCP code-intelligence assistant with its own persistent memory. Its memories must be kept in sync with this file.

**After updating AGENTS.md, also sync Serena:**

1. Activate the project: call `mcp__plugin_serena_serena__activate_project` with `"remnus-app"`.
2. List existing memories: call `mcp__plugin_serena_serena__list_memories` to see what needs updating.
3. Edit stale entries: call `mcp__plugin_serena_serena__edit_memory` for any memory whose content no longer matches AGENTS.md.

**Key memories to check:**

- `conventions` — i18n namespace list and count, coding rules
- `core` — source map, DB tables, component inventory

Do NOT create new Serena memories for every change — prefer editing existing ones. Only create a new memory if it covers a clearly standalone domain not already tracked.

---

# Project Details: Remnus

**Remnus** is a Notion-like application built around a **workspace** model. Users can create standalone pages (title + markdown) and customizable databases (dynamic columns, table/kanban/calendar views) — both living side by side in a unified sidebar. Each database row is also a page with markdown content.

## i18n & Localization

Remnus is fully internationalized using **next-intl v4** (App Router native). All user-facing text is loaded from translation files — **no hardcoded strings in components**.

### Supported Languages

| Code | Language          |
| ---- | ----------------- |
| `en` | English (default) |
| `tr` | Türkçe            |
| `hi` | हिन्दी            |
| `es` | Español           |
| `fr` | Français          |
| `de` | Deutsch           |

### Locale Resolution (priority order)

1. `NEXT_LOCALE` cookie (user picks via `LanguageSwitcher`, 1-year expiry)
2. `Accept-Language` header (auto OS language detection via `negotiator` + `@formatjs/intl-localematcher`)
3. `en` fallback

**Clean URLs:** `localePrefix: 'never'` — URLs stay as `/db/123`, never `/en/db/123`. All pages live under `src/app/[locale]/`.

**Translation files:** `messages/{locale}.json` — `en.json` is the source of truth. **17 namespaces:** `Layout`, `Home`, `Auth`, `Workspace`, `WorkspaceSettings`, `Templates`, `Database`, `Editor`, `Page`, `IconPicker`, `Admin`, `Errors`, `LanguageSwitcher`, `MobileNav`, `Landing`, `Pricing`, `Contact`.

### Rules for All Future Development

**Every new component or server action that surfaces user-facing text MUST follow these rules:**

1. **Client components** — `import { useTranslations } from 'next-intl'` and call `useTranslations('Namespace')` inside the component body.
2. **Server components / layouts** — `import { getTranslations } from 'next-intl/server'` and `await getTranslations('Namespace')`.
3. **Server actions** — same as above; use `getTranslations('Errors')` for error messages returned to the client.
4. **Add all new keys to ALL 6 files** before committing. Missing keys fall back to the key name.
5. **No hardcoded display strings** — not even English fallbacks like `|| 'Untitled'`. Always use `t('key')`.
6. **Date formatting** — use `useLocale()` (client) or locale from `getRequestConfig` (server) instead of `'en-US'`.
7. **Namespace selection** — pick the closest existing namespace. Create a new one only for a clearly standalone domain (add to all 6 files and document here).

## Color Theme

| Role                | Hex       | Tailwind token |
| ------------------- | --------- | -------------- |
| Main canvas bg      | `#1d1f23` | `neutral-950`  |
| Sidebar / card bg   | `#21252b` | `neutral-900`  |
| Content canvas bg   | `#282c34` | `neutral-850`  |
| Borders / dividers  | `#383b41` | `neutral-800`  |
| Silver text         | `#cccccc` | `neutral-100`  |
| Muted text          | `#d7dae0` | `neutral-50`   |
| Primary / accent    | `#445c95` | `blue-500`     |
| Destructive         | `#cd4d55` | `red-400`      |
| Success             | `#7fc36d` | `green-400`    |
| Warning             | `#cc7d45` | `amber-500`    |

Tokens defined via `@theme` overrides in `src/app/globals.css`.

## UI & Design Aesthetics

- **Flat and borderless:** Settings panels, drawers, sidebars — always `rounded-none`, no shadows.
- **Three-tier background:** `neutral-950` body frame → `neutral-900` sidebars/floating panels → `neutral-850` content/canvas. Separate with a single `border-neutral-800` line.
- **Flat-Line Separators:** Use `border-b border-neutral-850` + `hover:bg-neutral-800/10` rows instead of cards.
- **Auth Pages Exception:** `/login` and `/register` use `rounded-xl` cards and `rounded-lg` inputs. Do not apply this style inside the workspace.

## Technology Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** TailwindCSS, Lucide React icons
- **Database:** SQLite (`file:local.db`), Turso/Serverless compatible target.
- **ORM & Driver:** Drizzle ORM + `@libsql/client`.
- **Auth:** Auth.js v5 (`next-auth@beta`) + `@auth/drizzle-adapter` + `bcryptjs`.
- **Desktop:** Tauri v2 (Rust shell, loads `remnus.com` in system WebView).
- **Mobile:** Capacitor v8 (iOS + Android, loads `remnus.com` via `server.url`).
- **PWA:** `@ducanh2912/next-pwa` (Workbox service worker, `public/manifest.json`).

## Architecture & Conventions

### Database Tables

We use the **JSON Column Pattern** (not EAV) for dynamic user-defined properties:

| Table | Purpose |
| ----- | ------- |
| `workspaces` | Workspace list |
| `workspace_items` | Sidebar items (pages + databases), recursive `parent_id` nesting |
| `standalone_pages` | Markdown content for page-type items (1:1 with `workspace_items`) |
| `databases` | `schema` JSON (columns) + `views` JSON (named view configs) |
| `pages` | Database rows — `properties` JSON + `title`, `content`, `icon`, `icon_color` |
| `user` | Auth.js accounts — `role` ('user'\|'admin'\|'demo'), `password_hash` |
| `account` | OAuth provider links (Google) |
| `session` | Auth.js sessions |
| `verificationToken` | Email verification |
| `workspace_members` | User↔Workspace join — `role` ('owner'\|'member'\|'viewer') |
| `agent_tokens` | MCP bearer tokens — `token_prefix`, `token_hash`, `scope` ('read'\|'write'), `revoked_at` |
| `agent_activity` | Audit log for every MCP tool call |

### Auth System

- **Config split:** `src/auth.config.ts` (edge-safe, no DB, middleware only) + `src/auth.ts` (full, server components/actions).
- **Session access:** Always use `getCurrentUser()` from `src/lib/auth/session.ts` in server actions — **never** `auth()` directly. It is `React.cache`-wrapped to run at most once per request.
- **createdAt gotcha:** DrizzleAdapter stores `CURRENT_TIMESTAMP` as text (breaks Drizzle timestamp parsing). All `workspaces`, `workspace_members`, and credential `users` inserts pass explicit `createdAt: new Date()`. The `createUser` event also force-updates OAuth users immediately after row creation.
- **First-user bootstrap:** The very first non-demo user (any provider) is auto-promoted to `admin` and added as owner to all memberless workspaces.
- **Demo mode:** `demo@remnus.com` (role `demo`) — `loginAsDemo()` resets + reseeds then signs in. Requires at least one real user to exist first.
- **Access control:** All actions call `assertWorkspaceAccess(workspaceId)` or `assertDatabaseAccess(databaseId)` before executing. Unauthorized → throws; unauthenticated → `redirect('/login')`.
- **Env vars:** `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.

### Performance Rules

- **No query waterfalls:** Fetch independent sources with `Promise.all`.
- **Revalidation:** Call `revalidatePath('/')` only for sidebar-structural mutations (create/delete items, workspace rename/delete). Content saves (`updatePageContent`, `updatePageProperties`) must NOT call revalidatePath.
- **Optimistic UI:** `WorkspaceSidebar` applies mutations to local state immediately; server revalidation is background.
- **SQLite PRAGMAs:** WAL mode, `synchronous=NORMAL`, `foreign_keys=ON`, `cache_size=-20000`, `temp_store=MEMORY` applied at startup in `src/db/index.ts`.

### Migration Notes

- New migration `when` values must be **greater than** all existing values. Last: `0011` → `1780200000000`. **Next migration: `when` > `1780200000000`.**
- Apply with: `npx tsx src/db/migrate.ts`

### Project Structure

**Auth & middleware**
- `src/auth.config.ts` — Edge-compatible config (middleware only, no DB import). `/client-login` is handled specially: logged-in users with a `device_id` param are redirected straight to `/api/auth/client-bridge?device_id=…`; without a `device_id` they go to `/app`.
- `src/auth.ts` — Full config: DrizzleAdapter, Credentials provider, `client-token` provider (desktop OAuth), JWT callbacks, first-user bootstrap event.
- `src/proxy.ts` — Protects all routes (Next.js 16 proxy, replaces `middleware.ts`); whitelists `/login`, `/register`, `/client-login`, `/tauri-app`, `/api/auth/*`, `/api/auth/client-activate`, `/api/mcp`, static assets, `/`, `/pricing`, `/contact`.
- `src/lib/auth/session.ts` — `getCurrentUser()` — `React.cache`-wrapped `auth()`. Use this everywhere in server actions.

**Routes (`src/app/[locale]/`)**
- `layout.tsx` — Locale validation, `NextIntlClientProvider`, session check, sidebar + mobile nav render.
- `page.tsx` — Public landing (always `LandingBridgeSwitcher`, no auth check).
- `app/page.tsx` — Authenticated redirect gateway → first workspace item or `/login`.
- `login/page.tsx` — Credentials + Google OAuth login. In Tauri mode, renders a minimal UI (logo + "Sign in" button); on click generates a UUID `device_id`, opens `client-login?device_id=<uuid>` in the system browser, then polls `/api/auth/client-poll` every 2 s until a token arrives.
- `register/page.tsx` — Registration form.
- `client-login/page.tsx` — Public. Full login page (Google + credentials) opened in the system browser by Tauri. Reads `device_id` from URL search params and threads it through both auth paths so `/api/auth/client-bridge` can store the resulting token keyed by that id.
- `tauri-app/page.tsx` — Public entry for Tauri (`tauri.conf.json` devUrl/url). Sets `localStorage.platform=tauri`, auto-detects OS locale, redirects to `/app`.
- `db/[id]/page.tsx` — Database view (Table / Kanban / Calendar).
- `db/[id]/[pageId]/page.tsx` — Database row page editor.
- `page/[itemId]/page.tsx` — Standalone page editor.
- `pricing/page.tsx` — Public pricing (MarketingShell-wrapped).
- `contact/page.tsx` — Public contact (MarketingShell-wrapped).
- `admin/page.tsx` — Admin dashboard (users + workspaces tables, stat cards).
- `api/auth/[...nextauth]/route.ts` — Auth.js handler.
- `api/auth/client-bridge/route.ts` — GET. Called after browser-side login (as callbackUrl). Requires `device_id` query param. Creates a 5-min JWT signed with AUTH_SECRET, stores it in the in-memory `client-auth-store` keyed by `device_id`, and returns a "Close this tab" HTML page.
- `api/auth/client-poll/route.ts` — GET. Polled by the Tauri WebView every 2 s. Accepts `device_id`; returns `{ ready: false }` while waiting, `{ ready: true, token }` once the browser completes login (one-time consume).
- `api/auth/client-activate/route.ts` — GET. Tauri WebView navigates here with the token from the poll response. Signs in via `client-token` provider, redirects to `/app`.
- `api/mcp/route.ts` — MCP Streamable HTTP: bearer auth, rate limit (60 req/min), 8 tools, audit log.
  - **Read tools:** `search`, `list_workspace`, `get_page` (auto-detects type, no `isDbRow` flag needed), `get_database_schema` (schema only, no rows), `query_database` (supports `filters: Record<string,any>` for property matching)
  - **Write tools:** `create_page`, `update_page` (merges `properties` — never overwrites), `bulk_update` (multiple pages/rows in one call)

**Server Actions (`src/lib/actions/`)**
- `workspace.ts` — Workspace + sidebar item CRUD (all auth-gated via `assertWorkspaceAccess`).
- `database.ts` — Database schema + view mutations (`assertDatabaseAccess`).
- `page.ts` — Database row CRUD (`assertDatabaseAccess`).
- `auth.ts` — User auth, registration, role management, workspace membership, admin user ops.
- `demo.ts` — `loginAsDemo()` — reset + reseed demo workspace and sign in.
- `locale.ts` — `setLocale(locale)` — writes `NEXT_LOCALE` cookie.
- `agentToken.ts` — MCP token mint / list / revoke.

**Types (`src/lib/types/`)**
- `views.ts` — `DatabaseView`, `TableViewConfig`, `KanbanViewConfig`, `CalendarViewConfig`, `ViewFilter`, `ViewSort`, `OpenBehavior`.
- `properties.ts` — `SelectOption`, `SELECT_COLORS` (9-color palette), helpers: `getOptionColorByValue`, `getCardBorderDots`, `formatDateValue`.

**Core feature components (`src/components/features/`)**
- `WorkspaceSidebar` — Collapsible workspace tree, drag-and-drop reorder, optimistic mutations, mobile bottom-sheet context menu.
- `WorkspaceSettingsModal` — 3-tab modal: General, Members, API/MCP Tokens.
- `TemplatePickerModal` — 2-step item creation from templates (defined in `src/lib/templates.ts`).
- `DatabaseView` — View orchestrator: tabs, filters, sorts, peek modals, URL deep-link (`?v=view_id`).
- `DatabasePropertiesSidebar` — Schema editor, column visibility, filters, sorts, group-by, card layout settings.
- `TableLayout` — Notion-style grid, draggable columns, inline cell editing, row color tinting.
- `KanbanBoard` — Grouped by select column, draggable groups, card color, group bg tint.
- `CalendarView` — Monthly/weekly grid, card drag-to-reschedule, card color.
- `InlineCellEditor` — Shared inline editor for all property types (text, number, date, datetime, select, multi_select).
- `StandalonePageEditor` — Title + block editor, auto-save, back button only when `parentId` is set.
- `PageEditor` — DB row editor: properties panel + block editor, Narrow/Wide/Full width, peek-compact layout.
- `MobileNavWrapper` — Mobile-only bottom bar: workspace sheet, context-aware + button, user sheet.
- `ViewsBar` — View tabs with inline rename/delete/add; collapses to dropdown on mobile.
- `PageIcon` — Emoji or Lucide icon with 9 theme colors.
- `IconPicker` — Popover for emoji + Lucide icon + color selection.
- `SaveStatus` — Auto-fading save indicator (idle → saving → saved → error).
- `LanguageSwitcher` — Language dropdown; calls `setLocale()` + `router.refresh()`.
- `AdminUsersTable` — Paginated user table with delete (10/page).
- `AdminWorkspacesTable` — Paginated workspace table with item expand and delete (10/page).

**Editor (`src/components/features/editor/`)**
- `BlockEditor` — Tiptap editor: StarterKit, `@tiptap/markdown` v3, TaskList, Table, ChildBlock, SlashCommand. Use `key={page.id}` to remount on page switch.
- `ChildBlockExtension` — Tiptap node for embedded sub-pages/databases. Serializes as `<div data-cb-id>` — standard HTML block element required because `marked` does not tokenize custom elements.
- `ChildBlockView` — Node view: drag handle, icon, title link (calls `onImmediateSave` before nav), delete with content-check confirmation.
- `BubbleMenuBar` — Selection toolbar (Bold/Italic/Strike/Code/H1–H3 + "Turn into"). Uses anchor probe to self-position inside transformed ancestors (peek modals).
- `SlashCommandMenu` — `/` trigger; reads `workspaceId`/`parentId` from extension manager dynamically, not from closure.
- `SlashCommandList` — Keyboard-navigable command list; divider before child-block commands.

**Marketing (`src/components/marketing/`)**
- `LandingBridgeSwitcher` — Full landing page composition (pure server component, no auth check). Used by `page.tsx`.
- `LandingNav` — Sticky header; "Go to app" → `/app` for authed, Sign in / Get started for guests. Includes `<LanguageSwitcher variant="header" />`.
- `LandingHero` / `LandingWhy` / `LandingWhatsInside` / `LandingIntegrations` / `LandingSetup` / `LandingTools` / `LandingPricing` / `LandingClosing` / `LandingFooter` — Landing sections 01–08 + footer.
- `WhatsInsideViewer` — Client component. Auto-cycling Kanban/Table/Calendar viewer (4 s). All strings passed as props.
- `SetupGuideModal` — Client component. MCP connection steps modal with endpoint + auth header snippets. All strings passed as props.
- `MarketingShell` — Auth-aware wrapper for `/pricing` and `/contact` (adds header/footer only when unauthenticated).
- `MarketingHeader` / `MarketingFooter` / `HeroSection` / `FeaturesSection` / `PricingSection` / `ContactSection` — Legacy marketing shell components.
- `LandingChip` / `AIMark` — Utility: status pill, AI client SVG marks.
- `mini/` — Static mini previews: `KanbanMini`, `TableMini`, `CalendarMini`, `MarkdownPageMini`, `ViewTab`.

**Other**
- `src/lib/client-auth-store.ts` — In-memory store for pending desktop OAuth tokens. `setPendingClientToken(deviceId, token)` writes; `consumeClientToken(deviceId)` reads + deletes (one-time use, 5-min TTL). Single-process only — swap for a DB table in multi-instance deployments.
- `src/lib/templates.ts` — 7 item templates for `TemplatePickerModal`.
- `src/lib/seed.ts` — `createSeedWorkspace()` and `createDemoSeedData()` via shared `createRichWorkspaceData`.
- `src/lib/services/workspace.ts` — Cookie-free service layer for MCP tool handlers. Exports: `searchWorkspace`, `listWorkspaceItems`, `getPageById`, `getAnyPageById` (auto-detects workspace item vs DB row), `getDatabasePageById`, `getDatabaseSchema` (schema only, no rows), `queryDatabaseRows` (accepts optional `filters`), `createPageInWorkspace`, `updatePageById` (merges properties, never overwrites), `bulkUpdatePages`.
- `src/components/providers/QueryProvider.tsx` — TanStack Query provider (staleTime 60s, gcTime 5min).
- `src/db/` — Drizzle `schema.ts`, `index.ts` (WAL + PRAGMAs on startup), migrations.
- `messages/` — Translation files (`en.json` source of truth, 17 namespaces, 6 locales).

### Common Commands

- **Start Dev Server:** `npm run dev`
- **Generate Migrations:** `npx drizzle-kit generate`
- **Apply Migrations:** `npx tsx src/db/migrate.ts`
- **Desktop dev (Tauri):** `npm run tauri:dev` — requires Rust + Visual C++ Build Tools
- **Desktop build:** `npm run tauri:build`
- **Generate Tauri icons:** `npm run tauri:icon` — run once after Rust is installed
- **Android open:** `npm run cap:open:android` — opens Android Studio
- **Android run:** `npm run cap:android`
- **iOS open (macOS only):** `npm run cap:open:ios`
- **Sync Capacitor:** `npm run cap:sync` — call after changing `capacitor.config.ts`

### Cross-Platform Architecture

**Strategy:** Cloud-first. All three platforms (web, desktop, mobile) load `remnus.com`. No separate API or local server required.

```
 remnus.com (Vercel)
       │
 ┌─────┼───────┐
 │     │       │
Web  Tauri  Capacitor
     Shell   Shell
    (Rust)  (iOS/Android)
```

**PWA** — `public/manifest.json` + Workbox service worker. Enables "Install App" in browsers and is the foundation for offline support. Disabled in `development` mode (`NODE_ENV`).

**Tauri** (`src-tauri/`) — Rust shell wrapping a system WebView.
- Dev: `build.devUrl = "http://localhost:3000"` signals CLI to wait; `setup()` hook navigates to `localhost:3000/tauri-app` via `window.eval` (`#[cfg(debug_assertions)]`).
- Prod: loads `https://remnus.com/tauri-app` (set via `app.windows[0].url`).
- Entry point `/tauri-app` sets `localStorage.platform=tauri` and detects OS locale before redirecting to `/app`.
- Features: system tray (single icon, built programmatically — **no** `trayIcon` config in `tauri.conf.json`), global shortcuts, notifications, deep-link (`remnus://` scheme).
- **Close to tray:** `CloseRequested` event is intercepted in `lib.rs`; window hides instead of quitting. Tray left-click or "Show Window" menu item restores it; "Quit Remnus" exits.
- **Desktop OAuth flow (polling / device-authorization):** Tauri login view generates a UUID `device_id` → opens `remnus.com/client-login?device_id=<uuid>` in the system browser via `@tauri-apps/plugin-opener` → user logs in (Google or credentials) → browser POSTs to `/api/auth/client-bridge?device_id=<uuid>` which stores a 5-min JWT → browser shows "Close this tab" page → Tauri WebView polls `/api/auth/client-poll?device_id=<uuid>` every 2 s → on `{ ready: true, token }`, WebView navigates to `/api/auth/client-activate?token=…` → session cookie set → redirect to `/app`.
- Release CI: `.github/workflows/tauri-release.yml` — triggers on `v*` tags, builds Windows (`.msi`), macOS (`.dmg`, both Intel + Apple Silicon), Linux (`.deb`, `.AppImage`)
- **Requires:** Rust stable + Visual C++ Build Tools (Windows) / Xcode CLT (macOS)
- Icons: generated from `public/logo-square-dark.png` via `npm run tauri:icon` (after Rust install)

**Capacitor** (`capacitor.config.ts`, `android/`) — native WebView wrapper for iOS and Android.
- Loads `https://remnus.com` via `server.url` — no static export needed
- Plugins active: `SplashScreen`, `StatusBar`, `PushNotifications`, `Haptics`, `App`, `Keyboard`
- Dark theme colors (`#1d1f23`) set in `android/app/src/main/res/values/colors.xml`
- `android/` is committed to git (native project); `ios/` added on macOS via `npx cap add ios`
- **Requires:** Android Studio (Android) / Xcode on macOS (iOS)
