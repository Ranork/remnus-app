# Remnus

**Open-source MCP-native workspace for humans and AI agents.**

Kanban boards, databases, and pages that Claude, Cursor, and any AI agent can read and write via MCP — alongside you.

[![GitHub Stars](https://img.shields.io/github/stars/Ranork/remnus-app?style=flat-square)](https://github.com/Ranork/remnus-app/stargazers)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://img.shields.io/badge/Deploy%20to-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com/new/clone?repository-url=https://github.com/Ranork/remnus-app)

---

## What is Remnus?

Remnus is a Notion-like workspace built around the [Model Context Protocol (MCP)](https://modelcontextprotocol.io). Every page, database, and kanban board in your workspace is accessible to AI agents via a first-class MCP server — connect editors with one-click **OAuth 2.1 (PKCE)**, or use a scoped **bearer token** for headless / CI agents.

**Unlike Notion's MCP integration**, Remnus is designed for headless, CI/CD, and coding agent workflows from day one.

## Features

- **Pages** — Markdown editor with slash commands, nested sub-pages, and icons
- **Databases** — Customizable columns, Table / Kanban / Calendar views, filters, sorts
- **MCP Server** — 14 tools + 4 resources + 5 prompts, Streamable HTTP + SSE dual transport
- **Agent auth** — One-click OAuth 2.1 + PKCE (RFC 7591 dynamic registration) for editors, or scoped read/write personal access tokens for headless agents
- **Multi-workspace** — Invite members, role-based access (owner / member / viewer)
- **Desktop app** — Tauri v2 shell for Windows, macOS, Linux
- **Mobile** — Capacitor v8 for iOS and Android (loads remnus.com)
- **i18n** — English, Türkçe, Español, Français, Deutsch, हिन्दी

## Quick Start — Self-host

### Local Development

```bash
git clone https://github.com/Ranork/remnus-app.git
cd remnus-app
cp .env.example .env          # fill in AUTH_SECRET + OAuth credentials
npm install
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first user to sign up is auto-promoted to admin.

### Docker Compose (5-minute setup)

If you prefer to run Remnus using Docker:

1. Clone the repository and navigate into it:
   ```bash
   git clone https://github.com/Ranork/remnus-app.git
   cd remnus-app
   ```
2. Copy the environment template and fill in the required variables (especially `AUTH_SECRET` and OAuth credentials):
   ```bash
   cp .env.example .env
   ```
3. Start the application:
   ```bash
   docker compose up -d
   ```
4. Access Remnus at `http://localhost:3000`. The SQLite database will be persisted automatically using a Docker volume.

### Deploy

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Ranork/remnus-app)
[![Deploy to Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/Ranork/remnus-app)

### Add MCP to your editor

After signing in, open the **AI Agents** panel from the sidebar and click **Connect editor**. It walks you through every supported editor (Cursor, VS Code, Claude Code, Codex, Windsurf, and more).

[![Add to Cursor](https://img.shields.io/badge/Add%20to-Cursor-black?style=flat-square)](https://docs.cursor.com/context/model-context-protocol)
[![Add to VS Code](https://img.shields.io/badge/Add%20to-VS%20Code-blue?style=flat-square&logo=visualstudiocode)](https://code.visualstudio.com/docs/copilot/chat/mcp-servers)

**Recommended — OAuth (token-less):** point your editor at the MCP URL and approve the consent screen on first connect. Your editor runs the OAuth 2.1 flow automatically — nothing to copy.

```json
{
  "mcpServers": {
    "remnus": {
      "type": "http",
      "url": "https://your-instance.com/api/mcp"
    }
  }
}
```

**Headless / CI — personal access token:** create a scoped token from the AI Agents panel and send it as a bearer header.

```json
{
  "mcpServers": {
    "remnus": {
      "type": "http",
      "url": "https://your-instance.com/api/mcp",
      "headers": {
        "Authorization": "Bearer <your-token>"
      }
    }
  }
}
```

## MCP Tools

| Tool | Scope | Description |
|------|-------|-------------|
| `search_workspace` | read | Full-text search across pages and databases |
| `list_workspace` | read | List sidebar items with pagination |
| `get_page` | read | Get a page or database row by ID |
| `get_database_schema` | read | Get column schema of a database |
| `query_database` | read | Query rows with filters and pagination |
| `list_members` | read | List workspace members with roles |
| `query_audit_log` | read | Filtered agent activity log |
| `create_page` | write | Create a standalone page or database row |
| `update_page` | write | Update title, content, or properties |
| `bulk_update_pages` | write | Update multiple rows in one call |
| `delete_page` | write | Delete a page (requires `confirm: true`) |
| `move_item` | write | Move item to a new parent |
| `create_database` | write | Create a database with custom schema |
| `update_database_schema` | write | Add or remove columns |

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Database:** SQLite via Drizzle ORM + `@libsql/client` (Turso-compatible)
- **Auth:** Auth.js v5 — Google & GitHub OAuth
- **Styling:** Tailwind CSS + Lucide icons
- **Desktop:** Tauri v2 (Rust)
- **Mobile:** Capacitor v8

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All contributions are welcome — bug fixes, new MCP tools, translations, and docs.

## License

[AGPL-3.0](LICENSE) — free to self-host and modify. SaaS forks must open-source their changes.
