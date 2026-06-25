# Connect Your Editor

Remnus exposes a single remote MCP endpoint that any MCP-compatible editor can connect to:

```
https://www.remnus.com/api/mcp
```

There are two ways to authenticate:

- **OAuth (recommended, token-less)** — point the editor at the URL and approve the consent screen in your browser on first connect. Nothing to copy or paste. Works in editors that run the MCP OAuth 2.1 flow on a `401` (Claude, Cursor, VS Code, Zed, Codex).
- **Personal access token (PAT)** — mint a scoped token in **AI Agents → Connect editor → Advanced**, then send it as an `Authorization: Bearer …` header. Works everywhere, including editors that do not yet run the OAuth flow.

> **Always use the `www` host for OAuth.** The apex `remnus.com` redirects to `www.remnus.com`, and some clients reject the resulting resource-indicator mismatch. PAT (header-based) connections follow the redirect fine either way.

## Editor matrix

| Editor | Config location | Auth | One-click |
|---|---|---|---|
| Claude Code / Desktop | `claude mcp add` command / `.mcpb` bundle | OAuth | ✓ |
| Cursor | `~/.cursor/mcp.json` | OAuth · PAT | ✓ deeplink |
| VS Code (Copilot) | MCP settings | OAuth · PAT | ✓ deeplink |
| Codex | `~/.codex/config.toml` | OAuth (`codex mcp login`) · PAT | — |
| **Windsurf** | `~/.codeium/windsurf/mcp_config.json` | PAT | — |
| **Cline** | `cline_mcp_settings.json` | PAT | — |
| **Zed** | `settings.json` → `context_servers` | OAuth · PAT | — |

Claude, Cursor, VS Code, and Codex are walked through step-by-step in the in-app **AI Agents → Connect editor** flow (and produce one-click deeplinks or ready commands). This page covers the file-configured editors: **Windsurf**, **Cline**, and **Zed**.

To mint a token for any of the PAT snippets below: open the sidebar **AI Agents** panel → **Connect editor** → expand **Advanced**, pick a workspace and scope (read or write), and copy the generated token. It is shown only once.

---

## Windsurf

Config file:

- macOS / Linux: `~/.codeium/windsurf/mcp_config.json`
- Windows: `%USERPROFILE%\.codeium\windsurf\mcp_config.json`

Add Remnus under `mcpServers` using `serverUrl` and your token:

```json
{
  "mcpServers": {
    "remnus": {
      "serverUrl": "https://www.remnus.com/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

1. Mint a token in **AI Agents → Connect editor → Advanced** and paste it in place of `YOUR_TOKEN_HERE`.
2. In Windsurf, open **Cascade → manage MCP servers** and click **Refresh** to load the new server.
3. Ask Cascade: *"List all pages and databases in my Remnus workspace."*

> Windsurf accepts both `serverUrl` and `url` for remote HTTP servers; `serverUrl` is the documented field. You can keep the token out of the file with variable interpolation — e.g. `"Authorization": "Bearer ${env:REMNUS_TOKEN}"`.

---

## Cline

Cline runs inside VS Code or Cursor. Open the **MCP Servers** panel (Cline sidebar icon → top-right menu → **MCP Servers**) → **Configure MCP Servers** to edit `cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "remnus": {
      "type": "streamableHttp",
      "url": "https://www.remnus.com/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

1. Mint a token in **AI Agents → Connect editor → Advanced**.
2. Paste it as the `Authorization` header value and save.
3. Cline reloads the server automatically — the **remnus** tools appear in the MCP panel.
4. Ask: *"Use the remnus MCP to list my workspace."*

> **The `type` must be exactly `streamableHttp`** — camelCase, no hyphen. With `streamable-http` or no `type` at all, Cline falls back to SSE and the connection fails with a `405`. You can also add the server from Cline's **Remote Servers** tab instead of editing the JSON by hand.

---

## Zed

Zed calls MCP servers **context servers**. Open `settings.json` (**Cmd/Ctrl + ,**) and add Remnus under `context_servers`.

**OAuth (recommended)** — omit the header and Zed runs the browser sign-in on first use:

```json
{
  "context_servers": {
    "remnus": {
      "url": "https://www.remnus.com/api/mcp"
    }
  }
}
```

**With a token:**

```json
{
  "context_servers": {
    "remnus": {
      "url": "https://www.remnus.com/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

1. Add one of the snippets above to `settings.json`.
2. Open the Agent Panel — the **remnus** context server appears. If you used the OAuth form, approve the consent screen in your browser when prompted.
3. Ask the agent: *"List all pages and databases in my Remnus workspace."*

> Requires a recent Zed build with remote (URL-based) context server support. Older versions run stdio servers only — for those, bridge with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) by setting `"command": "npx"`, `"args": ["-y", "mcp-remote", "https://www.remnus.com/api/mcp"]` instead of `url`.

---

## Any other MCP client

If your tool is not listed, it almost certainly accepts the standard `mcpServers` shape. Point it at the endpoint and add a bearer token if it does not support OAuth:

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

## Verify

Whatever editor you use, confirm the connection with:

> "Use the remnus MCP to list all items in my workspace."

A successful response returns your pages and databases. From there the agent can search and read everything, and — with a write-scoped token or write consent — create and update content. See [Authentication](authentication.md) for scopes and rate limits, and [Read Tools](read-tools.md) / [Write Tools](write-tools.md) for the full tool catalog.
