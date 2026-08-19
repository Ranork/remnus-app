# Remote vs Local MCP Servers: Which Should You Use?

Every Model Context Protocol (MCP) server runs somewhere, and "somewhere" comes down to two shapes: a process your client launches on your own machine, or an independent server your client connects to over the network. The [MCP specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports) calls these **stdio** and **Streamable HTTP** — the two standard transport bindings the protocol defines today. Neither is a strictly better default. They trade off setup effort, who's responsible for security, whether a team shares one deployment or everyone runs their own, and whether the agent doing the work is a person sitting at a laptop or an unattended job in CI. This guide walks through both models, when each one fits, how they combine, and how [Remnus](https://remnus.com) — an open source MCP-native workspace — fits into remote and self-hosted setups specifically.

## What is a local MCP server?

A local MCP server is a process your MCP client launches directly on your machine and talks to over **stdio**: newline-delimited JSON-RPC messages sent over the standard input and output streams of a subprocess the client starts and owns. There's no network hop and, in the base transport, no built-in authentication step — the client trusts the server because the client itself started it. A typical config just names a command and arguments (for example, an `npx` invocation), and the client spawns that process each time it needs the server running.

That trust model is also the main thing to be careful about. The specification's own security guidance is direct on this point: local servers "effectively run with the full privileges of the user" — without proper sandboxing, a malicious startup command or a compromised package can mean arbitrary code execution, and the specification notes a user typically has "no insight into what commands are being executed." A local server is a great fit precisely because it's fast and simple to wire up, but it's only as trustworthy as the code you're running.

Common examples: a filesystem server that reads and writes files in a project directory, a local Git tool, or a database driver connecting to a database running on the same machine. All of these want direct, low-latency access to something already local — a network round trip would add nothing.

## What is a remote MCP server?

