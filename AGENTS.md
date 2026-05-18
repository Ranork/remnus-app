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

## UI Language
All user-facing text — labels, placeholders, empty states, buttons, error messages — must be written in **English**. Date and time values must be formatted using the `en-US` locale. Do not introduce Turkish or any other language into the UI.

## Color Theme
Color Hex Codes: #181e26, #202933, #30373e, #404449, #505254, #5f5f5f, #d6d6d6
Palette link: https://coolors.co/181e26-202933-30373e-404449-505254-5f5f5f-d6d6d6

## UI & Design Aesthetics
- **Material and Borderless Design Language:** Always keep settings panels, drawers, sidebars, and properties panels completely flat, shadowless, and unrounded (`rounded-none`).
- **Seamless Canvas Integration:** Sidebars and properties panels must use a background color of `bg-neutral-950` to blend seamlessly with the main content canvas with zero contrast boundaries. Use only a single left border line (`border-l border-neutral-800`) to cleanly segment sidebars from the main content.
- **Flat-Line Separators:** Instead of nested card boxes or chunky cards, use simple bottom border separator lines (`border-b border-neutral-850`) and full-width list items with soft hover effects (`hover:bg-neutral-800/10` or `hover:bg-neutral-800/20`) to achieve a premium, high-end Notion-like layout.

## Technology Stack
- **Framework:** Next.js 15 (App Router)
- **Styling:** TailwindCSS, Lucide React icons
- **Database:** SQLite (local `file:local.db`), intended to be Turso/Serverless compatible in the future.
- **ORM & Driver:** Drizzle ORM paired with `@libsql/client`.

## Architecture & Conventions

### Database Pattern (JSON Columns)
To support fully dynamic, user-defined properties without structural database migrations, we use the **JSON Column Pattern** rather than EAV:
- **`workspaces` table:** Single source of truth for the workspace list. Contains `id` (PK), `name`, `created_at`, `updated_at`.
- **`workspace_items` table:** Single source of truth for the sidebar items. Linked to `workspaces` via `workspace_id` (CASCADE delete). Every top-level item — whether a standalone page or a database — has one row here. Columns: `id`, `workspace_id`, `type` ('page'|'database'), `title`, `parent_id` (nullable, for future nesting), `sort_order`, `created_at`, `updated_at`.
- **`standalone_pages` table:** Stores markdown `content` for workspace pages. Linked to `workspace_items` via `item_id` (CASCADE delete). One-to-one with a page-type workspace item.
- **`databases` table:** Stores the `schema` as JSON (e.g., `[{ id: 'col1', name: 'Status', type: 'select', options: ['To Do'] }]`), and `views` as JSON (storing multiple named configurations for tables and boards, including column order, visibility, filters, sorts, and groups). Has an `item_id` column linking back to `workspace_items` (SET NULL on delete).
- **`pages` table:** Represents a database row. Stores row-specific custom fields in the `properties` JSON column, alongside fixed columns `title` and `content` (markdown). Always belongs to a database via `database_id`.

### Migration Notes
- Drizzle migrator applies migrations in order of the `when` timestamp in `_journal.json`.
- **The `when` value for a new migration MUST be greater than all existing `when` values** — otherwise the migrator silently skips it.
- Existing `when` values: `0000` → `1779091089863`, `0001` → `1779200000000`, `0002` → `1779300000000`, `0003` → `1779400000000`. New migrations must use a `when` > `1779400000000`.
- Apply with: `npx tsx src/db/migrate.ts`

### Project Structure
- `src/app/`: Next.js App Router orchestration and layouts. Server components fetch data here.
  - `src/app/page.tsx`: Home page — redirects to first workspace item of the active workspace if one exists, otherwise shows empty-state welcome screen.
  - `src/app/db/[id]/page.tsx`: Database view (TableLayout or KanbanBoard).
  - `src/app/db/[id]/[pageId]/page.tsx`: Database row page editor (markdown + properties).
  - `src/app/page/[itemId]/page.tsx`: Standalone workspace page editor (title + markdown only).
- `src/lib/types/`: Types definitions.
  - `views.ts`: Types for `DatabaseView`, `TableViewConfig`, `KanbanViewConfig`, `ViewFilter`, `ViewSort`, operator definitions, and `OpenBehavior` options ('center' | 'side' | 'full').
