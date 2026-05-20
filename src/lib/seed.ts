import { db } from '@/db';
import { workspaces, workspaceItems, standalonePages, databases, pages, workspaceMembers } from '@/db/schema';

export async function createSeedWorkspace(userId: string, userName?: string | null) {
  const workspaceName = userName ? `${userName} Workspace` : 'Personal Workspace';
  await createRichWorkspaceData(userId, workspaceName);
}

// ── Demo seed data ─────────────────────────────────────────────────────────

const GETTING_STARTED = `## Getting Started with Remnus

Remnus is a workspace for notes, databases, and project management — all in one sidebar. This guide walks you through everything in this demo workspace.

---

### What's in this workspace?

This workspace is organized into **nested pages and databases** to help you explore every feature:

- **📁 Projects** — A top-level folder page. Expand it in the sidebar to reveal two nested projects, each with their own sub-pages and databases.
  - **🚀 Remnus v2 Launch** — A project page with a brief, meeting notes, and a kanban task board — all nested inside.
  - **🎨 Design System** — A design project with component specs and a component library database.
- **Sprint Board** — Kanban + Table views. Tasks with status, priority, assignee, and story points.
- **Bug Tracker** — Three views: All Bugs (table), Open (filtered), and Board (kanban). Row colors reflect severity.
- **Team Calendar** — Calendar view for scheduling, plus a Schedule table view sorted by date.
- **Reading List** — Table database with row color tinting and a filtered "Finished" view.

---

### Nested Pages

Click the **▶** chevron next to any page in the sidebar to expand it and reveal its children. Pages can contain:
- Other pages (notes, docs, briefs)
- Databases (tables, kanban boards, calendars)
- Any mix of both — infinitely nested

Try expanding **Projects → Remnus v2 Launch** to see a full project workspace nested inside a single sidebar item.

**To create a nested item:** hover any page in the sidebar and click the **+** icon that appears. The new item will be created as a child of that page.

---

### Pages

Standalone pages like this one hold freeform **markdown content** — great for notes, docs, meeting minutes, and long-form writing.

A few things to try:
- Press \`/\` at the start of any line to open the **slash command menu** — insert headings, bullet lists, numbered lists, code blocks, quotes, and more.
- Select any text to reveal the **bubble toolbar** for bold, italic, strikethrough, code, and heading shortcuts.
- Click the **icon** at the top of this page to pick any emoji or Lucide icon with a custom color.
- Use the **width toggle** (top-right toolbar) to switch between Narrow, Wide, and Full width layouts.

---

### Databases

Databases are like spreadsheets where every row is also a full page. Each cell is editable inline — no need to open the row to change a value.

#### Views
Every database can have multiple named views — each with its own layout, visible columns, filters, and sorts. Click the **view tabs** at the top of a database to switch between them.

Supported view types:
- **Table** — Spreadsheet layout with sortable columns, resizable widths, and row color tinting
- **Kanban** — Card board grouped by any select property; supports card colors and column background tints
- **Calendar** — Monthly or weekly calendar placing cards by a date property

#### Properties
Open any database row to see its full property panel on the right. Supported types: Text, Number, Date, DateTime, Select, and Multi-select. Select and multi-select options have 9 color options.

#### Filters & Sorts
Click the **Properties** button (top-right of any database) to open the sidebar. From there you can:
- Show/hide columns per view
- Add filters (applied only to the current view)
- Add sorts
- Configure group-by for kanban, date column for calendar
- Set page open behavior (center peek, side peek, or full page)

---

### Sidebar

- **Workspaces** — You can have multiple workspaces. Click the **+** button or hover a workspace to access its settings.
- **Drag to reorder** — Drag any item or workspace to rearrange the sidebar.
- **Settings** — Hover a workspace and click the gear icon to rename it, manage members, or delete it.
- **New items** — Click the **+** next to any page or workspace to open the template picker and choose from pages and database templates.
`;

// ── Nested page content strings ───────────────────────────────────────────

const PROJECTS_PAGE_CONTENT = `## Projects

This is your projects folder. Expand it in the sidebar to navigate between active projects.

Each project contains its own pages and databases — all nested inside this single sidebar item.

---

### Active Projects

| Project | Status | Owner | Due |
|---------|--------|-------|-----|
| Remnus v2 Launch | 🟡 In Progress | Alice | June 30, 2026 |
| Design System | 🟢 Active | Bob | Ongoing |

---

> **Tip:** Click the **▶** chevron next to "Projects" in the sidebar to expand it and see all nested projects.
`;

const REMNUS_LAUNCH_CONTENT = `## Remnus v2 Launch

This project covers the full product launch of Remnus v2 — from planning to go-live.

---

### Objectives

- Ship the nested page system and new sidebar navigation
- Complete the design system overhaul
- Deliver a polished onboarding experience for new users
- Achieve public launch by end of Q2 2026

### Key Milestones

| Milestone | Date | Status |
|-----------|------|--------|
| Feature freeze | June 10, 2026 | 🔵 Upcoming |
| Internal beta | June 17, 2026 | 🔵 Upcoming |
| Public launch | June 30, 2026 | 🔵 Upcoming |

---

### Pages in this project

Expand this page in the sidebar to find:
- **📋 Project Brief** — Full goals, scope, and team assignments
- **🗓️ Kickoff Meeting Notes** — Notes and action items from the kickoff call
- **✅ Launch Tasks** — Kanban board tracking all launch tasks
`;