A remote MCP server is an independent, long-running process — typically reachable at a single HTTPS URL — that a client connects to instead of launching. The current standard transport for this is **Streamable HTTP**: the server exposes one **MCP endpoint** that accepts `POST` requests, the client sends every JSON-RPC request or notification as its own POST, and the server replies with either a single JSON object or a request-scoped [Server-Sent Events](https://en.wikipedia.org/wiki/Server-sent_events) stream. The server is a separate process capable of handling multiple client connections, which is what makes "remote" and "shared" go together naturally — one deployment, many clients.

Streamable HTTP is a relatively recent name for a transport that has itself evolved. It replaced an earlier **HTTP+SSE** transport from the 2024-11-05 protocol revision, starting with revision 2025-03-26. HTTP+SSE has been formally deprecated ever since; the specification says new implementations "SHOULD NOT adopt it" and marks it eligible for removal in a future revision. If you're reading MCP documentation, a blog post, or a client's changelog that still talks about "HTTP+SSE" as the way to connect a remote server, it's describing the older, deprecated model — Streamable HTTP is what current clients and servers should be using. Remnus's own MCP endpoint, for example, speaks Streamable HTTP at `https://www.remnus.com/api/mcp`, one request per tool call, stateless.

Because a remote server is a standing network service rather than a spawned process, it typically requires real authentication — OAuth or a bearer token — where a local stdio server usually doesn't.

## Local vs remote MCP servers at a glance

| | Local (stdio) | Remote (Streamable HTTP) |
| --- | --- | --- |
| **Setup** | Install and configure a command per client, per machine | Point the client at one URL — nothing to install |
| **Authentication** | Typically none at the transport level; trust comes from the client having launched the process itself | OAuth 2.1 (with PKCE) or bearer tokens are the norm for a network-reachable endpoint |
| **Team access** | Each person configures and runs their own copy; no shared session | One deployment serves every connected client and teammate |
| **Maintenance** | Each user updates their own install | One operator maintains one deployment for everyone |
| **Updates** | Pulled manually, per machine, whenever someone remembers to | Deployed once; every client gets the new version on its next call |
| **Latency** | No network hop — communication is local process I/O | Adds a network round trip; actual cost depends on hosting region and connection quality |
| **Offline use** | Keeps working without internet, since nothing leaves the machine | Requires connectivity to the endpoint |
| **Headless workflows** | Works for a single-machine cron job, but has no built-in remote-auth story for jobs running elsewhere | Built for this: a long-lived token authenticates unattended jobs across any machine or CI runner without a browser |
| **Security responsibilities** | The person running it is responsible for sandboxing — the process holds the user's own OS privileges | The operator is responsible for hardening the endpoint (auth, `Origin` validation, rate limits); clients trust the server's TLS and auth, not its source code |
| **Self-hosting** | Not really a separate concept — it already runs on your own machine | Optional and meaningful: you can run the same server software on your own infrastructure instead of a vendor's, keeping the shared/remote benefits under your own control |

## When local MCP is the better choice

Local fits best when a tool needs direct access to something that's already local — your filesystem, a local Git repository, a database or service running on the same machine — and a network hop would only add overhead without adding capability. It also fits single-user, single-machine workflows where there's no team to share a deployment with, no interest in standing up authentication infrastructure, and a genuine need to keep working offline. Setup is usually the fastest path here: name a command in a config file and the client handles the rest.

The tradeoff is that you inherit the responsibility the specification calls out directly — sandboxing the process and vetting what it does, since it runs with your own privileges rather than behind a separate, auditable boundary.

## When remote MCP is the better choice

Remote fits once more than one client or person needs the same data source with consistent permissions — a team database, a shared knowledge base, a project management workspace — because a remote deployment centralizes authentication, authorization, and auditing in one place instead of duplicating trust decisions across every machine that connects. It's also the natural fit for headless and automated work: a CI job, a scheduled script, or an unattended agent can't complete an interactive setup step, but it can present a token to a URL. And because updates happen once, on the server, every connected client picks up a fix or a new tool immediately rather than waiting for someone to reinstall.

The tradeoff is the network dependency itself (no connectivity, no access) and handing security responsibility to whoever operates the endpoint — which is exactly why *who* operates it, and whether you can inspect or replace that operator, matters.

## Hybrid architectures

The two models aren't mutually exclusive, and in practice a lot of real setups mix them. Most MCP-capable clients let you configure several servers in one config, some local and some remote, side by side — a local filesystem server alongside a remote team workspace, for instance.

A more specific pattern is bridging: a client that only knows how to launch local stdio processes can still reach a remote Streamable HTTP server through a small local proxy. The open source [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) package is a widely used example — the client launches it locally like any stdio server, and it forwards traffic to a remote HTTP endpoint on the other side, running the browser-based OAuth flow on first connect. Remnus ships exactly this pattern as a packaged Claude Desktop extension (`.mcpb`): Claude Desktop runs a small local Node launcher over stdio, which bridges in-process to Remnus's remote endpoint using `mcp-remote`, completing OAuth 2.1 with PKCE on the first call. From the client's point of view it looks like a local server; from the workspace's point of view every call still lands on the same authenticated, audited remote endpoint as a native HTTP connection would. Hybrid setups like this are a practical way to get remote-server benefits — centralized data, centralized auth, one place to update — in front of a client that doesn't yet speak remote HTTP natively.

## Security considerations

The two deployment models don't map to "safe" and "unsafe" — they map to different responsibilities. A local server runs with your own OS privileges and no transport-level authentication, so the entire security question is "do I trust this code and does it need sandboxing?" A remote server puts that boundary at the network edge instead: it should validate the `Origin` header on incoming connections, require real authentication, and (per the specification's own guidance) bind to `localhost` rather than all network interfaces if it's ever run in a context where it shouldn't be reachable from other machines. Neither model does anything by itself to stop prompt injection — content a server returns, local or remote, can still try to redirect an agent's behavior, which is a content-handling problem independent of transport.

