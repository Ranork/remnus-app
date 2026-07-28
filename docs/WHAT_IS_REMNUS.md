# Remnus — Agent Primer

> This document is a context/prompt fragment meant to be handed to any AI agent session so it can answer "What is Remnus?" accurately and in depth. Sources: this repo's `README.md`, `AGENTS.md`, `docs/mcp/*`, `docs/blog/*`, `server.json` (as of 2026-07-28). Version: `remnus-app@0.1.14`.
>
> This file lives outside the `docs/mcp/*` and `docs/blog/*` content pipeline (it is not registered in `src/lib/content/manifest.ts`), so it is **not** automatically published on `/wiki` or `/docs` — it is a plain reference file for agent context.

## 1. One-sentence identity

**Remnus** is a Notion-like **workspace** product built from the ground up around the **Model Context Protocol (MCP)**, open source (AGPL-3.0), for humans and AI agents to use together. `server.json` summary: *"MCP-native open-source Notion alternative: read & write pages, databases and kanban boards."*

## 2. Product model

- Every user belongs to one or more **workspaces**; a workspace is organized around a single sidebar tree.
- Two kinds of items live side by side in that sidebar:
  - **Standalone pages** — title + a Tiptap-based markdown editor, slash commands, nested sub-pages, icons.
  - **Databases** — dynamic-column tables (text/select/status/date/number/relation, etc.) with **Table / Kanban / Calendar** views, filters, and sorting.
- Key design decision: **every database row is also a page** — a kanban card has both typed properties and a full markdown body. This collapses the usual distinction between "task" and "note."
- Cross-workspace invites/roles: **owner / member / viewer**.
- The data model is not EAV; it uses a **JSON Column Pattern** (dynamic properties live in `schema`/`properties` JSON columns) on top of SQLite/Turso + Drizzle ORM.

## 3. Why it exists: the "MCP-native" position

Remnus's core claim is that, unlike most tools that are *designed for humans first and get MCP bolted on later* ("MCP-integrated"), it is built so that **agent access is an architectural design constraint** from day one ("MCP-native"). Concretely that means:

- The MCP server is not a separate wrapper/sidecar — it lives at `/api/mcp` as **part of the application itself**, and the same queries and permission checks that power the web UI also power agent calls.
- Anything a human can do through the UI (search, read, write, change schema), an agent can do too, through the same auth/scope/audit chain.
- Responses are **typed, structured tool output** rather than flattened prose (schema, column types, and select options are preserved).
- Instead of a "one item per write" model, there are **batch write tools** (`bulk_update_pages`).
- Auth is not patched on top of human sessions; **agent tokens are first-class principals** (OAuth 2.1 + PKCE or a scoped PAT).
- Every agent call is written to an **immutable audit log**.
- Agent memory is not an opaque vector store — it's a database of **ordinary, readable/correctable pages**.

This distinction is made concrete in a set of comparison posts (`docs/blog/remnus-vs-*.md`) against Notion, Obsidian, AppFlowy, and AFFiNE: Remnus lags Notion on everyday-workspace maturity (view variety, offline mobile, template marketplace) but offers headless/agent auth plus an audit trail on every plan, including Free. Obsidian is a fully local-first, single-user tool, whereas Remnus is a networked workspace a team and its agents share. AppFlowy has no official agent-connection path; Remnus has a first-party MCP server. AFFiNE caps self-hosted workspaces at 10 seats without a paid Team license; Remnus imposes no seat cap on self-hosting.

## 4. The MCP server — technical surface

**Endpoint:** `https://www.remnus.com/api/mcp` (always use the `www` host — the apex `remnus.com` redirects, and some OAuth clients reject the resulting resource-indicator mismatch). Supports both **Streamable HTTP** (stateless) and **SSE** (stateful) transports.

### Authentication
- **OAuth 2.1 + PKCE (S256)** — the recommended path, nothing to paste. Dynamic client registration (RFC 7591, `POST /api/oauth/register`). Access tokens last 1 hour; refresh tokens rotate on use and last 30 days. The consent screen lets the user pick the workspace, scope (read/write), and agent name.
- **Personal Access Token (PAT)** — for headless/CI use; only workspace **owners** can mint one (`rmns_...` prefix, sent via `Authorization: Bearer`). Can be created with or without an expiry.
- Every token/connection is scoped to **exactly one workspace**.
- **Scopes:** `read` (9 read tools) and `write` (all read tools + 10 write tools). A write-tool call with a read-scoped token returns an error and makes no changes.
- **Rate limit:** 60 requests/minute per token, `429` on excess.
- **Audit log:** every tool call (PAT and OAuth alike) is written to the workspace audit log; inspect it via the `query_audit_log` tool or the "AI Agents" panel.

### 19 MCP tools (9 read + 10 write)

| Tool | Scope | What it does |
|---|---|---|
| `search_workspace` | read | Full-text search across pages and databases |
| `list_workspace` | read | List sidebar items with pagination |
| `get_page` | read | Get a page or database row by ID (`mode: "outline"` for a cheap skim) |
| `get_database_schema` | read | Get the column schema of a database |
| `query_database` | read | Query rows with filters and pagination (`fields` projection to save tokens) |
| `list_members` | read | List workspace members with roles |
| `query_audit_log` | read | Filtered agent activity log |
| `get_changes_since` | read | What changed since a timestamp or cursor (delta-sync) |
| `get_related_pages` | read | A page's parent/children/outgoing links/backlinks/database siblings (link graph) |
| `create_page` | write | Create a standalone page or database row |
| `update_page` | write | Update title, content, or properties |
| `bulk_update_pages` | write | Update multiple rows in one call |
| `delete_page` | write | Delete a page (requires `confirm: true`) |
| `move_item` | write | Move an item to a new parent |
| `create_database` | write | Create a database with a custom schema |
| `update_database_schema` | write | Add or remove columns |
| `create_database_view` | write | Add a table/kanban/calendar view |
| `update_database_view` | write | Rename a view or patch its config |
| `delete_database_view` | write | Delete a saved view (requires `confirm: true`) |