const PROJECT_BRIEF_CONTENT = `## Project Brief — Remnus v2

### Overview

Remnus v2 is a major product update introducing nested pages, a redesigned sidebar, and an improved database experience. The goal is to make Remnus the go-to tool for solo creators and small teams who need a lightweight but powerful Notion alternative.

### Problem Statement

Current users report friction when organizing large workspaces. Everything lives at the top level — there's no way to group related pages and databases under a shared parent. This creates cluttered sidebars and makes it hard to find things.

### Solution

Introduce a fully recursive nested page system:
- Any page can contain sub-pages and sub-databases
- The sidebar shows a collapsible tree view
- Sub-items are created via the **+** button next to any page

### Goals

- Reduce sidebar clutter by enabling project-based grouping
- Keep navigation fast — no full-page reloads when expanding/collapsing
- Preserve all existing functionality (drag-to-reorder, icons, etc.)

### Scope

**In scope:**
- Nested pages and databases with unlimited depth
- Collapsible sidebar tree with smart auto-expansion
- Template picker available on sub-pages
- Drag-and-drop reorder within parent scope

**Out of scope (v2):**
- Cross-parent drag-and-drop
- Breadcrumb navigation in header
- Page backlinks

### Team

| Role | Person |
|------|--------|
| Product | Alice Chen |
| Engineering Lead | Marcus Johnson |
| Design | Aisha Patel |
| QA | Kai Rivera |

### Success Metrics

- 70% of active users organize items into nested structures within 30 days
- Sidebar load time remains under 100ms with 200+ items
- Zero regressions in existing database/page functionality
`;

const KICKOFF_NOTES_CONTENT = `## Kickoff Meeting Notes

**Date:** May 19, 2026
**Attendees:** Alice Chen, Marcus Johnson, Aisha Patel, Kai Rivera

---

## Agenda

1. Review project brief and scope
2. Technical approach for nested items
3. Design handoff timeline
4. Q&A and open issues

---

## Notes

**Alice** opened the meeting by walking through the project brief. The team aligned on scope — nested pages are the core deliverable; breadcrumbs and backlinks are deferred to a future sprint.

**Marcus** presented the technical approach:
- \`parent_id\` column added to \`workspace_items\` table (nullable, self-referential FK)
- Sidebar renders a recursive tree using a flat item list built on the client
- Server actions already support \`parentId\` option on both \`createStandalonePage\` and \`createWorkspaceDatabase\`
- Auto-expansion of ancestor nodes when navigating to a deeply nested page

**Aisha** shared initial wireframes for the sidebar tree view. Key design decisions:
- Chevron (▶ / ▼) replaces the old expand behavior
- Vertical connector lines use Dusk Blue for visual hierarchy
- Hover \`+\` button creates a child item inline

**Kai** will handle regression testing. Will write an end-to-end test covering:
- Creating a nested page
- Navigating to it
- Deleting the parent (cascade)

---

## Action Items

- [ ] Marcus: merge \`parent_id\` migration to main by May 21
- [ ] Aisha: finalize sidebar component designs by May 23
- [ ] Kai: set up regression test suite by May 26
- [ ] Alice: update project brief with final milestone dates
`;

const DESIGN_SYSTEM_CONTENT = `## Design System

A single source of truth for all UI components, tokens, and patterns used across Remnus.

---

### Design Principles

1. **Flat & Borderless** — No shadows, no nested cards. Borders only for separation.
2. **Three-tier backgrounds** — \`neutral-950\` (frame) → \`neutral-900\` (sidebars/panels) → \`neutral-850\` (canvas/content)
3. **Motion with purpose** — Micro-animations only where they communicate state changes.
4. **Dark-first** — All components are designed in dark mode. Light mode is not planned.

---

### Color Tokens

| Role | Token | Hex |
|------|-------|-----|
| Canvas background | \`neutral-850\` | \`#282c34\` |
| Sidebar background | \`neutral-900\` | \`#21252b\` |
| Frame background | \`neutral-950\` | \`#1d1f23\` |
| Border / divider | \`neutral-800\` | \`#383b41\` |
| Primary text | \`neutral-100\` | \`#cccccc\` |
| Muted text | \`neutral-50\` | \`#d7dae0\` |
| Accent / primary | \`blue-500\` | \`#445c95\` |
| Destructive | \`red-400\` | \`#cd4d55\` |
| Success | \`green-400\` | \`#7fc36d\` |
| Warning | \`amber-500\` | \`#cc7d45\` |

---

### Pages in this project

- **📐 Component Specs** — Detailed spec for each component category
- **🧩 Component Library** — Database tracking all components with status and owner
`;

