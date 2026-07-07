# Read Tools

All 9 read tools are available to every token regardless of scope.

---

## search_workspace

Search the workspace by title **and content**. Matches standalone pages, databases, and database rows (each row is a page) on their title or body text.

**Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `query` | string | ✓ | | Text to match against item titles and content (case-insensitive substring) |
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

**Returns** — `{ items: [...], hasMore: boolean, nextCursor?: string }`, where each item has `{ id, type, title, parentId, icon, databaseId? }`.

---

## get_page

Get the content of a workspace page or database row. Auto-detects the type — no flags needed.

**Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `pageId` | string | ✓ | | Workspace item ID or database row ID |
| `mode` | `"full"` \| `"outline"` | | `"full"` | `"outline"` collapses the body to headings + the first line of each section — a token-cheap skim for long pages |

**Returns** — `{ id, title, content, properties, type }`. In outline mode the response also carries `mode: "outline"` and `fullContentChars` (the size of the full body), so you can decide whether a `"full"` re-fetch is worth it.

**Token tip** — on long pages, skim with `mode: "outline"` first (typically 80–90% smaller), then fetch `"full"` only when the outline shows the page is relevant.

---

## get_database_schema

Get only the column schema of a database, without fetching rows. Use this before `query_database` to learn column names and IDs.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `databaseId` | string | ✓ | Database ID (from `list_workspace` or `search_workspace`) |

**Returns** — `{ name, schema: [{ id, name, type, options? }] }`

---

## query_database

Get the schema and rows of a database. Supports property filters, field projection, and cursor-based pagination.

**Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `databaseId` | string | ✓ | | Database ID |
| `limit` | number | | `50` | Rows per page |
| `filters` | object | | | Filter rows by property value |
| `fields` | string[] | | | Only return these columns (matched by column id **or** name, case-insensitive); row titles are always included. Add `"content"` to include row markdown bodies — otherwise they are omitted when projecting |
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

When you only need a few columns (e.g. checking statuses on a board), pass `fields` to cut the payload dramatically — row bodies and unrequested properties are dropped, and the returned `schema` is trimmed to match:

```json
{
  "databaseId": "…",
  "fields": ["Status", "Priority"]
}
```

On a typical board this returns ~85% fewer tokens than a full query.

**Returns** — `{ schema, rows, hasMore, nextCursor? }` (`schema` trimmed to the requested fields when projecting)

---

## list_members

List all members of the workspace with their roles and join dates.

**Parameters** — none

**Returns** — array of `{ userId, email, name, role, joinedAt }`

---

## query_audit_log

Query the MCP agent activity audit log for the current workspace.

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

**Bootstrapping a sync** — omit both `since` and `cursor` on the first call to crawl everything (every item comes back as `created`). Save the last page's `nextCursor`, or the `updatedAt` of the most recent change, and pass it back as `cursor`/`since` on the next call to pick up only what changed since.

```json
{ "changes": [
  { "id": "…", "type": "page", "title": "Sprint Notes", "changeType": "updated", "updatedAt": "2026-07-04T09:12:00.000Z" },
  { "id": "…", "type": "database_row", "title": "Fix login bug", "changeType": "created", "updatedAt": "2026-07-04T10:03:00.000Z", "databaseId": "…" },
  { "id": "…", "type": "page", "title": "Old Draft", "changeType": "deleted", "updatedAt": "2026-07-04T11:20:00.000Z" }
], "hasMore": false }
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