### 5 MCP resources (cheap, attachable context)

| URI | Content |
|---|---|
| `remnus://workspace/{id}/schema` | Full JSON schema of every database in the workspace |
| `remnus://workspace/{id}/digest` | A one-line-per-item markdown tree of the whole workspace — the cheapest way for an agent to orient |
| `remnus://page/{id}` | Markdown content + properties of any page or row |
| `remnus://database/{id}/schema` | Column schema of a single database |
| `remnus://audit-log/recent` | The 50 most recent audit log entries for the current token |

### 7 MCP prompts (server-side, reusable templates)

`summarize-page` (bullet/paragraph/tldr summary), `weekly-status-report` (status-grouped weekly report), `kanban-triage` (blocker/priority/next-action analysis), `extract-tasks` (pull an actionable checklist from a page), `search-and-create` (check for similar existing content before writing something new), `save-memory` (produces the instruction to write a durable memory as a structured row — decision/preference/gotcha/fact types), `recall-context` (returns outlines of the best-matching pages plus the link-graph neighborhood of the top hit, in one package).

### The agent memory concept

One of Remnus's flagship use cases: agent memory is not an opaque vector/embedding store — it's **ordinary, structured pages in a database** (with Type/Tags/Date properties). A human can read, correct, and group these memories inside the workspace itself. The `save-memory` / `recall-context` prompt pair is purpose-built for this.

## 5. Platforms & deployment

- **Web:** Next.js 16.2.6 (App Router) — `remnus.com` in the cloud, or your own domain when self-hosted.
- **Desktop:** Tauri v2 (Rust shell), Windows/macOS/Linux — loads `remnus.com` in the system WebView.
- **Mobile:** Capacitor v8, iOS + Android — likewise loads `remnus.com`.
- **PWA:** Workbox-based service worker, install-prompt flow, `/download` page.
- **Self-host options:** local `npm run dev`, Docker Compose (5-minute setup, SQLite volume for persistence), one-click Vercel or Railway deploy.
- **Registries:** published on the official MCP Registry (`io.github.Ranork/remnus`) and on Smithery (`ranorkk/remnus`) so MCP-aware clients can discover it automatically.
- **Claude Desktop:** connects via a bundled remote-MCP proxy under `mcpb/`, or via a standard `mcpServers` JSON config / the `mcp-remote` bridge like any other editor.
- **Supported editors/clients:** Claude Code, Claude Desktop, Cursor, VS Code, Codex, Windsurf, Continue, Antigravity, Cline, Zed, and any general MCP-compatible client.

## 6. Tech stack (summary)

- **Framework:** Next.js 16.2.6 (App Router), React 19.2, strict TypeScript 5.
- **Database:** SQLite (`@libsql/client`, Turso-compatible) + Drizzle ORM; dynamic properties in JSON columns (not EAV).
- **Auth:** Auth.js v5 — Google & GitHub OAuth; plus its own OAuth 2.1 + PKCE authorization server for agents (RFC 7591 dynamic client registration).
- **i18n:** next-intl v4, `localePrefix: 'never'`.
- **Editor:** Tiptap v3 (rich text/markdown).
- **State/cache:** TanStack Query.
- **Styling:** Tailwind CSS + Lucide icons; flat/borderless, three-tier neutral dark palette (auth pages are the deliberate rounded-card exception).
- **Integrations:** Cloudinary (image uploads), Stripe (billing), PostHog (analytics + error tracking), AWS SES (transactional/newsletter email).
- **License:** **AGPL-3.0** — free to self-host and modify; SaaS forks must open-source their changes.

## 7. Language support

8 locales: **English (source/default), Türkçe, हिन्दी, Español, Français, Deutsch, 中文, Русский.**

## 8. Pricing model (summary)

The subscription belongs to a **billing owner (a user)**, not a workspace; the owner holds a seat pool. Plans: **Free / Startup / Professional / Enterprise** — each defines seat, agent (token), storage, and audit-log retention limits. Even the Free plan includes MCP access, an audit log, and scoped tokens.

## 9. Typical use cases

- **Project planning**, **task/kanban management**, **agent memory**, **documentation maintenance**, **multi-agent collaboration**, **automated status reporting**.

## 10. Quick reference

| Field | Value |
|---|---|
| MCP endpoint | `https://www.remnus.com/api/mcp` |
| Tools / Resources / Prompts | 19 / 5 / 7 |
| Auth | OAuth 2.1 + PKCE (recommended), PAT |
| Rate limit | 60 requests/min/token |
| License | AGPL-3.0 |
| Repo | `github.com/Ranork/remnus-app` |
| Locales | en, tr, hi, es, fr, de, zh, ru |

---

This document was compiled entirely from the repository's own sources (README/AGENTS.md/docs), without a live connection to the `remnus_app` MCP server. Tool/resource/prompt counts and lists should stay in sync with `README.md` and `docs/mcp/*.md` — if those numbers change, update this file too. Code and current documentation remain the canonical source of truth.