const COMPONENT_SPECS_CONTENT = `## Component Specs

This page documents the specification and usage guidelines for each component category in Remnus's design system.

---

## Layout Components

### Sidebar
- **Background:** \`bg-neutral-900\`
- **Width:** 260px fixed
- **Border:** \`border-r border-neutral-800\`
- **Items:** Full-width, flat, \`hover:bg-neutral-800/20\`
- **Active item:** \`bg-neutral-800/40\` + \`text-neutral-100\`

### Canvas
- **Background:** \`bg-neutral-850\`
- **Max content width:** 720px (narrow), 1024px (wide), 100% (full)
- **Padding:** \`px-16 py-12\` (narrow), \`px-8 py-12\` (wide/full)

---

## Form Components

### Input
\`\`\`
bg-neutral-800 border border-neutral-700
rounded-none h-9 px-3
focus:outline-none focus:ring-1 focus:ring-blue-500
text-neutral-100 placeholder:text-neutral-500
\`\`\`

### Button (Primary)
\`\`\`
bg-blue-500 hover:bg-blue-600
text-white font-medium
rounded-none h-9 px-4
transition-colors duration-150
\`\`\`

### Button (Destructive)
\`\`\`
bg-red-400 hover:bg-red-500
text-white font-medium
rounded-none h-9 px-4
\`\`\`

---

## Feedback Components

### Empty State
- Centered in the available canvas
- Muted icon (Lucide, \`text-neutral-600\`, size 40)
- Title: \`text-neutral-400 text-sm font-medium\`
- Subtitle: \`text-neutral-600 text-xs\`

### Toast / Notification
- Bottom-right anchored
- \`bg-neutral-900 border border-neutral-800\`
- Auto-dismiss after 4 seconds
- Stack up to 3 toasts

---

## Auth Pages Exception

The \`/login\` and \`/register\` pages use a softly rounded style (\`rounded-xl\` card, \`rounded-lg\` inputs/buttons) to visually separate the auth flow from the workspace canvas. Do **not** apply this rounded style inside the workspace.
`;

