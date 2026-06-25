# Table View Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build table-view grouping by `select` and `status` properties, rendering grouped table sections vertically with draggable group headers.

**Architecture:** Add a pure grouping helper with tests, then reuse the board settings grouping UI through a shared layout-section component. Keep `TableLayout` as the cell/row renderer and add a thin `GroupedTableLayout` wrapper for group partitioning, section headers, and group reordering.

**Tech Stack:** Next.js App Router, React client components, TypeScript, TailwindCSS, lucide-react, next-intl, Node test runner with `tsx`.

## Global Constraints

- Approved spec: `docs/superpowers/specs/2026-06-25-table-view-grouping-design.md`.
- Relevant Next.js docs read before implementation: `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` and `node_modules/next/dist/docs/03-architecture/accessibility.md`.
- User-facing controls must match the board settings grouping UI. Table settings may add only a table-specific ungrouped option.
- Default behavior must remain unchanged: existing table views and newly created table views start with no grouping until the user explicitly chooses a grouping property.
- Every new user-facing string must use `next-intl` and be added to all 8 locale files.
- Do not add dependencies.
- Do not run `npm run build`; it runs DB seeding. Use `npx next build` if a production build check is needed.
- If starting a dev server, bind it to the local network, for example `npm run dev -- --hostname 0.0.0.0`.
- Leave unrelated dirty files untouched, including `src/db/migrations/0016_agent_edit_stamp.sql`.

---

### Task 1: Pure Table Grouping Helper

**Files:**
- Create: `src/lib/tableGrouping.ts`
- Create: `src/lib/tableGrouping.test.ts`

**Interfaces:**
- Produces: `UNCATEGORIZED_TABLE_GROUP: 'Uncategorized'`
- Produces: `NO_TABLE_GROUPING_VALUE: ''`
- Produces: `isTableGroupableColumn(column: unknown): boolean`
- Produces: `getEffectiveTableGroupOrder(options: string[], groupOrder?: string[]): string[]`
- Produces: `getVisibleTableGroups(options: string[], groupOrder?: string[], hiddenGroups?: string[]): string[]`
- Produces: `groupPagesForTable(pages, groupByCol, options, visibleGroups)`

- [ ] **Step 1: Write the failing helper tests**

Create `src/lib/tableGrouping.test.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  UNCATEGORIZED_TABLE_GROUP,
  getEffectiveTableGroupOrder,
  getVisibleTableGroups,
  groupPagesForTable,
  isTableGroupableColumn,
} from './tableGrouping';

describe('table grouping helpers', () => {
  it('only allows select and status columns', () => {
    assert.equal(isTableGroupableColumn({ type: 'select' }), true);
    assert.equal(isTableGroupableColumn({ type: 'status' }), true);
    assert.equal(isTableGroupableColumn({ type: 'multi_select' }), false);
    assert.equal(isTableGroupableColumn({ type: 'checkbox' }), false);
    assert.equal(isTableGroupableColumn(null), false);
  });

  it('uses saved group order first and appends new options in schema order', () => {
    assert.deepEqual(
      getEffectiveTableGroupOrder(['Todo', 'Doing', 'Done', 'Blocked'], ['Done', 'Todo', 'Missing']),
      ['Done', 'Todo', 'Doing', 'Blocked'],
    );
  });

  it('adds Uncategorized last unless it is hidden', () => {
    assert.deepEqual(
      getVisibleTableGroups(['Todo', 'Done'], ['Done', 'Todo'], []),
      ['Done', 'Todo', UNCATEGORIZED_TABLE_GROUP],
    );

    assert.deepEqual(
      getVisibleTableGroups(['Todo', 'Done'], ['Done', 'Todo'], [UNCATEGORIZED_TABLE_GROUP]),
      ['Done', 'Todo'],
    );
  });

  it('omits hidden configured groups', () => {
    assert.deepEqual(
      getVisibleTableGroups(['Todo', 'Doing', 'Done'], ['Done', 'Todo', 'Doing'], ['Doing']),
      ['Done', 'Todo', UNCATEGORIZED_TABLE_GROUP],
    );
  });

  it('groups unknown, empty, and missing values into Uncategorized', () => {
    const pages = [
      { id: '1', properties: { status: 'Todo' } },
      { id: '2', properties: { status: 'Done' } },
      { id: '3', properties: { status: 'Blocked' } },
      { id: '4', properties: { status: '' } },
      { id: '5', properties: {} },
    ];

    const grouped = groupPagesForTable(
      pages,
      'status',
      ['Todo', 'Done'],
      ['Todo', 'Done', UNCATEGORIZED_TABLE_GROUP],
    );

    assert.deepEqual(grouped.Todo.map((p) => p.id), ['1']);
    assert.deepEqual(grouped.Done.map((p) => p.id), ['2']);
    assert.deepEqual(grouped[UNCATEGORIZED_TABLE_GROUP].map((p) => p.id), ['3', '4', '5']);
  });

  it('does not surface pages for hidden groups', () => {
    const grouped = groupPagesForTable(
      [
        { id: '1', properties: { status: 'Todo' } },
        { id: '2', properties: { status: 'Done' } },
      ],
      'status',
      ['Todo', 'Done'],
      ['Done', UNCATEGORIZED_TABLE_GROUP],
    );

    assert.equal(grouped.Todo, undefined);
    assert.deepEqual(grouped.Done.map((p) => p.id), ['2']);
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npx tsx --test src/lib/tableGrouping.test.ts`

