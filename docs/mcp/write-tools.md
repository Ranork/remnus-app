# Write Tools

Write tools require a **write-scoped token**. Calling these with a read-scoped token returns an error and makes no changes.

Every write tool also accepts optional `contextRunId`. In a workspace using **Strict context**, actual mutations require a non-expired ID returned by this same agent's `prepare_context` call. Destructive confirmation and normal authorization remain separate requirements. In Manual/Smart mode the field is optional.

`create_page`, `update_page`, and `create_database` additionally accept optional `knowledge` (`conceptType`, `description`, `tags`, `sources`, `status`, `staleAfter`). Agent-created or agent-updated items are recorded as machine-generated drafts; only a signed-in Remnus user can review the exact revision.

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
| `knowledge` | object | | OKF-aligned retrieval/lifecycle metadata |
| `contextRunId` | string | | Context preflight ID (required in Strict mode) |

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
| `knowledge` | object | | OKF-aligned retrieval/lifecycle metadata |
| `contextRunId` | string | | Context preflight ID (required in Strict mode) |

**Returns** — `{ updated: true, id }`

---

## bulk_update_pages

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

Column types: `text`, `number`, `select`, `multi_select`, `status`, `user`, `multi_user`, `date`, `datetime`, `checkbox`, `url`, `email`, `phone`

- `status` — like `select`, but each option may include a `group`: `"todo"` | `"in_progress"` | `"complete"` (renders as a progress-ring glyph).
- `user` / `multi_user` — store workspace member user ids (no `options` needed); resolved to member name + avatar in the UI.

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

---

## create_database_view

Add a new saved view (table, kanban, or calendar) to a database. Kanban groups rows by a select/status column; calendar places cards by a date/datetime column. Use `get_database_schema` first to see column ids/names.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `databaseId` | string | ✓ | Database ID |
| `name` | string | ✓ | Name for the new view |
| `type` | string | ✓ | `"table"` \| `"kanban"` \| `"calendar"` |
| `groupByCol` | string | | Kanban only: select/status column id or name. Auto-picks the first status/select column if omitted. |
| `dateCol` | string | | Calendar only: date/datetime column id or name. Auto-picks the first date/datetime column if omitted. |
| `icon` | string | | Emoji, `"lucide:Name"`, or image URL for the view tab |
| `iconColor` | string | | Theme color for a lucide icon |

A kanban view with no select/status column, or a calendar view with no date/datetime column, errors unless one is passed explicitly.

**Returns** — `{ created: true, view }`

---

## update_database_view

Rename a view, change its icon, or patch fields within its existing config (`filters`, `sorts`, `groupByCol`, `dateCol`, `cardProperties`, etc — merged into the current config). A view's type (table/kanban/calendar) can't be changed after creation; create a new view instead.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `databaseId` | string | ✓ | Database ID |
| `viewId` | string | ✓ | View ID (from `get_database_schema`) |
| `name` | string | | New view name |
| `icon` | string | | Emoji, `"lucide:Name"`, or image URL |
| `iconColor` | string | | Theme color for a lucide icon |
| `config` | object | | Partial config fields to merge in, e.g. `{ "groupByCol": "col_abc123" }` |

**Returns** — `{ updated: true, view }`

---

## delete_database_view

Delete a saved view. Requires `confirm: true`. A database must always keep at least one view — deleting the last one errors.

**Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `databaseId` | string | ✓ | | Database ID |
| `viewId` | string | ✓ | | View ID (from `get_database_schema`) |
| `confirm` | boolean | | `false` | Set to `true` to confirm deletion |

**Returns** — `{ deleted: true }`

---

## add_comment

Add a comment to a page or database row, in a thread separate from its markdown body — a place to leave running notes or a closure note as you work. Comments you add here cannot be edited or deleted by you afterward; use `update_page` for content you need to revise.

**Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `pageId` | string | ✓ | | Workspace item ID or database row ID |
| `body` | string | ✓ | | Comment text (max 4,000 characters) |
| `kind` | `"note"` \| `"closure"` | | `"note"` | Marks the comment as a running note or a closing note |

**Returns** — `{ id, createdAt }`
