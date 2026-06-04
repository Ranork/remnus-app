# Write Tools

Write tools require a **write-scoped token**. Calling these with a read-scoped token returns an error and makes no changes.

---

## create_page

Create a new standalone page or a database row.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `title` | string | ✓ | Page title |
| `content` | string | | Initial markdown content |
| `parentId` | string | | Parent workspace item ID — creates a nested standalone page |
| `databaseId` | string | | Database ID — creates a row instead of a standalone page |
| `properties` | object | | Initial property values for database rows |

Pass either `parentId` (standalone page) or `databaseId` (database row), not both.

**Returns** — `{ id, type }`

---

## update_page

Update an existing page or database row. Properties are **merged** — existing properties that are not included in the call are preserved.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `pageId` | string | ✓ | Workspace item ID or database row ID |
| `title` | string | | New title |
| `content` | string | | New markdown content (replaces existing) |
| `properties` | object | | Properties to merge into the row |

**Returns** — `{ updated: true, id }`

---

## bulk_update

Update multiple pages or database rows in a single call.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `updates` | array | ✓ | Array of update objects — each has `pageId` plus optional `title`, `content`, `properties` |

**Returns** — array of per-item results.

---

## delete_page

Delete a workspace page, database, or database row. Requires `confirm: true` to execute. Without it, the tool returns a description of what would be deleted and makes no changes.

**Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `pageId` | string | ✓ | | Item to delete |
| `confirm` | boolean | | `false` | Set to `true` to confirm deletion |

Always call once without `confirm` first to verify the target before confirming.

**Returns** — `{ deleted: true, id }` on confirmation; a preview string otherwise.

---

## move_item

Move a sidebar item (page or database) to a new parent within the workspace.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `itemId` | string | ✓ | Workspace item ID to move |
| `newParentId` | string \| null | | New parent item ID — pass `null` to move to workspace root |

**Returns** — updated item object.

---

## create_database

Create a new database with a custom schema. A `Title` text column is always prepended automatically.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✓ | Database name |
| `parentId` | string | | Parent workspace item ID (omit for root) |
| `schema` | array | | Column definitions (omit for default Title + Status schema) |

**Column definition**

```json
{
  "name": "Status",
  "type": "select",
  "options": [
    { "value": "Backlog", "color": "default" },
    { "value": "In Progress", "color": "orange" },
    { "value": "Done", "color": "green" }
  ]
}
```

Column types: `text`, `number`, `select`, `multi_select`, `date`, `datetime`

**Returns** — `{ id, databaseId }`

---

## update_database_schema

Add or remove columns from an existing database. Removing columns is **destructive** (all data in that column is lost) and requires `confirm: true`.

**Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `databaseId` | string | ✓ | | Database ID |
| `addColumns` | array | | | Columns to add — same format as `create_database` schema |
| `removeColumnIds` | array | | | Column IDs to remove (find IDs via `get_database_schema`) |
| `confirm` | boolean | | `false` | Required when removing columns |

The `Title` column cannot be removed.

**Returns** — updated schema.
