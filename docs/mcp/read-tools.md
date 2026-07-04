# Read Tools

All 7 read tools are available to every token regardless of scope.

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
