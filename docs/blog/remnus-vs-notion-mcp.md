# Remnus vs Notion: Full Comparison

Notion and Remnus both organize work as pages and databases with table, board, and calendar views, so they get compared a lot. This comparison covers both halves of that question honestly: the everyday workspace you and your team use by hand (editor, views, mobile apps, templates, integrations), and the AI agent side (MCP authentication, tool coverage, pricing, and audit trails). Every claim below is pulled from Notion's own help center and developer docs, or from Remnus's own source code, checked at the time of writing rather than assumed.

We are not neutral here, we built Remnus. So where Notion is simply ahead, we say so plainly instead of hiding it in a footnote.

**Short version:** Notion is the more complete everyday workspace today (deeper views, relations, offline mobile, a huge template library). Remnus is built for an AI agent to operate on your workspace unattended, with a first-party MCP server, headless auth, and a queryable audit trail on every plan including Free. The rest of this page backs both halves of that with sources.

## What each product actually is

Notion is the workspace almost everyone has already used. Over a decade of development gave it a deep editor, eight different database view types, native mobile and desktop apps with offline support, a marketplace with more than 30,000 templates, and a hosted MCP server at `mcp.notion.com` that lets an AI client search, read, and edit your workspace.

Remnus is a smaller, open source workspace built the other way around on the AI side: the MCP server was the starting point, not an add-on bolted onto an existing product later. Every page and every database row is reachable through the same 19 tools whether a human clicks through the UI or an agent calls the API, and the whole thing is self-hostable under AGPL-3.0. On the everyday workspace side, Remnus is a younger, smaller product, and it is behind Notion in several concrete ways covered below.

## The everyday workspace

Most of what people actually do day to day has nothing to do with AI, and this is the part where Notion's decade-plus head start shows:

- **Database views:** 8 types (table, board, timeline, calendar, gallery, list, chart, dashboard) versus Remnus's 3 (table, kanban, calendar)
- **Relations and rollups** across databases: Notion has them, Remnus's column types don't include them yet
- **Real-time multiplayer editing** with live cursors: Notion has it, Remnus syncs through a background refresh instead
- **Page version history:** Notion keeps it, Remnus doesn't expose it yet
- **Native offline mobile apps:** Notion has them, Remnus's apps are online-first
- **Templates:** Notion's marketplace lists 30,000+, Remnus ships 7 starter templates
- **Pre-built integrations:** Notion has native Slack, Google Drive, GitHub, and Figma plus a large Zapier catalog; Remnus has none, relying on its general-purpose MCP surface instead

None of this is close, and it would be dishonest to frame it any other way. Remnus is a new product from a small team, not a company the size of Notion, and it is under active, continuous development rather than a fixed release schedule, so treat this list as where things stand today rather than a permanent ceiling. It is also, deliberately, not where we are focusing first: the section below is the part we built Remnus around.

## Where Remnus is built differently: the AI agent side

This is the part we built Remnus around, and where the comparison flips.

### Side by side

| Feature | Notion | Remnus |
|---|---|---|
| Database view types | 8 (table, board, timeline, calendar, gallery, list, chart, dashboard) | 3 (table, kanban, calendar) |
| Cross-database relations/rollups | Yes | Not currently |
| Real-time multiplayer cursors | Yes, WebSocket based, sub-second sync | No, updates arrive via background refresh |
| Page version history | Yes, 30 days on paid plans | Not currently |
| Native mobile offline mode | Yes, since August 2025 | Not currently (online-first apps) |
| Official template count | 30,000+ | 7 built-in |
| Pre-built app integrations | Native Slack, Google Drive, GitHub, Figma, plus Zapier catalog | None; the general-purpose MCP surface is the integration layer |
| MCP authentication | OAuth only, a person must complete the login flow | OAuth 2.1 with PKCE for editors, plus scoped personal access tokens for headless use |
| Built for unattended agents | No, Notion's own docs say this may not suit "cloud-based coding agents that run without human interaction" | Yes, personal access tokens need no login and no human present |
| MCP tools exposed | 19, across search, content, database and view management, comments, and workspace admin | 19, split 9 read and 10 write, plus 5 resource templates and 7 prompt templates |
| Editing granularity for agents | Page and block level | Page level and database row level |
| Database view queries over MCP | Require a Business plan or higher with Notion AI enabled | Included on every plan, including Free |
| Agent connections to outside apps (Custom Agents) | Business and Enterprise plans only | Not applicable, Remnus agents connect inward over MCP rather than acting as an outbound integration hub |
| MCP rate limit | About 3 requests per second per integration (roughly 180/minute, or 2,700 per 15 minutes) | 60 requests per minute per token |
| Audit trail of agent writes | Workspace audit log is an Enterprise-only, human-facing admin feature | Every write is stamped with the acting token and queryable directly through the `query_audit_log` MCP tool, on every plan |
| Self hosting | Not available | Yes, self-hostable under AGPL-3.0 |
| License | Proprietary | AGPL-3.0 |
| Base pricing | Free $0, Plus $10, Business $20 (all per seat, per month), Enterprise custom | Free $0, Startup $10, Professional $29 (all flat per month, not per seat), Enterprise custom |

### Authentication is the real fork in the road

Notion's MCP connector requires OAuth, every time, with a person present to approve the login. Notion's own documentation is direct about the consequence: a user must complete the OAuth flow to authorize access, which may not be suitable for fully automated workflows or cloud-based coding agents that run without human interaction. There used to be a community-run, token-based alternative server, but Notion's own docs now describe that package as no longer actively maintained.

