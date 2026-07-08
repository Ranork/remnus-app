# Remnus MCP

Remnus MCP is a [Model Context Protocol](https://modelcontextprotocol.io) server built into every Remnus workspace. It lets AI agents — Claude, Cursor, Windsurf, and any MCP-compatible client — read and write your workspace data over a standard HTTP API.

## What you can do

- Query pages and databases with full-text search and property filters
- Create and update pages, database rows, and entire databases
- Automate reports, task extraction, and kanban triage with built-in prompts
- Monitor all agent activity through a structured audit log

## Endpoint

```
https://www.remnus.com/api/mcp
```

Always use the `www` host — the apex `remnus.com` redirects to `www.remnus.com`, and some OAuth clients reject the resulting resource-indicator mismatch. Supports both **Streamable HTTP** (stateless, one request per call) and **SSE** (stateful, persistent connection).

## Quick start

1. Open your workspace → sidebar **AI Agents** button → **Connect editor**
2. Pick your editor. Most connect with **OAuth** — no token to copy, just approve the consent screen in your browser on first connect. Prefer a token? Expand **Advanced** to mint one.
3. Ask your agent to list your workspace — see [Getting Started](getting-started.md) for the full walkthrough

## Documentation

| | |
|---|---|
| [Getting Started](getting-started.md) | OAuth connect, PAT fallback, first call |
| [Connect Your Editor](connect-editors.md) | Windsurf, Continue, Antigravity, Cline, Zed & more — ready configs + OAuth |
| [Authentication](authentication.md) | Bearer tokens, scopes, rate limits |
| [Read Tools](read-tools.md) | 9 read-only tools |
| [Write Tools](write-tools.md) | 10 write tools |
| [Resources](resources.md) | 5 MCP resource templates |
| [Prompts](prompts.md) | 7 built-in prompt templates |
| [Agent Memory](agent-memory.md) | Save & recall durable memory over MCP |
| [Token-Efficient Usage](token-efficient-usage.md) | Cut a typical read 80–90% with projection, outline, digest & delta |