- `src/lib/actions/`: Next.js Server Actions for all database mutations (CRUD).
  - `workspace.ts`: Workspace & items CRUD — `getActiveWorkspaceId`, `getWorkspaces`, `createWorkspace`, `deleteWorkspace`, `renameWorkspace`, `switchWorkspace`, `getWorkspaceItems`, `createStandalonePage`, `createWorkspaceDatabase`, `getStandalonePageByItemId`, `updateStandalonePageContent`, `updateWorkspaceItemTitle`, `getDatabaseByItemId`.
  - `database.ts`: `createDatabase` delegates to `createWorkspaceDatabase`; also `getDatabases`, `getDatabase`, `updateDatabaseSchema`, `updateDatabaseViews`.
  - `page.ts`: Database row actions — `createPage`, `getPages`, `getPage`, `updatePageProperties`, `updatePageContent`.
- `src/components/features/`: React components.
  - `WorkspaceSidebar`: Unified sidebar displaying all workspaces as root branches in a collapsible tree-view layout. Child pages and databases are nested directly beneath their parent workspace. Clicking an item silently syncs the active workspace cookie. Supports inline workspace creation, renaming, deletion, and adding items directly within a specific workspace's subtree.
  - `DatabaseView`: Orchestrates the active view tabs, controls active view state, manages the schema, handles view creation/renaming/deletion, provides filtering/sorting coordination, and manages page peek overlay modals (Center / Side Peek) and opening behaviors.
  - `ViewsBar`: Renders named view tab buttons for a database, allowing inline renaming, deleting, and adding table or kanban views.
  - `DatabasePropertiesSidebar`: Unified right-side sidebar managing database schema properties (adding/removing fields, editing options), columns visibility controls, active view filters, active view sorts, and page opening modes (peek options) in a tabbed panel layout.
  - `TableLayout`: Notion-like grid with vertical borders, tight padding, and fully draggable columns (swap-on-drop) that persist to the active view's configuration. Supports hidden columns and custom row click behaviors.
  - `KanbanBoard`: Kanban board grouped by a designated `select` column, with Uncategorized fallback. Column groups are draggable (reorderable), saved to the view config. Supports custom card click behaviors.
  - `StandalonePageEditor`: Simple editor for workspace pages — large title input + block editor, both auto-saved (debounced). No properties panel.
  - `PageEditor`: Full editor for database row pages — properties panel (select dropdowns, text inputs, multi-select, date) + block editor with auto-save. Can be rendered inside a peek panel.
  - `editor/BlockEditor`: Tiptap-based block editor. Accepts `initialContent` (markdown string) and `onChange` callback. Extensions: StarterKit, `@tiptap/markdown` (markdown ↔ ProseMirror roundtrip), Placeholder, SlashCommand. Content is stored as plain markdown — no schema changes required. Use `key={page.id}` to remount on page switch.
  - `editor/BubbleMenuBar`: Floating formatting toolbar that appears on text selection. Self-positions using `window.getSelection()` corrected by a hidden anchor probe (`position:fixed; top:0; left:0`) to handle transformed ancestors (peek modal animations). Clamps within the nearest scrollable container; flips below the selection when there is no room above. Includes Bold, Italic, Strike, Code, H1/H2/H3, and a "Turn into" block-type dropdown (Paragraph, Heading 1–3, Bullet List, Numbered List, Quote, Code Block).
  - `editor/SlashCommandMenu`: Tiptap `Extension` using `@tiptap/suggestion`. Triggers on `/` at block start; renders `SlashCommandList` via tippy.js appended to `document.body`.
  - `editor/SlashCommandList`: `forwardRef` component rendered inside the tippy popup. Keyboard-navigable list of 8 block-insert commands.
- `src/db/`: Contains Drizzle `schema.ts`, connection `index.ts`, migration scripts, and `migrations/` folder.

### Common Commands
- **Start Dev Server:** `npm run dev`
- **Generate Migrations:** `npx drizzle-kit generate`
- **Apply Migrations:** `npx tsx src/db/migrate.ts` (Due to interactive limitations of `drizzle-kit push`, use this custom script to apply local `.sql` changes).
