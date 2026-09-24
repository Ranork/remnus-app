# Token-Efficient Usage

Every MCP read costs an agent tokens, latency, and context-window space — and so does simply *connecting*: tool definitions land in the model's context before a single word of the task. Remnus exposes the workspace's existing structure — the tree, database schemas, the link graph — so an agent can read exactly what it needs instead of re-crawling everything. This guide collects the practical patterns that cut a typical read by 80–90%, with the tool parameters that do it.

Start from the cheapest thing that answers your question, in this order: **the local map → the delta → a targeted read → a search.** Everything below is that order, expanded.

Most savings come from scoping reads down. The explicit exception is `prepare_context`: when necessary to honor its caller-supplied budget, it labels and truncates lower-priority content rather than silently overflowing the context window. For measured numbers on a real workspace, see the blog post [How Many Tokens Does Your Agent Burn Reading Your Notes?](/docs/agent-token-efficiency).

## 1. Prepare task context within a budget

For multi-page product or coding work, call [`prepare_context`](read-tools.md#prepare_context) with the concrete task instead of manually chaining search and full-page reads:

```json
{
  "task": "Add a viewer role to workspace invitations",
  "maxTokens": 2000,
  "trustPolicy": "prefer-human-reviewed"
}
```

The result combines BM25 relevance, native OKF-aligned metadata, exact-revision review signals, and compact graph neighbors. `estimatedTokens` stays within `maxTokens`; inspect `truncated`, `selectionReason`, and per-concept `contentTruncated` before deciding whether to fetch one full page. Reuse the returned `contextRunId` for related Remnus writes instead of preparing the same task again.

Do not force this call for greetings, formatting-only requests, or a single known page. That would add tokens instead of saving them. Smart mode targets meaningful product/coding work; Strict mode is an optional governance gate for Remnus mutations.

## 2. Orient from the map, not a full crawl

Before doing anything, an agent needs to know what exists. Don't list every item and read each body. Read the `remnus://workspace/{id}/digest` [resource](resources.md) once — a compact one-line-per-item map (title, type, id, row count, body size, last-updated), indented by nesting, opening with a `cursor:` line.

In a project connected with [`remnus init`](project-install.md), that same map is already on disk as **`.remnus/workspace-map.md`**, refreshed whenever an agent session starts and after each write. Read it there first:

- it costs no round-trip, so the first turn starts with the ids already in hand;
- it can be grepped — an agent can pull the three lines it needs rather than the whole map, which an MCP response cannot do, it is all-or-nothing;
- its header says when it was written and up to which cursor it is verified, so staleness is visible rather than assumed.

It is a **cache**, not a source of truth. Before writing, or whenever it looks stale, take the cursor and ask for the delta (§5) — never re-crawl.

- **Do:** read the map (local file, else the digest), then target specific items by id.
- **Avoid:** `list_workspace` + `get_page` on everything just to see what's there.

Measured: ~87% smaller than reading every page body to orient.

## 3. Project database queries with `fields`

`query_database` returns every column by default, but row markdown bodies are **omitted unless you explicitly add `"content"` to `fields`** — a plain query is already body-free, so the expensive path is opt-in. When you only need a few columns — statuses on a board, due dates — pass a `fields` array (matched by column id **or** name, case-insensitive). Unrequested properties are dropped too, and the returned schema is trimmed to match.

```json
{ "databaseId": "…", "fields": ["Status", "Priority"] }
```

Add `"content"` to `fields` only when you actually need the row bodies. See [query_database](read-tools.md#query_database).

Measured: ~82% smaller on a typical board, and ~74% from the body-free default alone.

## 4. Skim long pages with outline mode

`get_page` supports `mode: "outline"`, which collapses a page to its headings plus the first line of each section and reports `fullContentChars`. Skim first; fetch `mode: "full"` only for the pages the outline shows are relevant.

```json
{ "pageId": "…", "mode": "outline" }
```

- **Do:** outline → decide → full-read the few that matter.
- **Avoid:** full-reading a page to discover it wasn't relevant.

Measured: ~80% smaller than a full read on a long page. The digest and the local map print each page's body size, so you can pick outline mode before the first read. See [get_page](read-tools.md#get_page).

## 5. Sync the delta, don't re-crawl

This is the session-start ritual, not an advanced trick: **read the map once, then live off the delta.**

[`get_changes_since`](read-tools.md#get_changes_since) takes the `cursor` printed at the top of the digest / local map and returns only what was created, updated or deleted after it. It always returns a `nextCursor` — including when nothing changed — so there is always something to keep for the next call. An hourly agent against a workspace that changed twice reads two entries, not the whole tree.

Only when you have no map at all does the full bootstrap (omit both `since` and `cursor`) make sense. Entries stamped in the cursor's own second may be reported once more, so dedupe by `id`.

## 6. Walk the graph before reading bodies

After a search or a change feed surfaces a page, call [get_related_pages](read-tools.md#get_related_pages) before pulling bodies. It returns the page's parent, children, outgoing links, backlinks, and same-database siblings — titles and ids only — so you can see the context around a page and `get_page` only the neighbors you actually need. Working in code, go the other way round: `get_related_pages` with `resource` set to the file you are about to change lists the pages written against it, one call instead of a search.

## 7. Batch a known ID list with get_pages

Once `search_workspace`, `get_related_pages`, or `get_changes_since` has given you the specific IDs you need — possibly spanning several databases or mixing pages with rows — fetch them in one round-trip with [get_pages](read-tools.md#get_pages) instead of one `get_page` per ID. A single bad ID doesn't drop the rest of the batch; check each result's `ok` field.

- **Do:** `get_pages({ pageIds: [...] })` for a handful of specific, already-known IDs.
- **Avoid:** looping `get_page` one ID at a time, or reaching for `get_pages` when the rows all share one database — `query_database` with `filters`/`fields` is a single query there.

## 8. Let prompts assemble context for you

The [`recall-context`](prompts.md#recall-context) prompt bundles all of the above: it searches a topic, collapses each hit to an outline, and appends the top match's link-graph neighborhood — in one message, instead of many `search_workspace` + `get_page` round-trips. Pair it with [`save-memory`](prompts.md#save-memory) to give a long-running agent a workspace-backed memory. See [Agent Memory](agent-memory.md).

## A token budget, before and after

A session that orients, checks a board, and reads one page:

| Step | Naive | Efficient |
|---|---|---|
| Orient | read every body (~1,379 tok) | digest / local map (~182 tok) |
| Board | full query (~3,550 tok) | `fields` (~632 tok) |
| Page | full read (~655 tok) | outline (~133 tok) |
| **Total** | **~5,584 tok** | **~947 tok** |

Same work, ~83% fewer tokens — before delta sync removes the re-orientation cost on every following turn. (Re-measured 2026-09-22 with `npm run bench:tokens` on the same fixture workspace; the map costs a few dozen tokens more than it used to because it now carries the sync cursor and each page's body size, which is what lets the next turn be a delta instead of another read.)

## What connecting costs, before you read anything

Tool definitions are a fixed per-session cost: they enter the model's context on connect, every session. Only a tool's **name, description and input schema** reach the model — output schemas and annotations travel between server and client only. Measured with `npm run bench:mcp-budget` (2026-09-22, MCP SDK 1.29):

| Surface | Before | After |
|---|---|---|
| Write-scoped session, model-visible tool definitions | ~7,750 tok | ~5,410 tok |
| Read-scoped session, model-visible tool definitions | ~7,750 tok | ~1,360 tok |
| Server instructions (smart policy) | ~223 tok | ~269 tok |

Two changes did this. Descriptions and input schemas were trimmed to the sentences that actually change an agent's behaviour — the merge semantics of `update_page`, the `confirm: true` rule, the refusal contract of a cross-database move — and everything restating a field's own name was dropped. And a **read-scoped token no longer receives the 14 write tools at all**: they used to be advertised and refused at call time, which cost every read-only integration thousands of tokens for tools it could never use.

The [dashboard](dashboards.md) tools, added 2026-09-23, put that rule to work: `create_dashboard` and `update_dashboard` add about 555 tokens to a write-scoped session (≈ 253 + 302) and nothing to a read-scoped one — the write-scoped total is now ~5,980 tokens. Their seven block shapes are not in the schemas at all; the catalog (~1,500 tokens) is the resource `remnus://dashboard/catalog`, paid only by a session that builds a dashboard.

A tool result is sent twice on the wire — once as text, once as `structuredContent` — but each client forwards exactly one of those to the model (Claude Code keeps the structured half, Claude Desktop and Cursor keep the text), so the model-visible size is one copy. That is also what `agent_activity.response_bytes` records.

## See also

- [Read Tools](read-tools.md) — full parameter reference
- [Resources](resources.md) — the workspace digest resource
- [Agent Memory](agent-memory.md) — durable memory with `save-memory` / `recall-context`
