'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { GripVertical, ArrowLeft, ArrowUp, ArrowRight, ArrowDown } from 'lucide-react';
import { getPropertyIcon, Checkbox, selectCls, CollapsibleSection } from './shared';
import GroupingLayoutSection from './GroupingLayoutSection';

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
  cardBorderSide?: 'left' | 'top' | 'right' | 'bottom';
  onCardBorderSideChange?: (side: 'left' | 'top' | 'right' | 'bottom') => void;
  cardBgCol?: string;
  onCardBgColChange?: (colId: string) => void;
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
  cardBorderSide = 'left',
  onCardBorderSideChange,
  cardBgCol,
  onCardBgColChange,
  groupColBg,
  onGroupColBgChange,
  hiddenGroups = [],
  onHiddenGroupsChange,
}: KanbanLayoutSectionProps) {
  const t = useTranslations('Database');

  const colorColumns = schema.filter((c: any) => c.type === 'select' || c.type === 'multi_select' || c.type === 'status');
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
      <GroupingLayoutSection
        schema={schema}
        groupByCol={groupByCol}
        onGroupByColChange={onGroupByColChange}
        groupColBg={groupColBg}
        onGroupColBgChange={onGroupColBgChange}
        hiddenGroups={hiddenGroups}
        onHiddenGroupsChange={onHiddenGroupsChange}
      />

      {/* Cards */}
      <CollapsibleSection label={t('sectionCards')}>
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
        <div className="px-4 py-2.5 flex flex-col gap-2">
          <button onClick={() => onShowPropertyLabelsChange?.(!showPropertyLabels)} className="w-full flex items-center justify-between cursor-pointer">
            <span className="text-xs text-neutral-300">{t('showLabels')}</span>
            <Checkbox checked={showPropertyLabels} />
          </button>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-neutral-300 shrink-0">{t('propertyText')}</span>
            <select value={propertyTextClamp} onChange={(e) => onPropertyTextClampChange?.(e.target.value as 'truncate' | 'wrap')} className={`${selectCls} w-28 shrink-0 cursor-pointer`}>
              <option value="truncate">{t('truncate')}</option>
              <option value="wrap">{t('wrap')}</option>
            </select>
          </div>
        </div>
      </CollapsibleSection>

      {/* Card colors */}
      <CollapsibleSection label={t('cardColors')} defaultOpen={false}>
        <div className="px-4 pb-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-neutral-300 shrink-0">{t('cardBackground')}</span>
            <select value={cardBgCol ?? ''} onChange={(e) => onCardBgColChange?.(e.target.value)} className={`${selectCls} w-32 shrink-0 cursor-pointer truncate`}>
              <option value="">None</option>
              {colorColumns.map((col: any) => <option key={col.id} value={col.id}>{col.name}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-neutral-300 shrink-0">{t('accentLine')}</span>
            <select value={cardColorCol ?? ''} onChange={(e) => onCardColorColChange?.(e.target.value)} className={`${selectCls} w-32 shrink-0 cursor-pointer truncate`}>
              <option value="">None</option>
              {colorColumns.map((col: any) => <option key={col.id} value={col.id}>{col.name}</option>)}
            </select>
          </div>
          {cardColorCol && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-neutral-500 shrink-0 pl-3">{t('accentPosition')}</span>
              <div className="flex gap-1">
                {([
                  { side: 'left', Icon: ArrowLeft },
                  { side: 'top', Icon: ArrowUp },
                  { side: 'right', Icon: ArrowRight },
                  { side: 'bottom', Icon: ArrowDown },
                ] as const).map(({ side, Icon }) => (
                  <button
                    key={side}
                    onClick={() => onCardBorderSideChange?.(side)}
                    className={`w-7 h-7 flex items-center justify-center border rounded transition-colors cursor-pointer ${
                      cardBorderSide === side
                        ? 'border-blue-500/60 text-blue-400 bg-blue-500/10'
                        : 'border-neutral-700 text-neutral-500 hover:border-neutral-600 hover:text-neutral-400'
                    }`}
                  >
                    <Icon size={12} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </>
  );
}