Expected: FAIL because `src/lib/tableGrouping.ts` does not exist.

- [ ] **Step 3: Implement the grouping helper**

Create `src/lib/tableGrouping.ts`:

```ts
export const UNCATEGORIZED_TABLE_GROUP = 'Uncategorized';
export const NO_TABLE_GROUPING_VALUE = '';

type DatabaseColumn = {
  id?: string;
  type?: string;
};

type PageLike = {
  properties?: Record<string, unknown>;
};

export function isTableGroupableColumn(column: unknown): column is DatabaseColumn {
  if (!column || typeof column !== 'object') return false;
  const type = (column as DatabaseColumn).type;
  return type === 'select' || type === 'status';
}

export function getEffectiveTableGroupOrder(options: string[], groupOrder: string[] = []): string[] {
  if (!groupOrder.length) return options;
  const optionSet = new Set(options);
  const ordered = groupOrder.filter((group) => optionSet.has(group));
  const extras = options.filter((option) => !groupOrder.includes(option));
  return [...ordered, ...extras];
}

export function getVisibleTableGroups(
  options: string[],
  groupOrder: string[] = [],
  hiddenGroups: string[] = [],
): string[] {
  const hidden = new Set(hiddenGroups);
  return [...getEffectiveTableGroupOrder(options, groupOrder), UNCATEGORIZED_TABLE_GROUP].filter(
    (group) => !hidden.has(group),
  );
}

export function groupPagesForTable<TPage extends PageLike>(
  pages: TPage[],
  groupByCol: string,
  options: string[],
  visibleGroups: string[],
): Record<string, TPage[]> {
  const optionSet = new Set(options);
  const visibleSet = new Set(visibleGroups);
  const grouped: Record<string, TPage[]> = {};

  for (const group of visibleGroups) {
    grouped[group] = [];
  }

  for (const page of pages) {
    const value = page.properties?.[groupByCol];
    const group = typeof value === 'string' && optionSet.has(value) ? value : UNCATEGORIZED_TABLE_GROUP;
    if (visibleSet.has(group)) {
      grouped[group].push(page);
    }
  }

  return grouped;
}
```

- [ ] **Step 4: Run helper tests**

