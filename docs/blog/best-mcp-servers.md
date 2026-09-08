# Best MCP Servers for Claude Code, Cursor, and Codex

*This article is published by Remnus. Remnus is included in the comparison below, in the Memory and workspace category, using the same verification standard applied to every other entry — it is not placed first or scored more favorably because we wrote it.*

The Model Context Protocol (MCP) turned "connect my AI agent to a real system" from a bespoke integration into a standard client-server contract. In under two years that standard produced hundreds of servers of wildly different quality: some are official, funded, and actively maintained; others were demo code someone pushed once and never touched again. Picking the wrong one costs more than wasted setup time — a local server runs with your machine's privileges, and a remote one holds a token that can read or write real data.

This guide covers MCP servers that are worth evaluating today, organized by what they connect to, with the verification details you need to make your own call rather than trust a marketing page.

**Research date: this article was researched and verified in September 2026**, against each project's official repository or documentation. MCP client compatibility, pricing, and maintenance status change quickly — check the official link before you install, not this table.

## Methodology

Every server listed here was checked against its official GitHub repository, official documentation site, or official vendor page — never a mirrored, forked, or third-party aggregator listing. For each one we verified, as of the research date:

- **Maintenance activity** — recent commits, releases, or documented ongoing development, not a single initial commit followed by silence.
- **Licensing** — what license the code ships under, or, for a hosted-only service, what the access/pricing model is.
- **Authentication** — how a client proves who it is (OAuth, API key/token, local credential, or none).
- **Deployment type** — whether it runs locally (stdio, on your machine, your privileges) or remotely (hosted, over HTTP, a provider's infrastructure).
- **Supported clients** — MCP is a standard, so most servers work with any compliant client (Claude Code, Cursor, Codex CLI, Windsurf, and others); we note it only when a server is unusually client-specific.

We excluded projects that showed no meaningful commit activity, carried no clear license or ownership, or that we could not verify against an original source. We did not accept or apply payment to influence inclusion or ranking, and none of the entries below are affiliate links. Where a number (stars, downloads, pricing) isn't something we could verify precisely at research time, we describe it qualitatively instead of guessing — treat every specific figure you see elsewhere as a snapshot that may already be stale by the time you read it.

## Quick comparison table

| Server | Category | Local / Remote | Auth | License / pricing |
| --- | --- | --- | --- | --- |
| [GitHub MCP Server](https://github.com/github/github-mcp-server) | Code repositories | Both | OAuth, PAT, GitHub App | MIT (free) |
| [Git (reference server)](https://github.com/modelcontextprotocol/servers) | Code repositories | Local only | None (local filesystem) | MIT/Apache-2.0 (free) |
| [Playwright MCP](https://github.com/microsoft/playwright-mcp) | Browser automation | Both | None built in | Apache-2.0 (free) |
| [Firecrawl MCP](https://github.com/mendableai/firecrawl-mcp-server) | Browser automation | Both | API key or OAuth | MIT + hosted credit plans |
| [Postgres MCP Pro](https://github.com/crystaldba/postgres-mcp) | Databases | Both | DB connection URI | MIT (free) |
| [Supabase MCP](https://github.com/supabase-community/supabase-mcp) | Databases | Both | OAuth 2.1 | Apache-2.0 (free) |
| [Context7](https://github.com/upstash/context7) | Documentation | Both | API key (free tier) | MIT + hosted free tier |
| [Filesystem (reference server)](https://github.com/modelcontextprotocol/servers) | File systems | Local only | None (OS permissions) | MIT/Apache-2.0 (free) |
| [Sentry MCP](https://github.com/getsentry/sentry-mcp) | Monitoring | Both | OAuth or API token | Source-available + hosted |
| [Grafana MCP](https://github.com/grafana/mcp-grafana) | Monitoring | Both | Service account token | Apache-2.0 (free) |
| [Memory (reference server)](https://github.com/modelcontextprotocol/servers) | Memory and workspace | Local only | None | MIT/Apache-2.0 (free) |
| [Remnus MCP](https://remnus.com) | Memory and workspace | Remote (self-hostable) | OAuth or PAT | AGPL-3.0 + hosted plans |
| [Linear MCP](https://linear.app/docs/mcp) | Project management | Remote | OAuth 2.1, API key | Free with Linear account |
| [Notion MCP](https://github.com/makenotion/notion-mcp-server) | Project management | Both | Integration token, OAuth | MIT + Notion pricing |

## Code repositories

### GitHub MCP Server

- **Best for:** teams already living in GitHub who want an agent to triage issues, open PRs, or inspect CI runs without leaving the editor.
- **Main capabilities:** repository browsing and code search, issue and pull request automation, GitHub Actions workflow and log access, code scanning and Dependabot alerts, notifications.
- **Local or remote:** both — GitHub hosts a remote endpoint at `api.githubcopilot.com/mcp/`, and the same server runs locally via Docker or a native binary over stdio.
- **Authentication:** OAuth for interactive use, personal access tokens or GitHub App credentials for unattended jobs; supports GitHub Enterprise.
- **License / pricing:** MIT, free and open source.
- **Important limitation:** the tool surface is large (100+ tools across toolsets); enable only the toolsets a given agent needs rather than granting everything by default.
- **Official link:** [github.com/github/github-mcp-server](https://github.com/github/github-mcp-server)

### Git (reference server)

- **Best for:** local repository inspection — reading history, diffing, and searching — without exposing anything beyond the filesystem you already have access to.
- **Main capabilities:** read, search, and manipulate a local Git repository (log, diff, blame, branch listing).
- **Local or remote:** local only, stdio.
- **Authentication:** none — it inherits whatever filesystem permissions the process already has.
- **License / pricing:** MIT/Apache-2.0 depending on file, free.
- **Important limitation:** maintained as a reference implementation, not a production hardened service — scope it to a specific repo path rather than a broad filesystem root.
- **Official link:** [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)

## Browser automation

### Playwright MCP (Microsoft)

- **Best for:** agents that need to drive a real browser — filling forms, clicking through flows, or verifying a UI change actually works.
- **Main capabilities:** structured accessibility-tree page snapshots (not screenshots), element interaction, network inspection and mocking, storage state management, video/trace recording, PDF generation.
- **Local or remote:** both — runs locally over Node.js/Docker, or as a standalone HTTP service with a `--port` flag for remote connections.
- **Authentication:** none built in — the project's own documentation is explicit that this "is not a security boundary," so treat any remote deployment as something to put behind your own network controls.
- **License / pricing:** Apache-2.0, free.
- **Important limitation:** because it can execute arbitrary page interactions, an untrusted remote deployment is a real risk; run it locally or behind access control you own.
- **Official link:** [github.com/microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)

### Firecrawl MCP

- **Best for:** research and data-collection agents that need to crawl, scrape, and search the open web at scale, not just drive one browser session.
- **Main capabilities:** single-page extraction with schema support, site crawling and URL discovery, web search with content fetching, page automation, and scheduled change monitoring.
- **Local or remote:** both — a hosted endpoint with a keyless free tier, and a self-hostable open-source server.
- **Authentication:** API key, or OAuth access tokens for the hosted service.
- **License / pricing:** MIT for the server; the hosted service runs on a credit-based plan.
- **Important limitation:** heavy crawling against third-party sites can trip rate limits or terms-of-service issues — check the target site's policies before pointing an autonomous crawl at it.
- **Official link:** [github.com/mendableai/firecrawl-mcp-server](https://github.com/mendableai/firecrawl-mcp-server)

## Databases

### Postgres MCP Pro

- **Best for:** developers who want an agent to help tune and debug an existing PostgreSQL database — index health, query plans, connection and vacuum stats — not just run arbitrary SQL.
- **Main capabilities:** database health analysis, index tuning recommendations, `EXPLAIN` plan analysis, workload analysis, and role-scoped SQL execution.
- **Local or remote:** both — Docker or a Python install, supporting stdio and SSE transports.
- **Authentication:** a standard PostgreSQL connection URI; the server supports an unrestricted mode for development and a restricted read-only mode for production.
- **License / pricing:** MIT, free and open source.
- **Important limitation:** the safety boundary is the connection role you give it — a URI with write privileges gives the agent write privileges, so use a dedicated read-only role against production data.
- **Official link:** [github.com/crystaldba/postgres-mcp](https://github.com/crystaldba/postgres-mcp)

### Supabase MCP

- **Best for:** teams already on Supabase who want an agent that understands both the underlying Postgres database and Supabase-specific project configuration.
- **Main capabilities:** table and schema management, data querying, project configuration access, and a companion PostgREST server for REST API connectivity.
- **Local or remote:** both — a cloud-hosted endpoint, and a local CLI-based server for self-hosted or local development environments.
- **Authentication:** OAuth 2.1 for the cloud-hosted server, with an organization selection step during setup.
- **License / pricing:** Apache-2.0, free.
- **Important limitation:** default scope can span an entire Supabase organization; restrict it to a single project before connecting an autonomous agent.
- **Official link:** [github.com/supabase-community/supabase-mcp](https://github.com/supabase-community/supabase-mcp)

## Documentation

### Context7 (Upstash)

- **Best for:** stopping an agent from writing against an outdated or hallucinated version of a library's API — a common failure mode when a model's training data predates a library's current release.
- **Main capabilities:** resolves a library name to a versioned documentation ID, then retrieves current, version-specific docs and code examples directly into the agent's context.
- **Local or remote:** both — a cloud-hosted endpoint, and an open-source server you can self-host.
- **Authentication:** a free API key for the hosted service; OAuth-based setup is also available via its CLI.
- **License / pricing:** MIT, with a free tier on the hosted service.
- **Important limitation:** coverage depends on a library being indexed — very new, obscure, or private packages may not have documentation available yet.
- **Official link:** [github.com/upstash/context7](https://github.com/upstash/context7)

## File systems

### Filesystem (reference server)

- **Best for:** giving an agent read/write access to a specific local directory — project files, a scratch folder, a build output — without exposing the rest of the machine.
- **Main capabilities:** read, write, move, and search files and directories within a configured allow-list of paths.
- **Local or remote:** local only, stdio.
- **Authentication:** none — access is governed by which directories you explicitly allow at startup, plus normal OS file permissions.
- **License / pricing:** MIT/Apache-2.0, free.
- **Important limitation:** it is a reference implementation, not a hardened sandbox; always pass an explicit, narrow allow-list rather than a home directory or drive root.
- **Official link:** [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)

## Monitoring

### Sentry MCP

- **Best for:** letting an agent pull real error and performance data into a debugging session instead of asking you to paste a stack trace by hand.
- **Main capabilities:** natural-language search across events, issues, and performance traces; translates queries into Sentry's query syntax; integrates with Sentry's Seer analysis tooling depending on deployment.
- **Local or remote:** both — a hosted production service, and a local stdio server that also supports self-hosted Sentry installations.
- **Authentication:** OAuth for the hosted service, or a Sentry auth token scoped to specific permissions (e.g. `org:read`, `project:read`) for local/self-hosted use.
- **License / pricing:** source-available under the terms in the project's own `LICENSE.md`; usable against both Sentry's hosted product and self-hosted Sentry.
- **Important limitation:** scope the auth token narrowly — Sentry organizations often hold sensitive stack traces and user context that shouldn't flow into a broadly-shared agent session.
- **Official link:** [github.com/getsentry/sentry-mcp](https://github.com/getsentry/sentry-mcp)

### Grafana MCP

- **Best for:** teams whose observability stack is centered on Grafana and want an agent that can query dashboards, datasources, alerts, and on-call schedules in one place.
- **Main capabilities:** dashboard search and updates, querying Prometheus/Loki/Elasticsearch and other connected datasources, alert rule and silence management, Grafana Incident and OnCall integration, image rendering.
- **Local or remote:** both — a local binary, Docker, or `uvx`, or a remote deployment via Kubernetes/Helm using SSE or streamable HTTP.
- **Authentication:** Grafana service account tokens (recommended), username/password, or mTLS for networked deployments.
- **License / pricing:** Apache-2.0, free.
- **Important limitation:** over 100 tools exist, but higher-risk ones (ClickHouse, CloudWatch, admin/user management) are disabled by default — leave them off unless a specific workflow needs them.
- **Official link:** [github.com/grafana/mcp-grafana](https://github.com/grafana/mcp-grafana)

## Memory and workspace

### Memory (reference server)

- **Best for:** a minimal, local knowledge graph an agent can write facts to and query later within a single machine or project.
- **Main capabilities:** stores entities, relations, and observations as a simple local knowledge graph; supports basic create/read/search operations over it.
- **Local or remote:** local only, stdio, typically backed by a local JSON file.
- **Authentication:** none.
- **License / pricing:** MIT/Apache-2.0, free.
- **Important limitation:** it's single-machine and single-user by design — nothing here is shared across a team or across devices, and there's no structure beyond a flat entity/relation graph.
- **Official link:** [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)

### Remnus MCP

- **Best for:** teams and individual developers who want a shared, human-readable workspace — pages, databases, tasks — that both people and multiple AI agents read and write over MCP, rather than a memory store only one agent can see.
- **Main capabilities:** full-text and property-filtered search, page and database reads, page/database/row creation and updates, bulk updates, an audit log, and a context-preparation tool (`prepare_context`) that assembles task-relevant context instead of dumping a whole workspace into a prompt.
- **Local or remote:** remote by default (`www.remnus.com/api/mcp`, stateless HTTP); the codebase is AGPL-3.0, so self-hosting is possible for teams that want to run their own instance.
- **Authentication:** OAuth 2.1 with PKCE for interactive clients, or personal access tokens for headless/unattended agents; every connection is scoped to `read` or `write` for the whole workspace.
- **License / pricing:** AGPL-3.0 open source, with hosted plans; see [remnus.com/pricing](https://remnus.com/pricing) for current tiers.
- **Important limitation:** the scope model is workspace-wide `read`/`write` rather than per-tool granularity — least-privilege here means choosing which workspace and which scope a token gets, not fine-grained per-table permissions. See the [MCP security guide](/docs/mcp-security-guide) for how to reason about that trade-off.
- **Official link:** [remnus.com](https://remnus.com)

## Project management

### Linear MCP

- **Best for:** engineering teams on Linear who want an agent to read, create, and update issues and projects as part of its normal workflow, without a separate integration to maintain.
- **Main capabilities:** discovering, creating, and updating issues, projects, and comments; a read-only endpoint or scoped OAuth for agents that should only observe.
- **Local or remote:** remote only — centrally hosted and managed by Linear at `mcp.linear.app/mcp`.
- **Authentication:** OAuth 2.1 with dynamic client registration for interactive setup, bearer tokens or Linear API keys for programmatic use, and Okta SAML for enterprise-managed authentication.
- **License / pricing:** free to use with a Linear account; no separate MCP-specific charge documented.
- **Important limitation:** it's remote-only and tied to your Linear account — there's no local/offline mode, and functionality is described as still expanding.
- **Official link:** [linear.app/docs/mcp](https://linear.app/docs/mcp)

### Notion MCP Server

- **Best for:** teams whose project tracking, docs, or wikis already live in Notion and want an agent to search, read, and edit that content directly.
- **Main capabilities:** querying databases and data sources, creating and updating pages, searching workspace content, and converting page content to and from Markdown.
- **Local or remote:** both — a local server via npm or Docker, or Notion's official remote server with OAuth.
- **Authentication:** Notion integration tokens for direct API access, or OAuth for the hosted remote server; bearer-token passthrough is supported for multi-tenant deployments.
- **License / pricing:** MIT for the server; usage is governed by your Notion plan and API limits.
- **Important limitation:** the server underwent a significant tool-schema migration to Notion's data-source-centric API — pin a version and re-test after upgrading rather than assuming tool names stay stable across releases.
- **Official link:** [github.com/makenotion/notion-mcp-server](https://github.com/makenotion/notion-mcp-server)

## How to choose an MCP server

There's no universal "best" — the right server depends on what you're optimizing for:

- **Match the category to the actual bottleneck.** If your agent keeps writing against a library API that changed six months ago, that's a documentation problem (Context7), not a code-repository or database problem. Add servers one category at a time, tied to a concrete failure you've actually hit.
- **Local vs. remote is a risk decision, not just a convenience one.** A local server runs with your machine's privileges and can read anything the process can read; a remote server runs on someone else's infrastructure and holds a token that can act on your behalf. Browser automation and filesystem access are usually safer local-only; things you already trust a vendor with (GitHub, Sentry, Linear) are reasonable to use remote.
- **Check who issues the credential and how narrow it can be scoped.** A server that supports read-only scopes or a dedicated low-privilege role (Postgres MCP Pro's read-only mode, Linear's read-only endpoint, Remnus's `read` scope) lets you give an exploratory agent access without also giving it a delete button.
- **Prefer official servers from the platform owner when one exists**, over a third-party reimplementation of the same integration — an official server tracks the underlying API's changes and gets a security response if something breaks.
- **Confirm client compatibility before you commit**, especially for anything beyond the big three clients. MCP is a standard, but individual clients differ in which transport types (stdio, SSE, streamable HTTP) and auth flows they support, and that support changes over time — check the client's own current docs, not a list like this one.

## Security checklist before installation

MCP servers are tools with real permissions, not sandboxed chat plugins — treat installing one with the same care as installing a browser extension or a CLI you're granting shell access to.

- **Confirm the source.** Install from the official repository or vendor page, not a search result, a forum link, or a copied fork. Check who maintains it and whether it has a real commit history.
- **Read what scopes or tokens it asks for**, and grant the narrowest one that does the job — a read-only token or role wherever the server offers one.
- **Know whether it's local or remote**, and what that implies: local servers inherit your machine's privileges; remote servers hold a credential to a real system on your behalf.
- **Check for a security policy or documented threat model.** Servers that discuss their own risk surface (as Playwright MCP's docs do, for example) are telling you something true, not something to dismiss.
- **Never hardcode a token or API key into a config file you might commit** — use your OS keychain, a secrets manager, or environment variables kept out of version control.
- **Require human confirmation for destructive actions** — deletes, force-pushes, bulk updates, production writes — either through the server's own settings or your client's approval flow, rather than letting an agent execute them unattended.
- **Review the audit trail, if one exists**, after connecting a new server for the first time, so a mistake in the first session is caught early rather than discovered later.

For the fuller threat model — malicious servers, prompt injection, excessive permissions, credential leakage — see the [MCP security guide](/docs/mcp-security-guide).

## Recommended example stacks

These are starting points, not prescriptions — add or drop servers based on which categories above map to your actual workflow.

**Solo developer**

- GitHub MCP Server (local, stdio) — code and PR context
- Context7 — current library documentation
- Filesystem (reference server), scoped to the current project directory
- Postgres MCP Pro in read-only mode, if the project has a database

**Small team**

- GitHub MCP Server (remote, hosted) — shared repo access across teammates
- Linear MCP or Notion MCP — wherever the team already tracks work
- Sentry MCP — shared error visibility during debugging sessions
- Remnus MCP or another shared workspace server — durable, human-and-agent-readable project context that outlives any one chat session

**Self-hosted / privacy-conscious**

- Git and Filesystem reference servers (local, stdio, no network exposure)
- Postgres MCP Pro against a self-hosted database, restricted role
- A self-hosted Sentry instance with Sentry MCP's local stdio mode
- A self-hosted Remnus instance (AGPL-3.0) for shared workspace and agent memory without a third-party hosting the data

## FAQ

**Is MCP itself safe?**
MCP is a protocol, not a guarantee — safety depends entirely on which servers you connect and what scopes you grant them. Treat the protocol as neutral infrastructure and evaluate each server on its own merits.

**Can I use more than one MCP server at once?**
Yes — Claude Code, Cursor, and Codex CLI all support connecting multiple MCP servers simultaneously, and the example stacks above assume you will.

**Do all MCP servers work with all clients?**
Most do, since MCP is a shared standard, but transport support (stdio vs. SSE vs. streamable HTTP) and auth flow support vary by client and change over time. Check the client's current documentation before assuming compatibility.

**Is a local server always safer than a remote one?**
Not automatically. A local server runs with your machine's own privileges, which is dangerous if the server itself is untrustworthy; a remote server is only as safe as the provider operating it and the scope of the token you give it. Neither category is inherently safer — the specific server and how narrowly you scope it matter more than local vs. remote alone.

**How often should I re-check a server I already installed?**
Whenever the client or the server publishes a major version change, and periodically for anything holding a long-lived credential — maintenance can slow down or stop after you've already integrated a tool.

## Closing

The MCP ecosystem is still young enough that "actively maintained" and "official" are doing a lot of the filtering work — most of the risk isn't in the protocol, it's in which specific server you point a capable agent at, and how much you let it do once connected. Start from the category that maps to your actual bottleneck, prefer the official source, scope credentials narrowly, and revisit the list periodically rather than treating any single setup as permanent. If a shared, agent-and-human-readable workspace is one of the gaps in your own stack, that's the problem [Remnus](https://remnus.com) is built around — worth a look alongside whatever else ends up on your list.
