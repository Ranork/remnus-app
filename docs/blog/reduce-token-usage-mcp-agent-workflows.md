# How to Reduce Token Usage in MCP Agent Workflows

Connecting an AI agent to a whole workspace over the Model Context Protocol (MCP) is the easy part. The expensive part is what happens next: the agent reads. It lists the tree, opens pages to see what they contain, pulls every column of a database to check one status field, and does most of that again on the next turn because nothing told it what changed. Every one of those reads is billed as input tokens, occupies space in a finite context window, and adds latency before the agent does any actual work.

It also makes the agent worse. A context window is shared by the system prompt, tool definitions, prior turns, tool results, and the model's own output, and models get less reliable as it fills — Anthropic calls the effect [context rot](https://platform.claude.com/docs/en/build-with-claude/context-windows). An agent that loads 40 KB of workspace it doesn't need isn't just paying for 40 KB; it's reasoning over a haystack it built itself.

This guide covers where tokens actually go in an MCP workflow and the concrete patterns that cut avoidable reads — structured digests, outline-first reads, targeted search, schema-before-rows, field projection, change tracking, and a clean split between durable memory and task context. It uses [Remnus](https://remnus.com) (an open-source MCP-native workspace) for verified examples, but the patterns apply to any MCP server that exposes them. None of this guarantees a smaller bill — pricing, caching, and model behavior vary by provider — but it reliably removes reads the agent never needed.

## Where tokens are consumed in an MCP workflow

Before optimizing, know what you're paying for. In a tool-using agent loop, tokens accrue in several distinct categories, and providers price and report them separately:

- **Input tokens** — everything sent to the model on a request: system prompt, conversation history, the `tools` parameter (every tool's name, description, and JSON schema), and every tool result appended so far. This is usually the largest and fastest-growing category in an agent loop, because history is resent in full on every turn.
- **Output tokens** — what the model generates, including tool-call arguments and any reasoning tokens. Typically priced several times higher per token than input.
- **Cached input tokens** — when a provider supports prompt caching, a stable prefix of the request can be served from cache. Anthropic prices a cache read at [0.1× the base input rate and a cache write at 1.25–2×](https://platform.claude.com/docs/en/about-claude/pricing); other providers differ or don't offer it at all. Caching is a prefix match, so a single changed byte early in the request invalidates everything after it.
- **Tool-definition overhead** — just declaring tools adds a fixed cost. On Anthropic models, the tool-use system prompt alone runs [roughly 300–850 tokens depending on model and `tool_choice`](https://platform.claude.com/docs/en/about-claude/pricing), before any tool is called. An MCP server that exposes 40 tools makes every request bigger.
- **Tool responses (retrieved context)** — the payloads your MCP reads return. This is the category you have the most direct control over, and where "read everything" hurts most.

The MCP specification itself frames [tools, resources, and prompts](https://modelcontextprotocol.io/docs/learn/server-concepts) by who controls them: the model calls tools, the application supplies resources, the user invokes prompts. That control split matters for cost because the model's read decisions are the ones you can't fully predict — so the server needs to offer read shapes that are cheap by default.

## Why "read everything" is a poor default

"Load the whole workspace so the agent has full context" sounds safe. In practice it fails three ways:

1. **You pay for the 95% the task didn't need.** Most tasks touch a handful of pages. Reading 200 to find 6 means 97% of those input tokens were waste — on this turn and, because history is resent, on every turn after it.
2. **Signal gets buried.** Retrieval quality is not the same as retrieval volume. The relevant paragraph is harder for the model to use when it's surrounded by 30 KB of unrelated rows.
3. **It doesn't scale with the workspace.** A workflow that "just reads everything" works on a 10-page workspace and quietly breaks on a 2,000-page one — the same agent, the same prompt, now overflowing its context window.

The fix isn't to starve the agent. It's to give it a cheap way to see the shape of the workspace, then read precisely. Every pattern below is a version of that move.

## Use structured summaries and workspace digests

The first thing an agent needs is orientation: what exists, of what type, how big, last changed. The naive way to get that is to list every item and open each one. The cheap way is a single digest read.

Remnus exposes this as the `remnus://workspace/{id}/digest` [resource](https://remnus.com/wiki/resources) — a compact, one-line-per-item map (title, type, id, row count, last-updated), indented by nesting. Remnus's own [published measurement](https://remnus.com/docs/agent-token-efficiency) on a small seeded workspace put the digest at roughly 90% fewer tokens than reading every page body to get the same orientation. That figure is from one specific workspace and won't transfer exactly, but the structural point holds: a map of the workspace is a fraction of the size of its contents.

A digest is a resource, not a tool — it's read-only and safe for the client to fetch speculatively. If your MCP server offers something similar, it should be the agent's first read, every session.

## Request outlines before full content

Long pages are the other big spender. A 3,000-word design doc costs the same whether the agent needed one section or all of it.

Remnus's `get_page` takes `mode: "outline"`, which collapses a page to its headings plus the first line of each section and reports `fullContentChars` so the agent can decide whether the full body is worth fetching:

```json
{ "pageId": "pg_abc123", "mode": "outline" }
```

Remnus measured outline mode at roughly 80% smaller than a full read on a long page. The workflow it enables matters more than the number: **skim, decide, then full-read only the pages the outline proved relevant** — instead of paying full price to discover a page wasn't.

## Use targeted search and filtering

If the agent knows what it's looking for, it should search for it, not reconstruct it by reading. `search_workspace` matches titles and body text and returns ids, breadcrumbs, and a matching snippet — enough to decide what to open without opening anything:

```json
{ "query": "viewer role invitation", "limit": 10 }
```

Two rules keep search cheap:

- **Cap the result count.** A `limit` of 10 with good ranking beats 50 results the agent has to skim.
- **Search, then read the winners.** The snippet plus breadcrumb is usually enough to pick the two or three pages worth a full `get_page`.

For list operations, MCP defines [opaque cursor-based pagination](https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/pagination) — `tools/list`, `resources/list`, `prompts/list`, and server list tools all support it. An agent should page through results only as far as it needs, not drain the cursor to build a full local copy.

## Read schemas before large databases

When an agent needs data from a database, the instinct is to query the database. But a query without knowing the schema means either pulling every column (expensive) or guessing column names (wrong).

`get_database_schema` returns column names, types, and select options — and no rows:

```json
{ "databaseId": "db_sprintboard" }
```

That's a small, cheap read that tells the agent exactly which columns exist and what to project. It's the setup move that makes the next pattern possible.

## Fetch only required properties or records

A board query usually needs two or three fields — a status, a priority — not every property on every row, and rarely the row bodies at all.

Remnus's `query_database` omits row markdown bodies by default (you opt back in by adding `"content"` to `fields`), and a `fields` projection drops every unrequested column and trims the returned schema to match:

```json
{ "databaseId": "db_sprintboard", "fields": ["Status", "Priority"] }
```

Remnus's published figure for this is around 83% fewer tokens than a full query on a 16-row board. Combine it with `filters` so the agent pulls only the rows that match the condition it cares about, and a "what's blocked?" check reads a small fraction of the table.

When the agent already has a specific list of ids — from a search, a change feed, or a link-graph walk — spanning multiple databases, `get_pages` fetches up to 50 in one round trip instead of one `get_page` call each. If the ids all live in one database, a single filtered `query_database` is cheaper still.

## Track changes instead of re-reading unchanged content

A recurring agent — a daily standup summary, an hourly watcher, a memory refresh — does not need to re-crawl the workspace every run. It needs the delta.

`get_changes_since` returns a compact chronological feed of what was created, updated, or deleted since a timestamp or cursor:

```json
{ "cursor": "eyJ0cyI6MTcuLi59" }
```

The first call bootstraps; every call after that returns just the changes. For an agent that runs every hour against a workspace that changed twice, that's two entries instead of the entire tree — the single largest saving available to any scheduled workflow, because it removes the re-orientation cost from every run after the first.

## Separate long-term memory from temporary context

Not everything an agent learns should be treated the same way. Conflating durable knowledge with task scratch is a common source of bloat: either the agent reloads a giant memory blob on every turn, or it persists throwaway debugging state as if it mattered.

The split that works:

- **Temporary context** lives in the current session's window only — the file being edited, a debugging trace, the current tool results. It's gone after the task, and that's correct.
- **Durable memory** is a small, deliberate record — a decision and its reasoning, a preference, a gotcha — written once and retrieved on demand later, not preloaded.

Remnus implements durable memory as an [Agent Memory](https://remnus.com/wiki/agent-memory) database (fixed `Title` / `Type` / `Tags` / `Date` shape) with a `save-memory` prompt to write a structured record and `recall-context` to read the relevant slice back as outlines. Because entries are ordinary workspace pages, a person can correct or delete one and the next recall reflects it. The [memory vs RAG vs context window](https://remnus.com/docs/ai-agent-memory-vs-rag-vs-context-window) breakdown covers why these are different mechanisms with different failure modes — the token point is narrower: retrieve memory when a task needs it, don't carry it in the prompt by default.

## Use reusable prompts carefully

MCP prompts package a repeatable workflow so a user doesn't re-explain it every time. Remnus ships several — `weekly-status-report`, `kanban-triage`, `recall-context`, `summarize-page`. A good prompt is token-efficient by construction: `recall-context` runs the search, collapses each hit to an outline, and appends the top match's link-graph neighborhood in one message, replacing many manual `search_workspace` + `get_page` round trips.

The caveat: a prompt that assembles context has a cost, and running it when it isn't needed adds tokens instead of saving them. Don't invoke a context-preparing prompt for a greeting, a formatting tweak, or a single page you already have the id for. Prompts are user-controlled for a reason — invoke them when the workflow they package is the workflow you're actually doing.

## Example optimized project workflow

A concrete task: *"Add viewer-role support to workspace invitations."* The agent needs to orient, find the relevant code/spec pages, check the current sprint board, and read the two or three pages that matter.

### Bad workflow

| Step | Action | Rough input cost |
|---|---|---|
| Orient | `list_workspace`, then `get_page` on all ~40 items | very high |
| Board | `query_database` on the sprint board, all columns, all row bodies | high |
| Spec | full `get_page` on 6 candidate pages to find the 2 that matter | high |
| Next turn | re-send all of the above as history, re-read the board "to be safe" | compounding |

Everything is read at full size, most of it is irrelevant to viewer roles, and the re-read on the next turn pays for the board twice.

### Improved workflow

| Step | Action | Effect |
|---|---|---|
| Orient | read the `digest` resource once | ~one small page instead of 40 |
| Find | `search_workspace` `"viewer role invitation"`, `limit: 10` | ids + snippets, no bodies |
| Triage | `get_pages` on the top 3 hits, `mode: "outline"` | headings only; pick the 2 real ones |
| Read | `get_page` `mode: "full"` on those 2 | full cost paid only where it counts |
| Board | `get_database_schema`, then `query_database` with `fields: ["Status","Assignee"]` and a filter | a few columns of matching rows |
| Next turn | `get_changes_since` with the saved cursor | just what changed, not a re-crawl |

Remnus's own end-to-end measurement of a comparable "orient, check the board, read one page" session — again, one seeded workspace, `chars ÷ 4` token estimates, not a billing statement — came out around **84% fewer tokens** on the efficient path, before delta sync removes the re-orientation cost on later turns. Your ratio will differ. The shape won't: the agent does the same work having read a fraction of the workspace.

For a task that genuinely spans many pages, Remnus's `prepare_context` ([Context-First MCP](https://remnus.com/wiki/context-first)) folds most of this into one call — give it the task and a `maxTokens` budget, and Context Pack v2 ranks by relevance, metadata, and the link graph, then returns only the excerpts that fit, with `estimatedTokens` and `truncated` reported. Don't use it for greetings or a single known page; that adds cost.

## Measuring whether optimization works

Optimization you can't measure is guesswork. Three levels, cheapest first:

1. **Count before you send.** Anthropic's [token counting endpoint](https://platform.claude.com/docs/en/build-with-claude/token-counting) (`/v1/messages/count_tokens`) accepts the same request body — system, tools, messages — and returns the input-token total, free of charge. Other providers offer tokenizers or count endpoints. Use it to compare a projected query against a full one before the real call.
2. **Read the `usage` block on every response.** Anthropic returns `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`, and `server_tool_use` counts. Watch the cache-read number across repeated runs: if it's zero when you expect hits, something early in your prefix is changing (a timestamp, an unsorted tool list, a per-request id) and defeating the cache.
3. **Track cost per completed task, not per call.** A workflow that makes more small calls but finishes with less total context in the window is winning even though the call count went up. Provider dashboards break spend down by token category — the one to drive down is retrieved-context input.

A caution on estimates: the `characters ÷ 4` rule is a rough English-text approximation, and [newer tokenizers produce noticeably more tokens](https://platform.claude.com/docs/en/build-with-claude/token-counting) for the same text. Treat pre-send counts as ratios for comparison, not as the number you'll be billed.

## How Remnus supports structured context access

Remnus is built so the token-efficient path is the default one, using structure the workspace already has rather than an LLM compressing anything:

- **Content is served as markdown**, not block-wrapped JSON — the agent reads roughly what a person wrote, without per-block ids, timestamps, and annotation objects inflating every paragraph.
- **The `digest` and `schema` resources** give one-read orientation and full database schemas with zero row data.
- **`get_page` outline mode** and **`query_database` field projection** (bodies omitted by default) let the agent scope every read down to what it asked for.
- **`get_changes_since`** turns recurring work into delta sync.
- **`get_related_pages`** returns a page's parent, children, links, and backlinks as titles and ids only — orient around a page without re-reading its neighborhood.
- **`prepare_context`** (Context Pack v2) does budgeted, task-scoped retrieval in one call, reporting its own token estimate and truncation.
- **`save-memory` / `recall-context`** keep durable memory in a human-editable database, retrieved on demand.
- **Manual / Smart / Strict policy** controls how automatically the context-first flow runs; Strict can require a current context preflight before a workspace write.

The full references: [Read Tools](https://remnus.com/wiki/read-tools), [Token-Efficient Usage](https://remnus.com/wiki/token-efficient-usage), and the measured [token-consumption article](https://remnus.com/docs/agent-token-efficiency).

## FAQ

### Does reducing token usage make the agent less capable?

No, when done right. The goal is to remove reads the task didn't need, not information it did. An agent that orients with a digest and then reads the three relevant pages in full has the context it needs — it just skipped the 37 pages it didn't.

### Will these techniques lower my bill?

They remove avoidable input tokens, which is the largest controllable cost category in most agent loops. But total spend depends on your provider's pricing, whether caching applies, model choice, output volume, and how many turns a task takes. This guide can't and doesn't guarantee a lower invoice — measure your own workflow before and after.

### How much do prompt caching and cached tokens help?

When a provider supports it, a cache read is much cheaper than a fresh input token (Anthropic: 0.1× the base rate). But caching is a prefix match — stable content must come first, and volatile content (timestamps, per-request ids, the changing question) must come after the last cache breakpoint, or you pay to rewrite the cache every call. Availability and pricing vary by provider and model; check your provider's documentation.

### Should I just limit how many tools my MCP server exposes?

It helps — tool definitions are resent on every request, and on Anthropic models the tool-use system prompt adds hundreds of tokens before any call. A focused tool set is cheaper than a sprawling one. Some clients also support deferred/searchable tool loading. But the larger savings are almost always in the read payloads, not the tool list.

### What's the single highest-impact change for a recurring agent?

Change tracking. An agent that re-crawls the workspace on every scheduled run is repaying the full orientation cost every time. Switching to a `get_changes_since`-style delta feed removes that entirely after the first run.

### Do I need `prepare_context` / Context Pack v2 for every task?

No. It's for substantive multi-page work. For a greeting, a formatting change, or a single page whose id you already have, preparing a context pack adds overhead instead of removing it. Reach for the narrow primitives — `fields`, outline mode, the digest — when you already know the read shape you need.

## Start narrow

The default that scales isn't "give the agent everything." It's "give the agent a cheap way to see what exists, then let it read precisely." Orient with a digest, search instead of list, outline before full-read, project instead of select-all, and sync deltas instead of re-crawling. Measure the retrieved-context tokens before and after — that's the number these patterns move.

To see the structured-access model on a live connection, [open a Remnus workspace](https://remnus.com) and connect an agent from the **AI Agents** panel, or start with [Token-Efficient Usage](https://remnus.com/wiki/token-efficient-usage) and the [measured token-consumption article](https://remnus.com/docs/agent-token-efficiency).
