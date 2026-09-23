## Remnus workspace

This project is connected to the Remnus workspace **{{WORKSPACE_NAME}}** ({{SCOPE}}
access) via the `remnus` MCP server — durable project knowledge (decisions, plans,
task state) meant to outlive a single session.

`.remnus/config.json`'s `calibrated` field records whether this workspace has been
populated for this project yet. If it's `false`, a one-time setup guide is available
at {{CALIBRATE_URL}} — optional, for whichever agent wants to run it; the workspace
also works as-is without it. A `Calibration Log` page with unticked steps is a run
that was interrupted: resume it with that guide rather than starting over.

**Using it, in this order:**
1. Orient from `.remnus/workspace-map.md` (cached: titles, ids, row counts, body
   sizes) — grep it instead of listing the tree over MCP. Its `cursor:` line marks
   how far it is verified.
2. Before writing, or if it looks stale, `get_changes_since` with that cursor —
   never re-crawl. No map file? Call it once with no cursor.
3. Read narrowly: `get_page` (`mode: "outline"` for long pages), `query_database`
   with `fields`; `prepare_context` before non-trivial work, keeping its
   `contextRunId` for related writes.
4. `search_workspace` last, not first.
- Write down decisions, gotchas, and state changes as they happen — not just in conversation.
- `update_page` merges (send only what changed); check `get_database_schema` before
  writing rows; batch with `bulk_*`; destructive calls need `confirm: true`
  (preview first, confirm only with the human).
- Rejected or wrong-workspace token → tell the human to run `npx remnus doctor`;
  don't work around a broken connection with local notes instead.
- No Remnus tools here and no `.remnus/credentials.json`? That is a fresh clone —
  tell the human to run `npx remnus join` (not `init`).
