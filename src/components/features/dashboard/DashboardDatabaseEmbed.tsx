'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import TableLayout from '@/components/features/TableLayout';
import KanbanBoard from '@/components/features/KanbanBoard';
import { MembersProvider, type WorkspaceMember } from '@/components/features/MembersContext';
import { deletePage, duplicatePage, updatePageProperties } from '@/lib/actions/page';
import type { DatabaseView, ViewFilter, ViewSort } from '@/lib/types/views';

/**
 * The `database_embed` block — the real `TableLayout` / `KanbanBoard`, not a
 * lookalike. Reusing them is the point: a table inside a dashboard has to show
 * the same status chips, person avatars, colors and row icons the database
 * route shows, and a second implementation would drift from it within a
 * release.
 *
 * What the wrapper decides, and why:
 *
 *  • **Row edits are real.** Changing a property, deleting or duplicating a row
 *    calls the same server actions the database route calls. A table that
 *    silently swallowed edits would be worse than one that didn't offer them.
 *  • **View-config edits are local to this visit.** Reordering columns, hiding
 *    one, adding a filter or a sort changes only what this reader sees. A
 *    dashboard embeds someone else's saved view; it does not get to rewrite it.
 *  • **Rows are already filtered, sorted and capped on the server** (see
 *    `resolveDashboard`), so this component starts from the final list.
 */
export default function DashboardDatabaseEmbed({
  database,
  view,
  rows,
  members,
}: {
  database: { id: string; name: string; schema: unknown[] };
  view: DatabaseView;
  rows: Record<string, unknown>[];
  members: WorkspaceMember[];
}) {
  const t = useTranslations('Dashboard');
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [localRows, setLocalRows] = useState(rows);

  const config = view.config as {
    type: string;
    columnOrder?: string[];
    hiddenColumns?: string[];
    columnWidths?: Record<string, number>;
    rowColorCol?: string;
    groupByCol?: string;
    groupOrder?: string[];
    cardProperties?: string[];
    cardColorCol?: string;
    filters?: ViewFilter[];
    sorts?: ViewSort[];
  };

  // Presentation state that stays inside this embed — see the header note.
  const [columnOrder, setColumnOrder] = useState<string[]>(config.columnOrder ?? []);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(config.hiddenColumns ?? []);
  const [filters, setFilters] = useState<ViewFilter[]>(config.filters ?? []);
  const [sorts, setSorts] = useState<ViewSort[]>(config.sorts ?? []);
  const [groupOrder, setGroupOrder] = useState<string[]>(config.groupOrder ?? []);

  const openRow = (pageId: string) => router.push(`/db/${database.id}/${pageId}`);

  const patchProperties = (pageId: string, properties: Record<string, unknown>) => {
    setLocalRows((prev) =>
      prev.map((r) =>
        r.id === pageId ? { ...r, properties: { ...(r.properties as Record<string, unknown>), ...properties } } : r,
      ),
    );
    startTransition(async () => {
      await updatePageProperties(pageId, properties);
    });
  };

  const removeRow = (pageId: string) => {
    setLocalRows((prev) => prev.filter((r) => r.id !== pageId));
    startTransition(async () => {
      await deletePage(pageId, database.id);
      router.refresh();
    });
  };

  const copyRow = (pageId: string) => {
    startTransition(async () => {
      await duplicatePage(pageId, database.id);
      router.refresh();
    });
  };

  const toggleHideColumn = (colId: string) =>
    setHiddenColumns((prev) => (prev.includes(colId) ? prev.filter((c) => c !== colId) : [...prev, colId]));

  const body = useMemo(() => {
    if (config.type === 'kanban' && config.groupByCol) {
      return (
        <KanbanBoard
          database={database}
          pages={localRows}
          groupByCol={config.groupByCol}
          groupOrder={groupOrder}
          onGroupOrderChange={setGroupOrder}
          onCardClick={openRow}
          // Dropping a card into another column IS a property change, so it
          // persists like any other cell edit. Within-column ordering is not
          // offered here: it belongs to the database's own view.
          onCardMove={(pageId, targetGroupId) => patchProperties(pageId, { [config.groupByCol!]: targetGroupId })}
          onDeletePage={removeRow}
          onDuplicatePage={copyRow}
          hasSorts={sorts.length > 0}
          cardProperties={config.cardProperties}
          cardColorCol={config.cardColorCol}
          onUpdatePageProperties={patchProperties}
        />
      );
    }

    return (
      <TableLayout
        database={database}
        pages={localRows}
        columnOrder={columnOrder}
        hiddenColumns={hiddenColumns}
        columnWidths={config.columnWidths ?? {}}
        rowColorCol={config.rowColorCol}
        onColumnOrderChange={setColumnOrder}
        onRowClick={openRow}
        // Row drag is off, so this is unreachable — it exists because the prop
        // is required, not as a swallowed write.
        onRowReorder={() => {}}
        onDeletePage={removeRow}
        onDuplicatePage={copyRow}
        hasSorts={sorts.length > 0}
        onUpdatePageProperties={patchProperties}
        filters={filters}
        sorts={sorts}
        onFiltersChange={setFilters}
        onSortsChange={setSorts}
        onToggleHideColumn={toggleHideColumn}
        disableRowDrag
        showToggleColumnsButton={false}
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localRows, columnOrder, hiddenColumns, filters, sorts, groupOrder, config, database]);

  if (!localRows.length) {
    return <p className="px-1 py-6 text-center text-xs text-neutral-500">{t('noRows')}</p>;
  }

  return (
    <MembersProvider members={members}>
      <div className="overflow-x-auto">{body}</div>
    </MembersProvider>
  );
}
