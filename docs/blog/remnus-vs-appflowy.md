# Remnus vs AppFlowy: Full Comparison

AppFlowy and Remnus are both open source, both AGPL-3.0, and both self-hostable Notion-style workspaces with grid, board, and calendar views. That overlap is exactly why people ask how they compare. This is a fact based look at both halves: the everyday workspace, and how each one actually connects to an AI agent. Every claim below comes from AppFlowy's own docs, pricing page, and GitHub repo, or from Remnus's own source code, checked at the time of writing.

We built Remnus, so we are not a neutral party here. Where AppFlowy is simply ahead, we say so directly.

**Short version:** AppFlowy is the more mature everyday workspace today (deeper database relations, a properly local-first offline mode, a bigger community). Remnus is the one with a first-party MCP server: AppFlowy still has no official way for an external AI agent to connect in and read or write your workspace, only an open feature request and unofficial community wrappers. The rest of this page backs both halves of that with sources.

## What each product actually is

AppFlowy is a mature open source Notion alternative built with Rust and Flutter, which gives it genuine cross-platform reach and a local-first architecture from day one. It has crossed roughly 70,000 GitHub stars, ships new releases every two to three weeks, and has its own built-in AI chat assistant for writing, summarizing, and working with database content.

Remnus is a younger, smaller open source workspace built around a different bet: that an AI agent should be a first-class user of the workspace, not just a chat assistant bolted onto the editor. Every page and database row is reachable through the same 14 MCP tools whether a human clicks through the UI or an agent calls the API.

## The everyday workspace

On day-to-day basics the two are closer than you might expect:

- **Database views:** both offer 3 types, AppFlowy's Grid/Board/Calendar versus Remnus's table/kanban/calendar, so there is no real gap here
- **Relations and rollups:** AppFlowy has a Relation field type for linking rows across databases plus a Rollup property to aggregate that data; Remnus does not yet
- **Offline mode:** AppFlowy is local-first by architecture on both desktop and mobile; Remnus's apps are online-first
- **Templates and maturity:** AppFlowy's community template gallery and multi-year release history are larger than a newer project can match yet

None of that is a small gap, and it would be dishonest to wave it away. Remnus is a new project under active, continuous development, not a finished product competing feature for feature with a five-year-old codebase, so treat this as a snapshot rather than a fixed ranking. It is also not the part we built Remnus around, which is the section below.

## Where Remnus is built differently: the AI agent side

This is the actual fork in the road, and it is a bigger one than the workspace features above.

### Side by side

