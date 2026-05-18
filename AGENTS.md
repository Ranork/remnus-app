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
| Role | Name | Hex | Tailwind token |
|---|---|---|---|
| Main canvas bg | Carbon Black | `#1d1f23` | `neutral-950` |
| Sidebar / card bg | Shadow Grey | `#21252b` | `neutral-900` |
| Content canvas bg | One Dark Pro editor | `#282c34` | `neutral-850` |
| Borders / dividers | Gunmetal | `#383b41` | `neutral-800` |
| Silver text | Silver | `#cccccc` | `neutral-100` |
| Muted text / labels | Alabaster Grey | `#d7dae0` | `neutral-50` |
| Primary / accent | Dusk Blue | `#445c95` | `blue-500` |
| Destructive | Blushed Brick | `#cd4d55` | `red-400` |
| Success | Moss Green | `#7fc36d` | `green-400` |
| Warning | Golden Chestnut | `#cc7d45` | `amber-500` |

All tokens are defined via `@theme` overrides in `src/app/globals.css`. The neutral scale (800–950) drives backgrounds and borders; accent colors (blue, red, green, amber) are remapped to stay within this palette.
Palette link: https://coolors.co/1d1f23-21252b-282c34-383b41-cccccc-d7dae0-445c95-cd4d55-7fc36d-cc7d45

