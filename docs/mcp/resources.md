# Resources

MCP resources provide structured, addressable data that clients can subscribe to or read on demand. Remnus exposes five resource templates.

---

## remnus://workspace/{id}/schema

Get the full JSON schema of a workspace — all databases with their column definitions.

**URI** — `remnus://workspace/{workspaceId}/schema`

**Mime type** — `application/json`

**Returns**

```json
{
  "workspaceId": "abc123",
  "databases": [
    {
      "id": "db456",
      "title": "Work Plan",
      "schema": [
        { "id": "title", "name": "Title", "type": "text" },
        { "id": "col_abc123", "name": "Status", "type": "select", "options": [
          { "value": "Backlog", "color": "default" },
          { "value": "Done", "color": "green" }
        ]}
      ]
    }
  ]
}
```

---

## remnus://workspace/{id}/digest

Get a compact, one-line-per-item map of the whole workspace — the cheapest way for an agent to orient before making targeted reads.

**URI** — `remnus://workspace/{workspaceId}/digest`

**Mime type** — `text/markdown`

**Returns** — an indented markdown tree, one line per item, carrying titles, ids, database row counts, and last-updated dates:

```markdown
# Workspace digest

4 items (3 pages, 1 databases). Dates are last-updated (YYYY-MM-DD).
Read a page with get_page(id) — use mode:"outline" for a cheap skim — and rows with query_database(databaseId, fields:[…]).

- [page] Start Here (id: a09c…, updated: 2026-06-28)
  - [page] How This Was Built (id: 6e02…, updated: 2026-06-28)
- [database] Sprint Board (id: f1c6…, databaseId: f0e6…, rows: 16, updated: 2026-07-01)
```

**Token tip** — a whole workspace fits in a few hundred tokens here, versus paginating `list_workspace` and probing pages one by one. Read the digest first, then fetch only what you need.

---

## remnus://page/{id}

Get the markdown content and properties of any page or database row.

**URI** — `remnus://page/{pageId}`

**Mime type** — `text/markdown`

**List** — `resources/list` returns the 20 most recently updated pages in the workspace. All other pages are accessible directly by their ID.

**Returns** — markdown with properties listed under a `## Properties` heading, followed by the page content.

---

## remnus://database/{id}/schema

Get the column schema of a specific database.

**URI** — `remnus://database/{databaseId}/schema`

**Mime type** — `application/json`

**List** — `resources/list` returns one entry per database in the workspace.

**Returns**

```json
{
  "schema": [
    { "id": "title", "name": "Title", "type": "text" },
    { "id": "col_abc123", "name": "Status", "type": "select", "options": [...] }
  ]
}
```

---

## remnus://audit-log/recent

Get the 50 most recent audit log entries for the current MCP token.

**URI** — `remnus://audit-log/recent`

**Mime type** — `application/json`

**Returns** — array of activity records with `tool`, `status`, `targetType`, `targetId`, and `createdAt`.
