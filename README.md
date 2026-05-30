# Remnus

A self-hostable, Notion-like workspace application. Create pages, build databases, organize work with kanban and calendar views — and connect AI agents directly to your workspace via MCP.

**Live demo:** [https://remnus.com](https://remnus.com)

---

## Features

### Workspace & Navigation
- **Multi-workspace support** — create and switch between workspaces, each with its own members and content
- **Unified sidebar** with collapsible tree navigation — pages and databases live side by side
- **Infinite nesting** — pages can contain sub-pages and sub-databases at any depth
- **Drag-and-drop reordering** of sidebar items and workspaces with optimistic UI
- **Custom icons** — emoji or Lucide icons with 9 theme colors on any page or database

### Pages
- **Rich block editor** (Tiptap) with slash-command menu (`/heading`, `/table`, `/todo`, `/code`, …)
- **Markdown import/export** — content is stored as plain markdown
- **Inline child blocks** — embed sub-pages and sub-databases directly inside a page body
- **Auto-save** with debouncing and a live save-status indicator

### Databases
- **Dynamic schema** — add text, number, select, multi-select, date, datetime columns without any migration
- **Multiple named views** per database (Table, Kanban, Calendar) with independent filter, sort, group, and visibility settings
- **Table view** — draggable columns, inline cell editing, column-level quick filters
- **Kanban view** — drag-to-reorder groups, configurable card properties, colored left-border accents
- **Calendar view** — monthly/weekly grid, drag cards to reschedule dates
- **Each database row is a full page** — open in center/side peek or full page with a rich content editor and properties panel

### Collaboration & Access Control
- **Workspace members** with three roles: Owner, Member, Viewer
- **Invite by email**, transfer ownership, update roles
- **Admin panel** — global user and workspace management for the first registered user

### AI Agent Integration (MCP)
- **Streamable HTTP MCP server** at `/api/mcp` — connect Claude Code, Cursor, Windsurf, Continue, or any MCP-compatible agent
- **Bearer token auth** scoped per workspace with read-only or read/write permissions
- **12 MCP tools & 4 resources:** full read/write workspace capabilities with dual-mode (Streamable HTTP + SSE) support.
- **Audit log** — every agent tool call is logged with status and target
- Token management in Workspace Settings → API / MCP Tokens

### Internationalization
- **6 languages** — English, Türkçe, हिन्दी, Español, Français, Deutsch
- Automatic locale detection from the browser's `Accept-Language` header on first visit
- Manual language switcher in the sidebar and auth pages
- Clean URLs — no `/en/` prefix, locale is resolved transparently

### Auth
- **Google OAuth** and **email/password** on the same login page
- Passwords hashed with bcrypt (cost 12), minimum 8 characters
- **Demo mode** — "Try Demo" button resets and loads a seeded workspace instantly
- First registered user is automatically promoted to admin

### Design
- Dark-only theme — flat, borderless, Notion-inspired design language
- Fully responsive — mobile bottom navigation bar with slide-up sheets
- Skeleton loading states during route transitions

### Cross-Platform
- **PWA** — installable from any browser via the "Install App" prompt (Workbox service worker)
- **Desktop** — native Windows / macOS / Linux app via Tauri (system WebView, system tray, ~10 MB binary)
- **Android** — native app via Capacitor (Google Play ready)
- **iOS** — native app via Capacitor (App Store ready, requires macOS to build)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Server Actions) |
| Language | TypeScript |
| Styling | Tailwind CSS v4, Lucide React |
| Editor | Tiptap + `@tiptap/extension-markdown` |
| Database | SQLite via `@libsql/client` (Turso-compatible) |
| ORM | Drizzle ORM |
| Auth | Auth.js v5 (`next-auth@beta`) + `@auth/drizzle-adapter` |
| i18n | next-intl v4 |
| AI/Agents | `@modelcontextprotocol/sdk` (Streamable HTTP) |
| State/Cache | TanStack Query |
| PWA | `@ducanh2912/next-pwa` (Workbox) |
| Desktop | Tauri v2 (Rust + system WebView) |
| Mobile | Capacitor v8 (iOS + Android) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A Google Cloud project with OAuth 2.0 credentials (for Google sign-in)

### 1. Clone and install

```bash
git clone https://github.com/your-username/remnus-app.git
cd remnus-app
npm install
```

### 2. Configure environment variables

Create a `.env.local` file:

```env
# Auth
AUTH_SECRET=your-random-32-char-secret
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret

# Database (local SQLite for development)
DATABASE_URL=file:local.db
```

Generate a secure `AUTH_SECRET`:
```bash
openssl rand -base64 32
```

### 3. Apply database migrations

```bash
DATABASE_URL="file:local.db" npx tsx src/db/migrate.ts
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first account you register is automatically promoted to admin.

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Add the following Authorized Redirect URIs:
   - Production: `https://remnus.com/api/auth/callback/google`
   - Local dev: `http://localhost:3000/api/auth/callback/google`
4. Copy the Client ID and Secret into `.env.local`

---

## MCP Integration

Remnus exposes a Streamable HTTP MCP server that lets AI agents read and write workspace content using bearer token authentication.

### Generating a token

