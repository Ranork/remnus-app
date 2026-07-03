# Getting Started

This guide walks you through connecting your first AI client to Remnus. The recommended path is **OAuth** — no token to generate or paste. A personal access token (PAT) is available as a fallback for clients that don't run the MCP OAuth flow.

## Step 1 — Open the connect flow

1. Open your workspace in Remnus
2. Click the **AI Agents** button at the bottom of the sidebar
3. Click **Connect editor**
4. Pick your editor — Claude Code, Cursor, VS Code, Codex, Windsurf, Continue, Antigravity, or **Other tool** for any other MCP-compatible client

## Step 2 — Connect with OAuth (recommended)

For OAuth-ready editors (Claude Code, Cursor, VS Code, Codex, and most other clients), Remnus generates a ready-to-use command, deeplink, or config snippet pointing at the endpoint — no token embedded. Approve the consent screen that opens in your browser on first connect, and you're done.

For example, Claude Code:

```
claude mcp add --transport http --scope user remnus https://www.remnus.com/api/mcp
```

Any tool that reads a standard `mcpServers` JSON config (Claude Desktop included) can connect the same way via the [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) bridge:

```json
{
  "mcpServers": {
    "remnus": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://www.remnus.com/api/mcp"]
    }
  }
}
```

On the first tool call, `mcp-remote` opens your browser to complete the OAuth 2.1 + PKCE flow — nothing to copy or paste.

> **Always use the `www` host.** The apex `remnus.com` redirects to `www.remnus.com`, and some clients reject the resulting resource-indicator mismatch during OAuth.

See [Connect Your Editor](connect-editors.md) for the full editor-by-editor matrix, including editors that don't yet support OAuth (Windsurf, Continue, Antigravity — token only).

## Step 3 — Or connect with a personal access token (advanced)

Some clients don't run the OAuth flow, or you may just prefer a static token. In the **Connect editor** flow, expand **Advanced**:

1. Choose a workspace (only workspace **owners** can mint tokens) and a scope:
   - **Read** — the agent can read pages, databases, and members, but cannot modify anything
   - **Write** — the agent can create, update, and delete pages and databases (includes read access)
2. Click **Generate token** and copy it — it is shown only once
3. Paste it into the generated config, e.g. for the `mcp-remote` bridge:

```json
{
  "mcpServers": {
    "remnus": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote", "https://www.remnus.com/api/mcp",
        "--header", "Authorization:${AUTH_HEADER}"
      ],
      "env": { "AUTH_HEADER": "Bearer YOUR_TOKEN_HERE" }
    }
  }
}
```

Or for a client that takes headers directly (e.g. Cursor's `mcp.json`):

```json
{
  "mcpServers": {
    "remnus": {
      "url": "https://www.remnus.com/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

Manage and revoke tokens (PAT and OAuth) any time from the **AI Agents** panel. See [Authentication](authentication.md) for scopes, expiry, and revocation.

## Step 4 — Verify the connection

Ask your AI client:

> "Use the remnus MCP to list all items in my workspace."

A successful response returns a JSON list of your pages and databases.

## Rate limits

The MCP endpoint allows **60 requests per minute** per token. Exceeding this limit returns a `429` response.

## Transport modes

| Mode | When to use |
|---|---|
| Streamable HTTP | Default — one HTTP request per tool call, stateless |
| SSE | Persistent connection — lower latency for high-frequency calls |
