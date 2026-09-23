# Dashboards

A **dashboard** is a third kind of workspace item, alongside pages and
databases. It is a status screen assembled from pre-defined blocks — metrics,
charts, embedded database views, short lists and text — that read live from the
workspace's own databases.

Its intended author is an agent. A dashboard has no HTML, no layout language
and no formula syntax: it is one strict JSON document, so an agent can produce a
whole status screen in a single small write and patch one tile of it later
without resending the rest. People can edit the same blocks from the page itself
— **Add block**, or the settings button on any tile.

## What a dashboard is not

- **It does not hold data.** Every block names a *source* — a `databaseId` plus
  filters — and the numbers are computed when the page is opened. Nothing is
  copied into the spec, so a dashboard cannot go stale, and deleting a database
  leaves a "source removed" tile rather than a lie.
- **It is not a page.** There is no markdown body, no comments panel and no
  child pages. Long-form content belongs on a page; a `text` block is for a
  heading or a one-line warning.
- **It is not a database view.** A `database_embed` block shows a view a
  database already has. The embed never rewrites that saved view.

## Tools

| Tool | What it does |
|---|---|
| [`create_dashboard`](write-tools.md#create_dashboard) | Creates the dashboard with its blocks in one call. |
| [`update_dashboard`](write-tools.md#update_dashboard) | Patches blocks **by id**: add, update, remove, reorder — plus title and icon. |
| [`get_page`](read-tools.md#get_page) | Reads a dashboard back as its `spec`; `mode: "outline"` returns just the block list. |
| [`delete_page`](write-tools.md#delete_page) | Deletes it (preview first, then `confirm: true`). It goes to Trash like any item. |

The block catalog is **not** in the tool schemas — those are sent to every
agent in every session. It is served on demand as the MCP resource
[`remnus://dashboard/catalog`](resources.md#remnusdashboardcatalog): the field
list of every block type, generated from the same schema the write tools
enforce, plus ready-made templates. This page is the human-readable copy.

A typical six-block dashboard costs about **270 tokens** to create (1,086 bytes
of arguments, measured with the project's bytes ÷ 4 convention), and changing
one tile afterwards costs a few dozen.

### Writing a dashboard

```json
{
  "title": "Sprint status",
  "icon": "lucide:PieChart",
  "blocks": [
    { "id": "open", "type": "metric", "title": "Open",
      "source": { "databaseId": "…", "filters": [ { "columnId": "Status", "operator": "not_equals", "value": "Done" } ] } },
    { "id": "mix", "type": "chart", "title": "By status", "variant": "donut", "groupBy": "Status",
      "source": { "databaseId": "…" } },
    { "id": "next", "type": "list", "title": "In progress", "showColumns": ["Priority"],
      "source": { "databaseId": "…", "filters": [ { "columnId": "Status", "operator": "equals", "value": "In Progress" } ] } }
  ]
}
```

- **Column fields take a name or an id**, case-insensitive (`columnId`,
  `groupBy`, `valueColumnId`, `sort.columnId`, `showColumns`, filter columns).
  The id is what gets stored, so renaming a column later does not break the
  block.
- **`databaseId`** can be the database id from the workspace map or the
  database's item id — both resolve.
- **Select and status values** must be real options; `"done"` is stored as
  `"Done"`. A value that is no option at all is reported as a warning.
- **`id` may be omitted**; one is generated (`metric1`, `chart2`, …) and
  returned, so you can patch the block later.

### Patching a dashboard

```json
{
  "dashboardId": "…",
  "add":    [ { "id": "cats", "type": "chart", "variant": "bar", "groupBy": "Category", "source": { "databaseId": "…" } } ],
  "update": [ { "id": "open", "title": "Still open", "unit": "tasks" } ],
  "remove": [ "intro" ],
  "order":  [ "open", "done" ]
}
```

- `update` entries are **merged** into the block they name: send only the
  fields that change. `null` removes an optional field. A block's `type` cannot
  change — remove it and add a new one.
- `order` lists block ids in their new order; blocks you leave out keep their
  relative order after them.
- The call is **all-or-nothing**, applied in the order remove → update → add →
  order. One bad entry refuses the whole call and says which entry and why.
- Two writers patching different blocks at the same moment both land: the
  write is compare-and-swap on the stored spec, and a lost race is re-applied
  to the newer version.

### What comes back

```json
{ "id": "…", "url": "https://www.remnus.com/dashboard/…",
  "blocks": ["open", "done", "high", "mix", "next", "cats"],
  "warnings": ["block \"typo\" source.filters.0.columnId: no column \"Stauts\" in \"Sprint Board\" — columns: Title, Status, Priority, Category"] }
```

An agent never sees the screen it builds, so the answer is its only feedback:

- `url` — where a human can look.
- `blocks` — every block id in display order.
- `warnings` — anything that will render empty or broken: an unknown column,
  a filter value that is no option, a filter that matches no rows right now, a
  link to an item that does not exist. Present only when there is something to
  say.

A refused write is an error that names the entry, the field and what was
expected — an unknown `type` lists the valid ones, an unknown field lists the
fields that type takes.

A database the workspace does not have — including another workspace's — is
refused outright, with the same message either way, so a refusal never
confirms that a foreign id exists.

## The spec

One versioned JSON document. The renderer and the write tools validate it with
the same schema; there is no second model anywhere.

Two rules the whole feature rests on:

1. **Every block has a stable `id`** (1–32 characters of `A–Z a–z 0–9 _ -`,
   unique within the dashboard). Blocks are patched, moved and deleted by id.
   Nothing may address a block by its position in the array.
2. **Blocks carry a source, never rows.** See above.

Objects are strict: an unknown field is a rejected write, not a silently dropped
one. Reads are lenient *per block* — a block this build cannot understand
renders as "this block could not be read" and costs exactly its own tile. A
patch only validates the blocks it touches, so such a block also survives edits
to its neighbours.

## Block catalog

`*` marks a required field. Every block also takes `id`, `title` (≤ 80
characters) and `width`.

| Type | What it shows | Fields |
|---|---|---|
| `metric` | One number — count, sum, average, min or max — with an optional unit and a trend against the previous period. | `source*`, `aggregate` (`count` default · `sum` · `avg` · `min` · `max`), `columnId` (required unless `count`), `unit` (≤ 16), `trend` `{columnId*, days* 1–365}` |
| `chart` | A bar, line or donut chart of one database grouped by one column. | `source*`, `variant*` (`bar` · `line` · `donut`), `groupBy*`, `bucket` (`day` · `week` · `month`, date columns only), `aggregate` (`count` · `sum`), `valueColumnId` (required for `sum`), `limit` 2–12 (default 8) |
| `database_embed` | A saved table or kanban view of a database, rendered as the real thing. | `databaseId*`, `viewId` (id or name; default the first view), `limit` 1–50 (default 10) |
| `list` | The first N rows of a filtered query, as a compact list of titles. | `source*`, `limit` 1–20 (default 5), `sort` `{columnId*, direction* asc/desc}`, `showColumns` (≤ 3) |
| `text` | Short markdown — a heading, an explanation, a warning. | `markdown*` (≤ 2,000), `tone` (`default` · `info` · `warning`) |
| `links` | Quick links to pages, databases or dashboards of this workspace. | `items*` — 1–12 of `{itemId*, label}` |
| `activity` | The most recent agent activity in this workspace. | `limit` 1–20 (default 6) |

`source` is `{ databaseId*, filters }`. Filters (up to 8, all must match) are
`{ columnId*, operator*, value }` with the same operators as database views —
`equals`, `not_equals`, `contains`, `not_contains`, `is_empty`, `is_not_empty` —
and are evaluated by the same code, so a filter selects the same rows in a view
and in a dashboard block. `value` is a string; `'["A","B"]'` matches any of the
listed values.

### Layout

`width` is `quarter`, `half` or `full` on a four-column desktop grid; on a phone
every block is full width. Omitting it gives the block type's own default
(`metric` and `links` a quarter, `database_embed` the full row, everything else
a half).

## Templates

The catalog resource carries three skeletons, so an agent fills in ids instead
of designing from scratch. Placeholders: `$DB` a databaseId; `$STATUS`,
`$OWNER`, `$DATE` column names; `$DONE` the status value that means finished.
Drop the blocks whose column the database does not have.

| Template | Needs | Blocks |
|---|---|---|
| `project-status` | `$DB`, `$STATUS`, `$DONE` | Open / Done / All metrics, a donut by status, a list of what is still open |
| `backlog-health` | `$DB`, `$STATUS`, `$DONE`, `$OWNER` | Open items, open items with no owner, a bar chart of open work per owner, a triage list |
| `weekly-pulse` | `$DB`, `$DATE` | A count with a 7-day trend, a weekly line chart, the latest rows, agent activity |

## Limits

- Cross-workspace sources are impossible, not merely refused: the renderer only
  ever looks up databases inside the dashboard's own workspace.
- Dashboards are not published through `/share/…`.
- Dashboards do not enter the content link graph, in either direction.
- Dashboards are not part of an OKF export.
- The block catalog is fixed; there are no user-defined block types.
