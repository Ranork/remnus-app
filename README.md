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
- **6 MCP tools:** `list_workspace`, `search`, `get_page`, `query_database`, `create_page`, `update_page`
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

### Available tools

| Tool | Scope | Description |
|---|---|---|
| `list_workspace` | read | List pages and databases (optionally by parent) |
| `search` | read | Search by title across the workspace |
| `get_page` | read | Get full content of a page or database item |
| `query_database` | read | Get schema and rows of a database |
| `create_page` | write | Create a standalone page or database row |
| `update_page` | write | Update title, content, or properties |

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
