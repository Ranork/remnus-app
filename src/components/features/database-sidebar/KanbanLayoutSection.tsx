'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { GripVertical } from 'lucide-react';
import { normalizeOption } from '@/lib/types/properties';
import { getPropertyIcon, Checkbox, selectCls } from './shared';

interface KanbanLayoutSectionProps {
  schema: any[];
  groupByCol?: string;
  onGroupByColChange?: (colId: string) => void;
  cardProperties?: string[];
  onCardPropertiesChange?: (props: string[]) => void;
  showPropertyLabels?: boolean;
  onShowPropertyLabelsChange?: (show: boolean) => void;
  propertyTextClamp?: 'truncate' | 'wrap';
  onPropertyTextClampChange?: (clamp: 'truncate' | 'wrap') => void;
  cardColorCol?: string;
  onCardColorColChange?: (colId: string) => void;
  groupColBg?: boolean;
  onGroupColBgChange?: (enabled: boolean) => void;
  hiddenGroups?: string[];
  onHiddenGroupsChange?: (hidden: string[]) => void;
}

export default function KanbanLayoutSection({
  schema,
  groupByCol,
  onGroupByColChange,
  cardProperties,
  onCardPropertiesChange,
  showPropertyLabels = true,
  onShowPropertyLabelsChange,
  propertyTextClamp = 'truncate',
  onPropertyTextClampChange,
  cardColorCol,
  onCardColorColChange,
  groupColBg,
  onGroupColBgChange,
  hiddenGroups = [],
  onHiddenGroupsChange,
}: KanbanLayoutSectionProps) {
  const t = useTranslations('Database');

  const selectColumns = schema.filter((c: any) => c.type === 'select');
  const colorColumns = schema.filter((c: any) => c.type === 'select' || c.type === 'multi_select');
  const groupColumn = schema.find((c: any) => c.id === groupByCol);
  const options = groupColumn?.options ? groupColumn.options.map((o: any) => normalizeOption(o).value) : [];

  const availableCardProps = schema.filter((c: any) => c.id !== 'title' && c.id !== groupByCol);
  const effectiveVisible: string[] =
    cardProperties !== undefined
      ? cardProperties.filter((id) => availableCardProps.some((c: any) => c.id === id))
      : availableCardProps.slice(0, 2).map((c: any) => c.id);

  const visibleCardProps = effectiveVisible.map((id) => availableCardProps.find((c: any) => c.id === id)).filter(Boolean) as any[];
  const hiddenCardProps = availableCardProps.filter((c: any) => !effectiveVisible.includes(c.id));

  const toggleCardProp = (colId: string) => {
    onCardPropertiesChange?.(
      effectiveVisible.includes(colId)
        ? effectiveVisible.filter((id) => id !== colId)
        : [...effectiveVisible, colId],
    );
  };

  const [draggingCardProp, setDraggingCardProp] = useState<string | null>(null);
  const [dragOverCardProp, setDragOverCardProp] = useState<string | null>(null);

  const handleDrop = (targetColId: string) => {
    if (!draggingCardProp || draggingCardProp === targetColId) return;
    const current = [...effectiveVisible];
    const fromIdx = current.indexOf(draggingCardProp);
    const toIdx = current.indexOf(targetColId);
    if (fromIdx !== -1 && toIdx !== -1) {
      const [moved] = current.splice(fromIdx, 1);
      current.splice(toIdx, 0, moved);
      onCardPropertiesChange?.(current);
    }
    setDraggingCardProp(null);
    setDragOverCardProp(null);
  };

  return (
    <>
      {/* Group by */}
      <div className="px-4 py-3">
        <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-2">{t('groupBy')}</span>
        {selectColumns.length > 0 ? (
          <select value={groupByCol} onChange={(e) => onGroupByColChange?.(e.target.value)} className={`${selectCls} w-full text-xs py-1.5 px-2`}>
            {selectColumns.map((col: any) => <option key={col.id} value={col.id}>{col.name}</option>)}
          </select>
        ) : (
          <span className="text-xs text-amber-500/80">{t('addSelectForGroup')}</span>
        )}
      </div>

      {/* Card properties */}
      <div>
        <div className="px-4 py-2.5">
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider">{t('cardProperties')}</span>
        </div>
        {availableCardProps.length === 0 ? (
          <p className="text-[11px] text-neutral-700 text-center pb-3">{t('noAdditionalProperties')}</p>
        ) : (
          <div className="flex flex-col">
            {visibleCardProps.map((col) => (
              <div
                key={col.id}
                draggable
                onDragStart={() => setDraggingCardProp(col.id)}
                onDragOver={(e) => { e.preventDefault(); if (draggingCardProp && draggingCardProp !== col.id) setDragOverCardProp(col.id); }}
                onDrop={() => handleDrop(col.id)}
                onDragEnd={() => { setDraggingCardProp(null); setDragOverCardProp(null); }}
                className={`flex items-center gap-2 px-4 py-2 border-b border-neutral-800/30 hover:bg-neutral-800/10 transition-colors cursor-default ${draggingCardProp === col.id ? 'opacity-30' : ''} ${dragOverCardProp === col.id ? 'border-t-2 border-t-blue-500/50' : ''}`}
              >
                <GripVertical size={11} className="text-neutral-600 cursor-grab shrink-0" />
                {getPropertyIcon(col.type)}
                <span className="flex-1 text-xs text-neutral-300 truncate">{col.name}</span>
                <button onClick={() => toggleCardProp(col.id)} className="cursor-pointer"><Checkbox checked={true} /></button>
              </div>
            ))}
            {hiddenCardProps.map((col: any) => (
              <button key={col.id} onClick={() => toggleCardProp(col.id)} className="flex items-center gap-2 px-4 py-2 border-b border-neutral-800/30 hover:bg-neutral-800/10 transition-colors cursor-pointer text-left">
                <span className="w-2.75 shrink-0" />
                {getPropertyIcon(col.type)}
                <span className="flex-1 text-xs text-neutral-500 truncate">{col.name}</span>
                <Checkbox checked={false} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Show labels */}
      <button onClick={() => onShowPropertyLabelsChange?.(!showPropertyLabels)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-neutral-800/10 transition-colors cursor-pointer border-b border-neutral-800/30">
        <span className="text-xs text-neutral-300">{t('showLabels')}</span>
        <Checkbox checked={showPropertyLabels} />
      </button>

      {/* Property text clamp */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-xs text-neutral-300">{t('propertyText')}</span>
        <div className="flex items-center gap-2">
          <select value={propertyTextClamp} onChange={(e) => onPropertyTextClampChange?.(e.target.value as 'truncate' | 'wrap')} className={`${selectCls} text-neutral-400 py-1 px-1.5 w-28 cursor-pointer truncate`}>
            <option value="truncate">{t('truncate')}</option>
            <option value="wrap">{t('wrap')}</option>
          </select>
          <span className="w-5 shrink-0" />
        </div>
      </div>

      {/* Card color */}
      <div className="px-4 py-3 border-b border-neutral-800/30 flex items-center justify-between gap-3">
        <span className="text-xs text-neutral-300 shrink-0">{t('cardColor')}</span>
        <div className="flex items-center gap-2">
          <select value={cardColorCol ?? ''} onChange={(e) => onCardColorColChange?.(e.target.value)} className={`${selectCls} text-neutral-400 py-1 px-1.5 w-28 shrink-0 cursor-pointer truncate`}>
            <option value="">None</option>
            {colorColumns.map((col: any) => <option key={col.id} value={col.id}>{col.name}</option>)}
          </select>
          <span className="w-5 shrink-0" />
        </div>
      </div>

      {/* Group column background */}
      <button onClick={() => onGroupColBgChange?.(!groupColBg)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-neutral-800/10 transition-colors cursor-pointer border-b border-neutral-800/30">
        <span className="text-xs text-neutral-300">{t('groupBackground')}</span>
        <Checkbox checked={!!groupColBg} />
      </button>

      {/* Visible groups */}
      {groupColumn && (
        <div>
          <div className="px-4 py-2.5">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">{t('visibleGroups')}</span>
          </div>
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
    </>
  );
}
