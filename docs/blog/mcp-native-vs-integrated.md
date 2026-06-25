The Model Context Protocol (MCP) is becoming a de facto standard for how AI clients talk to tools and data sources. As more products add MCP support, a vocabulary distinction is emerging that is worth naming clearly: **MCP-integrated** vs **MCP-native**. These are not official terms, but they describe architecturally different things — and the difference matters if you are choosing tooling for an AI-heavy workflow.

## MCP-Integrated: Bolting On After the Fact

An MCP-integrated product is one that was designed for human use first, then gained MCP support as a feature addition. The product's core data model, permission system, and API surface were not designed with machine access in mind. MCP was added later — typically as a thin wrapper around existing REST APIs or database queries.

This is how most tools work today. Notion, for example, has an API that a third-party MCP server can wrap. The agent can read pages and update properties. But the data model was designed for a visual editor driven by a human. Some things translate awkwardly: rich block structures become flat text, relational databases lose their relational semantics, permission checks were built for user sessions not bearer tokens with scoped access.

The integration works. You can get data in and out. But the experience often has a seam — you can feel the gap between what a human sees and what an agent gets.

Notion is not a knock here. They built an excellent human-facing product. MCP was not in scope when they designed their architecture, and adding it to an existing system is genuinely hard.

## MCP-Native: Designed for Both from the Start

An MCP-native product treats agent access as a first-class concern from day one. The architecture is designed so that a human using the product and an agent using the product have access to the same capabilities through consistent interfaces.

For Remnus, this meant a few specific decisions:

**The MCP server is part of the application, not a sidecar.** Our MCP endpoint lives at `/api/mcp` alongside the Next.js routes that power the web interface. The same database queries, the same permission checks, the same business logic — no separate sync process, no eventually-consistent shadow store.

**Agent tokens are first-class auth principals.** Bearer tokens issued through the UI have explicit scopes (`read` or `write`), expiry options, and appear in the same audit log as human sessions. An agent token is not a workaround; it is a supported authentication method with its own access control path.

**The schema is designed to be readable by machines.** Workspace items, database schemas, and page properties use structured JSON columns that map cleanly to typed tool responses. When an agent calls `get_database_schema`, it gets back a typed column list with select options, not a blob it needs to parse.

**Every write is audited.** Rows modified by an agent carry an `agent_token_id` stamp and a separate `agent_edited_at` timestamp. The workspace owner can see exactly which token changed which page and when. This matters for trust — knowing what an agent did is as important as knowing what it can do.

## A Concrete Comparison

Suppose you want an agent to triage a backlog: read all open tickets, update their priority based on some criteria, and add a comment summarizing what it did.

**In an MCP-integrated system**, you typically need to:
1. Call a list endpoint to get items (paginated, might be multiple calls)
2. Parse the response format (often more verbose than you need)
3. Call an update endpoint per item (no batch support in most cases)
4. Create a separate comment or page edit (different endpoint, different auth)
5. Handle rate limits independently from your other API usage

**In Remnus**, the same workflow maps directly to MCP tools:
1. `query_database` with filters — cursor-based pagination built in
2. `bulk_update_pages` — sends all property changes in one call
3. `update_page` on the summary page — same tool, consistent interface

The difference is not "Remnus is faster." It is that the MCP surface was designed for *this kind of workflow* rather than retrofitted onto a surface designed for human clicks.

## What This Does Not Mean

MCP-native is not a claim of superiority on every axis. Notion has a decade of refinement in its human-facing interface, a mobile app, a desktop app, and integrations that Remnus does not have yet. For a team that primarily uses Notion as a human tool and occasionally wants an AI assistant to read from it, the MCP-integrated path works fine.

The distinction matters most when your use case is *primarily* agent-driven — when the agent is doing most of the work and the human reviews results, rather than the human doing most of the work and occasionally delegating to an agent. For those workflows, the seams in an MCP-integrated architecture accumulate.

## AppFlowy and the Trajectory

AppFlowy is the closest open source comparison to Remnus — a Notion-like workspace, self-hostable, with a strong community. Their MCP support, at the time of writing, comes through the community rather than the core team and wraps their existing API surface. It works. But the pattern is MCP-integrated.

The difference in trajectory is: as Remnus grows, MCP capabilities grow with the data model. New column types get corresponding filter support in `query_database`. New block types get corresponding read/write coverage in the page tools. There is no separate "MCP team" keeping a wrapper in sync — it is the same codebase.

## Why We Talk About This

We use the term "MCP-native" in our documentation and marketing because we want people evaluating Remnus to understand what they are getting. If your workflow is primarily human-driven with occasional AI assistance, the label does not change much for you. If your workflow involves agents running autonomously against a workspace — reading, writing, triaging, generating — the architectural foundation matters.

The MCP ecosystem is still young. The patterns are still being established. We think "native first" is the right bet: it is easier to make a machine-friendly interface human-friendly than the other way around.

---

If you want to see the MCP surface in action, the [getting started guide](/share/docs/mcp/getting-started) has live tool examples you can run against the demo workspace.
