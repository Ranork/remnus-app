# Remnus — Agent Primer

> This document is a context/prompt fragment meant to be handed to any AI agent session so it can answer "What is Remnus?" accurately and in depth. Sources: this repo's `README.md`, `AGENTS.md`, `docs/mcp/*`, `docs/blog/*`, `server.json` (as of 2026-08-04). Version: `remnus-app@0.1.17`.
>
> This file lives outside the `docs/mcp/*` and `docs/blog/*` content pipeline (it is not registered in `src/lib/content/manifest.ts`), so it is **not** automatically published on `/wiki` or `/docs` — it is a plain reference file for agent context.

## 1. One-sentence identity

**Remnus** is the first **"Human-Agent Collaborative Workspace"** — a workspace built from the ground up around the **Model Context Protocol (MCP)** where humans and AI agents work together as equal, first-class citizens.
`server.json` summary: *"The first MCP-native workspace for human-agent teams. Read, write, and collaborate seamlessly with AI using structured data and verifiable audit logs."*

## 2. Why it exists: the "MCP-native" position and vision

Traditional tools (Notion, Obsidian, etc.) are designed for *humans* first, with AI integrations bolted on afterward through outside APIs. Remnus is a system where **agent access is itself an architectural design constraint (MCP-native)**. Its core claim: *if agents are part of your team, they should work at the same table, under the same security and transparency rules as you.*

In practice, this vision means:
*   **Not a "Notion Alternative":** the goal isn't to optimize human-to-human collaboration; it's to bring AI agents (Cursor, Claude, Windsurf) that write code, do research, or manage tasks together with human teammates in a **shared context**.
*   **Transparent memory instead of an opaque black box:** agent memory is not a "vector store" black hole. Everything an agent learns and records is made of **ordinary pages that a human can read, correct, and delete**.
*   **First-class tokens and an attributable audit log:** there is no permission model patched on top of human sessions. Agent tokens (OAuth/PAT) are primary identities. Every MCP tool call records the actor, operation, status, target, timing, and response size so the team can inspect agent activity.
*   **Structured responses:** instead of flattened text exports, agents get back typed data with column types, schemas, and select-options preserved.
*   **OKF-native context:** knowledge can carry type, description, tags, sources, lifecycle, freshness, provenance, and exact-revision review. Agents can retrieve the best task context inside an explicit token budget instead of crawling the workspace.

## 3. Product model

*   Every user belongs to one or more **workspaces**; a workspace is organized around a single sidebar tree.
*   Two kinds of items — equally readable by humans and machines — live side by side in that sidebar:
    *   **Standalone pages** — title + a Tiptap-based markdown editor, slash commands, sub-page hierarchy.
    *   **Databases** — dynamic-column tables (text/select/status/date/number/relation, etc.) with **Table / Kanban / Calendar** views, filters, and sorting.
*   Key design decision: **every database row is also a page** — a kanban card has both typed properties an agent can filter on and a long-form markdown body.
*   The data model is not EAV; it uses a **JSON Column Pattern** (dynamic properties live in `schema`/`properties` JSON columns).

## 4. OKF knowledge and Context Pack v2

Open Knowledge Format (OKF) v0.2 is Remnus's experimental import/export adapter, not a second canonical store. Native `knowledge_metadata` and exact-revision `knowledge_reviews` remain attached to ordinary pages and database rows. Imported human claims remain `external-human-asserted` until a signed-in Remnus member reviews the current title and body.

`prepare_context` combines BM25 relevance, native metadata, freshness, trust, and the page-link graph. It returns ranked concepts, selection reasons, warnings, approximate token use, and a 30-minute actor-bound `contextRunId`.

- **Manual:** context is prepared only when requested.
- **Smart (default):** compatible clients are instructed to prepare context for meaningful multi-page work and skip trivial requests.
- **Strict:** actual Remnus MCP mutations also require the same actor's current `contextRunId`.

Strict does not replace write scope, authorization, or destructive confirmation, and an MCP server cannot enforce policy over a coding client's local files, shell, or Git.

## 5. The MCP server — technical surface

**Endpoint:** `https://www.remnus.com/api/mcp` (always use the `www` host). Uses the modern **Streamable HTTP** transport (stateless — one HTTP request per call). The server is not a separate sidecar — `/api/mcp` is directly the core of the Remnus web application.

### Authentication and security boundaries
*   **OAuth 2.1 + PKCE (S256)** — the recommended path. Dynamic client registration (`POST /api/oauth/register`). Access tokens last 1 hour, refresh tokens 30 days. The human user (owner) sets the agent's read/write permissions on the consent screen.
*   **Personal Access Token (PAT)** — for headless/CI or custom agents, minted by workspace **owners**.
*   **Scopes:** `read` (11 tools) and `write` (all tools). A write call with a read-scoped token is blocked instantly.
*   **Rate limit:** 60 requests/minute per token.
*   **Traceability (audit log):** every tool call (which page was read, which property changed) is written to the workspace audit log.

### 21 MCP tools (agent capabilities)

