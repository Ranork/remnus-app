<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Keeping This File Up to Date

**Every agent that makes structural changes to the project MUST update this file before finishing.**
Structural changes include: adding/removing tables, adding routes, adding/removing components, adding server actions, or changing architectural patterns.
If you skip this step, future agents will work from a stale map and make mistakes.

---

# Project Details: Remna

**Remna** is a Notion-like application built around a **workspace** model. Users can create standalone pages (title + markdown) and customizable databases (dynamic columns, table/kanban views) — both living side by side in a unified sidebar. Each database row is also a page with markdown content.

## Technology Stack
- **Framework:** Next.js 15 (App Router)
- **Styling:** TailwindCSS, Lucide React icons
- **Database:** SQLite (local `file:local.db`), intended to be Turso/Serverless compatible in the future.
- **ORM & Driver:** Drizzle ORM paired with `@libsql/client`.

## Architecture & Conventions

### Database Pattern (JSON Columns)
To support fully dynamic, user-defined properties without structural database migrations, we use the **JSON Column Pattern** rather than EAV:
- **`workspace_items` table:** Single source of truth for the sidebar. Every top-level item — whether a standalone page or a database — has one row here. Columns: `id`, `type` ('page'|'database'), `title`, `parent_id` (nullable, for future nesting), `sort_order`, `created_at`, `updated_at`.
- **`standalone_pages` table:** Stores markdown `content` for workspace pages. Linked to `workspace_items` via `item_id` (CASCADE delete). One-to-one with a page-type workspace item.
- **`databases` table:** Stores the `schema` as JSON (e.g., `[{ id: 'col1', name: 'Status', type: 'select', options: ['To Do'] }]`). Has an `item_id` column linking back to `workspace_items` (SET NULL on delete).
- **`pages` table:** Represents a database row. Stores row-specific custom fields in the `properties` JSON column, alongside fixed columns `title` and `content` (markdown). Always belongs to a database via `database_id`.

### Migration Notes
- Drizzle migrator applies migrations in order of the `when` timestamp in `_journal.json`.
- **The `when` value for a new migration MUST be greater than all existing `when` values** — otherwise the migrator silently skips it.
- Existing `when` values: `0000` → `1779091089863`. New migrations must use a `when` > `1779091089863`.
- Apply with: `npx tsx src/db/migrate.ts`

### Project Structure
- `src/app/`: Next.js App Router orchestration and layouts. Server components fetch data here.
  - `src/app/page.tsx`: Home page — redirects to first workspace item if one exists, otherwise shows empty-state welcome screen.
  - `src/app/db/[id]/page.tsx`: Database view (TableLayout or KanbanBoard).
  - `src/app/db/[id]/[pageId]/page.tsx`: Database row page editor (markdown + properties).
  - `src/app/page/[itemId]/page.tsx`: Standalone workspace page editor (title + markdown only).
- `src/lib/actions/`: Next.js Server Actions for all database mutations (CRUD).
  - `workspace.ts`: Workspace CRUD — `getWorkspaceItems`, `createStandalonePage`, `createWorkspaceDatabase`, `getStandalonePageByItemId`, `updateStandalonePageContent`, `updateWorkspaceItemTitle`, `getDatabaseByItemId`.
  - `database.ts`: `createDatabase` delegates to `createWorkspaceDatabase`; also `getDatabases`, `getDatabase`, `updateDatabaseSchema`.
  - `page.ts`: Database row actions — `createPage`, `getPages`, `getPage`, `updatePageProperties`, `updatePageContent`.
- `src/components/features/`: Client-side UI components.
  - `WorkspaceSidebar`: Unified sidebar. Receives `WorkspaceItemRow[]` from `getWorkspaceItems()`. Shows FileText icon for pages, Database icon for databases. Inline "Page" / "Database" creation buttons at the bottom. Active item highlighted via `usePathname()`.
  - `DatabaseView`: Orchestrates the active layout (`table` or `kanban`) and holds select-type grouping state.
  - `TableLayout`: Notion-like grid with vertical borders, tight padding, fully draggable columns (swap-on-drop) that persist to the database schema.
  - `KanbanBoard`: Kanban board grouped by a designated `select` column, with Uncategorized fallback.
  - `SchemaEditorModal`: Modal for editing database columns (add/remove/rename, select options).
  - `StandalonePageEditor`: Simple editor for workspace pages — large title input + markdown textarea, both auto-saved (debounced). No properties panel.
  - `PageEditor`: Full editor for database row pages — properties panel (select dropdowns, text inputs) + markdown textarea with auto-save.
- `src/db/`: Contains Drizzle `schema.ts`, connection `index.ts`, migration scripts, and `migrations/` folder.

### Common Commands
- **Start Dev Server:** `npm run dev`
- **Generate Migrations:** `npx drizzle-kit generate`
- **Apply Migrations:** `npx tsx src/db/migrate.ts` (Due to interactive limitations of `drizzle-kit push`, use this custom script to apply local `.sql` changes).
