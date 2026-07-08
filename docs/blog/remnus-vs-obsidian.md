# Remnus vs Obsidian: Full Comparison

This one is a slightly different comparison than the others. Obsidian is a personal, local-first notes app: your vault is a folder of plain Markdown files on your own device, no server required. Remnus is a team workspace that a group of people, and their AI agents, work inside together over the network. They are not really competing for the same job. But plenty of people researching how to let an AI agent read and write their notes look at both, so here is where they actually line up and where they don't, checked against Obsidian's own docs, forum, and roadmap, and against Remnus's own source code.

One quick disclosure since we're on the other side of this: we build Remnus. Anywhere Obsidian is genuinely stronger, that gets said outright, not softened.

**Short version:** Obsidian wins on raw plugin depth (thousands of community plugins), a native whiteboard, and the strongest offline story of anything we've compared it to, since there's no server in the loop at all. Remnus is the one built for a team plus an agent to operate on shared, structured data together, with a real MCP server, scoped tokens, and an audit trail baked in from day one. Full detail below.

## What each product actually is

Obsidian stores your notes as Markdown files you own outright, syncs them optionally through a paid add-on, and layers a large plugin ecosystem, over 2,700 community plugins as of mid-2026, on top of that plain-text foundation. Two things now ship in Obsidian itself rather than as plugins: Canvas, an infinite whiteboard for laying out notes and attachments, and Bases, a native database layer that turns a folder of notes into filterable, sortable table, gallery, list, or map views built from the YAML properties already in your files.

Remnus, by contrast, is a shared workspace: pages and databases that a team edits together and that an AI agent can reach through 14 first-party MCP tools, using the exact same data a person sees in the app, not a special read-only export.

## The everyday workspace

Obsidian earns real points here that have nothing to do with agents:

- **Plugin ecosystem:** thousands of community plugins cover kanban boards, calendars, task management, and more, on top of the native Bases layer
- **Canvas:** a built-in infinite whiteboard, something Remnus does not have at all
- **Offline by design:** Obsidian needs no server or account to work fully; Remnus needs a connection to a workspace, self-hosted or cloud
- **Kanban and calendar views for Bases** are on Obsidian's own public roadmap under "Planned," alongside real-time "Multiplayer" editing, none of them shipped yet, all achievable today only through third-party plugins

That last point cuts both ways, and it's worth calling out directly: neither Obsidian nor Remnus has live, Google-Docs-style collaborative editing with visible co-author cursors today. Obsidian Sync supports shared vaults (up to 20 collaborators) but syncs changes file by file, not keystroke by keystroke, and Remnus updates through a background refresh rather than a live cursor too. That's a real parity point, not a Remnus weakness relative to Obsidian specifically.

None of the plugin-ecosystem gap is something a young project closes overnight, and it would be a stretch to pretend otherwise. Remnus ships updates constantly, but a multi-year plugin marketplace isn't something you build in a sprint. What follows is the part we actually built Remnus to be good at.

## Where Remnus is built differently: the AI agent side

### Side by side

| Feature | Obsidian | Remnus |
|---|---|---|
| Data model | Local Markdown files in a vault on your device | Shared workspace: pages and database rows, self-hosted or cloud |
| Native database views | Table, gallery, list, map (via the built-in Bases layer) | Table, kanban, calendar |
| Kanban / calendar views | Third-party plugins today; both listed as "Planned" on the official roadmap | Native, shipped |
| Real-time multiplayer editing | Not shipped (listed as "Planned"); Sync merges file-by-file, not keystroke-by-keystroke | Not shipped either; updates arrive via background refresh |
| Native MCP server (agent connects in) | No official core plugin; a forum request for one exists with no team commitment | Yes, first-party, 19 tools |
| Community MCP options | Several independent plugins/servers (at least five actively maintained ones found) wrap vault file access over MCP | Not applicable |
| Bearer token / PAT auth for agents | Not standardized; each community plugin defines its own | Yes, scoped `rmns_` personal access tokens, expiry optional, instantly revocable |
| OAuth 2.1 with PKCE for editors | Not applicable | Yes |
| Agent-queryable audit trail | Not documented | Yes, every write stamped and queryable via the `query_audit_log` MCP tool, on every plan |
| Multi-person team workspace | Not the core model; Sync allows shared vaults, not a team-first product | Yes, workspaces with roles and member management |
| Openness of your data | Plain Markdown files, fully yours, but the app itself is closed source | AGPL-3.0, source fully open, self-hostable |
| Base pricing | App free for personal and commercial use. Sync $4/month billed annually ($5 monthly). Publish $8/month billed annually ($10 monthly). Commercial license now optional at $50/user/year | Free $0, Startup $10/month flat, Professional $29/month flat (not per seat), Enterprise custom |

