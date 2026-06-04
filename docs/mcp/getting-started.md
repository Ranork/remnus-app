# Getting Started

This guide walks you through generating an MCP token and connecting your first AI client to Remnus.

## Step 1 — Generate a token

1. Open your workspace in Remnus
2. Click the **⋯** menu next to the workspace name in the sidebar, then open **Settings**
3. Navigate to the **Tokens** tab
4. Click **New Token**
5. Enter a name (e.g. `Claude Desktop`) and choose a scope:
   - **Read** — the agent can read pages, databases, and members, but cannot modify anything
   - **Write** — the agent can create, update, and delete pages and databases (includes read access)
6. Click **Create** and copy the token — it is shown only once

## Step 2 — Configure Claude Desktop

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "remnus": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://remnus.com/api/mcp"],
      "env": {
        "MCP_BEARER_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```

Replace `YOUR_TOKEN_HERE` with the token you copied.

> **Where is `claude_desktop_config.json`?**
> - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
> - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

After saving, restart Claude Desktop. A small hammer icon will appear in the chat input area when the MCP server is connected.

## Step 3 — Configure Cursor

In Cursor go to **Settings → MCP** and add:

```json
{
  "remnus": {
    "url": "https://remnus.com/api/mcp",
    "headers": {
      "Authorization": "Bearer YOUR_TOKEN_HERE"
    }
  }
}
```

Or use the one-click **Open in Cursor** deeplink available in the **Tokens** tab after creating a token.

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
