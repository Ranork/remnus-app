# How to Connect Cursor to Remnus with MCP

Cursor is fast at writing code. It is far less aware of the project *around* the code — the requirements, the open tasks, the decisions your team already made. That context usually lives in another tab, and Cursor can't see it.

Connecting Cursor to [Remnus](https://remnus.com) over the Model Context Protocol (MCP) closes that gap. MCP is an open standard that lets an AI client call external tools and data through one consistent interface; the [official MCP documentation](https://modelcontextprotocol.io/docs/getting-started/intro) is the canonical reference. Remnus is an MCP-native workspace — pages, databases, kanban boards, calendars, and agent memory — that exposes all of it to a client like Cursor.

Once connected, Cursor can search your workspace, read a product spec, query your task database, create and update tasks, and save an implementation decision back to a page — without you copying anything between windows.

This guide covers the full setup against the current Cursor release, with verified configuration and clearly marked placeholders.

## Prerequisites

- **A Remnus workspace.** A workspace on [remnus.com](https://remnus.com) or a self-hosted Remnus deployment. Self-hosting exposes the same MCP endpoint on your own domain — substitute your host in every example below.
- **Cursor, recent version.** Any Cursor build with MCP support (Settings → MCP / Tools & Integrations). MCP is a desktop-app feature.
- **Basic MCP familiarity.** You don't need deep protocol knowledge — just the idea that a *server* (Remnus) exposes tools and a *client* (Cursor) calls them.
- **Workspace permissions.** OAuth works for any workspace member. Minting a personal access token requires workspace **owner** rights.

The Remnus endpoint is the same for every client:

```
https://www.remnus.com/api/mcp
```

Always use the `www` host. The apex `remnus.com` redirects to `www.remnus.com`, and some clients reject the resulting resource-indicator mismatch during OAuth.

## Connecting Remnus as an MCP server

There are two reliable paths. The one-click deeplink is fastest; the manual file edit gives you full control and works the same across Cursor versions.

### Method A — One-click from Remnus (recommended)

1. Open your workspace in Remnus.
2. Click **AI Agents** at the bottom of the sidebar, then **Connect editor**.
3. Pick **Cursor**. Remnus generates an **Add to Cursor** deeplink — OAuth by default, no token embedded.
4. Click it. Cursor opens and offers to install a server named `remnus`. Approve.
5. On the first tool call, Cursor opens your browser to the Remnus consent screen. Pick the workspace and scope, approve, and you're connected.

### Method B — Edit `mcp.json` manually

Cursor reads MCP servers from a `mcp.json` file. Add Remnus under `mcpServers`.

For **OAuth** (recommended), provide only the URL — Cursor runs the browser sign-in on first use:

```json
{
  "mcpServers": {
    "remnus": {
      "url": "https://www.remnus.com/api/mcp"
    }
  }
}
```

For a **personal access token**, add an `Authorization` header instead:

```json
{
  "mcpServers": {
    "remnus": {
      "url": "https://www.remnus.com/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_REMNUS_TOKEN"
      }
    }
  }
}
```

`YOUR_REMNUS_TOKEN` is a placeholder — replace it with the real `rmns_…` value you mint (see the next section). Remote HTTP servers in Cursor use `url` and optional `headers`; no `type` field is required.

### Where to store the configuration

Cursor supports two locations, and you choose based on scope:

| Location | Path | Scope |
|---|---|---|
| Global | `~/.cursor/mcp.json` (Windows: `%USERPROFILE%\.cursor\mcp.json`) | Every project you open in Cursor |
| Project | `.cursor/mcp.json` in the project root | That project only; shareable via version control |

After editing the file, open Cursor Settings and find the MCP servers section (recent builds group it under **Tools & Integrations**). If `remnus` doesn't appear or shows as off, toggle it on or reload the window. The exact menu label varies by Cursor version — see the [official Cursor MCP docs](https://cursor.com/docs/mcp) for your build.

## Authentication and permission scopes

Remnus supports two authentication methods. Both are workspace-scoped: one connection only ever reaches one workspace.

**OAuth 2.1 + PKCE (recommended).** Point Cursor at the URL with no credentials. On the first request, Cursor runs the standard flow: you approve a consent screen, and Cursor stores rotating tokens. Access tokens expire after one hour; refresh tokens rotate on use and last 30 days, so an active connection stays signed in without you ever handling a token.

**Personal access token (PAT).** For a static credential — useful when you'd rather not run a browser flow — open the sidebar **AI Agents** panel → **Connect editor** → **Advanced**, choose a workspace and scope, and generate a token. Tokens are prefixed `rmns_` and shown only once. Only workspace **owners** can mint them.

Both methods carry one of two scopes:

| Scope | What the agent can do |
|---|---|
| `read` | Search, list, and read pages, databases, schemas, and members — no changes |
| `write` | Everything in `read`, plus create, update, move, and delete |

Calling a write tool with a read-scoped token returns an error and changes nothing. Start with `read` and grant `write` deliberately. Full details are on the [Remnus authentication docs](https://www.remnus.com/wiki/authentication) and the [security page](https://www.remnus.com/security).

## Testing the connection

Confirm everything works with a read-only request before letting Cursor write anything.

1. Open Cursor's Agent chat.
2. Ask a safe, read-only question:

> "Use the remnus MCP to list all pages and databases in my workspace."

Cursor calls `list_workspace` (or `search_workspace`) and returns your items. By default, **Cursor asks for approval before running each MCP tool** — approve the read call.

3. If you see your workspace contents, the connection is verified: auth, transport, and tool discovery all work.

A read-only test can never modify data, so it's the safe first step regardless of which scope your token holds.

## Five useful Cursor and Remnus workflows

Each of these maps to real Remnus tools, documented in the [Remnus MCP reference](https://www.remnus.com/wiki).

### 1. Reading product requirements

Point Cursor at a spec before it writes code. It runs `search_workspace` to find the page, then `get_page` to read the full markdown — so implementation starts from your actual requirements, not a guess.

### 2. Reviewing active tasks

Ask Cursor what's in flight. It calls `get_database_schema` to resolve your real column IDs and status options, then `query_database` with a filter to return only open work. Resolving the schema first matters — invented column names silently produce empty results.

### 3. Creating implementation tasks

When Cursor breaks a feature into steps, it can file them as real rows with `create_page`, passing the database ID and a typed `properties` object. The tasks land in the same board your team reviews.

### 4. Updating task status

A Remnus kanban board groups database rows by a status column, so moving a card is a property update. Cursor calls `update_page`, which **merges** properties — setting `status` leaves every other field untouched. To change several at once, `bulk_update_pages` does it in one call.

### 5. Saving important implementation decisions

This is what keeps context from evaporating. Ask Cursor to record why it chose an approach, and it writes a page — a decision, with reasoning and a date — that the next session can find. It's the same durable-context pattern described in our [MCP-native workspace guide](https://www.remnus.com/docs/what-is-an-mcp-native-workspace), which also covers multi-agent, shared-workspace setups.

## Example prompts

Five copy-ready prompts for the Cursor Agent chat:

```text
Use the remnus MCP to find the "Auth Rework" spec and summarize the requirements as a checklist.
```

```text
Query my Tasks database in Remnus and list every row with status "In Progress", grouped by assignee.
```

```text
Break the current feature into implementation tasks and create them in my Tasks database with priority and status set.
```

```text
Move the "Rate limiting" task in Remnus to Done, and add a one-line note on what changed.
```

```text
Record a decision page in Remnus: we chose token-bucket rate limiting over fixed windows, with the reasoning and today's date.
```

## Project-specific vs global MCP configuration

Cursor lets you register Remnus globally or per project. Choose by how the workspace maps to your work.

**Use global (`~/.cursor/mcp.json`) when:**

- One Remnus workspace backs most of what you do in Cursor.
- You want the server available in every repo without re-adding it.
- The config is personal — a global file isn't committed to any repo.

**Use project (`.cursor/mcp.json`) when:**

- A specific repository pairs with a specific Remnus workspace.
- You want teammates to inherit the same server by checking the file into version control.
- You keep different scopes or tokens per project.

A practical rule: personal, cross-project access goes global; team-shared, repo-bound access goes project. If you commit a project `.cursor/mcp.json`, keep it OAuth-only or use an environment-referenced token — never commit a raw `rmns_` secret.

## Security recommendations

- **Prefer OAuth.** It keeps a long-lived secret out of your config files entirely.
- **Default to read scope.** Give Cursor `write` only when it genuinely needs to create or update content. A reporting or review workflow should be read-only.
- **Never commit a raw token.** If a project config needs a PAT, reference it from an environment variable and give the token an expiry date.
- **Keep tool approval on.** Cursor's per-call approval is your last checkpoint before a write. Review what a tool will do before approving, especially deletes.
- **Watch the audit log.** Every MCP tool call is recorded in an immutable Remnus audit log with the token identity attached — review it from the **AI Agents** panel. More on our [security page](https://www.remnus.com/security).

Destructive operations add a second guardrail: `delete_page` and column-removing schema changes require an explicit confirmation step that returns a preview first, so nothing is lost on a single call.

## Troubleshooting common errors

**Server doesn't appear after editing `mcp.json`.** Check the file is valid JSON and in the right location (`~/.cursor/mcp.json` global, `.cursor/mcp.json` project root). Open Cursor Settings, toggle the server, or reload the window.

**Authentication fails / consent screen never opens.** Confirm you used the `www` host. For OAuth, remove any `Authorization` header — a rejected header makes Cursor treat the connection as failed instead of falling back to OAuth. For a PAT, re-check the token value and that it isn't expired or revoked.

**Write tools return a scope error.** Your token is read-only. Reconnect with a write scope, or mint a write-scoped PAT. Read tools still work on a read token, so an empty tool list is a connection problem, not a scope one.

**`429 Too Many Requests`.** The endpoint allows 60 requests per minute per token. Space out bulk operations, and prefer `bulk_update_pages` over many single `update_page` calls.

**Tools don't run at all.** Cursor asks for approval before each MCP tool by default — check the chat for a pending approval prompt. Make sure the `remnus` server is enabled in settings.

**Filters return nothing.** Ask Cursor to call `get_database_schema` first. Property filters use real column IDs and exact select-option strings; guessed values match nothing.

## How to remove or revoke the integration

Removing the server in Cursor and revoking the credential in Remnus are two separate actions — for a leaked token, do both.

- **Remove from Cursor:** delete the `remnus` entry from your `mcp.json`, or toggle/remove it in the MCP settings section.
- **Revoke from Remnus:** open the sidebar **AI Agents** panel and revoke the OAuth connection or PAT. Revocation is immediate — the next request returns `401`, no matter what any client still has cached.

Removing the server locally does not revoke the token; the credential stays valid until you revoke it in Remnus.

## FAQ

**Does connecting Cursor to Remnus require a personal access token?**
No. OAuth is the default and needs no token — Cursor runs the browser consent flow on first use. A PAT is a fallback for when you prefer a static credential.

**Where does Cursor store the Remnus MCP configuration?**
In `mcp.json`: globally at `~/.cursor/mcp.json` or per project at `.cursor/mcp.json`. Global applies to every project; project applies only to that repo and can be shared through version control.

**Do I need to restart Cursor after editing `mcp.json`?**
Usually not — open the MCP settings section and toggle the server, or reload the window if it doesn't appear. Behavior varies slightly by Cursor version; the [official Cursor MCP docs](https://cursor.com/docs/mcp) reflect your build.

**Can I give Cursor read-only access to my workspace?**
Yes. Connect with a `read` scope and Cursor can search and read everything but cannot create, edit, or delete — write calls just return an error. Use write scope only for agents that need it.

**Which operating systems does this work on?**
Any platform where Cursor's desktop app runs. Because Remnus is a remote HTTP server, the `mcp.json` configuration is identical across systems — only the Windows home-directory path differs (`%USERPROFILE%\.cursor\mcp.json`).

**Will Cursor delete my pages without asking?**
Two safeguards apply: Cursor asks for approval before each tool call by default, and Remnus gates deletes and destructive schema changes behind an explicit confirmation that previews the change first. You can also connect read-only to remove the risk entirely.

## Try it

If your Cursor sessions keep losing the context that lives outside your code, an MCP-native workspace is the missing piece. Remnus is open source and self-hostable, and connecting takes a minute.

[Open a workspace at remnus.com](https://remnus.com), then use **AI Agents → Connect editor → Cursor** to add the server — or follow the full [MCP documentation](https://www.remnus.com/wiki) to wire it up by hand.