| Feature | AppFlowy | Remnus |
|---|---|---|
| Database view types | 3 (Grid, Board, Calendar) | 3 (table, kanban, calendar) |
| Cross-database relations/rollups | Yes | Not currently |
| Native offline mode | Yes, local-first by architecture | Online-first apps, no full offline editing yet |
| Native MCP server (agent connects in) | No, an open feature request (GitHub issue #8043, opened June 2025) remains unresolved | Yes, first-party, 19 tools |
| MCP client (workspace connects out to other tools) | Yes, AppFlowy's own AI assistant can call external MCP servers | Not applicable, Remnus is built to be the server agents connect to |
| Unofficial/community MCP access | Third-party wrappers (e.g. on Zapier, PulseMCP) exist around the AppFlowy Cloud REST API, not maintained by the core team | Not applicable |
| Works with the offline desktop app | No, community MCP wrappers need AppFlowy Cloud; the local desktop database isn't API accessible | Not applicable, Remnus is cloud native |
| Bearer token / PAT auth for agents | Not documented | Yes, scoped `rmns_` personal access tokens, expiry optional, instantly revocable |
| OAuth 2.1 with PKCE for editors | Not documented | Yes |
| Agent-queryable audit trail | Not documented | Yes, every write stamped and queryable via the `query_audit_log` MCP tool, on every plan |
| Self hosting | Yes, both the client and the AppFlowy Cloud sync server are open source | Yes |
| License | AGPL-3.0 | AGPL-3.0 |
| Base pricing (managed cloud) | Free: 2 members, 5 GB storage, 10 AI responses/month, 2 AI images/month. Pro: $10/user/month billed annually ($12.50 monthly), up to 50 members, unlimited storage and AI responses. AI MAX add-on $8/user/month, Vault (local AI) add-on $6/user/month | Free $0, Startup $10/month flat, Professional $29/month flat (not per seat), Enterprise custom |

### AppFlowy does not have a native MCP server yet

This is the headline difference, and it is worth being precise about it because AppFlowy's own AI features can make it look like more is there than actually is.

AppFlowy has built AI directly into its editor: an AI chat assistant, writing help, and support for models including GPT-5, Gemini 2.5 Pro, and Claude 3.7 Sonnet, plus a local-AI option through Ollama for privacy. That assistant can also act as an MCP *client*, meaning it can reach out and call other MCP servers on your behalf, similar in direction to Notion's Custom Agents. What it does not have, as of this writing, is the reverse: a first-party MCP *server* that lets an external client like Claude Desktop or Cursor connect in and read or write your AppFlowy workspace directly. The GitHub issue requesting exactly that (opened June 2025, tagged for 2026) is still open with no shipped timeline.

There are community-built MCP servers that wrap the AppFlowy Cloud REST API (listed on directories like PulseMCP and Zapier's MCP catalog), built by individual contributors rather than the AppFlowy team. They also only work against AppFlowy Cloud, since the plain offline desktop app keeps notes in a local binary format that isn't reachable over an API at all.

Remnus was built the opposite way: the MCP server is the first-party interface, live from the start, with 19 tools split 9 read and 10 write, plus 5 resource templates and 7 prompt templates, maintained by the same team that builds the product.

### Authentication and headless agents

Because AppFlowy has no official inbound MCP server, there is no first-party answer for how an unattended agent would authenticate to one, no documented bearer token scheme, no scope model, and no rate limit to describe. Whatever exists today is whatever a specific community wrapper implements on its own.

Remnus ships two supported paths out of the box: OAuth 2.1 with PKCE for editors that want one-click connect with a person present, and scoped personal access tokens (prefixed `rmns_`) for headless use, no login screen required, expiry optional, revocable instantly, and rate limited at 60 requests per minute per token.

### Pricing: what AppFlowy's tiers actually gate

AppFlowy's Free plan covers 2 members, 5 GB storage, 10 AI chat responses and 2 AI images a month. Pro is $10 per user per month billed annually (or $12.50 billed monthly), covering up to 50 members, unlimited storage, and unlimited AI responses. Two add-ons layer on top: AI MAX at $8/user/month unlocks larger models and unlimited image generation, and Vault at $6/user/month runs AI locally for privacy. All of that pricing is about AppFlowy's own built-in AI assistant, since there is no native MCP surface to meter separately.

Remnus prices flat per workspace owner rather than per seat: Free at $0, Startup at $10 a month, Professional at $29 a month, Enterprise custom. The full 14-tool MCP surface works identically on every tier, Free included. For a 5-person team, that is a flat $10 or $29 a month on Remnus against AppFlowy Pro's per-seat $50-62.50 a month for the same headcount, though the two products are not charging for the same thing: AppFlowy's price buys a mature editor and built-in AI chat, Remnus's buys agent seats and MCP capability on top of a newer editor.

### Audit trails

Remnus stamps every agent write with the acting token and a timestamp, queryable directly through the `query_audit_log` MCP tool on every plan. We could not find documentation of an equivalent agent-specific audit trail for AppFlowy, which follows naturally from not having a native inbound MCP server to audit in the first place.

### Self hosting and licensing: a genuine tie

This is the one category where we are not claiming an advantage. AppFlowy and Remnus are both released under AGPL-3.0, and both can be fully self-hosted, client and sync server alike, without paying either project anything. AppFlowy has the larger, longer-running open source community behind that license today. If self-hostability and copyleft licensing are your deciding factor, both products satisfy it equally.

## Who should pick which

Pick AppFlowy if you want a more mature editor, a properly local-first offline experience on every platform, cross-database relations and rollups, and a built-in AI chat assistant, and you do not currently need an external AI agent to read and write your workspace over MCP.

Pick Remnus if you specifically want an agent to operate on your workspace through a real first-party MCP server: scoped tokens with no login screen for headless use, database row level writes, a queryable audit trail of every agent action, and all of that available on the free tier. Go in knowing you are trading AppFlowy's editor maturity, offline architecture, and relation/rollup support for that.

Both are AGPL-3.0 and self-hostable, so this is not an open-source-versus-closed question the way a Notion comparison is. It comes down to whether you need an agent connecting into your workspace today, or a more finished workspace with AI as an in-app assistant.

---

For the architectural reasoning behind building MCP in from the start rather than adding it later, read [MCP-Native vs MCP-Integrated](/docs/mcp-native-vs-integrated). Curious how Remnus stacks up against a closed-source workspace, another AGPL one, or a local-first notes app? See [Remnus vs Notion](/docs/remnus-vs-notion-mcp), [Remnus vs AFFiNE](/docs/remnus-vs-affine), and [Remnus vs Obsidian](/docs/remnus-vs-obsidian). To see the tool surface in action, connect an agent from the AI Agents panel in your workspace settings.