## UI & Design Aesthetics
- **Material and Borderless Design Language:** Always keep settings panels, drawers, sidebars, and properties panels completely flat, shadowless, and unrounded (`rounded-none`).
- **Seamless Canvas Integration:** Use a three-tier background hierarchy — `bg-neutral-950` for the outermost body frame only, `bg-neutral-900` for sidebars and floating panels (properties sidebar, dropdowns, peek drawers), `bg-neutral-850` for all content/canvas areas (page editors, table, kanban, calendar grids, modal content). Separate panels from content with a single border line (`border-l border-neutral-800` or `border-r border-neutral-800`).
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
- **`workspace_items` table:** Single source of truth for the sidebar items. Linked to `workspaces` via `workspace_id` (CASCADE delete). Every top-level item — whether a standalone page or a database — has one row here. Columns: `id`, `workspace_id`, `type` ('page'|'database'), `title`, `parent_id` (nullable, for future nesting), `sort_order`, `icon`, `icon_color`, `created_at`, `updated_at`.
- **`standalone_pages` table:** Stores markdown `content` for workspace pages. Linked to `workspace_items` via `item_id` (CASCADE delete). One-to-one with a page-type workspace item.
- **`databases` table:** Stores the `schema` as JSON (e.g., `[{ id: 'col1', name: 'Status', type: 'select', options: [{ value: 'To Do', color: 'default' }] }]`), and `views` as JSON (storing multiple named configurations for tables and boards, including column order, visibility, filters, sorts, groups, card color, and group background). Has an `item_id` column linking back to `workspace_items` (SET NULL on delete). Select/multi_select `options` are stored as `SelectOption[]` (`{ value: string; color?: SelectOptionColor }`); plain string options are still accepted for backward compatibility via `normalizeOption`. `date` and `datetime` columns accept a custom `dateFormat` parameter ('default' | 'iso' | 'uk' | 'us' | 'relative').
- **`pages` table:** Represents a database row. Stores row-specific custom fields in the `properties` JSON column, alongside fixed columns `title`, `content` (markdown), `icon`, and `icon_color`. Always belongs to a database via `database_id`.

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
  - `views.ts`: Types for `DatabaseView`, `TableViewConfig`, `KanbanViewConfig`, `CalendarViewConfig`, `ViewFilter`, `ViewSort`, operator definitions, and `OpenBehavior` options ('center' | 'side' | 'full'). All three view configs include optional `defaultPageIcon` (string) and `defaultPageIconColor` (string) properties for view-level fallback icons. `KanbanViewConfig` includes: `cardProperties` (ordered list of visible property IDs; undefined = first 2), `showPropertyLabels` (boolean, default true), `propertyTextClamp` ('truncate' | 'wrap', default 'truncate'), `cardColorCol` (property ID of a select/multi_select column that drives the card's segmented left-border color), and `groupColBg` (boolean, tints each kanban column background with its group option's color). `CalendarViewConfig` includes `cardColorCol` (same card-color mechanism), `cardProperties` (ordered list of visible property IDs; undefined = first 1), `showPropertyLabels` (boolean, default true), and `propertyTextClamp` ('truncate' | 'wrap', default 'truncate').
  - `properties.ts`: Color system for select/multi_select options. Defines `SelectOption` (`{ value: string; color?: SelectOptionColor }`), `SELECT_COLORS` (9-color palette — default, red, orange, yellow, green, teal, blue, purple, pink — each with `bg`, `text`, `dot`, and `groupBg` CSS color strings), and helpers: `normalizeOption` (string → SelectOption backward compat), `getOptionColor`, `getOptionColorByValue` (looks up color from an options array by value string), `getCardBorderDots` (returns `string[]` of dot-hex colors for a card's left-border accent — one for select, one per value for multi_select), and `formatDateValue` (centralized formatter for date/datetime columns based on `dateFormat`).
- `src/lib/actions/`: Next.js Server Actions for all database mutations (CRUD).
  - `workspace.ts`: Workspace & items CRUD — `getActiveWorkspaceId`, `getWorkspaces`, `createWorkspace`, `deleteWorkspace`, `renameWorkspace`, `switchWorkspace`, `getWorkspaceItems`, `createStandalonePage`, `createWorkspaceDatabase`, `getStandalonePageByItemId`, `updateStandalonePageContent`, `updateWorkspaceItemTitle`, `getDatabaseByItemId`, `updateWorkspaceItemIcon`.
  - `database.ts`: `createDatabase` delegates to `createWorkspaceDatabase`; also `getDatabases`, `getDatabase`, `updateDatabaseSchema`, `updateDatabaseViews`.
  - `page.ts`: Database row actions — `createPage` (supports optional `icon` and `iconColor` default page values on creation), `getPages`, `getPage`, `updatePageProperties`, `updatePageContent`, `updatePageIcon`.
- `src/components/features/`: React components.
  - `WorkspaceSidebar`: Unified sidebar displaying all workspaces as root branches in a collapsible tree-view layout. Child pages and databases are nested directly beneath their parent workspace. Clicking an item silently syncs the active workspace cookie. Supports inline workspace creation, renaming, deletion, and adding items directly within a specific workspace's subtree.
  - `DatabaseView`: Orchestrates the active view tabs, controls active view state, manages the schema, handles view creation/renaming/deletion, provides filtering/sorting coordination, and manages page peek overlay modals (Center / Side Peek) and opening behaviors (supporting Table, Kanban, and Calendar layouts). Handles deep-linking views via URL search params (`?v=view_id`) using a `useEffect`-based sync (not a `useState` initializer — avoids SSR hydration mismatch) and browser dynamic document title updates.
  - `ViewsBar`: Renders named view tab buttons for a database, allowing inline renaming, deleting, and adding table, kanban, or calendar views.
  - `DatabasePropertiesSidebar`: Unified right-side sidebar managing database schema properties (adding/removing fields, editing options), columns visibility controls, active view filters, active view sorts, page opening modes (peek options), group-by properties, calendar properties (date property and week start day option), and kanban card layout settings (card properties visibility/order with drag-to-reorder, show property labels toggle, property text wrap/truncate select) in a tabbed panel layout. Also supports view-level "Default Page Icon" and "Default Page Icon Color" selection. Each select/multi_select option now has a color dot that opens a 9-swatch inline color picker, and date/datetime properties have a Date format selector. Layout tab exposes: "Card color" property selector (select or multi_select) for kanban and calendar, and "Group background color" toggle for kanban.
  - `CalendarView`: Interactive calendar displaying database row cards placed based on a selected date property. Supports monthly and weekly grids, back/forward range navigators, settings layout integrations, custom week start day (Sunday/Monday), and smooth card drag-and-drop to dynamically reschedule page dates. Accepts `cardColorCol` prop: when set, renders a segmented left-border accent bar on each card using `getCardBorderDots`. Supports inline editing of card properties via `InlineCellEditor`.
  - `TableLayout`: Notion-like grid with vertical borders, tight padding, and fully draggable columns (swap-on-drop) that persist to the active view's configuration. Supports hidden columns and custom row click behaviors. Select and multi_select cells render as colored chips using `getOptionColorByValue` from `properties.ts`. Supports inline editing of cells (except the title column) via `InlineCellEditor`.
  - `KanbanBoard`: Kanban board grouped by a designated `select` column, with Uncategorized fallback. Column groups are draggable (reorderable), saved to the view config. Supports custom card click behaviors. Card display is configurable via `cardProperties`, `showPropertyLabels`, and `propertyTextClamp`. Also supports `cardColorCol` (renders a segmented left-border accent bar via `getCardBorderDots` — one solid strip for select, divided into equal segments per value for multi_select) and `groupColBg` (tints each column background with its group option's `groupBg` color; adds `p-3` inner padding and reduces column gap to `gap-2` when active). Supports inline editing of card properties via `InlineCellEditor`.
  - `InlineCellEditor`: Shared component that provides in-place inline editing inputs and absolutely positioned dropdowns/popovers for all database property types (`text`, `number`, `date`, `datetime`, `select`, `multi_select`), capturing click events (`e.stopPropagation`) to prevent opening card/row peek modals.
  - `PageIcon`: Renders custom emojis or specific Lucide icons with 9 tailwind-supported theme colors (default, red, orange, yellow, green, teal, blue, purple, pink), falling back to type-specific icons (FileText / Database).
  - `IconPicker`: Popover panel allowing emoji (curated or custom) and Lucide icon selection with an inline color selector.
  - `StandalonePageEditor`: Simple editor for workspace pages — large title input + block editor, both auto-saved (debounced). No properties panel. Supports large custom page icon headers at the top with an integrated `IconPicker`. Dynamically updates browser page title in real-time as the user types.
  - `PageEditor`: Full editor for database row pages — properties panel (select dropdowns, text inputs, multi-select, date) + block editor with auto-save. Supports large custom page icon headers at the top with an integrated `IconPicker`. Can be rendered inside a peek panel. Dynamically synchronizes browser page title in full view mode. Supports Narrow, Wide, and Full width layout modes in full page view with local storage persistence. Text and number property changes are debounced (600 ms) before persisting; discrete controls (select, date, datetime, multi-select) save immediately on change. The `select` property uses a custom dropdown (not a native `<select>`) that renders each option as a colored chip; multi_select selected/available chips are also color-coded using `getOptionColorByValue`.
  - `editor/BlockEditor`: Tiptap-based block editor. Accepts `initialContent` (markdown string) and `onChange` callback. Extensions: StarterKit, `@tiptap/markdown` (markdown ↔ ProseMirror roundtrip), Placeholder, SlashCommand. Content is stored as plain markdown — no schema changes required. Use `key={page.id}` to remount on page switch.
  - `editor/BubbleMenuBar`: Floating formatting toolbar that appears on text selection. Self-positions using `window.getSelection()` corrected by a hidden anchor probe (`position:fixed; top:0; left:0`) to handle transformed ancestors (peek modal animations). Clamps within the nearest scrollable container; flips below the selection when there is no room above. Includes Bold, Italic, Strike, Code, H1/H2/H3, and a "Turn into" block-type dropdown (Paragraph, Heading 1–3, Bullet List, Numbered List, Quote, Code Block).
  - `editor/SlashCommandMenu`: Tiptap `Extension` using `@tiptap/suggestion`. Triggers on `/` at block start; renders `SlashCommandList` via tippy.js appended to `document.body`.
  - `editor/SlashCommandList`: `forwardRef` component rendered inside the tippy popup. Keyboard-navigable list of 8 block-insert commands.
- `src/db/`: Contains Drizzle `schema.ts`, connection `index.ts`, migration scripts, and `migrations/` folder.

### Common Commands
- **Start Dev Server:** `npm run dev`
- **Generate Migrations:** `npx drizzle-kit generate`
- **Apply Migrations:** `npx tsx src/db/migrate.ts` (Due to interactive limitations of `drizzle-kit push`, use this custom script to apply local `.sql` changes).
