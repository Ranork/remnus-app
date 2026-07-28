# Current task

## Status

Done. Type-checked, linted. Not live-probed against a running server this round (user asked to skip Playwright/browser verification earlier in the session; kept the same posture here since these are small, well-understood MCP changes).

## Active agent

Claude Code

## Branch

master

## Goal

Act on an external review doc (`remnus-mcp-oneriler.md`) of the MCP server, written by probing `initialize`/`tools/list`/`resources/list`/`prompts/list` directly. Verified each claim against the actual code (not taken at face value) before fixing anything — one claim (delete_page "looks like success") turned out to already be handled correctly, one (`create_database` "two titles") was a correct symptom attributed to the wrong function. Implemented the 4 fixes the user asked for.

## Completed (this round)

- `src/app/api/mcp/route.ts` — `new McpServer(...)` now passes `{ instructions: buildInstructions(ctx) }` as a second arg (previously omitted entirely, so `initialize` never returned an `instructions` field). `buildInstructions` is short and scope-aware: always points at `remnus://workspace/{id}/digest` for orientation and names `recall-context`/`save-memory` explicitly (the two prompts an agent couldn't discover without probing raw JSON-RPC); adds a write-semantics line only when `ctx.scope === 'write'`. Deliberately does **not** inline the full digest text — `getWorkspaceDigest` is one line per workspace item, unbounded, and would ride on every request.
- `src/app/api/mcp/route.ts` — `json()` and `withMcpHeader()` now force `Content-Type: application/json; charset=utf-8`. Root cause was in the third-party MCP SDK's transport (`WebStandardStreamableHTTPServerTransport`), which replies with a bare `application/json`; fixed by normalizing the header on the way out instead of patching the SDK.
- `src/lib/services/workspace.ts` (`updatePageById`) — **real bug, independently confirmed by tracing the code, not just taking the doc's word for it**: passing `title` to `update_page` updated `pages.title` but left `properties.title` untouched, and table views render a row's name from `properties.title` — so an MCP-driven rename silently didn't show up in the UI. Fixed by always syncing `title` into `properties.title` when either `title` or `properties` is patched; an explicit `properties.title` in the same call still wins over the plain `title` field.
- `src/app/api/mcp/tools/write.ts` — enriched `create_page`/`update_page`/`bulk_update_pages` descriptions (previously 40-58 chars vs. 100-465 chars for their siblings in the same file). Now document the properties-merge semantics, the title-sync behavior above, and — accurately, not aspirationally — that `bulk_update_pages` is `Promise.all`-based: one invalid id fails the whole batch with no partial results (did not change this behavior, just stopped the description from implying otherwise).

## Changed files (this round)

- `src/app/api/mcp/route.ts`
- `src/app/api/mcp/tools/write.ts`
- `src/lib/services/workspace.ts`

## Verification (this round)

- `npx tsc --noEmit` — clean.
- `npm run lint` on the 3 changed files — 0 errors (2 pre-existing unrelated warnings in `workspace.ts`).
- Confirmed via SDK source (`node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.d.ts` + `mcp.js`) that `McpServer`'s second constructor arg accepts `instructions` and passes it straight to the underlying `Server`.
- Not re-verified live against a running MCP client this round (see Status).

## Open question raised by the user (not yet actioned)

Databases created **before** the `id`-column work (prior task below) don't have the column at all — expected/by-design (seeding only happens in the create paths, no backfill was built, deliberately, since it was scoped to "yeni bir database açıldığında"). Asked the user whether they want a backfill for existing databases; local `.env.local`'s `DATABASE_URL` looks like a short local file path (not a Turso remote URL, based on length only — didn't read the actual value), so a local backfill would be low-risk, but which environment(s) to target is their call before anything runs.

## Next exact step

Wait for the user's answer on the backfill question. No commit made yet.

---

## Prior task (id column + bulk import work)

## Goal

Expose each database row's real primary key (`pages.id`, currently invisible) as a schema column so it can be shown in the table and — critically — used as a precise match key in the bulk-update feature (see prior task below), instead of relying on Title (which can have duplicates). Requirements from the user: immutable (never editable, never settable via paste), and hidden by default on new databases (toggleable back on via the existing "Toggle Columns" UI).

## Completed

- **New column type `'id'`** (a synthetic/computed column — its value is always `page.id`, never stored in `pages.properties`):
  - `src/lib/utils/propertyCoercion.ts` — `coerceRowValues` treats `id`-type columns like `user`/`multi_user` (never written), but now also returns `rawByColumnId` (every matched column's raw pasted value, keyed by column id) so callers can match on a non-writable column without needing a "written" value.
  - `src/lib/actions/page.ts` — `bulkUpdatePagesByMatch` special-cases `matchCol.type === 'id'`: builds the match map directly from each existing row's real `pages.id` (not from `properties`), and reads the pasted match value from `rawByColumnId` instead of the coerced `properties`.
  - `src/components/features/BulkRowsDialog.tsx` — new `isMatchableColumn` (excludes only `user`/`multi_user`) separate from `isWritableColumn` (also excludes `id`), so "ID" appears in the match-column dropdown despite never being written; when it's the active match column its pasted header is also treated as "matched" (not "ignored") in the preview.
- **Seeded into new databases** (mirrors the existing `'title'`-guarantee pattern):
  - `src/lib/actions/workspace.ts` (`createWorkspaceDatabase`) and `src/lib/services/workspace.ts` (`createDatabaseInWorkspace`) — both now include/guarantee an `{ id: 'id', name: 'ID', type: 'id' }` column in freshly-created schemas (covers: `/database` slash command, `SubItemsPanel` add-sub-item, MCP `create_database`, Notion import).
  - `src/lib/templates.ts` — the **`db-blank` "Blank Database" template** (the actual "New Item" picker option a user reaches for a "normal" database — discovered during testing that it's a hardcoded template, not the schema-less code path) now also seeds the `id` column. Extended `SchemaColumn['type']` union to include `'id'`. The 4 other, more opinionated templates (Task Tracker, Event Calendar, Reading List, Agent Memory) were deliberately **not** touched — out of scope per "normal" database wording.
- **Hidden by default**:
  - `src/components/features/DatabaseView.tsx` — `defaultTableView(schema, name)` now takes `schema` and seeds `hiddenColumns: ['id']` when the column exists; both call sites (initial-views fallback, "add view" handler) updated.
  - `src/lib/templates.ts` — `db-blank`'s Table view config sets `hiddenColumns: ['id']`.
- **Immutable in the UI**:
  - `src/components/features/TableLayout.tsx` — cell click handler no longer opens `InlineCellEditor` for `col.type === 'id'`; renders the real `page.id` directly (monospace, selectable/copyable text) instead of a (nonexistent) `properties.id` value. `GroupedTableLayout.tsx` needed no change — it wraps `TableLayout` per group.
  - `src/components/features/database-sidebar/PropertiesPanel.tsx` — type dropdown is `disabled` for `id`-type columns (with a hidden `<option value="id">` so the disabled select still renders the right label instead of blank); rename and delete remain allowed (harmless, unlike Title).
  - `src/components/features/database-sidebar/shared.tsx` — added a `Fingerprint` icon for the `id` type in `getPropertyIcon`.
- i18n — added `Database.typeId` ("ID") to all 8 locale files, used by the now-locked type dropdown.

## Changed files

- `src/lib/utils/propertyCoercion.ts`
- `src/lib/actions/page.ts`
- `src/lib/actions/workspace.ts`
- `src/lib/services/workspace.ts`
- `src/lib/templates.ts`
- `src/components/features/DatabaseView.tsx`
- `src/components/features/TableLayout.tsx`
- `src/components/features/BulkRowsDialog.tsx`
- `src/components/features/database-sidebar/PropertiesPanel.tsx`
- `src/components/features/database-sidebar/shared.tsx`
- `messages/{en,tr,es,fr,de,zh,ru,hi}.json`

## Decisions

- `id`-type is **not** offered in the "Add property" type dropdown — it's exclusively system-seeded (one per database, fixed column id `'id'`), since its value is always `page.id` and doesn't make sense as a user-chosen/duplicable type.
- **Not retroactive** — only newly-created databases (via the paths above) get the column. Existing databases (e.g. the demo workspace's "Sprint Board", used in the prior task's testing) do not have it and there's no migration/backfill; out of scope per the user's "yeni bir database açıldığında" (when a new database is created) wording.
- Deletable (unlike Title) — removing the column from schema is harmless since `pages.id` always exists regardless of whether it's mirrored into `schema`.
- Kanban/Calendar card-property rendering was **not** specially handled for `id` type (would show blank/dash if manually added to a card's visible properties) — low priority since the column is hidden by default and the feature's real use case is table + bulk-update targeting.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run lint` on all changed files — 0 errors (pre-existing warnings only, none new).
- **Browser verification was interrupted by the user** (asked to skip Playwright, will check manually) partway through — had confirmed the `id` column is correctly seeded and hidden-by-default on a freshly-created "Blank Database" (via Toggle Columns showing only Title/Status until the templates.ts fix, then not re-confirmed after that fix). **Still unverified in-browser**: the templates.ts fix itself (does "Blank Database" now show ID in Toggle Columns?), the read-only/locked rendering in the table cell and Properties panel, and using "ID" as the bulk-update match column end-to-end.

## Remaining work

- User will verify manually. If something looks off, likely first places to check: `db-blank` template's schema/views in `src/lib/templates.ts`, and the `defaultTableView`/`getVisibleColumns` interaction in `DatabaseView.tsx`/`TableLayout.tsx`.

## Known issues

None found by tsc/lint; browser behavior unconfirmed post-templates.ts-fix (see Verification).

## Next exact step

Wait for the user's manual check. No commit made yet (commits are user-gated).

---

## Prior task (done, browser-verified)

Paste-driven bulk add/update UI for database rows (`BulkRowsDialog.tsx`, `bulkCreatePages`/`bulkUpdatePagesByMatch` in `page.ts`, `propertyCoercion.ts`, `parseTabularPaste.ts`) — lets a browser-automation agent (no MCP access) create/update many rows via paste + one click instead of one manual flow per row. Fully implemented, type-checked, linted, and manually verified in the browser (demo workspace "Sprint Board": add mode with new-option auto-creation, update mode with merge semantics and unmatched-row reporting). This task is what the "ID column" work above extends (ID is now available as a precise match-column choice in that same dialog).

---

## Prior task (Codex, done — merged in from origin/master)

Added the public blog article "How to Connect OpenAI Codex to Remnus with MCP" (`docs/blog/connect-openai-codex-to-remnus-mcp.md`, registered in `src/lib/content/manifest.ts`, listed in `docs/blog/README.md`). Verified: word count, `npm run lint`/`tsc`, rendered HTML structure, and live link checks (Remnus pages 200, official OpenAI docs resolved, `/api/mcp` returned expected 401). Not committed/pushed by that session — landed on `origin/master` via commits `ee11bdb`/`1eb97b9`, merged into this branch alongside the bulk-import/id-column work above.

---

## Prior task (separate, pending user verification — not touched this session)

Tauri desktop "Show in folder" download-toast bug: root cause identified as missing Tauri v2 ACL permissions for custom Rust commands on the remote-origin webview. Fixed via `src-tauri/permissions/app-commands.toml` (new) + `src-tauri/capabilities/default.json`, version bumped to 0.1.15 and tagged/pushed. Could not compile-verify (no Rust toolchain on this machine) — the bare vs. `remnus-app:`-prefixed permission-identifier syntax is unconfirmed. Awaiting the user's build/test result; if the build fails with an "unknown permission" ACL error, retry with the `remnus-app:` prefix. See git history (`v0.1.15` tag) for full detail if picking this back up.
