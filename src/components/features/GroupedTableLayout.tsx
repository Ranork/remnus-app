'use client';

import { useMemo, useState, type ComponentProps, type DragEvent } from 'react';
import { ChevronDown, ChevronRight, GripVertical, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { normalizeOption } from '@/lib/types/properties';
import {
  UNCATEGORIZED_TABLE_GROUP,
  getEffectiveTableGroupOrder,
  getVisibleTableGroups,
  groupPagesForTable,
} from '@/lib/tableGrouping';
import TableLayout from './TableLayout';
import { GroupGlyph } from './PropertyTags';

type GroupedTableLayoutProps = ComponentProps<typeof TableLayout> & {
  groupByCol: string;
  groupOrder: string[];
  hiddenGroups: string[];
  collapsedGroups?: string[];
  onGroupOrderChange: (order: string[]) => void;
  onCollapsedGroupsChange?: (groups: string[]) => void;
};

export default function GroupedTableLayout({
  database,
  pages,
  groupByCol,
  groupOrder,
  hiddenGroups,
  collapsedGroups = [],
  onGroupOrderChange,
  onCollapsedGroupsChange,
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
  const effectiveOptionOrder = useMemo(
    () => getEffectiveTableGroupOrder(options, groupOrder),
    [options, groupOrder],
  );
  const groupedPages = useMemo(
    () => groupPagesForTable(pages, groupByCol, options, visibleGroups),
    [pages, groupByCol, options, visibleGroups],
  );

  const collapsedSet = useMemo(() => new Set(collapsedGroups), [collapsedGroups]);

  // The "toggle columns" button belongs to whichever table is actually rendered
  // first — collapsing the top group must not take it away with it.
  const firstOpenGroupWithRows = visibleGroups.find(
    (name) => !collapsedSet.has(name) && (groupedPages[name]?.length ?? 0) > 0,
  );

  const toggleGroupCollapsed = (groupName: string) => {
    onCollapsedGroupsChange?.(
      collapsedSet.has(groupName)
        ? collapsedGroups.filter((g) => g !== groupName)
        : [...collapsedGroups, groupName],
    );
  };

  const [draggedGroup, setDraggedGroup] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);

  const handleGroupDragStart = (e: DragEvent, groupName: string) => {
    if (groupName === UNCATEGORIZED_TABLE_GROUP) return;
    setDraggedGroup(groupName);
    e.dataTransfer.setData('text/plain', groupName);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleGroupDragOver = (e: DragEvent, groupName: string) => {
    e.preventDefault();
    const sourceGroup = draggedGroup || e.dataTransfer.getData('text/plain');
    if (sourceGroup && sourceGroup !== groupName && groupName !== UNCATEGORIZED_TABLE_GROUP) {
      setDragOverGroup(groupName);
    }
  };

  const handleGroupDrop = (e: DragEvent, targetGroup: string) => {
    e.preventDefault();
    const sourceGroup = draggedGroup || e.dataTransfer.getData('text/plain');
    if (!sourceGroup || sourceGroup === targetGroup || targetGroup === UNCATEGORIZED_TABLE_GROUP) {
      setDraggedGroup(null);
      setDragOverGroup(null);
      return;
    }

    const current = [...effectiveOptionOrder];
    const fromIdx = current.indexOf(sourceGroup);
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
      {visibleGroups.map((groupName) => {
        const isUncategorized = groupName === UNCATEGORIZED_TABLE_GROUP;
        const groupRows = groupedPages[groupName] ?? [];
        const isCollapsed = collapsedSet.has(groupName);
        const isDraggingThis = draggedGroup === groupName;
        const isOver = dragOverGroup === groupName;

        // Sections are plain: the group's colour is its heading glyph, never a tinted
        // background (V2 R8.2 — the old "group background" setting is ignored).
        return (
          <section
            key={groupName}
            onDragOver={(e) => handleGroupDragOver(e, groupName)}
            onDrop={(e) => handleGroupDrop(e, groupName)}
            className={`rounded-control transition-opacity ${isDraggingThis ? 'opacity-30' : ''} ${isOver ? 'ring-1 ring-signal/50' : ''}`}
          >
            <div
              draggable={!isUncategorized}
              onDragStart={(e) => handleGroupDragStart(e, groupName)}
              onDragEnd={() => {
                setDraggedGroup(null);
                setDragOverGroup(null);
              }}
              className={`group/grouphead flex items-center gap-1 pb-1.5 ${isCollapsed ? '' : 'mb-1'}`}
            >
              <button
                type="button"
                onClick={() => toggleGroupCollapsed(groupName)}
                className="flex size-6 shrink-0 items-center justify-center rounded text-fg-3 transition-colors hover:bg-hover hover:text-fg cursor-pointer"
                title={isCollapsed ? t('expandGroup') : t('collapseGroup')}
                aria-label={isCollapsed ? t('expandGroup') : t('collapseGroup')}
                aria-expanded={!isCollapsed}
              >
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              </button>
              <div className={`flex min-w-0 items-center gap-2 ${!isUncategorized ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                <GroupGlyph column={groupColumn} value={isUncategorized ? null : groupName} />
                <h3 className="truncate text-sm font-semibold text-fg">
                  {isUncategorized ? t('uncategorized') : groupName}
                </h3>
                <span className="shrink-0 text-xs text-fg-3 tabular-nums">{groupRows.length}</span>
                {!isUncategorized && (
                  <GripVertical size={14} aria-hidden className="shrink-0 text-fg-4 opacity-0 transition-opacity group-hover/grouphead:opacity-100" />
                )}
              </div>
            </div>

            {isCollapsed ? null : groupRows.length > 0 ? (
              <TableLayout
                {...tableProps}
                database={database}
                pages={groupRows}
                onCreatePage={(initialProperties) => onCreatePage?.({
                  ...(isUncategorized ? {} : { [groupByCol]: groupName }),
                  ...initialProperties,
                })}
                disableRowDrag
                showToggleColumnsButton={groupName === firstOpenGroupWithRows}
              />
            ) : (
              <button
                type="button"
                onClick={() => onCreatePage?.(isUncategorized ? {} : { [groupByCol]: groupName })}
                className="flex w-full cursor-pointer items-center gap-1.5 rounded-control px-2.5 py-1.5 text-ui text-fg-3 transition-colors hover:bg-hover/50 hover:text-fg"
              >
                <Plus size={14} />
                {t('new')}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
