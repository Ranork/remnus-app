# Read Tools

All 11 read tools are available to every token regardless of scope.

---

## prepare_context

Build a task-specific context pack before multi-page product or coding work. Context Pack v2 runs BM25 retrieval across titles and bodies, combines native OKF-aligned metadata and the page link graph, prefers exact-revision human reviews, and penalizes stale/deprecated knowledge. Matching is case- and accent-insensitive ("Çözüm" = "cozum") but lexical: pass `keywords` for synonyms and for a workspace written in another language than the task. See [Keywords](context-first.md#keywords-the-agent-expands-the-server-ranks).

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `task` | string | ✓ | | Concrete task or question |
| `keywords` | string[] | | | Extra search terms, up to 24 × 60 characters: synonyms, and the workspace's own language when the task is written in another (English terms for a Turkish task). Ranked at half the weight of the task's own words |
| `maxTokens` | number | | `2000` | Approximate response budget (`1000`–`16000`) |
| `maxConcepts` | number | | `6` | Maximum concepts (`1`–`16`) |
| `trustPolicy` | string | | `prefer-human-reviewed` | `any`, `prefer-human-reviewed`, or `human-reviewed-only` |
| `includeRelated` | boolean | | `true` | Include title/ID graph neighbors for targeted follow-up |

**Returns** — a `remnus-context-pack-v2` JSON object with selected concept bodies, OKF-aligned type/status/trust/freshness metadata, per-concept `selectionReason`, truncation and token estimates, link-neighbor references, warnings, plus a short-lived `contextRunId`. Concept content is explicitly labeled untrusted reference data and cannot override user/system instructions.

`human-reviewed` means an authenticated Remnus user reviewed the exact current title/body hash. An imported OKF `human:*` assertion is labeled `external-human-asserted`; it is never promoted to a local review merely because the file says so.

The `contextRunId` belongs to the current agent and workspace and expires after 30 minutes. Pass it to related write tools. Smart mode treats this as the recommended context-first flow; Strict mode rejects Remnus mutations without it. See [Context-first MCP](context-first.md).

The budget applies to the compact JSON text returned by the tool. If a page cannot fit, its body is collapsed to an outline plus opening excerpt; if the pack still cannot fit, lower-ranked concepts are omitted and `truncated` becomes `true`.

---

## search_workspace

Search the workspace by title **and content**. Matches standalone pages, databases, and database rows (each row is a page) on their title or body text.

Matching ignores case and accents in the Latin-script languages Remnus supports: `cozum` finds "Çözüm Notları", `istanbul` finds "İstanbul Ofisi", `espana` finds "España". Letters of other scripts (Cyrillic, CJK) match as typed. Results are not ranked by relevance — use [`prepare_context`](#prepare_context) for "what is relevant to this task".

**Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `query` | string | ✓ | | Text to match against item titles and content (case- and accent-insensitive substring) |
| `limit` | number | | `10` | Maximum results |

**Returns** — `{ results: [...] }`, where each result has:

| Field | Type | Description |
|---|---|---|
| `id` | string | Item ID (pass to `get_page`) |
| `type` | string | `page` \| `database` \| `database_row` |
| `title` | string | Item title |
| `breadcrumb` | string[] | Location path from the workspace root to the item (for a `database_row`, ends with its parent database name) |
| `matchedOn` | string | Where the query matched: `title` \| `content` |
| `snippet` | string | Matching content snippet (empty when the match was on the title) |
| `databaseId` | string? | Parent database ID, present for `database_row` results (pass to `query_database`) |
| `parentId` | string? | Parent item ID for nested sidebar items |

---

## list_workspace

List workspace items (pages and databases). Supports cursor-based pagination and optional parent filtering.

**Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `parentId` | string | | | Parent item ID — omit for root items |
| `limit` | number | | `100` | Items per page |
| `cursor` | string | | | Pagination cursor from a previous `nextCursor` |

**Returns** — `{ items: [...], hasMore: boolean, nextCursor?: string }`, where each item has `{ id, type, title, databaseId? }` plus `parentId` and `icon` when they are set (a root item simply has no `parentId`).

**Token tip** — for orientation the workspace map is cheaper and needs no pagination: read the [digest resource](resources.md), or the cached `.remnus/workspace-map.md` in a project set up with `remnus init`. Reach for `list_workspace` when you need one branch of the tree, not the shape of the whole thing.

---

## get_page

Get the content of a workspace page, database row or dashboard. Auto-detects the type — no flags needed.

**Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `pageId` | string | ✓ | | Workspace item ID or database row ID |
| `mode` | `"full"` \| `"outline"` | | `"full"` | `"outline"` collapses the body to headings + the first line of each section — a token-cheap skim for long pages |

**Returns** — `{ id, title, content, properties, type }`. In outline mode the response also carries `mode: "outline"` and `fullContentChars` (the size of the full body), so you can decide whether a `"full"` re-fetch is worth it.

**Token tip** — on long pages, skim with `mode: "outline"` first (~80% smaller), then fetch `"full"` only when the outline shows the page is relevant. The workspace map prints each page's body size, so you can choose outline mode before the first read rather than after.

**Dashboards** — a [dashboard](dashboards.md) comes back as `{ id, type: "dashboard", title, icon, url, spec }`: its block spec as an object (not an escaped string), plus the in-app `url`. In outline mode `spec` is replaced by `blocks: [{ id, type, title }]` — all you need to pick ids for [`update_dashboard`](write-tools.md#update_dashboard). There is no comment thread, so `includeComments` adds nothing. `get_pages` shapes dashboards the same way.

---

## get_pages

Batch version of `get_page` — fetch a specific, already-known list of page/row IDs in one call, for example IDs returned by `search_workspace`, `get_related_pages`, or `get_changes_since`. IDs can span multiple databases or mix standalone pages with database rows.

**Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `pageIds` | string[] | ✓ | | Page/row IDs to fetch (max 50) |
| `mode` | `"full"` \| `"outline"` | | `"full"` | Same as `get_page` — applied to every fetched page |

**Returns** — `{ results: [{ id, ok, page?, error? }] }`. One missing or inaccessible ID does **not** fail the whole call — check each entry's `ok` field; `page` is present when `ok` is `true` (same shape as `get_page`'s return value), `error` when it's `false`.

**When to use this vs. `query_database`** — if the rows you want all live in one database, `query_database` with `filters`/`fields` is a single query and is cheaper than N lookups. Reach for `get_pages` when the IDs are already known and don't share one database (or mix page/database-row types).

---

## get_database_schema

Get the column schema and saved views of a database, without fetching rows. Use this before `query_database` to learn column names and IDs, or before `create_database_view` / `update_database_view` / `delete_database_view` to see existing view ids and config shape.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `databaseId` | string | ✓ | Database ID (from `list_workspace` or `search_workspace`) |

**Returns** — `{ name, schema: [{ id, name, type, options? }], views: [{ id, name, config, icon?, iconColor? }] }` (`views` always has at least one entry — a database with no saved views implicitly has a default Table view).

---

## query_database

Get the schema and rows of a database. Row markdown bodies are omitted by default — add `"content"` to `fields` to include them, or `get_page` a single row. Supports property filters, field projection, and cursor-based pagination.

**Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `databaseId` | string | ✓ | | Database ID |
| `limit` | number | | `50` | Rows per page |
| `filters` | object | | | Filter rows by property value |
| `fields` | string[] | | | Only return these columns (matched by column id **or** name, case-insensitive); row titles are always included. Add `"content"` to include row markdown bodies — they are omitted by default, with or without a projection |
| `cursor` | string | | | Pagination cursor |

**Filters**

Pass a JSON object where each key is a column ID and each value is the property value to match. Use `get_database_schema` to discover column IDs.

```json
{
  "filters": {
    "col_abc123": "Done",
    "col_def456": ["Tag1", "Tag2"]
  }
}
```

Use a string for `select` columns and an array for `multi_select` columns.

**Field projection**

When you only need a few columns (e.g. checking statuses on a board), pass `fields` to cut the payload further — unrequested properties are dropped (row bodies are already omitted by default), and the returned `schema` is trimmed to match:

```json
{
  "databaseId": "…",
  "fields": ["Status", "Priority"]
}
```

On a typical board this returns ~82% fewer tokens than a query that also pulls row bodies — and the body-free default is already ~74% of that saving on its own.

**Returns** — `{ schema, rows, hasMore, nextCursor? }` (`schema` trimmed to the requested fields when projecting)

---

## list_members

List all members of the workspace with their roles and join dates.

**Parameters** — none

**Returns** — array of `{ userId, email, name, role, joinedAt }`

---

## query_audit_log

Query the MCP agent activity audit log for the current workspace.

The log reaches back as far as the workspace owner's plan keeps it — 7 days on Free,
30 on Startup, 90 on Professional, 365 on Enterprise. An earlier `from` finds nothing
older; upgrading the plan makes the older history visible again right away.

**Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `tool` | string | | | Filter by tool name (e.g. `"create_page"`) |
| `status` | `"success"` \| `"error"` | | | Filter by call status |
| `from` | string | | | Start of date range — ISO 8601 (e.g. `"2025-01-01T00:00:00Z"`) |
| `to` | string | | | End of date range — ISO 8601 |
| `limit` | number | | `50` | Maximum results |

**Returns** — array of audit log entries with `tool`, `status`, `targetType`, `targetId`, `createdAt`, `agentName` (the agent's brand id, if set), and `tokenName` (the token's label).

---

## get_changes_since

Get a compact, chronological list of everything that changed in the workspace since a given time or a previous call's cursor — pages/databases edited, database rows edited, and items deleted. Built for **recurring agents** (a daily report, a standup summary, a memory refresh) so they can sync incrementally instead of re-reading the whole workspace on every run.

**Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `since` | string | | | ISO 8601 timestamp — only return changes after this time. Ignored when `cursor` is provided |
| `cursor` | string | | | Pagination cursor from a previous response's `nextCursor` — takes priority over `since` for resuming a sync |
| `limit` | number | | `100` | Maximum changes per page |

**Returns** — `{ changes: [...], hasMore: boolean, nextCursor?: string }`, where each change has:

| Field | Type | Description |
|---|---|---|
| `id` | string | Item ID (pass to `get_page` or `query_database`) |
| `type` | string | `page` \| `database` \| `database_row` |
| `title` | string | Item title (last known title for deleted items) |
| `changeType` | string | `created` \| `updated` \| `deleted` |
| `updatedAt` | string | When the change happened (ISO 8601) — for `deleted`, when the deletion happened |
| `databaseId` | string? | Parent database ID, present for `database_row` entries |

**`nextCursor` is always returned**, even when `hasMore` is false and even when nothing changed — that is the value to keep for the next call. (It used to be present only mid-pagination, which left a one-page bootstrap with nothing to save.)

**Starting from the map, not from a crawl** — the [digest resource](resources.md) and the cached `.remnus/workspace-map.md` both begin with a `cursor:` line taken before the map was built. Read the map once, then pass that cursor here: you get the delta since the map, not the tree again. Only when you have no map at all is a full bootstrap (omit both `since` and `cursor`) the right first call — every item then comes back as `created`.

**Re-reported entries** — a cursor that lands on the current second is deliberately inclusive of that second, since timestamps are second-granular and another agent may still be writing into it. An entry can therefore appear once more on the following call; dedupe by `id` rather than assuming exactly-once delivery.

```json
{ "changes": [
  { "id": "…", "type": "page", "title": "Sprint Notes", "changeType": "updated", "updatedAt": "2026-07-04T09:12:00.000Z" },
  { "id": "…", "type": "database_row", "title": "Fix login bug", "changeType": "created", "updatedAt": "2026-07-04T10:03:00.000Z", "databaseId": "…" },
  { "id": "…", "type": "page", "title": "Old Draft", "changeType": "deleted", "updatedAt": "2026-07-04T11:20:00.000Z" }
], "hasMore": false, "nextCursor": "eyJ0cyI6MTc…" }
```

**What counts as a change** — a page's own content edit, a database's schema edit, a database row's title/content/property edit, or moving/renaming an item. Deletions are tracked separately as tombstones, so a deleted item still shows up here (with its last known title) even though it no longer exists.

**Note on old data** — a handful of rows created before this app consistently stamped timestamps may have no reliable "last changed" time; those are only ever reported once, on a full crawl (no `since`/`cursor`), and won't reappear on later incremental calls.

---

## get_related_pages

Get a page's knowledge-graph neighborhood in one compact call: its parent, child pages, outgoing links (pages its body references), backlinks (pages whose bodies reference it), and — for database rows — sibling rows in the same database. Titles and IDs only, no page bodies, so orienting around a page costs a fraction of re-reading it and its neighbors; follow up with `get_page` on the ones that matter.

The link graph is derived from page content: inline `@`-mention links and child blocks (both embedded sub-pages and "Link to page" references) are extracted on every save, so the graph is always current — no separate indexing step.

**Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `pageId` | string | ✓ | | Page ID — a standalone page, database, or database row (same IDs `get_page` accepts) |

**Returns** — `{ page, parent, children, outgoingLinks, backlinks, siblings }`:

| Field | Type | Description |
|---|---|---|
| `page` | object | The subject — `{ id, title, type }` |
| `parent` | object? | Parent item (for a database row, the database it belongs to); `null` at workspace root |
| `children` | array | Items nested under this page in the sidebar tree |
| `outgoingLinks` | array | Pages this page's body references (children already listed above are excluded) |
| `backlinks` | array | Pages whose bodies reference this page (the parent is excluded) |
| `siblings` | object? | `{ total, items: [{ id, title }] }` — other rows in the same database (first 10); only for database rows, `null` otherwise |

Every entry in `parent`/`children`/`outgoingLinks`/`backlinks` is `{ id, title, type, databaseId?, linkKind? }` — `type` is `page` \| `database` \| `database_row`, `databaseId` is present on database entries (pass it to `query_database` / `get_database_schema`), and `linkKind` says how the reference was made (`page_link` = inline `@`-mention, `child_block` = embedded or linked block).

```json
{
  "page": { "id": "…", "title": "Auth Refactor Plan", "type": "page" },
  "parent": { "id": "…", "title": "Engineering", "type": "page" },
  "children": [ { "id": "…", "title": "Session Notes", "type": "page" } ],
  "outgoingLinks": [ { "id": "…", "title": "Login Bug", "type": "database_row", "linkKind": "page_link" } ],
  "backlinks": [ { "id": "…", "title": "Sprint Board", "type": "database", "databaseId": "…", "linkKind": "child_block" } ],
  "siblings": null
}
```

**Typical use** — after `search_workspace` or `get_changes_since` surfaces a page, call `get_related_pages` before reading bodies: it tells you what context exists around the page (specs it links to, tasks that reference it, its place in the tree) so you only `get_page` the neighbors you actually need.
