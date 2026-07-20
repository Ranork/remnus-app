# How to Connect Claude Code to Remnus with MCP

Claude Code is excellent at reading your repository. It is much weaker at knowing *why* the repository looks the way it does — which tasks are active, which approach was already rejected, and what the team decided last Thursday. That knowledge usually lives in a workspace, not in source files.

Connecting Claude Code to [Remnus](https://remnus.com) over the Model Context Protocol (MCP) closes that gap. Remnus is an open-source, MCP-native workspace: pages, databases, kanban boards, calendars, and agent memory. Once connected, Claude Code can search your workspace, read a project brief, query a task database, move a kanban card, and write a decision back — without you pasting anything into the terminal.

This guide walks through the connection end to end, using only verified commands and the current Remnus endpoint.

## Prerequisites

**A Remnus workspace.** Either a workspace on [remnus.com](https://remnus.com) or a self-hosted deployment. Remnus is AGPL-3.0, so a self-hosted instance exposes the same MCP surface at `/api/mcp` on your own domain — substitute your host in every command below.

**Claude Code, installed and authenticated.** Claude Code requires a Pro, Max, Team, Enterprise, or Console account; the free Claude.ai plan does not include it. Verify your install:

```bash
claude --version
```

This prints a version such as `2.1.197 (Claude Code)`. The steps here were validated on 2.1.197.

**A supported operating system.** Per the official [Claude Code setup docs](https://code.claude.com/docs/en/setup): macOS 13.0+, Windows 10 1809+ or Windows Server 2019+, Ubuntu 20.04+, Debian 10+, and Alpine Linux 3.19+. Windows works natively (PowerShell or CMD) or through WSL. Because Remnus is a *remote* MCP server, there is no platform-specific binary to install — every supported Claude Code platform connects identically.

**Workspace permissions.** OAuth works for any workspace member. Minting a personal access token requires workspace **owner** rights.

**A little MCP context.** MCP is an open standard for connecting AI applications to external systems — think of it as a USB-C port for AI tools. A *server* (Remnus) exposes tools, resources, and prompts; a *client* (Claude Code) calls them. The [official MCP documentation](https://modelcontextprotocol.io/docs/getting-started/intro) covers the model in depth, and Claude Code's [MCP reference](https://code.claude.com/docs/en/mcp) covers the client side.

## Choose an authentication method

Remnus supports two methods. Both are workspace-scoped: one connection only ever reaches one workspace.

| | OAuth 2.1 + PKCE | Personal access token (PAT) |
|---|---|---|
| Setup | Approve a browser consent screen | Mint and paste a token string |
| Credential in config | None | Token in your config file |
| Token lifetime | Access 1 hour, refresh 30 days, auto-rotating | Static, optional expiry date |
| Who can create it | Any workspace member | Workspace **owners** only |
| Scope chosen | On the consent screen, upgradeable later | Fixed at mint time |
| Best for | Everyday interactive use | CI, headless agents, shared runners |

**OAuth is the recommended path for Claude Code.** Claude Code implements the MCP OAuth flow, so nothing is ever written to disk in plaintext. The discovery chain is live today: an unauthenticated request to the endpoint returns `401` with a `WWW-Authenticate` header pointing at `https://www.remnus.com/.well-known/oauth-protected-resource`, which advertises PKCE (`S256`), dynamic client registration, and the `read` and `write` scopes. Claude Code walks that chain automatically.

Use a **PAT** when there is no browser to complete a consent screen — a CI job, a container, a remote build agent. See [Authentication](https://www.remnus.com/wiki/authentication) for the full policy.

> **Always use the `www` host.** The apex `remnus.com` redirects to `www.remnus.com`, and some MCP clients reject the resulting resource-indicator mismatch during OAuth. Header-based PAT connections follow the redirect either way.

## Step-by-step connection instructions

### Option A — Connect with OAuth (recommended)

1. **Add the server.** Run this from any directory:

   ```bash
   claude mcp add --transport http --scope user remnus https://www.remnus.com/api/mcp
   ```

   `--scope user` makes Remnus available in every project on your machine. The alternatives are `--scope local` (the default — this project only, private to you) and `--scope project` (written to `.mcp.json` and shared with your team through version control).

2. **Start Claude Code** in any project:

   ```bash
   claude
   ```

3. **Trigger the sign-in.** Open the MCP panel:

   ```
   /mcp
   ```

   Remnus appears as needing authentication. Select it and choose the authenticate option. From v2.1.186 you can also do this without opening a session:

   ```bash
   claude mcp login remnus
   ```

4. **Approve the consent screen.** Your browser opens the Remnus consent page. Pick the target workspace, the scope (**read** or **write**), the connection name, and the agent icon. Approve.

5. **Done.** Claude Code stores the tokens and refreshes them silently. Access tokens last one hour; rotating refresh tokens last 30 days, so an actively used connection stays signed in indefinitely.

### Option B — Connect with a personal access token

1. **Mint the token.** In Remnus, open the sidebar **AI Agents** panel → **Connect editor** → expand **Advanced**. Choose a workspace and a scope (**read** or **write**), then **Generate token**. Tokens are prefixed `rmns_` and are shown **only once**.

2. **Add the server with the header.** Replace the placeholder with your real token:

   ```bash
   claude mcp add --transport http --scope user remnus https://www.remnus.com/api/mcp \
     --header "Authorization: Bearer YOUR_REMNUS_TOKEN"
   ```

   `YOUR_REMNUS_TOKEN` is a placeholder — substitute the `rmns_…` value you copied.

3. **Restart Claude Code** so it picks up the new server.

### Optional — project-scoped JSON configuration

If you prefer sharing the server with your team through version control, add it to `.mcp.json` in the project root instead:

```json
{
  "mcpServers": {
    "remnus": {
      "type": "http",
      "url": "https://www.remnus.com/api/mcp"
    }
  }
}
```

Two things to know here. The `type` field is required — an entry with a `url` but no `type` is read as a stdio server and skipped with an error. And `streamable-http` is accepted as an alias for `http`, so snippets copied from other MCP server docs work unchanged.

### Optional — install the Remnus skill

The Remnus **desktop app** can install a companion skill to `~/.claude/skills/remnus/SKILL.md` during the connect flow (a checkbox, on by default, offered only for Claude Code). It teaches Claude Code the Remnus data model — that every database row is also a page, that `update_page` merges properties rather than replacing them, and that deletions need confirmation. Optional; the connection works without it.

## Confirm that the connection works

Start with read-only checks before letting the agent write anything.

**1. Confirm the server is registered and healthy:**

```bash
claude mcp list
```

A working connection reports `remnus: https://www.remnus.com/api/mcp - ✔ Connected`.

**2. Inspect the entry:**

```bash
claude mcp get remnus
```

**3. Check the tool count** inside a session with `/mcp`. The panel shows how many tools each server exposes. Remnus publishes **19**: 9 read tools and 10 write tools.

**4. Run a safe read.** Ask Claude Code:

> "Use the remnus MCP to list all items in my workspace."

A successful response returns your pages and databases. If that works, the connection is real — auth, transport, and tool discovery are all confirmed.

## Useful first workflows

These map to real Remnus tools, documented in [Read Tools](https://www.remnus.com/wiki/read-tools) and [Write Tools](https://www.remnus.com/wiki/write-tools).

**Read the project overview.** *"Find the page called 'Project Overview' in Remnus and summarize the current architecture."* Claude Code calls `search_workspace`, then `get_page` on the best hit.

**List active tasks.** *"Query my Tasks database in Remnus and show everything with status In Progress."* This runs `get_database_schema` first to resolve real column IDs and select-option strings, then `query_database` with a filter. The schema call is not wasted effort — invented column names silently produce empty filters.

**Create a task.** *"Add a task to my Tasks database: 'Audit MCP rate limits', priority High, status Todo."* This is `create_page` with a `databaseId` and a `properties` object.

**Update a kanban item.** A Remnus kanban view groups database rows by a select or status column, so moving a card *is* a property update: *"Move 'Audit MCP rate limits' to Done."* Claude Code calls `update_page`. Properties are **merged**, so setting `status` leaves every other field untouched. For several cards at once, `bulk_update_pages` does it in one round trip.

**Save a project decision.** *"Create a page under Decisions recording that we chose OAuth as the default MCP auth method, with the reasoning and today's date."* This is what turns a one-off conversation into context the next session can find — the pattern described in [How to Give Claude Code Persistent Memory and a Shared Workspace](https://www.remnus.com/docs/claude-code-persistent-memory-workspace).

Remnus also exposes MCP **resources** (`remnus://…` URIs) for cheap read-only context and five **prompt** templates, including `weekly-status-report` and `kanban-triage`.

## Recommended permission model

Grant the smallest scope that does the job.

**Start read-only.** A `read`-scoped connection can reach all 9 read tools — `search_workspace`, `list_workspace`, `get_page`, `get_database_schema`, `query_database`, `list_members`, `query_audit_log`, `get_changes_since`, and `get_related_pages` — and cannot modify anything. For summaries, reports, standups, and code work that only needs context, this is enough. Calling a write tool with a read token returns an error and changes nothing.

**Add write access deliberately.** The `write` scope adds `create_page`, `update_page`, `bulk_update_pages`, `delete_page`, `move_item`, `create_database`, `update_database_schema`, and the three database-view tools. Use a separate write connection for the agent that genuinely needs to file tasks, rather than upgrading your everyday one.

**Use two connections when it helps.** Register a read-only `remnus` at user scope for daily work, and a write-scoped server under a different name for a specific automation.

**Layer Claude Code's own permissions.** Remnus scopes are enforced server-side; Claude Code permission rules are enforced client-side. Both are useful. MCP tools follow the `mcp__<server>__<tool>` naming pattern, so `mcp__remnus__delete_page` can be denied in your Claude Code settings even on a write-scoped token.

**Two safeguards ship by default.** Destructive operations (`delete_page`, and `update_database_schema` when removing a column) require an explicit `confirm: true` — the first call returns a preview instead of acting. And every tool call is recorded in the workspace audit log. See the [Remnus security page](https://www.remnus.com/security) for the wider posture.

## Troubleshooting

**Authentication fails or the server shows as needing auth.** Run `/mcp` and re-authenticate, or `claude mcp login remnus`. Claude Code flags a server that returns `401` or `403`. If you already signed in, it refreshes the token and retries once before flagging.

**"Incompatible auth server" or the OAuth flow never opens.** Confirm you used the `www` host. The apex domain redirects, and some clients reject the resource-indicator mismatch that results.

**Invalid configuration.** If a JSON entry has a `url` but no `type`, Claude Code reports: `MCP server "remnus" has a "url" but no "type"; add "type": "http"`. Before v2.1.202 the same mistake surfaced as the far less obvious `command: expected string, received undefined`.

**A bad token beats OAuth.** If you set `headers.Authorization` and the server rejects it, Claude Code reports the connection as **failed** rather than falling back to OAuth. Remove the header to use OAuth instead.

**No tools appear.** Confirm the scope you connected at — read tokens still expose all 9 read tools, so an empty list means a connection problem, not a scope problem. Check `claude mcp get remnus`.

**Expired or revoked tokens.** PATs can carry an expiry; expired and revoked tokens both return `401`. Mint a new one, or re-run the OAuth flow. From v2.1.195, when a refresh token is rejected Claude Code immediately points you at `/mcp`.

**Network problems and `429`.** Remnus allows **60 requests per minute** per token on a rolling window; beyond that it returns `429 Too Many Requests`. Claude Code retries the initial connection up to three times on transient errors and reconnects mid-session with exponential backoff. Auth and not-found errors are never retried — those need a config change.

**Restarts.** Restart Claude Code after editing `.mcp.json` by hand. Project-scoped servers show as `⏸ Pending approval` until you run `claude` in that directory and accept.

**Headless runs.** In `claude -p` or Agent SDK runs there is no `/mcp` panel, so the OAuth flow cannot run. Sign in from an interactive session first, or use a PAT.

## Disconnecting or revoking access

**Remove the server from Claude Code:**

```bash
claude mcp remove remnus
```

**Clear stored credentials only** — keeping the server configured: open `/mcp`, select Remnus, and choose **Clear authentication**.

**Revoke from the Remnus side**, which is the one that matters if a credential leaked: open the sidebar **AI Agents** panel and revoke the OAuth connection or PAT. Revocation is immediate — the next request returns `401`, regardless of what any client still has cached. Removing a server locally does *not* revoke the token; do both.

## FAQ

**Do I need to self-host Remnus to use MCP?**
No. The hosted endpoint at `https://www.remnus.com/api/mcp` is available to every workspace. Self-hosting exposes the same surface on your own domain.

**Can I connect more than one workspace?**
Yes, but each connection is scoped to a single workspace — you never pass a workspace ID in a tool call. Register a second server under a different name to reach another workspace.

**Where does Claude Code store the configuration?**
`local` and `user` scoped servers live in `~/.claude.json`; `project` scoped servers live in `.mcp.json` in the project root. With OAuth, no credential is written into your config at all.

**Will Claude Code delete my pages by accident?**
Destructive tools require `confirm: true`, and the first call returns a preview instead of acting. You can also deny `mcp__remnus__delete_page` in your Claude Code permission settings, or simply connect with a read-only scope.

**Does this work on Windows?**
Yes. Remnus is a remote HTTP server, so it behaves identically on native Windows, WSL, macOS, and Linux. The `claude mcp add` command is the same everywhere — only line-continuation syntax differs, so put the multi-line PAT command on one line in PowerShell.

**How do I know what the agent actually changed?**
Every tool call is written to the workspace audit log. Ask Claude Code to run `query_audit_log`, or review recent activity in the **AI Agents** panel.

**Do I need the Remnus skill?**
No. It is optional and only sharpens how Claude Code uses the tools. The connection works without it.

## Get started

If you already have a Remnus workspace, connecting takes one command and a browser approval:

```bash
claude mcp add --transport http --scope user remnus https://www.remnus.com/api/mcp
```

If you don't, [create a workspace at remnus.com](https://remnus.com) and follow the in-app **AI Agents → Connect editor** flow, which generates this command for you. The full reference lives in [Getting Started](https://www.remnus.com/wiki/getting-started) and [Connect Your Editor](https://www.remnus.com/wiki/connect-editors).