That is a completely reasonable design for a product built primarily for people. It is a hard blocker for a nightly cron job, a CI pipeline that files its own tickets, or a coding agent working on a server at three in the morning with nobody at a keyboard to click "Allow."

Remnus was built assuming that second case is normal, not an edge case. A personal access token (prefixed `rmns_`) is scoped to read or write, can be given an expiry date or left open ended, and is revocable instantly from the workspace settings. No login screen, no human in the loop required. Editors that want the smoother experience still get OAuth 2.1 with PKCE and one click connect.

### Pricing: what is actually behind the paywall

Notion's headline prices are Free at $0, Plus at $10, and Business at $20, all billed per seat per month, with Enterprise on custom pricing. Full Notion AI access, the built-in Notion Agent, and MCP based database view queries all require the Business plan. If you want a Custom Agent (a configurable agent with its own MCP connections to outside tools like Linear or Canva), that is billed on top at $10 per 1,000 credits, and Custom Agents themselves are Business and Enterprise only. For a 5 person team, Notion Business alone runs $100 a month before any agent credits.

Remnus prices flat per workspace owner rather than per seat: Free at $0, Startup at $10 a month, and Professional at $29 a month, each covering a fixed seat and agent allowance rather than charging per head. The full 14-tool MCP surface, both read and write, works identically on every tier, Free included. The only things that scale with plan are seats, connected agents, storage, and audit log retention window, not which MCP tools are available.

Two different pricing philosophies. Notion charges more as your headcount grows and gates agent capability behind a specific tier. Remnus charges a flat rate as your workspace grows and keeps the entire MCP surface open regardless of tier.

### What an agent can actually do on each

Notion's hosted server exposes 19 tools across six categories: search and query (`notion-search`, `notion-query-data-sources`, `notion-query-database-view`, `notion-query-meeting-notes`), content management (`notion-fetch`, `notion-create-pages`, `notion-update-page`, `notion-move-pages`, `notion-duplicate-page`), database and view management (`notion-create-database`, `notion-update-data-source`, `notion-create-view`, `notion-update-view`), collaboration (`notion-create-comment`, `notion-get-comments`), workspace management (`notion-get-teams`, `notion-get-users`), and async operations (`notion-get-async-task`). Basic page creation, reading, and updating work on a Free Notion account. Querying a saved database view needs Business or higher with Notion AI turned on, and querying across multiple data sources in one call needs Enterprise.

Remnus exposes 19 tools. Read: `search_workspace`, `list_workspace`, `get_page`, `get_database_schema`, `query_database`, `list_members`, `query_audit_log`, `get_changes_since`, `get_related_pages`. Write: `create_page`, `update_page`, `bulk_update_pages`, `delete_page`, `move_item`, `create_database`, `update_database_schema`, `create_database_view`, `update_database_view`, `delete_database_view`. A few details worth calling out because they show up in real agent workflows: `update_page` and `bulk_update_pages` merge properties instead of overwriting them, so an agent updating one field never clobbers the rest of a row. `delete_page` previews what it would delete unless you explicitly pass `confirm: true`. `update_database_schema` protects the title column and requires explicit confirmation to remove any other column. A read-scoped token calling any write tool gets an explicit error instead of silently failing.

### Audit trails and trust

If an agent is going to write to your workspace unattended, you want a record of exactly what it changed and when. Notion's workspace audit log is restricted to the Enterprise plan and lives in a human-facing admin panel, it is not documented as something an MCP client can query directly.

Remnus stamps every agent write with the token that made it (`agent_token_id`) and a timestamp (`agent_edited_at`), and that full history is queryable on every plan, including Free, through the `query_audit_log` MCP tool itself. An agent, or the human supervising it, can ask "what changed in the last hour" without leaving the MCP session.

### Self hosting and licensing

Notion is closed source and cloud only. There is no self-hosted option at any price.

Remnus is released under AGPL-3.0. Anyone can self-host the official code for free, modify it, and run it privately. The one thing the license prevents is taking a modified version, running it as a competing hosted service, and keeping those modifications closed. For a workspace that stores your notes and hands write access to AI agents, being able to read the code and run it yourself is not a small detail.

## Who should pick which

Pick Notion if you want the most mature all-purpose workspace available: deeper database views, cross-database relations and rollups, real-time multiplayer editing, native offline mobile apps, a 30,000-template marketplace, and a long list of pre-built integrations. Its MCP connector handles the case where a person is present and occasionally delegates a search or edit to an agent perfectly well.

Pick Remnus if the AI agent is doing most of the work rather than occasional assistance: you want it to operate on the workspace unattended through a scoped token with no login screen, need database row level writes rather than whole-page edits, want the full MCP surface without hitting a plan wall, want a queryable audit trail of every agent action from day one, or want the option to self-host under an open license. Just go in knowing you are trading Notion's editor depth, view types, relations, offline mobile support, template library, and integration catalog for that.

Neither answer is wrong. They are built for different moments: one for a human working alongside an agent inside a mature product, the other for an agent working largely on its own inside a younger, smaller one, with a human reviewing the results afterward.

---

For the architectural reasoning behind building MCP in from the start rather than adding it later, read [MCP-Native vs MCP-Integrated](/docs/mcp-native-vs-integrated). Comparing self-hosted or local-first options instead? See [Remnus vs AppFlowy](/docs/remnus-vs-appflowy), [Remnus vs AFFiNE](/docs/remnus-vs-affine), and [Remnus vs Obsidian](/docs/remnus-vs-obsidian). To see the tool surface in action, connect an agent from the AI Agents panel in your workspace settings.
