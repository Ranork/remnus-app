## Remnus workspace

This project is connected to the Remnus workspace **{{WORKSPACE_NAME}}** ({{SCOPE}}
access) via the `remnus` MCP server — durable project knowledge (decisions, plans,
task state) meant to outlive a single session.

`.remnus/config.json`'s `calibrated` field records whether this workspace has been
populated for this project yet. If it's `false`, a one-time setup guide is available
at {{CALIBRATE_URL}} — optional, for whichever agent wants to run it; the workspace
also works as-is without it.

**Using it:**
- Search first (`search_workspace`/`list_workspace`) before creating anything.
- Call `prepare_context` before non-trivial work; keep its `contextRunId` for related writes.
- Write down decisions, gotchas, and state changes as they happen — not just in conversation.
- `update_page` merges (send only what changed); check a database's schema
  (`get_database_schema`) before writing rows; batch edits with `bulk_update_pages`;
  destructive calls need `confirm: true` (preview first, confirm only with the human).
- Rejected or wrong-workspace token → tell the human to run `npx remnus doctor`;
  don't work around a broken connection with local notes instead.
