---
name: remnus
description: Read and edit a Remnus workspace (Notion-like pages and databases) through the Remnus MCP server. Use whenever the user wants to find, read, create, update, organize, or report on Remnus pages, database rows, or schemas via the `remnus` MCP tools.
---

# Working with Remnus

Remnus is a Notion-like workspace. You interact with it through the **`remnus` MCP server** — a single connected workspace exposed via bearer-token auth. Every call already runs inside one fixed workspace; you never pass a workspace ID.

The server exposes all three MCP primitives:
- **Tools** — actions you call to read and write (the bulk of your work).
- **Resources** — read-only data you can attach as context, addressed by `remnus://…` URIs.
- **Prompts** — server-side templates that fetch + format data for common tasks (summaries, reports, triage).

Use the right one: resources to *pull context cheaply*, tools to *act*, prompts to *kick off a structured task*.

## The data model (read this first)

Two kinds of things live in the workspace, side by side in one sidebar tree:

- **Pages** — a title + markdown `content`. Can be nested under a parent (`parentId`).
- **Databases** — a typed `schema` (columns) plus rows. **Each row is itself a page**: it has a `title`, markdown `content`, an icon, AND a `properties` object keyed by column.

So "a page" can mean a standalone page *or* a database row. Most read tools auto-detect which, so you rarely need to care — but when you create or update, the distinction matters (see below).

Column types: `text` | `number` | `select` | `multi_select` | `date` | `datetime`.
`multi_select` values are **arrays**; everything else is scalar.

## Tools at a glance

**Read (safe, always allowed):**
- `search_workspace` — find pages/databases by title. Your usual entry point.
- `list_workspace` — list items, optionally under a `parentId`. Paginated.
- `get_page` — full content of a page or row by ID. Auto-detects type.
- `get_database_schema` — columns only, no rows. Cheap; call before querying.
- `query_database` — schema + rows, with optional `filters`. Paginated.
- `list_members` — workspace members and roles.
- `query_audit_log` — history of MCP tool calls (yours and other agents').

**Write (needs a write-scoped token):**
- `create_page` — new standalone page OR database row (see decision below).
- `update_page` — change title/content/properties of one item.
- `bulk_update_pages` — many updates in one call. Prefer this over a loop.
- `delete_page` — delete a page, row, or whole database. **Guarded.**
- `move_item` — reparent a sidebar item; `newParentId: null` → root.
- `create_database` — new database with a custom schema.
- `update_database_schema` — add/remove columns. Removing is **guarded.**

If a write tool returns "This token only has read scope," the user connected a read-only token — tell them; do not retry.

## Resources — `remnus://…`

Resources are read-only and listable; many clients let you attach them directly as context, which is cheaper and cleaner than a tool round-trip when you just need to *read*:

- `remnus://workspace/{id}/schema` — every database in the workspace plus its columns, in one document. Best first pull to understand what databases exist and their shapes.
- `remnus://database/{id}/schema` — columns of one database (same data as `get_database_schema`).
- `remnus://page/{id}` — a page or row rendered as markdown (title + properties + content). Listing returns the 20 most recently updated; any page is reachable by its ID.
- `remnus://audit-log/recent` — the last 50 activity entries for *this* token.

Rule of thumb: if the user just wants you to **read/understand**, prefer attaching the resource. If you need to **filter, paginate, or act**, use the equivalent tool (`query_database`, `get_page`, etc.). The schema resources and the `get_database_schema` tool return the same thing — either is fine.

## Prompts — structured task starters

The server ships five prompt templates that pre-fetch the relevant Remnus data and hand you a ready-to-run instruction. When the client surfaces prompts, **prefer them** over assembling the same context by hand:

- `summarize-page` — `page_id`, optional `style` (`bullet` | `paragraph` | `tldr`).
- `weekly-status-report` — `database_id`, optional `period` (e.g. "last week"). Groups by status, flags blockers/wins.
- `kanban-triage` — `database_id`. What needs attention, what's blocked, what to deprioritize, next 3 actions.
- `extract-tasks` — `page_id`. Pulls actionable items into a markdown checklist (action / owner / deadline / priority).
- `search-and-create` — `title` + `query`. Finds similar existing pages so a new one complements rather than duplicates.

These only *fetch and format* — the actual writing/analysis is yours. If a client doesn't expose prompts, reproduce them: query the data with the read tools, then do the summary/triage yourself.

## Core rules — do not skip these

### 1. Inspect before you act
Don't guess IDs or column names. Start from `search_workspace` or `list_workspace`, and run `get_database_schema` before `query_database` / before writing rows. You need real column IDs and the exact `select` option strings — invented values silently produce empty filters or unset properties.

### 2. `update_page` MERGES properties — it never replaces
Passing `properties: { status: "Done" }` changes only `status`; every other property is untouched. To *clear* a field, set it explicitly to `null`/`""`. Never re-send the whole property bag thinking you must preserve it — you don't, and doing so risks clobbering changes made since you read.

### 3. Confirm destructive operations with the human, not just the flag
`delete_page` and `update_database_schema` (when removing columns) require `confirm: true`. That flag is a safety latch, not your decision to make:
- Call them **once without `confirm`** to get the preview ("This will permanently delete …").
- Show that preview to the user and get an explicit yes.
- Only then call again with `confirm: true`.
Deleting a database row is irreversible; deleting a database or a parent page cascades to its children. Removing a column destroys that column's data across all rows.

### 4. Filtering & pagination
- `query_database` filters use column ID → value: `{ "col_status": "Done" }`. For `multi_select`, pass an array: `{ "col_tags": ["Bug"] }`. Get exact IDs/options from `get_database_schema`.
- When a response has `hasMore: true`, pass its `nextCursor` back as `cursor` to get the next page. Keep going until `hasMore` is false if the user asked for "all". Don't crank `limit` to a huge number to dodge pagination.

### 5. create_page: page vs row
- **Standalone page** → pass `title`, `content`, optional `parentId`.
- **Database row** → pass `databaseId` (+ `title`, `content`, `properties`). The row is created inside that database.
Don't pass both `parentId` and `databaseId`. Property keys must match the database's column IDs.

### 6. Batch, don't loop
Updating several rows (e.g. "mark all done")? Build one `bulk_update_pages` call. It's one audit entry and one round-trip instead of N.

### 7. Content is markdown
`content` is plain markdown. Headings, lists, tables, checkboxes (`- [ ]`) all work. Write clean markdown, not HTML.

## Common recipes

**"Find X and show me"** → `search_workspace` → `get_page` on the best hit.

**"What's in my Tasks database?"** → `search_workspace` (or `list_workspace`) to get the DB id → `get_database_schema` → `query_database` (filter/paginate as needed).

**"Mark these tasks done" / bulk edits** → `get_database_schema` for the status column id and the "Done" option string → `query_database` to resolve row IDs → one `bulk_update_pages`.

**"Add a new task"** → resolve the database id → `get_database_schema` for property keys → `create_page` with `databaseId` + `properties`.

**"Set up a database for X"** → `create_database` with a sensible schema (a Title column is auto-prepended). Then `create_page` rows.

**Reports / triage / summaries** → use the matching **prompt** (see the Prompts section). Fall back to read-tools + your own summary if prompts aren't exposed.

## When unsure
Ask the user which workspace item or database they mean rather than acting on a fuzzy match — titles repeat. Surface the audit log (`query_audit_log`) if they ask "what did the agent change?"
