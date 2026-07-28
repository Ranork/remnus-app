# Current task

## Status

Done — awaiting user manual verification (dev server running for testing)

## Active agent

Claude Code

## Branch

master

## Goal

Fix four reported database/editor bugs:
1. A select option created inline (from a page's property panel or a table/kanban cell) doesn't show up in Database Settings until the page is refreshed.
2. Changing select/status option colors in Database Settings and clicking Save appears to revert when the settings panel is closed and reopened (only a full page refresh shows the saved colors).
3. Copying a single table cell in the page editor sometimes still produces full markdown table syntax (`| … |`) instead of plain cell text.
4. Selects/status columns have no way to mark one option as the default, pre-filled on newly created rows.

## Scope

- `DatabaseView.tsx` and the table/kanban/calendar/properties-sidebar/page-editor children it renders.
- The in-page rich-text editor's block right-click "Copy" action (`BlockDragHandle.tsx`).
- `PropertiesPanel.tsx` (Database Settings → Properties tab) and the 8 i18n message files.

## Completed

- Root cause for bugs 1 & 2: `updateDatabaseSchema` only calls `revalidatePath` (marks the Next.js router cache stale for the *next* navigation) — it never refreshes the already-mounted client tree, and none of `TableLayout`/`KanbanBoard`/`PageEditor`/`DatabasePropertiesSidebar` kept a local mirror of `database.schema`. Fixed by adding `localSchema` state + a `liveDatabase` merged object in `DatabaseView.tsx`, and threading a new `onSchemaChange` callback into `TableLayout`, `KanbanBoard`, `PageEditor` (both peek instances), and `DatabasePropertiesSidebar` so schema edits (new inline option, settings-panel save) apply optimistically without a manual reload.
- Root cause for bug 3: verified via live browser testing that the existing `transformCopied`/`clipboardTextSerializer` fix in `BlockEditor.tsx` (2026-07-08) already handles the literal single-cell `CellSelection` (triple-click) case correctly. The real remaining gap was the right-click block-menu "Copy" action in `BlockDragHandle.tsx`: `blockAt()` always resolved the position to the top-level block (the whole `<table>`), so right-clicking anywhere inside a cell and choosing "Copy" copied the entire table as markdown. Fixed by having `blockAt()` also report the innermost table-cell position (`cellPos`), and `copyTarget()` now serializes just that cell's content when present (Copy button only — Cut still copies+deletes the whole table, unchanged, since it removes the whole block).
- Bug 4: added an optional `defaultValue` field on select/status columns. `PropertiesPanel.tsx` now renders a small star toggle next to each select/status option (not multi_select) to mark it as the column's default — kept in sync on option rename/remove/type-change. `DatabaseView.tsx`'s `handleAddRow` now merges `getDefaultPropertiesFromSchema(schema)` as the base layer (view filters / explicit initial properties still take priority), so every row-creation entry point (Table/Kanban/Calendar "+ New", header "New") pre-fills the configured default option. Added `Database.setAsDefaultOption` i18n key to all 8 locale files.
- `npx tsc --noEmit` clean; targeted ESLint on all touched files shows only pre-existing warnings (no new ones).

## Changed files

- `src/components/features/DatabaseView.tsx`
- `src/components/features/TableLayout.tsx`
- `src/components/features/KanbanBoard.tsx`
- `src/components/features/PageEditor.tsx`
- `src/components/features/DatabasePropertiesSidebar.tsx`
- `src/components/features/database-sidebar/PropertiesPanel.tsx`
- `src/components/features/editor/BlockDragHandle.tsx`
- `messages/{en,tr,hi,es,fr,de,zh,ru}.json`

## Verification

- `npx tsc --noEmit` passed.
- `npm run lint` on all 7 touched TSX files: 0 errors, only pre-existing warnings unrelated to this change.
- Bugs 1 & 2 confirmed by code-path analysis (revalidatePath does not refresh a mounted client tree; fix mirrors the existing `localPages` optimistic-update pattern already used elsewhere in the same file).
- Bug 3's CellSelection path was empirically confirmed already-fixed via a live Playwright session (triple-click → copy → plain text, not markdown); the block-menu "Copy" gap was confirmed by reading `blockAt()`'s position resolution.
- Bug 4 implemented and type-checked; not yet exercised in a browser.
- Not yet manually tested end-to-end in the running app by a human — user asked to take over manual testing themselves instead of further automated browser testing.

## Remaining work

- User to manually verify all four fixes in the browser (suggested test steps below).

## Known issues

- None known. Cut on a table cell (via the right-click block menu) still copies+deletes the *whole table* (unchanged behavior) — only the dedicated "Copy" action is now cell-scoped, by design (deleting just a cell isn't a well-defined "cut the block" operation here).

## Next exact step

Hand off to the user for manual browser verification. A `next dev` server is already running on http://localhost:3000 (background task) for this. Suggested checks:
1. **Inline option sync**: open a database row (peek or full page), type a brand-new select option value into a select/status property, then — without refreshing — open that database's Settings → Properties tab and confirm the new option is listed.
2. **Color save persistence**: open Database Settings → Properties, change a select/status option's color, click Save, close the settings panel, reopen it — colors should still show the new color (and the table/kanban cells should already reflect it too, without a page refresh).
3. **Single-cell copy**: in a page with a table, right-click inside one cell (cursor only, no text selected) → Copy, then paste into a plain-text field — should paste just that cell's text, not a full `| … |` markdown table. Also verify triple-click-select-cell → Ctrl+C still works the same way.
4. **Default select option**: in Database Settings → Properties, click the star next to one option on a select/status column, then create a new row from Table/Kanban/Calendar "+ New" — the property should come pre-filled with that option. Also check a Kanban "+ New" inside a specific column still uses that column's group value (not the schema default) when they differ.