### The MCP ecosystem around Obsidian is real, just not first-party

Search for ways to connect an AI agent to Obsidian and you'll find a genuinely active scene: separate MCP servers and plugins built by different independent developers, each wrapping vault access (reading notes, searching, sometimes writing) over the Model Context Protocol. Some run as a local server inside Obsidian itself; others sit outside it and talk to a companion REST API plugin. That's a sign of real demand.

What none of them are is official. A forum thread asking Obsidian's team to ship "a core plugin that exposes the 'canonical' MCP server," so agents go through supported commands instead of raw file access, has sat with a handful of likes and no team response since it was posted in December 2025. Until that changes, whichever community server you pick comes with its own authentication approach, its own update cadence, and its own risk if the maintainer moves on.

Remnus didn't leave that gap open. The MCP server ships with the product, built and maintained by the same team, covering 19 tools (9 read, 10 write) plus 5 resource templates and 7 prompt templates against the workspace's real data model, not a file-system shim.

### Authentication and headless agents

Because there's no canonical MCP server for Obsidian, there's no canonical way to authenticate to one either. Whichever community plugin you install picks its own scheme, and vetting that is on you.

Remnus settled this once, centrally: OAuth 2.1 with PKCE for editors connecting with a person at the keyboard, and scoped personal access tokens (prefixed `rmns_`) for everything unattended, no login step, an optional expiry, instant revocation, and a flat 60 requests per minute per token.

### Pricing: what you're actually paying for

Obsidian itself costs nothing, for personal or commercial use alike, as of a February 2026 change that dropped the earlier commercial-use requirement. Sync (multi-device access plus shared vaults) runs $4 a month billed annually or $5 month to month. Publish (turning notes into a public website) runs $8 a month annually or $10 month to month. The old $50-per-user commercial license is now a voluntary contribution rather than a requirement. None of that pricing has anything to do with AI agent access, since there's no first-party agent feature to price.

Remnus prices the workspace itself, flat per owner rather than per seat: Free at $0, Startup at $10 a month, Professional at $29 a month, Enterprise custom. The entire 14-tool MCP surface works the same on every tier, Free included, because agent access is the product, not an add-on bolted beside it.

### Audit trails

Every write an agent makes in Remnus carries the token that made it and a timestamp, and you can pull that history on the spot with the `query_audit_log` MCP tool on any plan. Obsidian has no equivalent to point to, which tracks: without an official inbound MCP server, there's no first-party agent-write path for a log to cover in the first place. Whatever a given community plugin logs, if anything, is its own business.

### Openness: two different kinds of freedom

These two are open in different, not really comparable, ways. Obsidian keeps your notes as plain Markdown files on your own disk forever, no proprietary format, no server dependency, even if the app itself vanished tomorrow, your data reads fine in any text editor. The application code, though, is closed source.

Remnus takes the opposite path: the code is AGPL-3.0, fully open, and you can self-host the whole workspace on your own infrastructure. But it's a client-server product, so it needs a running server, yours or Remnus's, to do anything at all; there's no local-file-only mode.

## Who should pick which

Pick Obsidian if what you actually want is a personal knowledge base: your own notes, in your own files, with the freedom to bolt on whichever of the thousands of community plugins fit how you think, and you're fine picking (and vetting) a community MCP plugin if you want an agent involved at all.

Pick Remnus if the job is a shared team workspace that an AI agent operates on directly through a supported, first-party MCP server: scoped tokens with no login step for unattended use, a queryable audit trail of every agent action from the free tier up, and multi-person workspaces with real membership and roles, not a personal vault a few people happen to sync into.

They're not really chasing the same prize, and it shows in the comparison. One is the deepest personal notes tool most people will ever use; the other is built specifically so a team and its agents can work the same shared data at once.

---

Curious how this stacks up elsewhere? Read [Remnus vs Notion](/docs/remnus-vs-notion-mcp), [Remnus vs AppFlowy](/docs/remnus-vs-appflowy), or [Remnus vs AFFiNE](/docs/remnus-vs-affine). For the reasoning behind building MCP in from day one, see [MCP-Native vs MCP-Integrated](/docs/mcp-native-vs-integrated). Or just connect an agent from the AI Agents panel in your workspace settings and see the tools for yourself.
