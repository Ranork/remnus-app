# Agent Memory

Agent Memory turns a Remnus workspace into a durable, human-readable memory your AI agent can save to and recall from over MCP — decisions, preferences, gotchas, and facts that would otherwise be lost when the conversation ends. Unlike an opaque vector store, every memory is an ordinary page you can read, edit, and organize yourself.

The pieces are already in Remnus: a ready-made **Agent Memory** database template and two MCP prompts — `save-memory` and `recall-context` — that write and read it in a token-efficient way.

## Why a workspace instead of a vector store

Most "agent memory" products hide your agent's memory inside embeddings you can't read. Remnus takes the opposite stance: memory is content. It lives in the same workspace as everything else, so you can browse it in a table, correct a wrong memory, group it by type, share it, and see exactly what your agent believes about your project.

Because the workspace structure already exists — pages, database schemas, the [link graph](read-tools.md#get_related_pages) — recall stays cheap. `recall-context` returns outlines, not full bodies, and only the neighborhood of the best match, so reloading prior context costs a fraction of re-reading everything.

## The Agent Memory template

Create the store from **New item → Templates → Agent Memory**. It's a database with the columns a memory needs:

| Column | Type | Purpose |
|---|---|---|
| `Title` | text | A concise, self-contained summary of the memory |
| `Type` | select | `Decision` · `Preference` · `Gotcha` · `Fact` |
| `Tags` | multi-select | Free-form labels (e.g. `architecture`, `api`) |
| `Date` | date | When the memory was recorded |

It ships with a **Table** view and a **By Type** board so you can browse memories grouped by kind. Every row is a full page, so the summary lives in the title and the full detail lives in the body.

You don't have to use the template — any database works — but starting from it means the `Type` / `Tags` / `Date` columns already exist, so `save-memory` can write structured records immediately.

## Saving a memory

Use the [`save-memory`](prompts.md#save-memory) prompt. Give it the thing to remember, optionally a `memory_type` (`decision` / `preference` / `gotcha` / `fact`) and `tags`:

```
Prompt: save-memory
  content: "The staging API rate-limits at 100 req/min — batch writes."
  memory_type: gotcha
  tags: api, infra
```

The prompt locates your Agent Memory database (or tells the agent to create one), then returns a filled instruction telling the agent exactly what structured row to write with [`create_page`](write-tools.md#create_page): a summary title, the `Type` / `Tags` / `Date` properties, and the full memory as the body. The prompt only prepares the instruction — the agent performs the write, and it shows up in the [audit log](read-tools.md#query_audit_log) like any other change.

## Recalling context

Use the [`recall-context`](prompts.md#recall-context) prompt at the start of a session to reload what the workspace already knows:

```
Prompt: recall-context
  topic: "rate limiting"
```

It searches the workspace, collapses each hit to a heading-and-first-line outline (the same collapse [`get_page`](read-tools.md#get_page)'s outline mode uses), and appends the parent / children / links / backlinks of the top match from the link graph — all in a single message. The agent gets oriented without a chain of `search_workspace` + `get_page` calls, and fetches a full body only when an outline shows it's worth it.

## A typical loop

1. **Start of session** — `recall-context` on the topic you're working on to reload prior decisions and gotchas.
2. **During work** — as the agent learns something durable (a decision, a constraint, a preference), `save-memory` records it.
3. **Later** — browse the Agent Memory database yourself, fix anything wrong, and the next `recall-context` reflects your edits.

Because memories are just pages, they also flow through the rest of the MCP surface: [`get_changes_since`](read-tools.md#get_changes_since) lets a recurring agent sync only new memories, and [`get_related_pages`](read-tools.md#get_related_pages) walks from a memory to the pages it references.

## See also

- [Prompts](prompts.md) — full argument reference for `save-memory` and `recall-context`
- [Read Tools](read-tools.md) — `get_page` outline mode, `get_related_pages`, `get_changes_since`
- [Write Tools](write-tools.md) — `create_page`, `create_database`