This is a large enough topic to deserve its own treatment rather than a condensed retread here: see the [MCP Security Guide](https://www.remnus.com/docs/mcp-security-guide) for the full threat model, OAuth vs. personal access tokens, least-privilege scopes, destructive-action confirmation, and audit logging — all reasoned from the specification's own [security best practices](https://modelcontextprotocol.io/specification/2026-07-28/basic/security_best_practices) rather than assumed.

## How Remnus fits into remote and self-hosted workflows

Remnus's MCP server is architecturally a remote server: it exposes a single Streamable HTTP endpoint at `https://www.remnus.com/api/mcp` rather than shipping a separate local binary. That gives you three concrete ways to use it, depending on how much infrastructure you want to run yourself:

- **Hosted, cloud.** Connect an OAuth-capable client (Claude Code, Cursor, VS Code, Codex, Zed, and most others) directly to the endpoint with no token to copy — approve a consent screen once, and the connection persists. For clients that don't run the OAuth flow, a scoped personal access token (`read` or `write`) is the fallback, which is also the right choice for headless jobs, since there's no browser step to complete. The [Getting Started guide](https://www.remnus.com/wiki/getting-started) covers both paths.
- **Self-hosted, still remote.** Remnus is AGPL-3.0 and fully self-hostable — the same MCP surface runs on your own infrastructure. The project's README covers the local-dev and Docker Compose paths in its "Quick Start — Self-host" section on [GitHub](https://github.com/Ranork/remnus-app), which gets a self-hosted instance running in a few steps, backed by your own OAuth credentials and your own domain. It's still a remote-style deployment in the architectural sense — a standing, network-addressable server that many clients connect to — the difference is who operates it.
- **Hybrid front door.** The Claude Desktop extension described above gives a stdio-only client a local process that bridges to whichever endpoint you configure, hosted or self-hosted, via `mcp-remote`.

Across all three, the tool surface, scopes, and audit log stay the same, per the [Authentication documentation](https://www.remnus.com/wiki/authentication) and [Security & Authentication overview](https://www.remnus.com/security) — only where the server actually runs changes.

## Decision checklist

- Does more than one person or automated job need to reach the same data with the same permissions? Lean remote.
- Does the work need direct, offline access to something already on this machine (files, a local repo, a local database)? Lean local.
- Will an unattended job (CI, cron, a scheduled agent) need to authenticate without a person present? Remote, with a scoped, expiring token.
- Do you want one team to maintain one deployment instead of every teammate maintaining their own install? Remote.
- Do you need the data to stay entirely on your own infrastructure, but still want a shared, centrally-updated deployment? Self-hosted remote.
- Is your client stdio-only but the server you need only speaks HTTP? Bridge with a proxy like `mcp-remote` instead of ruling either side out.

## FAQ

### Can a local MCP server become remote later?

Not automatically, but it's a common migration path: wrap the same tool logic behind a Streamable HTTP endpoint with authentication added, and point clients at the URL instead of a launch command. The protocol semantics (tools, resources, prompts) don't change between transports — only how messages are framed and delivered does.

### Is a remote MCP server always less secure than a local one?

No. A local server carries its own real risk — it runs with the full privileges of the user who launched it and typically has no transport-level authentication at all, so its security depends entirely on trusting the code. A remote server's security depends on how well the operator authenticates requests, scopes access, and hardens the endpoint. Neither model is inherently safer; they just put the responsibility in different places.

### Do I need Docker to self-host a remote MCP server?

Not necessarily. Remnus, for example, supports a plain local Node development setup (`npm install`, `npm run db:migrate`, `npm run dev`) as well as a Docker Compose path for a faster standing deployment — Docker isn't required, it's a convenience for getting a persistent, always-on instance running quickly.

### Can I use a local and a remote MCP server at the same time?

Yes. Most MCP clients accept multiple server entries in one config, and there's no rule that they all use the same transport — a local filesystem server and a remote team workspace can sit side by side in the same client.

### What happened to the old HTTP+SSE transport?

It was the remote transport defined in the 2024-11-05 protocol revision, and it has been deprecated since revision 2025-03-26 in favor of Streamable HTTP. The specification marks it eligible for removal in a future revision, so new integrations shouldn't build against it even where a server still supports it for backward compatibility.

### Does self-hosting a remote MCP server make it "local"?

Not in the transport sense. Self-hosting changes who operates the server, not its shape — it's still an independent, network-addressable process using Streamable HTTP that multiple clients can connect to, just running on infrastructure you control instead of a vendor's. It combines a self-managed operator with all the multi-client, centralized-auth properties of a remote deployment.

## Try it either way

Local and remote MCP servers solve different problems, and the right call usually falls out of who needs access and whether that access has to work unattended. If you want to see a remote, self-hostable MCP server in practice, [open a workspace at remnus.com](https://remnus.com) to connect with OAuth in a minute, or clone [the AGPL-3.0 source](https://github.com/Ranork/remnus-app) and run it on your own infrastructure with the same tool surface either way.
