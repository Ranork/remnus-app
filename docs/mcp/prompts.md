# Prompts

MCP prompts are reusable templates that fetch workspace data and return a filled message ready for LLM completion. The LLM call itself is performed by the client — prompts only prepare the input.

---

## summarize-page

Summarize a page or database row.

**Arguments**

| Argument | Type | Required | Default | Description |
|---|---|---|---|---|
| `page_id` | string | ✓ | | Workspace item ID or database row ID |
| `style` | `"bullet"` \| `"paragraph"` \| `"tldr"` | | `"paragraph"` | Summary style |

**Styles**

- `bullet` — key points as a bullet list
- `paragraph` — concise prose summary
- `tldr` — single-sentence summary

---

## weekly-status-report

Generate a weekly status report from a task database.

**Arguments**

| Argument | Type | Required | Default | Description |
|---|---|---|---|---|
| `database_id` | string | ✓ | | Database to generate the report from |
| `period` | string | | `"last week"` | Reporting period, e.g. `"this sprint"` |

The prompt groups items by status (Done / In Progress / Blocked / Backlog), highlights blockers, and surfaces key wins.

---

## kanban-triage

Review a kanban board and identify blockers, priorities, and next actions.

**Arguments**

| Argument | Type | Required | Description |
|---|---|---|---|
| `database_id` | string | ✓ | Database ID of the kanban board |

The prompt returns:
- Items needing immediate attention
- Blockers and their reasons
- Items that can be deprioritized
- The top 3 next actions

---

## extract-tasks

Extract all actionable tasks from a page.

**Arguments**

| Argument | Type | Required | Description |
|---|---|---|---|
| `page_id` | string | ✓ | Workspace item ID or database row ID |

Returns a markdown checklist. For each task: action, owner (if mentioned), deadline (if mentioned), and priority (if indicated).

---

## search-and-create

Search for similar existing pages and get content suggestions for a new page to avoid duplication.

**Arguments**

| Argument | Type | Required | Description |
|---|---|---|---|
| `title` | string | ✓ | Title of the page you want to create |
| `query` | string | ✓ | Search query to find similar existing content |

The prompt returns a markdown outline for the new page that complements (rather than duplicates) the existing content found by `query`.

---

## save-memory

Persist a durable memory — a decision, preference, gotcha, or fact — into your **Agent Memory** database as a structured, human-readable record. Pairs with `recall-context` to give a long-running agent a workspace-backed memory.

**Arguments**

| Argument | Type | Required | Default | Description |
|---|---|---|---|---|
| `content` | string | ✓ | | The thing to remember, in plain language |
| `memory_type` | `"decision"` \| `"preference"` \| `"gotcha"` \| `"fact"` | | `"fact"` | Kind of memory |
| `tags` | string | | | Comma-separated tags, e.g. `"architecture, api"` |
| `database_id` | string | | | Target memory database ID. Omit to auto-locate an Agent Memory database |

The prompt resolves the target database (or, if none exists, returns instructions to create one from the **Agent Memory** template shape) and hands back a filled instruction telling the agent exactly what structured row to write with `create_page`: a concise summary title, the `Type`/`Tags`/`Date` properties, and the full memory as the body. The prompt only prepares the instruction — the agent performs the write with the [write tools](write-tools.md).

> **Tip** — start from the built-in **Agent Memory** template (New item → Templates) so the `Type` / `Tags` / `Date` columns already exist. See [Agent Memory](agent-memory.md).

---

## recall-context

Recall everything the workspace already knows about a topic in **one compact package**: the top matching pages, each collapsed to a token-cheap outline, plus the link-graph neighborhood of the best match.

**Arguments**

| Argument | Type | Required | Default | Description |
|---|---|---|---|---|
| `topic` | string | ✓ | | What to recall context about |
| `limit` | number | | `6` | Maximum pages to include (1–12) |

The prompt runs `search_workspace`, collapses each hit to a heading-and-first-line outline (the same collapse `get_page`'s outline mode uses), and appends the parent / children / outgoing links / backlinks of the top hit from the [link graph](read-tools.md#get_related_pages). The result loads prior context in a single message instead of many `search_workspace` + `get_page` round-trips — fetch a full body with `get_page` only when an outline shows you need the detail.