| Tool | Scope | What it does (for agents) |
|---|---|---|
| `prepare_context` | read | Build Context Pack v2 and a short-lived preflight ID within an explicit token budget |
| `search_workspace` | read | Semantic/full-text search across pages and databases |
| `list_workspace` | read | Navigate the entire workspace hierarchy |
| `get_page` | read | Fetch a page/row by ID (`mode: "outline"` to save tokens) |
| `get_pages` | read | Fetch multiple pages/rows by ID in one call — a known, possibly cross-database ID list |
| `get_database_schema` | read | Learn a database's column types and rules |
| `query_database` | read | Query rows SQL-style with filters and sorting |
| `list_members` | read | List the team's human and machine members |
| `query_audit_log` | read | Read past activity records for this (or other) agents |
| `get_changes_since` | read | Pull everything that changed since a given timestamp (delta-sync) |
| `get_related_pages` | read | Link-graph analysis (find parent/child/backlinks) |
| `create_page` | write | Create a new document or task (row) |
| `update_page` | write | Update a page's content or properties (status, tags, etc.) |
| `bulk_update_pages` | write | **(Agent-specific)** Update dozens of rows (e.g., 50 tasks' status) in one call |
| `delete_page` | write | Delete a page (requires `confirm: true`) |
| `move_item` | write | Reorganize the hierarchy |
| `create_database` | write | Set up a new, custom-schema memory table/workflow from scratch |
| `update_database_schema` | write | Add or remove typed columns on a database |
| `create/update/delete_database_view` | write | Create and manage table/kanban views for humans to see |

### 6 MCP resources (cheap context channels)
Data an agent can subscribe to via URI for quick orientation:
*   `remnus://workspace/{id}/knowledge-health` (heuristic link, freshness, lifecycle, and review coverage)
*   `remnus://workspace/{id}/schema` (the whole workspace's structure)
*   `remnus://workspace/{id}/digest` (a one-line-per-item tl;dr summary map)
*   `remnus://page/{id}`
*   `remnus://database/{id}/schema`
*   `remnus://audit-log/recent` (the last 50 security records)

### 7 MCP prompts (built-in agent templates)
Server-hosted commands: `summarize-page`, `weekly-status-report`, `kanban-triage`, `extract-tasks`, `search-and-create`, `save-memory` (writes transparent memory), `recall-context` (link-graph-assisted memory recall).

## 6. Platforms & deployment

*   **Supported agents/clients:** Claude Code, Claude Desktop (mcp-remote bridge or standard config), Cursor, VS Code, Codex, Windsurf, Continue, Antigravity, Cline, Zed, and any MCP-compatible system. Published on the official MCP Registry and Smithery for automatic discovery.
*   **Human interfaces:** Web (Next.js 16 App Router), Desktop (Tauri v2 Rust shell), Mobile (Capacitor v8, iOS+Android), PWA.
*   **Self-host:** local CLI, Docker Compose, or Vercel/Railway.

## 7. Tech stack (summary)
*   Next.js 16.2.6, React 19.2, TypeScript 5.
*   SQLite (`@libsql/client`, Turso) + Drizzle ORM.
*   Auth.js v5 + an RFC 7591 dynamic client registration server.
*   Tiptap v3 (rich text editor), TanStack Query, Tailwind CSS.
*   **License: AGPL-3.0** (open source; free to modify).

## 8. Language support
English (default), Türkçe, हिन्दी, Español, Français, Deutsch, 中文, Русский.

## 9. Pricing model (summary)
Plans scale by agent density rather than headcount: **Free / Startup / Professional / Enterprise**. The main differentiators are agent (token) count, API rate limits, and audit-log retention. Even the Free plan includes full MCP access, audit log, and agent auth.

## 10. Typical use cases (human-agent collab)

1.  **Autonomous agent memory (shared memory):** an agent records project rule sets, preferences, and decision records into a Remnus table; a human reviews and edits them.
2.  **Agentic software development:** a coding agent like Cursor or Cline reads the Kanban board in Remnus to see blockers, then moves a task's status to "Done" via the Remnus API after shipping the code.
3.  **Automated status reporting:** an analysis agent runs overnight, reads everything that changed in the workspace (`get_changes_since`), and produces a weekly summary (`weekly-status-report`) page for the human team in the morning.
4.  **Safe research:** an agent piles up data it gathered from the outside world (the web) directly into a typed Remnus database as structured data.

## 11. Quick reference

| Field | Value |
|---|---|
| Category | Human-Agent Collaborative Workspace |
| MCP endpoint | `https://www.remnus.com/api/mcp` |
| Tools / Resources / Prompts | 21 / 6 / 7 |
| Auth model | Agent-first: OAuth 2.1 + PKCE, PAT |
| Security/trust | Full workspace audit log |
| License | AGPL-3.0 |
| Repo | `github.com/Ranork/remnus-app` |

---

Tool/resource/prompt counts and lists must stay in sync with `README.md`, `docs/mcp/*.md`, and the running MCP server. Code and current documentation remain the canonical source of truth.
