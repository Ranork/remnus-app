# Read Tools

All 7 read tools are available to every token regardless of scope.

---

## search_workspace

Search pages and databases in the workspace by title.

**Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `query` | string | ✓ | | Search query |
| `limit` | number | | `10` | Maximum results |

**Returns** — array of `{ id, type, title }` objects.

---

## list_workspace

List workspace items (pages and databases). Supports cursor-based pagination and optional parent filtering.

**Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `parentId` | string | | | Parent item ID — omit for root items |
| `limit` | number | | `100` | Items per page |
| `cursor` | string | | | Pagination cursor from a previous `nextCursor` |

**Returns** — `{ items: [...], hasMore: boolean, nextCursor?: string }`

---

## get_page

Get the full content of a workspace page or database row. Auto-detects the type — no flags needed.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `pageId` | string | ✓ | Workspace item ID or database row ID |

**Returns** — `{ id, title, content, properties, type }`

---

## get_database_schema

Get only the column schema of a database, without fetching rows. Use this before `query_database` to learn column names and IDs.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `databaseId` | string | ✓ | Database ID (from `list_workspace` or `search_workspace`) |

**Returns** — `{ schema: [{ id, name, type, options? }] }`

---

## query_database

Get the schema and rows of a database. Supports property filters and cursor-based pagination.

**Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `databaseId` | string | ✓ | | Database ID |
| `limit` | number | | `50` | Rows per page |
| `filters` | object | | | Filter rows by property value |
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

**Returns** — `{ schema, rows, hasMore, nextCursor? }`

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

**Returns** — array of audit log entries with `tool`, `status`, `targetType`, `targetId`, and `createdAt`.
