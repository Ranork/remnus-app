# Remnus vs AFFiNE: Full Comparison

If you're weighing self-hostable, open source Notion alternatives, AFFiNE and Remnus both show up quickly: documents, structured databases, and (on AFFiNE's side) an infinite whiteboard canvas. What splits them is what happens once you want an AI agent to actually operate on that workspace. We pulled every number below straight from AFFiNE's own docs, pricing page, and GitHub repo, and from Remnus's own source code, rather than relying on memory or marketing copy.

Full disclosure up front: we're the team behind Remnus. Wherever AFFiNE is simply the better product, that's stated plainly below, not buried.

**Short version:** AFFiNE is the more mature everyday workspace today, with more database view types, a genuinely offline-first design on desktop and mobile, and a much larger community. But self-hosting AFFiNE at real team scale is not entirely free: a workspace is capped at 10 seats without a paid Team license, even on your own infrastructure. Remnus is smaller and newer, but its MCP server is fully first-party, and self-hosting it has no seat cap tied to a commercial license. Sources and details for both sides are below.

## What each product actually is

AFFiNE is a mature open source workspace built by toeverything, combining documents, structured databases, and an infinite whiteboard canvas in one app. It has crossed roughly 70,000 GitHub stars, runs natively on Windows, macOS, Linux, iOS, and Android, and is genuinely offline-first: it was designed from the start to work without a connection and sync when you reconnect, on every platform including mobile.

Remnus takes the opposite starting point. Instead of a mature editor that later grew an AI assistant, it was built so an agent has the same standing as a human from the first commit: a first-party MCP server sits alongside the web app, and 19 tools cover the same pages and database rows a person sees in the UI, not a cut-down subset.

## The everyday workspace

On day-to-day basics, AFFiNE is ahead in real, specific ways:

- **Database views:** AFFiNE supports table, kanban, gallery, list, and grid views on the same data, five types against Remnus's three (table, kanban, calendar)
- **Relations and rollups:** neither product has shipped this yet. AFFiNE's maintainers confirmed in June 2026 that relation and rollup columns are accepted for the next major version (0.28); Remnus's column types don't include them either, with no shipped date yet
- **Offline mode:** AFFiNE is offline-first by architecture on desktop and mobile alike; Remnus's apps are online-first
- **Scale and maturity:** roughly 70,000 GitHub stars and years of releases against a much younger Remnus

Those are real advantages and we're not going to pretend otherwise. Remnus is still early and ships changes constantly rather than on a slow release cadence, so this list is a photograph of today, not a permanent scoreboard. It's also not where we've put our effort so far, which brings us to the actual point of difference.

## Where Remnus is built differently: the AI agent side

Here is where the two products stop looking alike.

### Side by side

| Feature | AFFiNE | Remnus |
|---|---|---|
| Database view types | 5 (table, kanban, gallery, list, grid) | 3 (table, kanban, calendar) |
| Cross-database relations/rollups | Not shipped yet, confirmed planned for version 0.28 | Not currently |
| Native offline mode | Yes, offline-first by architecture, desktop and mobile | Online-first apps, no full offline editing yet |
| Native MCP server (agent connects in) | No, tracking issues for API/MCP support have been closed or marked duplicate with no shipped first-party server | Yes, first-party, 19 tools |
| Unofficial/community MCP access | A third-party server (`affine-mcp-server` by an independent developer) wraps AFFiNE's collaboration APIs, not maintained by the core team | Not applicable |
| Bearer token / PAT auth for agents | Not documented | Yes, scoped `rmns_` personal access tokens, expiry optional, instantly revocable |
| OAuth 2.1 with PKCE for editors | Not documented | Yes |
| Agent-queryable audit trail | Not documented | Yes, every write stamped and queryable via the `query_audit_log` MCP tool, on every plan |
| Self hosting seat limit | Capped at 10 seats per workspace without a paid Team license, even on your own infrastructure | No seat cap tied to the license; self-host as many seats as your own server can handle |
| License | Editor client is MIT; the underlying data engine (OctoBase) is AGPL v3; a separate commercial Team/Enterprise license governs larger self-hosted deployments | AGPL-3.0, one license, no seat-gated commercial tier for self-hosting |
| Base pricing (managed cloud) | Free: 3 members, 10 GB storage, 7-day version history, no AI. Pro: $6.75/month billed annually, 10 members, 100 GB storage, 30-day history. Team: $10/seat/month (10+ seats), unlimited members. AI add-on: $8.90/month billed annually, separate from all plans | Free $0, Startup $10/month flat, Professional $29/month flat (not per seat), Enterprise custom |

