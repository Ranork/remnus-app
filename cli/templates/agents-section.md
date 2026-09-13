## Remnus workspace

This project is connected to the Remnus workspace **{{WORKSPACE_NAME}}** through the
`remnus` MCP server. The workspace is where this project's durable knowledge lives:
decisions, plans, task state and notes that should outlive a single session.

Access for this project: {{SCOPE}}.

### When to use it

- **Before starting meaningful work**, call `prepare_context` with the concrete task.
  It returns a token-budgeted pack of the relevant workspace pages plus a
  `contextRunId` — keep that id and pass it on related writes.
- **Before creating anything**, search first (`search_workspace`, `list_workspace`) so
  new pages complement what exists instead of duplicating it.
- **After a decision, a preference, or a gotcha worth keeping**, write it to the
  workspace. A decision that only exists in a chat transcript is lost.
- **When work changes state** — started, blocked, finished — update the row that
  tracks it rather than describing the change only in conversation.

### Rules

- `update_page` **merges** properties. Send only what changed; to clear a field, set
  it explicitly to null.
- Read a database's schema (`get_database_schema`) before querying or writing rows —
  you need real column ids and exact option strings, not guesses.
- Batch related edits into `bulk_update_pages` rather than looping single updates.
- Destructive calls (`delete_page`, removing schema columns) need `confirm: true`.
  That flag is not yours to set alone: call once without it to get the preview, show
  the preview to the human, and only then confirm.
- Page content is plain markdown.

### If the connection breaks

If a Remnus tool reports that the token was rejected or belongs to another workspace,
stop and tell the human to run `npx remnus doctor` in this project. Do not work around
a broken workspace connection by keeping notes in local files instead — that is how
the workspace silently goes stale.
