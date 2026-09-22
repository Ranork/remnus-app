# Dashboards

> **Status: not yet in the wiki nav.** This page is deliberately absent from
> `WIKI_PAGES` in `src/lib/content/manifest.ts`. Dashboards exist in the product
> today, but the MCP tools that create and patch them do not — publishing a
> reference page under `/wiki` that documents tools an agent cannot call would
> advertise a capability that has not shipped. The task that adds
> `create_dashboard` / `update_dashboard` adds the manifest entry in the same
> change, and fills in the **Tools** section at the bottom.

A **dashboard** is a third kind of workspace item, alongside pages and
databases. It is a status screen assembled from pre-defined blocks — metrics,
charts, embedded database views, short lists and text — that read live from the
workspace's own databases.

Its intended author is an agent. A dashboard has no HTML, no layout language
and no formula syntax: it is one strict JSON document, so an agent can produce a
whole status screen in a single small write and patch one tile of it later
without resending the rest.

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

## The spec

One versioned JSON document, validated by
[`src/lib/dashboard/schema.ts`](../../src/lib/dashboard/schema.ts) — the single
source of truth for both the renderer and (from the MCP task on) the write
tools.

```json
{
  "version": 1,
  "blocks": [
    { "id": "open", "type": "metric", "title": "Open tasks",
      "source": { "databaseId": "…", "filters": [ { "columnId": "status", "operator": "not_equals", "value": "Done" } ] },
      "aggregate": "count" },
    { "id": "mix", "type": "chart", "variant": "donut", "groupBy": "status",
      "source": { "databaseId": "…" } }
  ]
}
```

Two rules the whole feature rests on:

1. **Every block has a stable `id`** (1–32 characters of `A–Z a–z 0–9 _ -`,
   unique within the dashboard). Blocks are patched, moved and deleted by id.
   Nothing may address a block by its position in the array.
2. **Blocks carry a source, never rows.** See above.

Objects are strict: an unknown field is a rejected write, not a silently dropped
one. Reads are lenient *per block* — a block this build cannot understand
renders as "this block could not be read" and costs exactly its own tile.

## Block catalog

| Type | What it shows |
|---|---|
| `metric` | One number from a database — count, sum, average, min or max, with an optional unit and a trend against the previous period. |
| `chart` | A bar, line or donut chart of one database grouped by one column. A date column plus `bucket` gives a time axis. |
| `database_embed` | A saved view of an existing database, rendered as its real table or kanban board. |
| `list` | The first N rows of a filtered query, as a compact list of titles. |
| `text` | Short markdown — a heading, an explanation, a warning. Capped at 2,000 characters. |
| `links` | Quick links to chosen pages, databases or dashboards of this workspace. |
| `activity` | The most recent agent activity in this workspace. |

Filters use the same operator set as database views (`equals`, `not_equals`,
`contains`, `not_contains`, `is_empty`, `is_not_empty`) and are evaluated by the
same code, so a filter selects the same rows in a view and in a dashboard block.

### Layout

`width` is `quarter`, `half` or `full` on a four-column desktop grid; on a phone
every block is full width. Omitting it gives the block type's own default
(`metric` a quarter, `database_embed` the full row, everything else a half).

## Limits

- Cross-workspace sources are impossible, not merely refused: the renderer only
  ever looks up databases inside the dashboard's own workspace.
- Dashboards are not published through `/share/…`.
- Dashboards do not enter the content link graph, in either direction.
- Dashboards are not part of an OKF export.
- The block catalog is fixed; there are no user-defined block types.

## Tools

*(Added by the task that ships `create_dashboard` / `update_dashboard`. Until
then a dashboard is created from the workspace's "New item" menu and filled by
writing its spec.)*