1. Open any workspace → Settings (gear icon) → **API / MCP Tokens**
2. Create a token with a name and choose read-only or read & write scope
3. Copy the token — it is shown only once

### Connecting Claude Code

```bash
claude mcp add --transport http remnus https://remnus.com/api/mcp \
  --header "Authorization: Bearer <your-token>"
```

### Connecting Cursor / Windsurf / Continue

Add to your MCP config file (e.g. `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "remnus": {
      "url": "https://remnus.com/api/mcp",
      "headers": {
        "Authorization": "Bearer <your-token>"
      }
    }
  }
}
```

### Available tools & resources

#### Tools
| Tool | Scope | Description |
|---|---|---|
| `list_workspace` | read | List pages and databases (optionally by parent) |
| `search` | read | Search by title across the workspace |
| `get_page` | read | Get full content of a page or database item (auto-detects type) |
| `get_database_schema` | read | Get schema details of a specific database |
| `query_database` | read | Get schema and filtered rows of a database |
| `create_page` | write | Create a standalone page or database row |
| `update_page` | write | Update title, content, or properties (merges properties) |
| `bulk_update` | write | Perform batch updates on multiple pages or database rows |
| `delete_page` | write | Delete a workspace item or database row (requires confirmation) |
| `move_item` | write | Reparent a sidebar item in the workspace tree |
| `create_database` | write | Create a database with a custom column schema |
| `update_database_schema`| write | Add or remove columns in a database schema |

#### Resources
| Resource Template / URI | Description |
|---|---|
| `remnus://workspace/{id}/schema` | Database schema structure for the workspace |
| `remnus://page/{id}` | Markdown content and properties for pages (lists recent 20 pages) |
| `remnus://database/{id}/schema` | Dynamic column schema definitions for a specific database |
| `remnus://audit-log/recent` | Recent 50 agent activity logs and tool calls |

---

## Desktop App (Tauri)

The desktop app loads `remnus.com` in a native system WebView with a system tray icon and ~10 MB binary size.

### Prerequisites

- [Rust](https://rustup.rs/) stable
- **Windows:** Visual C++ Build Tools (`winget install Microsoft.VisualStudio.2022.BuildTools`)
- **macOS:** Xcode Command Line Tools (`xcode-select --install`)

### Development

```bash
# Start Next.js dev server + Tauri window simultaneously
npm run tauri:dev
```

### Release build

Tag a commit with `v*` (e.g. `v1.0.0`) and push — GitHub Actions builds installers for all platforms automatically:

| Platform | Output |
|---|---|
| Windows | `.msi` + `.exe` (NSIS) |
| macOS Intel | `.dmg` |
| macOS Apple Silicon | `.dmg` |
| Linux | `.deb` + `.AppImage` |

Or build locally:
```bash
npm run tauri:icon   # generate icons (first time only)
npm run tauri:build
```

---

## Mobile App (Capacitor)

The mobile app loads `remnus.com` in a native WebView and is distributed via Google Play / App Store.

### Android

Requires [Android Studio](https://developer.android.com/studio).

```bash
npm run cap:open:android   # open in Android Studio, then Run
# or
npm run cap:android        # run directly on connected device / emulator
```

### iOS (macOS only)

Requires Xcode on macOS.

```bash
npx cap add ios            # first time only
npm run cap:open:ios       # open in Xcode, then Run
```

### After config changes

```bash
npm run cap:sync           # re-sync capacitor.config.ts to native projects
```

---

## Self-Hosting

Remnus is designed to work with [Turso](https://turso.tech) for a serverless SQLite setup, or any local SQLite file for self-hosted deployments.

### Turso setup

1. Create a Turso database: `turso db create remnus`
2. Get the URL and token: `turso db show remnus --url` and `turso db tokens create remnus`
3. Set in production environment:
   ```env
   DATABASE_URL=libsql://your-db.turso.io
   DATABASE_AUTH_TOKEN=your-turso-token
   ```
4. Run migrations against the remote database:
   ```bash
   npx tsx src/db/migrate.ts
   ```

### Deploy to Vercel / any Node.js host

The project uses `export const runtime = 'nodejs'` on the MCP route (bcrypt is not Edge-compatible), so any Node.js-capable host works. Vercel, Railway, Render, and Fly.io are all suitable.

---

## Project Structure

```
src/
├── app/
│   ├── [locale]/          # All pages (locale-aware)
│   │   ├── page.tsx       # Home / marketing landing
│   │   ├── login/         # Auth pages
│   │   ├── db/[id]/       # Database view
│   │   ├── page/[itemId]/ # Standalone page editor
│   │   └── admin/         # Admin panel
│   └── api/
│       ├── auth/          # Auth.js handler
│       └── mcp/           # MCP Streamable HTTP endpoint
├── components/
│   └── features/          # WorkspaceSidebar, DatabaseView, PageEditor, …
├── db/
│   ├── schema.ts          # Drizzle schema
│   ├── migrations/        # SQL migrations
│   └── migrate.ts         # Migration runner
├── lib/
│   ├── actions/           # Next.js Server Actions
│   └── services/          # Cookie-free service layer (used by MCP)
└── messages/              # i18n translation files (en, tr, hi, es, fr, de)
```

---

## License

MIT
