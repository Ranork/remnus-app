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
