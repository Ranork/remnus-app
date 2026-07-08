# Token-Efficient Usage

Every MCP read costs an agent tokens, latency, and context-window space. Remnus exposes the workspace's existing structure — the tree, database schemas, the link graph — so an agent can read exactly what it needs instead of re-crawling everything. This guide collects the practical patterns that cut a typical read by 80–90%, with the tool parameters that do it.

The savings come from scoping reads down, not from any lossy compression on the server. For measured numbers on a real workspace, see the blog post [How Many Tokens Does Your Agent Burn Reading Your Notes?](/docs/agent-token-efficiency).

## 1. Orient with the digest, not a full crawl

Before doing anything, an agent needs to know what exists. Don't list every item and read each body. Read the `remnus://workspace/{id}/digest` [resource](resources.md) once — it returns a compact one-line-per-item map (title, type, id, row count, last-updated), indented by nesting.

- **Do:** read the digest, then target specific items by id.
- **Avoid:** `list_workspace` + `get_page` on everything just to see what's there.

Measured: ~90% smaller than reading every page body to orient.

## 2. Project database queries with `fields`

`query_database` returns every column by default, but row markdown bodies are **omitted unless you explicitly add `"content"` to `fields`** — a plain query is already body-free, so the expensive path is opt-in. When you only need a few columns — statuses on a board, due dates — pass a `fields` array (matched by column id **or** name, case-insensitive). Unrequested properties are dropped too, and the returned schema is trimmed to match.

```json
{ "databaseId": "…", "fields": ["Status", "Priority"] }
```

Add `"content"` to `fields` only when you actually need the row bodies. See [query_database](read-tools.md#query_database).

Measured: ~83% smaller on a typical board.

## 3. Skim long pages with outline mode

`get_page` supports `mode: "outline"`, which collapses a page to its headings plus the first line of each section and reports `fullContentChars`. Skim first; fetch `mode: "full"` only for the pages the outline shows are relevant.

```json
{ "pageId": "…", "mode": "outline" }
```

- **Do:** outline → decide → full-read the few that matter.
- **Avoid:** full-reading a page to discover it wasn't relevant.

Measured: ~80% smaller than a full read on a long page. See [get_page](read-tools.md#get_page).

## 4. Sync the delta, don't re-crawl

For anything recurring — a daily report, a memory refresh, a watcher — use [get_changes_since](read-tools.md#get_changes_since). The first call (no `since`/`cursor`) bootstraps the full state; save the `nextCursor` and pass it back on the next run to get only what was created, updated, or deleted since. An hourly agent against a workspace that changed twice reads two entries, not the whole tree.

## 5. Walk the graph before reading bodies

After a search or a change feed surfaces a page, call [get_related_pages](read-tools.md#get_related_pages) before pulling bodies. It returns the page's parent, children, outgoing links, backlinks, and same-database siblings — titles and ids only — so you can see the context around a page and `get_page` only the neighbors you actually need.

## 6. Let prompts assemble context for you

The [`recall-context`](prompts.md#recall-context) prompt bundles all of the above: it searches a topic, collapses each hit to an outline, and appends the top match's link-graph neighborhood — in one message, instead of many `search_workspace` + `get_page` round-trips. Pair it with [`save-memory`](prompts.md#save-memory) to give a long-running agent a workspace-backed memory. See [Agent Memory](agent-memory.md).

## A token budget, before and after

A session that orients, checks a board, and reads one page:

| Step | Naive | Efficient |
|---|---|---|
| Orient | read every body (~1,379 tok) | digest (~136 tok) |
| Board | full query (~3,706 tok) | `fields` (~632 tok) |
| Page | full read (~655 tok) | outline (~133 tok) |
| **Total** | **~5,740 tok** | **~901 tok** |

Same work, ~84% fewer tokens — before delta sync removes the re-orientation cost on every following turn.

## See also

- [Read Tools](read-tools.md) — full parameter reference
- [Resources](resources.md) — the workspace digest resource
- [Agent Memory](agent-memory.md) — durable memory with `save-memory` / `recall-context`
