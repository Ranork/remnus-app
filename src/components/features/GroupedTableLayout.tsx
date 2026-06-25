'use client';

import { useMemo, useState, type ComponentProps, type DragEvent } from 'react';
import { GripVertical, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getOptionColorByValue, normalizeOption } from '@/lib/types/properties';
import {
  UNCATEGORIZED_TABLE_GROUP,
  getEffectiveTableGroupOrder,
  getVisibleTableGroups,
  groupPagesForTable,
} from '@/lib/tableGrouping';
import TableLayout from './TableLayout';

type GroupedTableLayoutProps = ComponentProps<typeof TableLayout> & {
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
  const effectiveOptionOrder = useMemo(
    () => getEffectiveTableGroupOrder(options, groupOrder),
    [options, groupOrder],
  );
  const groupedPages = useMemo(
    () => groupPagesForTable(pages, groupByCol, options, visibleGroups),
    [pages, groupByCol, options, visibleGroups],
  );

  const [draggedGroup, setDraggedGroup] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);

  const handleGroupDrop = (e: DragEvent, targetGroup: string) => {
    e.preventDefault();
    if (!draggedGroup || draggedGroup === targetGroup || targetGroup === UNCATEGORIZED_TABLE_GROUP) {
      setDraggedGroup(null);
      setDragOverGroup(null);
      return;
    }

    const current = [...effectiveOptionOrder];
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
            onDragOver={(e) => {
              e.preventDefault();
              if (draggedGroup && draggedGroup !== groupName && !isUncategorized) {
                setDragOverGroup(groupName);
              }
            }}
            onDrop={(e) => handleGroupDrop(e, groupName)}
            className={`transition-opacity ${groupColBg ? 'p-3 rounded' : ''} ${isDraggingThis ? 'opacity-30' : ''} ${isOver ? 'ring-1 ring-blue-500/40' : ''}`}
            style={groupBgStyle}
          >
            <div
              draggable={!isUncategorized}
              onDragStart={(e) => {
                if (isUncategorized) return;
                setDraggedGroup(groupName);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => {
                setDraggedGroup(null);
                setDragOverGroup(null);
              }}
              className={`mb-2 flex items-center justify-between border-b pb-2 ${groupColBg ? 'border-white/8' : 'border-neutral-800/50'}`}
            >
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
