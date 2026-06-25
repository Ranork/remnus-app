# Remnus MCP

Remnus MCP is a [Model Context Protocol](https://modelcontextprotocol.io) server built into every Remnus workspace. It lets AI agents — Claude, Cursor, Windsurf, and any MCP-compatible client — read and write your workspace data over a standard HTTP API.

## What you can do

- Query pages and databases with full-text search and property filters
- Create and update pages, database rows, and entire databases
- Automate reports, task extraction, and kanban triage with built-in prompts
- Monitor all agent activity through a structured audit log

## Endpoint

```
https://remnus.com/api/mcp
```

Supports both **Streamable HTTP** (stateless, one request per call) and **SSE** (stateful, persistent connection).

## Quick start

1. Open your workspace → **⋯ menu** → **Settings** → **Tokens** tab
2. Click **New Token**, choose a name and scope
3. Copy the token and configure your AI client — see [Getting Started](https://remnus.com/share/docs/mcp/getting-started)

## Documentation

| | |
|---|---|
| [Getting Started](getting-started.md) | Token setup, Claude Desktop config, first call |
| [Connect Your Editor](connect-editors.md) | Windsurf, Cline, Zed & more — ready configs + OAuth |
| [Authentication](authentication.md) | Bearer tokens, scopes, rate limits |
| [Read Tools](read-tools.md) | 7 read-only tools |
| [Write Tools](write-tools.md) | 7 write tools |
| [Resources](resources.md) | 4 MCP resource templates |
| [Prompts](prompts.md) | 5 built-in prompt templates |