async function createRichWorkspaceData(userId: string, workspaceName: string) {
  const d = (n: number) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + n);
    return dt.toISOString().split('T')[0];
  };

  // ── Single workspace ────────────────────────────────────────────────────────

  const ws1 = crypto.randomUUID();
  await db.insert(workspaces).values({ id: ws1, name: workspaceName, sortOrder: 0, createdAt: new Date() });
  await db.insert(workspaceMembers).values({ id: crypto.randomUUID(), workspaceId: ws1, userId, role: 'owner', createdAt: new Date() });

  // ── Getting Started page ────────────────────────────────────────────────────

  const gettingStartedItem = crypto.randomUUID();
  await db.insert(workspaceItems).values({ id: gettingStartedItem, workspaceId: ws1, type: 'page', title: 'Getting Started', sortOrder: 0, icon: '👋', iconColor: 'default' });
  await db.insert(standalonePages).values({ id: crypto.randomUUID(), itemId: gettingStartedItem, content: GETTING_STARTED });

  // ── Projects parent page ────────────────────────────────────────────────────
  // This top-level page acts as a "folder" — its children are the actual projects.

  const projectsItem = crypto.randomUUID();
  await db.insert(workspaceItems).values({
    id: projectsItem,
    workspaceId: ws1,
    type: 'page',
    title: 'Projects',
    sortOrder: 1,
    icon: '📁',
    iconColor: 'default',
  });
  await db.insert(standalonePages).values({ id: crypto.randomUUID(), itemId: projectsItem, content: PROJECTS_PAGE_CONTENT });

  // ── Remnus v2 Launch — child of Projects ────────────────────────────────────

  const remnusLaunchItem = crypto.randomUUID();
  await db.insert(workspaceItems).values({
    id: remnusLaunchItem,
    workspaceId: ws1,
    type: 'page',
    title: 'Remnus v2 Launch',
    parentId: projectsItem,       // ← nested inside "Projects"
    sortOrder: 0,
    icon: '🚀',
    iconColor: 'blue',
  });
  await db.insert(standalonePages).values({ id: crypto.randomUUID(), itemId: remnusLaunchItem, content: REMNUS_LAUNCH_CONTENT });

  // Project Brief — child of Remnus v2 Launch
  const projectBriefItem = crypto.randomUUID();
  await db.insert(workspaceItems).values({
    id: projectBriefItem,
    workspaceId: ws1,
    type: 'page',
    title: 'Project Brief',
    parentId: remnusLaunchItem,    // ← nested inside "Remnus v2 Launch"
    sortOrder: 0,
    icon: '📋',
    iconColor: 'default',
  });
  await db.insert(standalonePages).values({ id: crypto.randomUUID(), itemId: projectBriefItem, content: PROJECT_BRIEF_CONTENT });

  // Kickoff Meeting Notes — child of Remnus v2 Launch
  const kickoffItem = crypto.randomUUID();
  await db.insert(workspaceItems).values({
    id: kickoffItem,
    workspaceId: ws1,
    type: 'page',
    title: 'Kickoff Meeting Notes',
    parentId: remnusLaunchItem,    // ← nested inside "Remnus v2 Launch"
    sortOrder: 1,
    icon: '🗓️',
    iconColor: 'default',
  });
  await db.insert(standalonePages).values({ id: crypto.randomUUID(), itemId: kickoffItem, content: KICKOFF_NOTES_CONTENT });

  // Launch Tasks database — child of Remnus v2 Launch
  const launchTasksItemId = crypto.randomUUID();
  const launchTasksDbId = crypto.randomUUID();
  const launchTasksSchema = [
    { id: 'title', name: 'Title', type: 'text' as const },
    {
      id: 'status', name: 'Status', type: 'select' as const, options: [
        { value: 'Backlog', color: 'default' as const },
        { value: 'In Progress', color: 'blue' as const },
        { value: 'Review', color: 'yellow' as const },
        { value: 'Done', color: 'green' as const },
      ],
    },
    {
      id: 'area', name: 'Area', type: 'select' as const, options: [
        { value: 'Engineering', color: 'teal' as const },
        { value: 'Design', color: 'pink' as const },
        { value: 'QA', color: 'purple' as const },
        { value: 'Product', color: 'blue' as const },
      ],
    },
    { id: 'assignee', name: 'Assignee', type: 'text' as const },
    { id: 'dueDate', name: 'Due Date', type: 'date' as const, dateFormat: 'default' as const },
  ];
  const launchTasksViews = [
    {
      id: 'v-lt-1',
      name: 'Board',
      config: {
        type: 'kanban' as const,
        groupByCol: 'status',
        groupOrder: ['Backlog', 'In Progress', 'Review', 'Done'],
        filters: [],
        sorts: [],
        openBehavior: 'center' as const,
        cardProperties: ['area', 'assignee', 'dueDate'],
        showPropertyLabels: true,
        propertyTextClamp: 'truncate' as const,
        cardColorCol: 'area',
        groupColBg: true,
      },
    },
    {
      id: 'v-lt-2',
      name: 'Table',
      config: {
        type: 'table' as const,
        columnOrder: ['title', 'status', 'area', 'assignee', 'dueDate'],
        hiddenColumns: [],
        filters: [],
        sorts: [],
        openBehavior: 'center' as const,
        rowColorCol: 'status',
      },
    },
  ];
  await db.insert(workspaceItems).values({
    id: launchTasksItemId,
    workspaceId: ws1,
    type: 'database',
    title: 'Launch Tasks',
    parentId: remnusLaunchItem,    // ← nested inside "Remnus v2 Launch"
    sortOrder: 2,
    icon: '✅',
    iconColor: 'green',
  });
  await db.insert(databases).values({ id: launchTasksDbId, name: 'Launch Tasks', itemId: launchTasksItemId, schema: launchTasksSchema, views: launchTasksViews });

  const launchTasks = [
    { title: 'Add parent_id column to workspace_items', status: 'Done', area: 'Engineering', assignee: 'Marcus', dueDate: d(-4) },
    { title: 'Build recursive sidebar tree renderer', status: 'Done', area: 'Engineering', assignee: 'Marcus', dueDate: d(-2) },
    { title: 'Implement auto-expand for active nested page', status: 'Done', area: 'Engineering', assignee: 'Marcus', dueDate: d(-1) },
    { title: 'Design sidebar chevron & connector lines', status: 'Done', area: 'Design', assignee: 'Aisha', dueDate: d(-3) },
    { title: 'Add nested item creation via + button', status: 'In Progress', area: 'Engineering', assignee: 'Marcus', dueDate: d(1) },
    { title: 'Write end-to-end regression tests', status: 'In Progress', area: 'QA', assignee: 'Kai', dueDate: d(3) },
    { title: 'Update Getting Started demo content', status: 'Review', area: 'Product', assignee: 'Alice', dueDate: d(2) },
    { title: 'Support drag-and-drop within parent scope', status: 'Backlog', area: 'Engineering', assignee: 'Marcus', dueDate: d(7) },
    { title: 'Breadcrumb navigation in page header', status: 'Backlog', area: 'Design', assignee: 'Aisha', dueDate: d(14) },
    { title: 'Public launch announcement', status: 'Backlog', area: 'Product', assignee: 'Alice', dueDate: d(21) },
  ];
  for (let i = 0; i < launchTasks.length; i++) {
    const t = launchTasks[i];
    await db.insert(pages).values({
      id: crypto.randomUUID(),
      databaseId: launchTasksDbId,
      title: t.title,
      content: '',
      properties: { title: t.title, status: t.status, area: t.area, assignee: t.assignee, dueDate: t.dueDate },
      sortOrder: i,
    });
  }

  // ── Design System — child of Projects ──────────────────────────────────────

  const designSystemItem = crypto.randomUUID();
  await db.insert(workspaceItems).values({
    id: designSystemItem,
    workspaceId: ws1,
    type: 'page',
    title: 'Design System',
    parentId: projectsItem,       // ← nested inside "Projects"
    sortOrder: 1,
    icon: '🎨',
    iconColor: 'pink',
  });
  await db.insert(standalonePages).values({ id: crypto.randomUUID(), itemId: designSystemItem, content: DESIGN_SYSTEM_CONTENT });

  // Component Specs — child of Design System
  const componentSpecsItem = crypto.randomUUID();
  await db.insert(workspaceItems).values({
    id: componentSpecsItem,
    workspaceId: ws1,
    type: 'page',
    title: 'Component Specs',
    parentId: designSystemItem,   // ← nested inside "Design System"
    sortOrder: 0,
    icon: '📐',
    iconColor: 'default',
  });
  await db.insert(standalonePages).values({ id: crypto.randomUUID(), itemId: componentSpecsItem, content: COMPONENT_SPECS_CONTENT });

  // Component Library database — child of Design System
  const compLibItemId = crypto.randomUUID();
  const compLibDbId = crypto.randomUUID();
  const compLibSchema = [
    { id: 'title', name: 'Component', type: 'text' as const },
    {
      id: 'category', name: 'Category', type: 'select' as const, options: [
        { value: 'Layout', color: 'blue' as const },
        { value: 'Form', color: 'teal' as const },
        { value: 'Navigation', color: 'purple' as const },
        { value: 'Feedback', color: 'green' as const },
        { value: 'Data', color: 'orange' as const },
      ],
    },
    {
      id: 'status', name: 'Status', type: 'select' as const, options: [
        { value: 'Planned', color: 'default' as const },
        { value: 'In Progress', color: 'yellow' as const },
        { value: 'Done', color: 'green' as const },
        { value: 'Deprecated', color: 'red' as const },
      ],
    },
    { id: 'owner', name: 'Owner', type: 'text' as const },
    { id: 'notes', name: 'Notes', type: 'text' as const },
  ];
  const compLibViews = [
    {
      id: 'v-cl-1',
      name: 'All Components',
      config: {
        type: 'table' as const,
        columnOrder: ['title', 'category', 'status', 'owner', 'notes'],
        hiddenColumns: [],
        filters: [],
        sorts: [],
        openBehavior: 'side' as const,
        rowColorCol: 'status',
      },
    },
    {
      id: 'v-cl-2',
      name: 'Board',
      config: {
        type: 'kanban' as const,
        groupByCol: 'status',
        groupOrder: ['Planned', 'In Progress', 'Done', 'Deprecated'],
        filters: [],
        sorts: [],
        openBehavior: 'side' as const,
        cardProperties: ['category', 'owner'],
        showPropertyLabels: true,
        propertyTextClamp: 'truncate' as const,
        cardColorCol: 'category',
        groupColBg: false,
      },
    },
  ];
  await db.insert(workspaceItems).values({
    id: compLibItemId,
    workspaceId: ws1,
    type: 'database',
    title: 'Component Library',
    parentId: designSystemItem,   // ← nested inside "Design System"
    sortOrder: 1,
    icon: '🧩',
    iconColor: 'purple',
  });
  await db.insert(databases).values({ id: compLibDbId, name: 'Component Library', itemId: compLibItemId, schema: compLibSchema, views: compLibViews });

  const components = [
    { title: 'Sidebar', category: 'Navigation', status: 'Done', owner: 'Aisha', notes: 'Collapsible tree, drag-and-drop, nested items' },
    { title: 'WorkspaceItem', category: 'Navigation', status: 'Done', owner: 'Aisha', notes: 'Icon, title, chevron, action buttons' },
    { title: 'DatabaseView', category: 'Data', status: 'Done', owner: 'Marcus', notes: 'Orchestrates Table, Kanban, Calendar views' },
    { title: 'TableLayout', category: 'Data', status: 'Done', owner: 'Marcus', notes: 'Inline editing, resizable columns, row tint' },
    { title: 'KanbanBoard', category: 'Data', status: 'Done', owner: 'Marcus', notes: 'Grouped columns, card colors, group bg tint' },
    { title: 'CalendarView', category: 'Data', status: 'Done', owner: 'Marcus', notes: 'Month/week modes, card color, date placement' },
    { title: 'ViewsBar', category: 'Navigation', status: 'Done', owner: 'Aisha', notes: 'View tabs, inline rename, add/delete view' },
    { title: 'PropertiesSidebar', category: 'Form', status: 'Done', owner: 'Aisha', notes: 'Schema editing, filters, sorts, group-by' },
    { title: 'PageEditor', category: 'Layout', status: 'Done', owner: 'Marcus', notes: 'Markdown editor with bubble toolbar and slash commands' },
    { title: 'IconPicker', category: 'Feedback', status: 'Done', owner: 'Aisha', notes: 'Emoji + Lucide icons with color selection' },
    { title: 'TemplatePickerModal', category: 'Feedback', status: 'Done', owner: 'Aisha', notes: '2-step modal: pick template → name item' },
    { title: 'WorkspaceSettingsModal', category: 'Feedback', status: 'Done', owner: 'Aisha', notes: 'General + Members tabs, role management' },
    { title: 'Breadcrumb', category: 'Navigation', status: 'Planned', owner: '', notes: 'Show ancestor path for deeply nested pages' },
    { title: 'CommandPalette', category: 'Navigation', status: 'Planned', owner: '', notes: 'Quick-open any page or database via ⌘K' },
    { title: 'Toast', category: 'Feedback', status: 'In Progress', owner: 'Aisha', notes: 'Auto-dismiss, stack up to 3' },
  ];
  for (let i = 0; i < components.length; i++) {
    const c = components[i];
    await db.insert(pages).values({
      id: crypto.randomUUID(),
      databaseId: compLibDbId,
      title: c.title,
      content: '',
      properties: { title: c.title, category: c.category, status: c.status, owner: c.owner, notes: c.notes },
      sortOrder: i,
    });
  }

  // ── Sprint Board database ───────────────────────────────────────────────────

  const sprintSchema = [
    { id: 'title', name: 'Title', type: 'text' as const },
    { id: 'status', name: 'Status', type: 'select' as const, options: [
      { value: 'To Do', color: 'blue' as const },
      { value: 'In Progress', color: 'yellow' as const },
      { value: 'In Review', color: 'teal' as const },
      { value: 'Done', color: 'green' as const },
    ]},
    { id: 'priority', name: 'Priority', type: 'select' as const, options: [
      { value: 'P1 — Critical', color: 'red' as const },
      { value: 'P2 — High', color: 'orange' as const },
      { value: 'P3 — Medium', color: 'yellow' as const },
      { value: 'P4 — Low', color: 'green' as const },
    ]},
    { id: 'assignee', name: 'Assignee', type: 'text' as const },
    { id: 'sprint', name: 'Sprint', type: 'select' as const, options: [
      { value: 'Sprint 12', color: 'purple' as const },
      { value: 'Sprint 13', color: 'blue' as const },
    ]},
    { id: 'points', name: 'Points', type: 'number' as const },
  ];
  const sprintViews = [
    {
      id: 'v-sprint-1',
      name: 'Board',
      config: {
        type: 'kanban' as const,
        groupByCol: 'status',
        groupOrder: ['To Do', 'In Progress', 'In Review', 'Done'],
        filters: [],
        sorts: [],
        openBehavior: 'center' as const,
        cardProperties: ['priority', 'assignee', 'points'],
        showPropertyLabels: true,
        propertyTextClamp: 'truncate' as const,
        cardColorCol: 'priority',
        groupColBg: true,
      },
    },
    {
      id: 'v-sprint-2',
      name: 'Table',
      config: {
        type: 'table' as const,
        columnOrder: ['title', 'status', 'priority', 'assignee', 'sprint', 'points'],
        hiddenColumns: [],
        filters: [],
        sorts: [],
        openBehavior: 'center' as const,
        rowColorCol: 'priority',
      },
    },
  ];
  const sprintDbItem = crypto.randomUUID();
  const sprintDb = crypto.randomUUID();
  await db.insert(workspaceItems).values({ id: sprintDbItem, workspaceId: ws1, type: 'database', title: 'Sprint Board', sortOrder: 2, icon: '✅', iconColor: 'green' });
  await db.insert(databases).values({ id: sprintDb, name: 'Sprint Board', itemId: sprintDbItem, schema: sprintSchema, views: sprintViews });

  const sprintTasks = [
    { title: 'Implement OAuth login flow', status: 'In Progress', priority: 'P1 — Critical', assignee: 'Alice', sprint: 'Sprint 12', points: 8 },
    { title: 'Design new onboarding screens', status: 'In Review', priority: 'P2 — High', assignee: 'Bob', sprint: 'Sprint 12', points: 5 },
    { title: 'Fix mobile navigation bug', status: 'To Do', priority: 'P2 — High', assignee: 'Charlie', sprint: 'Sprint 12', points: 3 },
    { title: 'Add export to CSV feature', status: 'In Progress', priority: 'P3 — Medium', assignee: 'Alice', sprint: 'Sprint 12', points: 5 },
    { title: 'Write API documentation', status: 'To Do', priority: 'P3 — Medium', assignee: 'Bob', sprint: 'Sprint 12', points: 3 },
    { title: 'Set up CI/CD pipeline', status: 'Done', priority: 'P1 — Critical', assignee: 'Charlie', sprint: 'Sprint 12', points: 8 },
    { title: 'Database query optimization', status: 'Done', priority: 'P2 — High', assignee: 'Alice', sprint: 'Sprint 12', points: 5 },
    { title: 'User dashboard redesign', status: 'In Progress', priority: 'P2 — High', assignee: 'Bob', sprint: 'Sprint 13', points: 8 },
    { title: 'Push notification system', status: 'To Do', priority: 'P1 — Critical', assignee: 'Charlie', sprint: 'Sprint 13', points: 13 },
    { title: 'Performance monitoring setup', status: 'To Do', priority: 'P3 — Medium', assignee: 'Alice', sprint: 'Sprint 13', points: 5 },
    { title: 'Customer portal MVP', status: 'To Do', priority: 'P2 — High', assignee: 'Bob', sprint: 'Sprint 13', points: 13 },
    { title: 'Security audit remediation', status: 'Done', priority: 'P1 — Critical', assignee: 'Charlie', sprint: 'Sprint 12', points: 8 },
  ];
  for (let i = 0; i < sprintTasks.length; i++) {
    const t = sprintTasks[i];
    await db.insert(pages).values({
      id: crypto.randomUUID(),
      databaseId: sprintDb,
      title: t.title,
      content: '',
      properties: { title: t.title, status: t.status, priority: t.priority, assignee: t.assignee, sprint: t.sprint, points: t.points },
      sortOrder: i,
    });
  }

  // ── Bug Tracker database ────────────────────────────────────────────────────

  const bugSchema = [
    { id: 'title', name: 'Title', type: 'text' as const },
    { id: 'severity', name: 'Severity', type: 'select' as const, options: [
      { value: 'Critical', color: 'red' as const },
      { value: 'High', color: 'orange' as const },
      { value: 'Medium', color: 'yellow' as const },
      { value: 'Low', color: 'green' as const },
    ]},
    { id: 'status', name: 'Status', type: 'select' as const, options: [
      { value: 'Open', color: 'red' as const },
      { value: 'In Progress', color: 'yellow' as const },
      { value: 'Resolved', color: 'green' as const },
      { value: 'Closed', color: 'default' as const },
    ]},
    { id: 'module', name: 'Module', type: 'select' as const, options: [
      { value: 'Auth', color: 'blue' as const },
      { value: 'Dashboard', color: 'teal' as const },
      { value: 'API', color: 'purple' as const },
      { value: 'Settings', color: 'default' as const },
      { value: 'Mobile', color: 'orange' as const },
    ]},
    { id: 'reporter', name: 'Reporter', type: 'text' as const },
    { id: 'reported', name: 'Reported', type: 'date' as const, dateFormat: 'default' as const },
  ];
  const bugViews = [
    {
      id: 'v-bug-1',
      name: 'All Bugs',
      config: {
        type: 'table' as const,
        columnOrder: ['title', 'severity', 'status', 'module', 'reporter', 'reported'],
        hiddenColumns: [],
        filters: [],
        sorts: [{ id: 's1', columnId: 'severity', direction: 'asc' as const }],
        openBehavior: 'side' as const,
        rowColorCol: 'severity',
      },
    },
    {
      id: 'v-bug-2',
      name: 'Open',
      config: {
        type: 'table' as const,
        columnOrder: ['title', 'severity', 'module', 'reporter', 'reported'],
        hiddenColumns: [],
        filters: [{ id: 'f1', columnId: 'status', operator: 'equals' as const, value: 'Open' }],
        sorts: [{ id: 's1', columnId: 'severity', direction: 'asc' as const }],
        openBehavior: 'side' as const,
      },
    },
    {
      id: 'v-bug-3',
      name: 'Board',
      config: {
        type: 'kanban' as const,
        groupByCol: 'status',
        groupOrder: ['Open', 'In Progress', 'Resolved', 'Closed'],
        filters: [],
        sorts: [],
        openBehavior: 'side' as const,
        cardProperties: ['severity', 'module', 'reporter'],
        showPropertyLabels: true,
        propertyTextClamp: 'truncate' as const,
        cardColorCol: 'severity',
        groupColBg: false,
      },
    },
  ];
  const bugDbItem = crypto.randomUUID();
  const bugDb = crypto.randomUUID();
  await db.insert(workspaceItems).values({ id: bugDbItem, workspaceId: ws1, type: 'database', title: 'Bug Tracker', sortOrder: 3, icon: '🐛', iconColor: 'red' });
  await db.insert(databases).values({ id: bugDb, name: 'Bug Tracker', itemId: bugDbItem, schema: bugSchema, views: bugViews });

  const bugs = [
    { title: 'Login fails after password reset', severity: 'Critical', status: 'Open', module: 'Auth', reporter: 'Alice', reported: d(-5) },
    { title: 'Dashboard charts not loading on Safari', severity: 'High', status: 'In Progress', module: 'Dashboard', reporter: 'Bob', reported: d(-8) },
    { title: 'API rate limiting not working correctly', severity: 'Critical', status: 'In Progress', module: 'API', reporter: 'Charlie', reported: d(-3) },
    { title: 'Settings page crashes on mobile iOS', severity: 'High', status: 'Open', module: 'Mobile', reporter: 'Alice', reported: d(-6) },
    { title: 'CSV export includes soft-deleted rows', severity: 'Medium', status: 'Open', module: 'API', reporter: 'Bob', reported: d(-2) },
    { title: 'Dark mode toggle resets on page refresh', severity: 'Low', status: 'Resolved', module: 'Settings', reporter: 'Charlie', reported: d(-12) },
    { title: 'Search results showing duplicate entries', severity: 'Medium', status: 'In Progress', module: 'Dashboard', reporter: 'Alice', reported: d(-4) },
    { title: 'Email notifications delayed by ~30 minutes', severity: 'High', status: 'Open', module: 'API', reporter: 'Bob', reported: d(-1) },
  ];
  for (let i = 0; i < bugs.length; i++) {
    const b = bugs[i];
    await db.insert(pages).values({
      id: crypto.randomUUID(),
      databaseId: bugDb,
      title: b.title,
      content: '',
      properties: { title: b.title, severity: b.severity, status: b.status, module: b.module, reporter: b.reporter, reported: b.reported },
      sortOrder: i,
    });
  }

  // ── Team Calendar database ──────────────────────────────────────────────────

  const calSchema = [
    { id: 'title', name: 'Title', type: 'text' as const },
    { id: 'date', name: 'Date', type: 'date' as const, dateFormat: 'default' as const },
    { id: 'type', name: 'Type', type: 'select' as const, options: [
      { value: 'Meeting', color: 'blue' as const },
      { value: 'Review', color: 'teal' as const },
      { value: 'Release', color: 'green' as const },
      { value: 'Sprint', color: 'purple' as const },
      { value: 'Social', color: 'pink' as const },
    ]},
    { id: 'attendees', name: 'Attendees', type: 'text' as const },
  ];
  const calViews = [
    {
      id: 'v-cal-1',
      name: 'Calendar',
      config: {
        type: 'calendar' as const,
        dateCol: 'date',
        viewMode: 'month' as const,
        firstDayOfWeek: 'monday' as const,
        filters: [],
        sorts: [],
        openBehavior: 'center' as const,
        cardColorCol: 'type',
        cardProperties: ['attendees'],
        showPropertyLabels: false,
        propertyTextClamp: 'truncate' as const,
      },
    },
    {
      id: 'v-cal-2',
      name: 'Schedule',
      config: {
        type: 'table' as const,
        columnOrder: ['title', 'date', 'type', 'attendees'],
        hiddenColumns: [],
        filters: [],
        sorts: [{ id: 's1', columnId: 'date', direction: 'asc' as const }],
        openBehavior: 'center' as const,
      },
    },
  ];
  const calDbItem = crypto.randomUUID();
  const calDb = crypto.randomUUID();
  await db.insert(workspaceItems).values({ id: calDbItem, workspaceId: ws1, type: 'database', title: 'Team Calendar', sortOrder: 4, icon: '📅', iconColor: 'teal' });
  await db.insert(databases).values({ id: calDb, name: 'Team Calendar', itemId: calDbItem, schema: calSchema, views: calViews });

  const events = [
    { title: 'Daily Standup', date: d(-2), type: 'Meeting', attendees: 'Alice, Bob, Charlie, Diana' },
    { title: 'Daily Standup', date: d(-1), type: 'Meeting', attendees: 'Alice, Bob, Charlie, Diana' },
    { title: 'Daily Standup', date: d(0), type: 'Meeting', attendees: 'Alice, Bob, Charlie, Diana' },
    { title: 'Daily Standup', date: d(1), type: 'Meeting', attendees: 'Alice, Bob, Charlie, Diana' },
    { title: 'Daily Standup', date: d(2), type: 'Meeting', attendees: 'Alice, Bob, Charlie, Diana' },
    { title: 'Sprint 12 Review', date: d(-3), type: 'Review', attendees: 'Full team' },
    { title: 'Design Critique', date: d(-1), type: 'Review', attendees: 'Alice, Bob' },
    { title: 'Sprint 13 Planning', date: d(1), type: 'Sprint', attendees: 'Full team' },
    { title: 'API Architecture Review', date: d(3), type: 'Review', attendees: 'Charlie, Alice' },
    { title: 'Team Lunch', date: d(4), type: 'Social', attendees: 'All team' },
    { title: 'Customer Demo', date: d(6), type: 'Meeting', attendees: 'Bob, Diana' },
    { title: 'Tech Debt Session', date: d(8), type: 'Meeting', attendees: 'Charlie, Alice' },
    { title: 'Team Retrospective', date: d(10), type: 'Review', attendees: 'Full team' },
    { title: 'Sprint 13 Review', date: d(14), type: 'Review', attendees: 'Full team' },
    { title: 'Q3 Release — v2.1', date: d(16), type: 'Release', attendees: 'Full team' },
  ];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    await db.insert(pages).values({
      id: crypto.randomUUID(),
      databaseId: calDb,
      title: e.title,
      content: '',
      properties: { title: e.title, date: e.date, type: e.type, attendees: e.attendees },
      sortOrder: i,
    });
  }

  // ── Reading List database ───────────────────────────────────────────────────

  const readingSchema = [
    { id: 'title', name: 'Title', type: 'text' as const },
    { id: 'author', name: 'Author', type: 'text' as const },
    { id: 'status', name: 'Status', type: 'select' as const, options: [
      { value: 'To Read', color: 'blue' as const },
      { value: 'Reading', color: 'yellow' as const },
      { value: 'Finished', color: 'green' as const },
    ]},
    { id: 'rating', name: 'Rating', type: 'number' as const },
    { id: 'category', name: 'Category', type: 'select' as const, options: [
      { value: 'Tech', color: 'blue' as const },
      { value: 'Business', color: 'teal' as const },
      { value: 'Design', color: 'pink' as const },
      { value: 'Self-Help', color: 'green' as const },
      { value: 'Fiction', color: 'purple' as const },
    ]},
  ];
  const readingViews = [
    {
      id: 'v-reading-1',
      name: 'All Books',
      config: {
        type: 'table' as const,
        columnOrder: ['title', 'author', 'status', 'rating', 'category'],
        hiddenColumns: [],
        filters: [],
        sorts: [],
        openBehavior: 'center' as const,
        rowColorCol: 'status',
      },
    },
    {
      id: 'v-reading-2',
      name: 'Finished',
      config: {
        type: 'table' as const,
        columnOrder: ['title', 'author', 'rating', 'category'],
        hiddenColumns: [],
        filters: [{ id: 'f1', columnId: 'status', operator: 'equals' as const, value: 'Finished' }],
        sorts: [{ id: 's1', columnId: 'rating', direction: 'asc' as const }],
        openBehavior: 'center' as const,
      },
    },
  ];
  const readingDbItem = crypto.randomUUID();
  const readingDb = crypto.randomUUID();
  await db.insert(workspaceItems).values({ id: readingDbItem, workspaceId: ws1, type: 'database', title: 'Reading List', sortOrder: 5, icon: '📚', iconColor: 'purple' });
  await db.insert(databases).values({ id: readingDb, name: 'Reading List', itemId: readingDbItem, schema: readingSchema, views: readingViews });

  const books = [
    { title: 'The Pragmatic Programmer', author: 'David Thomas', status: 'Finished', rating: 5, category: 'Tech' },
    { title: 'Design Systems', author: 'Alla Kholmatova', status: 'Reading', rating: 4, category: 'Design' },
    { title: 'Zero to One', author: 'Peter Thiel', status: 'Finished', rating: 5, category: 'Business' },
    { title: 'Clean Code', author: 'Robert C. Martin', status: 'Finished', rating: 4, category: 'Tech' },
    { title: 'Shape Up', author: 'Ryan Singer', status: 'To Read', rating: null, category: 'Business' },
    { title: "Don't Make Me Think", author: 'Steve Krug', status: 'Finished', rating: 5, category: 'Design' },
    { title: 'The Lean Startup', author: 'Eric Ries', status: 'Finished', rating: 4, category: 'Business' },
    { title: 'Atomic Habits', author: 'James Clear', status: 'Reading', rating: 5, category: 'Self-Help' },
    { title: 'An Elegant Puzzle', author: 'Will Larson', status: 'To Read', rating: null, category: 'Tech' },
  ];
  for (let i = 0; i < books.length; i++) {
    const b = books[i];
    await db.insert(pages).values({
      id: crypto.randomUUID(),
      databaseId: readingDb,
      title: b.title,
      content: '',
      properties: { title: b.title, author: b.author, status: b.status, rating: b.rating, category: b.category },
      sortOrder: i,
    });
  }
}

export async function createDemoSeedData(userId: string, userName?: string | null) {
  const workspaceName = userName ? `${userName} Workspace` : 'Demo Workspace';
  await createRichWorkspaceData(userId, workspaceName);
}