### AFFiNE does not have a native MCP server either

AFFiNE's own community has asked for this directly and repeatedly. A GitHub issue proposing native MCP support so AFFiNE could "connect with external data sources and AI workflows through standardized server connections" was closed and marked untriaged, with no visible maintainer commitment to a timeline. An earlier, related issue was closed as a duplicate of that one. Neither issue shows a shipped first-party MCP server as a result. AFFiNE's own README does not describe native MCP integration as a current capability.

What exists today is a third-party project, `affine-mcp-server`, built and maintained by an independent developer rather than the AFFiNE team, which wraps AFFiNE's document, database, and comment APIs into an MCP tool surface over stdio or HTTP. It is a real and apparently capable project, but it is not first-party, and its authentication, rate limits, and long-term maintenance are whatever that one maintainer implements and sustains.

Remnus skipped that middle step entirely. There was never a version without an MCP server: it shipped with the product from the start, covering 19 tools (9 read, 10 write) plus 5 resource templates and 7 prompt templates, built and kept in sync by the same team and the same codebase, not handed off to a separate community wrapper.

### Authentication and headless agents

With no official inbound MCP server, AFFiNE simply has nothing first-party to describe here: no bearer token format, no scopes, no published rate limit. Whoever runs the community wrapper decides all of that on their own.

Remnus gives you a choice of two paths, both maintained by the same team that ships the product. OAuth 2.1 with PKCE covers editors that want a one-click connect while a person is at the keyboard. Scoped personal access tokens, prefixed `rmns_`, cover everything else: no login screen, an optional expiry date, instant revocation, and a published limit of 60 requests per minute per token.

### Pricing and the self-hosting seat cap

AFFiNE's managed cloud runs Free (3 members, 10 GB, 7-day version history, no AI) through Pro ($6.75/month billed annually, 10 members, 100 GB, 30-day history) to Team ($10/seat/month, 10+ seats, unlimited members). An AI add-on runs $8.90/month billed annually on top of any of them. The Believer plan is a one-time $499.99 for lifetime personal Pro access plus 1 TB.

The detail worth pausing on is self-hosting. AFFiNE's self-hosted Community Edition is free, but a workspace is automatically capped at 10 seats and 10 AI/copilot actions per user. Growing a self-hosted workspace past 10 seats requires purchasing AFFiNE's commercial Team license, the same $10/seat/month as the managed cloud tier, even though you are running the software on your own server. That is a meaningfully different model from a single-license open source project: self-hosting removes the AFFiNE-hosting cost, but not the per-seat licensing cost once you scale past a small team.

Remnus prices flat per workspace owner rather than per seat on its managed cloud (Free $0, Startup $10/month, Professional $29/month, Enterprise custom), and self-hosting the AGPL-3.0 codebase has no seat cap tied to any commercial license at all. Run it for 5 people or 500 on your own infrastructure and the license does not charge you differently either way.

### Audit trails

Every write Remnus makes on an agent's behalf is stamped with which token did it and when, and that history is queryable on the spot through the `query_audit_log` MCP tool, no matter which plan you're on. AFFiNE doesn't have a documented equivalent, which isn't really surprising: without a native inbound MCP server, there's no first-party agent write path to keep a log of in the first place.

## Who should pick which

Pick AFFiNE if you want a more mature workspace with more database view types, a document-and-whiteboard combination Remnus doesn't offer, a genuinely offline-first experience on every platform including mobile, and you don't currently need an external AI agent connecting into your workspace over MCP. Just budget for the Team license if your self-hosted workspace grows past 10 seats.

Pick Remnus if you specifically want a first-party MCP server: scoped tokens with no login screen for headless agents, database row level writes, a queryable audit trail of every agent action on the free tier, and a self-hosting model where the license itself never charges you more as your team grows. Go in knowing you are trading AFFiNE's extra view types, whiteboard, and offline maturity for that.

Neither answer is wrong. AFFiNE is the more finished workspace today; Remnus is the one built specifically so an agent can operate on it unattended, with nothing about that story gated behind a paid tier.

---

Curious why we built MCP in on day one instead of adding it later? That reasoning is laid out in [MCP-Native vs MCP-Integrated](/docs/mcp-native-vs-integrated). We've run the same comparison against [Notion](/docs/remnus-vs-notion-mcp), [AppFlowy](/docs/remnus-vs-appflowy), and [Obsidian](/docs/remnus-vs-obsidian) too, if you want the fuller picture. Or skip straight to it: connect an agent from the AI Agents panel in your workspace settings and watch the tools work.