Run: `npx tsx --test src/lib/tableGrouping.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the helper**

Run:

```bash
git add src/lib/tableGrouping.ts src/lib/tableGrouping.test.ts
git commit -m "test(table): cover grouped table ordering"
```

---

### Task 2: Shared Board-Style Grouping Settings

**Files:**
- Create: `src/components/features/database-sidebar/GroupingLayoutSection.tsx`
- Modify: `src/components/features/database-sidebar/KanbanLayoutSection.tsx`
- Modify: `messages/en.json`
- Modify: `messages/tr.json`
- Modify: `messages/hi.json`
- Modify: `messages/es.json`
- Modify: `messages/fr.json`
- Modify: `messages/de.json`
- Modify: `messages/zh.json`
- Modify: `messages/ru.json`

**Interfaces:**
- Produces: board-style grouping controls reusable by board and table settings.
- Adds `Database.noGrouping` translation key in all 8 locales.
- The table settings select defaults to `Database.noGrouping`, preserving current table behavior by default.

- [ ] **Step 1: Add the new translation key**

Add `noGrouping` under `Database` in all 8 `messages/*.json` files.

Use these values:

```json
// messages/en.json
"noGrouping": "No grouping"

// messages/tr.json
"noGrouping": "Gruplama yok"

// messages/hi.json
"noGrouping": "कोई समूहीकरण नहीं"

// messages/es.json
"noGrouping": "Sin agrupación"

// messages/fr.json
"noGrouping": "Aucun regroupement"

// messages/de.json
"noGrouping": "Keine Gruppierung"

// messages/zh.json
"noGrouping": "不分组"

// messages/ru.json
"noGrouping": "Без группировки"
```

- [ ] **Step 2: Extract the shared grouping section**

Create `src/components/features/database-sidebar/GroupingLayoutSection.tsx`:

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { normalizeOption } from '@/lib/types/properties';
import { Checkbox, CollapsibleSection, selectCls } from './shared';

interface GroupingLayoutSectionProps {
  schema: any[];
  groupByCol?: string;
  onGroupByColChange?: (colId: string) => void;
  groupColBg?: boolean;
  onGroupColBgChange?: (enabled: boolean) => void;
  hiddenGroups?: string[];
  onHiddenGroupsChange?: (hidden: string[]) => void;
  allowNoGrouping?: boolean;
}

export default function GroupingLayoutSection({
  schema,
  groupByCol,
  onGroupByColChange,
  groupColBg,
  onGroupColBgChange,
  hiddenGroups = [],
  onHiddenGroupsChange,
  allowNoGrouping = false,
}: GroupingLayoutSectionProps) {
  const t = useTranslations('Database');
  const selectColumns = schema.filter((c: any) => c.type === 'select' || c.type === 'status');
  const groupColumn = schema.find((c: any) => c.id === groupByCol);
  const options = groupColumn?.options ? groupColumn.options.map((o: any) => normalizeOption(o).value) : [];

  return (
    <CollapsibleSection label={t('sectionGrouping')}>
      <div className="px-4 pb-3 flex flex-col gap-2">
        {selectColumns.length > 0 ? (
          <div>
            <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5">{t('groupBy')}</span>
            <select value={groupByCol ?? ''} onChange={(e) => onGroupByColChange?.(e.target.value)} className={`${selectCls} w-full`}>
              {allowNoGrouping && <option value="">{t('noGrouping')}</option>}
              {selectColumns.map((col: any) => <option key={col.id} value={col.id}>{col.name}</option>)}
            </select>
          </div>
        ) : (
          <span className="text-xs text-amber-500/80">{t('addSelectForGroup')}</span>
        )}
        <button onClick={() => onGroupColBgChange?.(!groupColBg)} className="w-full flex items-center justify-between py-1.5 hover:bg-neutral-800/10 transition-colors cursor-pointer rounded">
          <span className="text-xs text-neutral-300">{t('groupBackground')}</span>
          <Checkbox checked={!!groupColBg} />
        </button>
      </div>

      {groupColumn && (
        <div className="pb-2">
          <div className="flex flex-col">
            {[...options, 'Uncategorized'].map((colName) => {
              const isHidden = hiddenGroups.includes(colName);
              return (
                <button
                  key={colName}
                  onClick={() => onHiddenGroupsChange?.(isHidden ? hiddenGroups.filter((g) => g !== colName) : [...hiddenGroups, colName])}
                  className="w-full flex items-center justify-between px-4 py-2 border-b border-neutral-800/30 hover:bg-neutral-800/10 transition-colors cursor-pointer text-left"
                >
                  <span className="text-xs text-neutral-300 truncate">{colName === 'Uncategorized' ? t('uncategorized') : colName}</span>
                  <Checkbox checked={!isHidden} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}
```

- [ ] **Step 3: Replace Kanban’s inline grouping controls**

Modify `src/components/features/database-sidebar/KanbanLayoutSection.tsx`:

```tsx
import GroupingLayoutSection from './GroupingLayoutSection';
```

Remove `normalizeOption` from the imports, remove `groupColumn` and `options` constants from `KanbanLayoutSection`, and replace the existing grouping `<CollapsibleSection>` block with:

```tsx
<GroupingLayoutSection
  schema={schema}
  groupByCol={groupByCol}
  onGroupByColChange={onGroupByColChange}
  groupColBg={groupColBg}
  onGroupColBgChange={onGroupColBgChange}
  hiddenGroups={hiddenGroups}
  onHiddenGroupsChange={onHiddenGroupsChange}
/>
```

- [ ] **Step 4: Run checks**

Run:

```bash
npx tsx --test src/lib/tableGrouping.test.ts
npm run lint
```

Expected: both PASS.

- [ ] **Step 5: Commit shared settings**

Run:

```bash
git add src/components/features/database-sidebar/GroupingLayoutSection.tsx src/components/features/database-sidebar/KanbanLayoutSection.tsx messages/en.json messages/tr.json messages/hi.json messages/es.json messages/fr.json messages/de.json messages/zh.json messages/ru.json
git commit -m "refactor(database): share grouping settings controls"
```

---

### Task 3: Table View Config And Sidebar Wiring

**Files:**
- Modify: `src/lib/types/views.ts`
- Modify: `src/components/features/DatabasePropertiesSidebar.tsx`
- Modify: `src/components/features/DatabaseView.tsx`

**Interfaces:**
- Extends `TableViewConfig` with optional grouping fields.
- Shows the same board-style grouping controls in table view settings.
- Keeps `defaultTableView()` ungrouped by omitting `groupByCol`.

- [ ] **Step 1: Extend `TableViewConfig`**

Modify `src/lib/types/views.ts`:

```ts
export interface TableViewConfig {
  type: 'table';
  columnOrder: string[];
  hiddenColumns: string[];
  columnWidths?: Record<string, number>;
  rowColorCol?: string;
  groupByCol?: string;
  groupOrder?: string[];
  groupColBg?: boolean;
  hiddenGroups?: string[];
  filters: ViewFilter[];
  sorts: ViewSort[];
  openBehavior?: OpenBehavior;
  defaultPageIcon?: string;
  defaultPageIconColor?: string;
}
```

- [ ] **Step 2: Render grouping controls for table views**

Modify `src/components/features/DatabasePropertiesSidebar.tsx`:

```tsx
import GroupingLayoutSection from './database-sidebar/GroupingLayoutSection';
```

Inside the table-only Layout block, render grouping before appearance:

```tsx
{viewType === 'table' && (
  <GroupingLayoutSection
    schema={schema}
    groupByCol={groupByCol}
    onGroupByColChange={onGroupByColChange}
    groupColBg={groupColBg}
    onGroupColBgChange={onGroupColBgChange}
    hiddenGroups={hiddenGroups}
    onHiddenGroupsChange={onHiddenGroupsChange}
    allowNoGrouping
  />
)}
```

Keep the existing appearance section below it.

- [ ] **Step 3: Pass table grouping props from `DatabaseView`**

Modify `src/components/features/DatabaseView.tsx` so the sidebar receives table grouping config when `tableConfig` is active:

```tsx
groupByCol={tableConfig?.groupByCol ?? kanbanConfig?.groupByCol}
groupColBg={tableConfig?.groupColBg ?? kanbanConfig?.groupColBg ?? false}
hiddenGroups={tableConfig?.hiddenGroups ?? kanbanConfig?.hiddenGroups}
```

Keep the existing handlers:

```tsx
onGroupByColChange={handleGroupByChange}
onGroupColBgChange={handleGroupColBgChange}
onHiddenGroupsChange={(hidden) =>
  mutateConfig((cfg) => ({ ...cfg, hiddenGroups: hidden }))
}
```

- [ ] **Step 4: Run checks**

Run:

```bash
npx tsx --test src/lib/tableGrouping.test.ts
npm run lint
```

Expected: both PASS.

- [ ] **Step 5: Commit config and sidebar wiring**

Run:

```bash
git add src/lib/types/views.ts src/components/features/DatabasePropertiesSidebar.tsx src/components/features/DatabaseView.tsx
git commit -m "feat(table): add grouping settings"
```

---

### Task 4: Grouped Table Layout

**Files:**
- Create: `src/components/features/GroupedTableLayout.tsx`
- Modify: `src/components/features/TableLayout.tsx`
- Modify: `src/components/features/DatabaseView.tsx`

**Interfaces:**
- Produces vertically stacked grouped table sections.
- Disables row drag in grouped mode.
- Keeps board-style group header drag for vertical group ordering.

- [ ] **Step 1: Add grouped-mode props to `TableLayout`**

Modify `src/components/features/TableLayout.tsx` props:

```tsx
  disableRowDrag?: boolean;
  showToggleColumnsButton?: boolean;
  emptyState?: React.ReactNode;
```

Default them in the function parameter destructuring:

```tsx
  disableRowDrag = false,
  showToggleColumnsButton = true,
  emptyState,
```

Change the toggle-columns button wrapper to:

```tsx
{showToggleColumnsButton && (
  <div className="absolute right-2 top-1 z-20">
    ...
  </div>
)}
```

Change `handleGripDragStart` to:

```tsx
const handleGripDragStart = (e: React.DragEvent, pageId: string) => {
  if (hasSorts || disableRowDrag) { e.preventDefault(); return; }
  const rowEl = rowRefs.current.get(pageId);
  if (rowEl) e.dataTransfer.setDragImage(rowEl, 24, rowEl.offsetHeight / 2);
  setDraggedRowId(pageId);
  e.dataTransfer.effectAllowed = 'move';
};
```

Change the action-bar button props:

```tsx
draggable={!hasSorts && !disableRowDrag}
className={`text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 transition-colors rounded flex items-center justify-center cursor-pointer ${
  hasSorts || disableRowDrag ? 'opacity-50' : 'cursor-grab active:cursor-grabbing'
}`}
title={hasSorts || disableRowDrag ? t('dragMove') : t('dragReorder')}
```

Change the empty rows block:

```tsx
{pages.length === 0 ? (
  emptyState ?? (
    <tr>
      <td colSpan={visibleCols.length} className="py-16 text-center text-neutral-600 text-sm">
        {t('noPages')}
      </td>
    </tr>
  )
) : (
  ...
)}
```

- [ ] **Step 2: Create `GroupedTableLayout`**

Create `src/components/features/GroupedTableLayout.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { GripVertical, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getOptionColorByValue, normalizeOption } from '@/lib/types/properties';
import {
  UNCATEGORIZED_TABLE_GROUP,
  getVisibleTableGroups,
  groupPagesForTable,
} from '@/lib/tableGrouping';
import TableLayout from './TableLayout';

type GroupedTableLayoutProps = React.ComponentProps<typeof TableLayout> & {
  groupByCol: string;
  groupOrder: string[];
  hiddenGroups: string[];
  groupColBg?: boolean;
  onGroupOrderChange: (order: string[]) => void;
};

export default function GroupedTableLayout({
  database,
  pages,
  groupByCol,
  groupOrder,
  hiddenGroups,
  groupColBg = false,
  onGroupOrderChange,
  onCreatePage,
  ...tableProps
}: GroupedTableLayoutProps) {
  const t = useTranslations('Database');
  const schema = database.schema ?? [];
  const groupColumn = schema.find((col: any) => col.id === groupByCol);
  const options = useMemo(
    () => (groupColumn?.options ?? []).map((option: any) => normalizeOption(option).value),
    [groupColumn?.options],
  );
  const visibleGroups = useMemo(
    () => getVisibleTableGroups(options, groupOrder, hiddenGroups),
    [options, groupOrder, hiddenGroups],
  );
  const groupedPages = useMemo(
    () => groupPagesForTable(pages, groupByCol, options, visibleGroups),
    [pages, groupByCol, options, visibleGroups],
  );

  const [draggedGroup, setDraggedGroup] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);

  const orderedOptionGroups = visibleGroups.filter((group) => group !== UNCATEGORIZED_TABLE_GROUP);

  const handleGroupDrop = (e: React.DragEvent, targetGroup: string) => {
    e.preventDefault();
    if (!draggedGroup || draggedGroup === targetGroup || targetGroup === UNCATEGORIZED_TABLE_GROUP) {
      setDraggedGroup(null);
      setDragOverGroup(null);
      return;
    }

    const current = [...orderedOptionGroups];
    const fromIdx = current.indexOf(draggedGroup);
    const toIdx = current.indexOf(targetGroup);
    if (fromIdx !== -1 && toIdx !== -1) {
      const [moved] = current.splice(fromIdx, 1);
      current.splice(toIdx, 0, moved);
      onGroupOrderChange(current);
    }

    setDraggedGroup(null);
    setDragOverGroup(null);
  };

  return (
    <div className="flex flex-col gap-6 pb-6">
      {visibleGroups.map((groupName, index) => {
        const isUncategorized = groupName === UNCATEGORIZED_TABLE_GROUP;
        const groupRows = groupedPages[groupName] ?? [];
        const isDraggingThis = draggedGroup === groupName;
        const isOver = dragOverGroup === groupName;
        const groupBgStyle = groupColBg
          ? (isUncategorized
              ? { backgroundColor: 'rgba(56, 59, 65, 0.08)' }
              : { backgroundColor: getOptionColorByValue(groupColumn?.options || [], groupName).groupBg })
          : undefined;

        return (
          <section
            key={groupName}
            draggable={!isUncategorized}
            onDragStart={(e) => {
              if (isUncategorized) return;
              setDraggedGroup(groupName);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (draggedGroup && draggedGroup !== groupName && !isUncategorized) {
                setDragOverGroup(groupName);
              }
            }}
            onDrop={(e) => handleGroupDrop(e, groupName)}
            onDragEnd={() => {
              setDraggedGroup(null);
              setDragOverGroup(null);
            }}
            className={`transition-opacity ${groupColBg ? 'p-3 rounded' : ''} ${isDraggingThis ? 'opacity-30' : ''} ${isOver ? 'ring-1 ring-blue-500/40' : ''}`}
            style={groupBgStyle}
          >
            <div className={`mb-2 flex items-center justify-between border-b pb-2 ${groupColBg ? 'border-white/8' : 'border-neutral-800/50'}`}>
              <div className={`flex items-center gap-2 min-w-0 ${!isUncategorized ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                {!isUncategorized && <GripVertical size={12} className="text-neutral-600 shrink-0" />}
                <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-400 truncate">
                  {isUncategorized ? t('uncategorized') : groupName}
                </h3>
              </div>
              <span className="text-xs text-neutral-500 tabular-nums">{groupRows.length}</span>
            </div>

            {groupRows.length > 0 ? (
              <TableLayout
                {...tableProps}
                database={database}
                pages={groupRows}
                onCreatePage={(initialProperties) => onCreatePage?.({
                  ...(isUncategorized ? {} : { [groupByCol]: groupName }),
                  ...initialProperties,
                })}
                disableRowDrag
                showToggleColumnsButton={index === 0}
              />
            ) : (
              <button
                onClick={() => onCreatePage?.(isUncategorized ? {} : { [groupByCol]: groupName })}
                className="w-full py-4 text-xs text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/10 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus size={13} />
                {t('new')}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Render grouped tables from `DatabaseView`**

Modify `src/components/features/DatabaseView.tsx` imports:

```tsx
import GroupedTableLayout from './GroupedTableLayout';
import { isTableGroupableColumn } from '@/lib/tableGrouping';
```

Add after `tableConfig` is declared:

```tsx
const tableGroupColumn = tableConfig?.groupByCol
  ? schema.find((col: any) => col.id === tableConfig.groupByCol)
  : null;
const isGroupedTableView = !!tableConfig?.groupByCol && isTableGroupableColumn(tableGroupColumn);
```

Replace the table render branch with:

```tsx
{isTableView && tableConfig ? (
  isGroupedTableView ? (
    <GroupedTableLayout
      database={database}
      pages={processedPages}
      groupByCol={tableConfig.groupByCol!}
      groupOrder={tableConfig.groupOrder ?? []}
      hiddenGroups={tableConfig.hiddenGroups ?? []}
      groupColBg={tableConfig.groupColBg ?? false}
      onGroupOrderChange={handleGroupOrderChange}
      columnOrder={tableConfig.columnOrder}
      hiddenColumns={tableConfig.hiddenColumns}
      columnWidths={tableConfig.columnWidths ?? {}}
      onColumnWidthsChange={handleColumnWidthsChange}
      rowColorCol={tableConfig.rowColorCol}
      onColumnOrderChange={handleColumnOrderChange}
      onRowClick={handlePageClick}
      onRowReorder={handleRowReorder}
      onDeletePage={handleDeletePage}
      onDuplicatePage={handleDuplicatePage}
      hasSorts={(config.sorts?.length ?? 0) > 0}
      onUpdatePageProperties={handleUpdatePageProperties}
      onCreatePage={handleAddRow}
      filters={config.filters}
      sorts={config.sorts}
      onFiltersChange={handleFiltersChange}
      onSortsChange={handleSortsChange}
      onToggleHideColumn={toggleHideColumn}
      defaultPageIcon={config.defaultPageIcon}
      defaultPageIconColor={config.defaultPageIconColor}
      onPageIconChange={handlePageIconChange}
    />
  ) : (
    <TableLayout
      ...
    />
  )
) : kanbanConfig ? (
```

Keep the existing ungrouped `TableLayout` props exactly as they are today.

- [ ] **Step 4: Run tests and lint**

Run:

```bash
npx tsx --test src/lib/tableGrouping.test.ts
npm run lint
```

Expected: both PASS.

- [ ] **Step 5: Commit grouped table rendering**

Run:

```bash
git add src/components/features/GroupedTableLayout.tsx src/components/features/TableLayout.tsx src/components/features/DatabaseView.tsx
git commit -m "feat(table): render grouped table sections"
```

---

### Task 5: Browser Verification And Polish

**Files:**
- Modify only files touched in previous tasks if verification exposes issues.

- [ ] **Step 1: Run full focused verification**

Run:

```bash
npx tsx --test src/lib/tableGrouping.test.ts src/lib/sidebarVisibility.test.ts src/lib/nextDevOrigins.test.ts
npm run lint
```

Expected: all PASS.

- [ ] **Step 2: Start the dev server on the local network**

Run:

```bash
npm run dev -- --hostname 0.0.0.0
```

Expected: server starts and prints a local URL plus network-accessible URL.

- [ ] **Step 3: Manually verify the flow in browser**

Use an existing database with a status column:

- Open a table view.
- Open Settings -> Layout.
- Confirm table grouping controls match the board settings grouping controls.
- Choose a status/select property.
- Confirm multiple table sections appear vertically.
- Drag group headers up/down and refresh to confirm order persists.
- Hide and show a group.
- Create a row from a non-empty group and confirm the grouped property is prefilled.
- Create a row from an empty visible group and confirm the grouped property is prefilled.
- Confirm row dragging is disabled inside grouped table sections.
- Confirm inline edit, page open, duplicate/delete, column resize/reorder, and toggle columns still work.
- Confirm no repeated toggle-column buttons clutter every group.

- [ ] **Step 4: Commit polish fixes if needed**

If verification required changes, run:

```bash
git add <changed-files>
git commit -m "fix(table): polish grouped table interactions"
```

- [ ] **Step 5: Final status**

Run:

```bash
git status --short
git log --oneline -5
```

Expected: only pre-existing unrelated dirty files remain.

## Self-Review

- Spec coverage: the plan covers select/status grouping, board-style controls, vertical grouped sections, group-title drag order, hidden groups, group-specific new rows, disabled grouped row drag, large-record helper memoization, and browser verification.
- Placeholder scan: no `TBD`, `TODO`, or vague “add tests” steps remain.
- Type consistency: table grouping fields are `groupByCol`, `groupOrder`, `groupColBg`, and `hiddenGroups` across types, sidebar, view state, and grouped layout.
