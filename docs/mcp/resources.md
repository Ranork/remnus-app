# Resources

MCP resources provide structured, addressable data that clients can subscribe to or read on demand. Remnus exposes seven resources: five templates addressed by id, plus the static dashboard catalog and recent audit log.

---

## remnus://workspace/{id}/knowledge-health

Get a compact heuristic report covering orphan concepts, broken references, OKF freshness/lifecycle, and human-review coverage.

**URI** — `remnus://workspace/{workspaceId}/knowledge-health`

**Mime type** — `application/json`

The score is an orientation signal, not a factual-accuracy or security certification.

The report uses native knowledge metadata when it exists: broken links, orphan concepts, lifecycle/freshness state, and exact-current-revision human-review coverage. Imported `human:*` assertions remain external claims and do not increase Remnus's local human-reviewed count. Use the resource to find maintenance work, not to certify that a statement is true.

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

**Returns** — an indented markdown tree, one line per item, carrying titles, ids, database row counts, page body sizes and last-updated dates, under a header that opens with a sync cursor:

```markdown
# Workspace digest

cursor: eyJ0cyI6MTc5MDA3MzYxMTAwMCwiaWQiOiJ-In0
4 items (3 pages, 1 databases). Dates are last-updated (YYYY-MM-DD); chars = body size.
Read a page with get_page(id) — mode:"outline" for a cheap skim of a long one — and rows with query_database(databaseId, fields:[…]).
Later, sync with get_changes_since(cursor) instead of re-reading this.

- [page] Start Here (id: a09c…, 820 chars, updated: 2026-06-28)
  - [page] How This Was Built (id: 6e02…, 14k chars, updated: 2026-06-28)
- [database] Sprint Board (id: f1c6…, databaseId: f0e6…, rows: 16, updated: 2026-07-01)
```

**The `cursor:` line** is taken *before* the map is assembled, so nothing can slip between the two. Keep it: [`get_changes_since(cursor)`](read-tools.md#get_changes_since) then returns the delta since this map rather than the tree again — the whole point of reading the digest once instead of every turn.

**`chars`** is the page's body size, so you can pick `get_page` with `mode: "outline"` for a long page up front instead of paying for a full read to discover it was long.

**Token tip** — a whole workspace fits in a few hundred tokens here, versus paginating `list_workspace` and probing pages one by one. Read the digest first, then fetch only what you need. In a project set up with [`remnus init`](project-install.md), this same map is cached on disk as `.remnus/workspace-map.md`, which an agent can grep without a round-trip.

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

## remnus://dashboard/catalog

The reference an agent reads before [`create_dashboard`](write-tools.md#create_dashboard): every block type with its fields (generated from the same schema the write tools enforce, so it cannot drift), the rules for sources, filters and column references, and three ready-made templates (`project-status`, `backlog-health`, `weekly-pulse`) to fill in instead of designing from scratch.

**URI** — `remnus://dashboard/catalog`

**Returns** — Markdown, about 6 KB (~1,500 tokens). It lives here rather than in the tool schemas because `tools/list` is paid by every session and this only by one that builds a dashboard. Human-readable copy: [Dashboards](dashboards.md).

---

## remnus://audit-log/recent

Get the 50 most recent audit log entries for the current MCP token.

**URI** — `remnus://audit-log/recent`

**Mime type** — `application/json`

**Returns** — array of activity records with `tool`, `status`, `targetType`, `targetId`, and `createdAt`.
