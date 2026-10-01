'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { GripVertical } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { getPropertyIcon, CollapsibleSection, ToggleRow } from './shared';
import { SimpleSelect } from '@/components/ui/select';
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
  /** The property whose value marks every card (a badge at the card's top). */
  cardMarkCol?: string;
  onCardMarkColChange?: (colId: string) => void;
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
  cardMarkCol,
  onCardMarkColChange,
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
        hiddenGroups={hiddenGroups}
        onHiddenGroupsChange={onHiddenGroupsChange}
      />

      {/* Cards */}
      <CollapsibleSection label={t('sectionCards')}>
        {availableCardProps.length === 0 ? (
          <p className="text-xs text-fg-3 text-center pb-3">{t('noAdditionalProperties')}</p>
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
                className={`flex items-center gap-2 px-4 py-1.5 text-xs transition-colors hover:bg-hover/60 cursor-default ${draggingCardProp === col.id ? 'opacity-30' : ''} ${dragOverCardProp === col.id ? 'shadow-[inset_0_2px_0_var(--color-signal)]' : ''}`}
              >
                <GripVertical size={12} className="text-fg-4 cursor-grab shrink-0" />
                {getPropertyIcon(col.type)}
                <span className="flex-1 text-fg-2 truncate">{col.name}</span>
                <Checkbox size="sm" checked onCheckedChange={() => toggleCardProp(col.id)} aria-label={col.name} />
              </div>
            ))}
            {hiddenCardProps.map((col: any) => (
              <ToggleRow key={col.id} checked={false} onToggle={() => toggleCardProp(col.id)}>
                <span className="w-3 shrink-0" />
                {getPropertyIcon(col.type)}
                <span className="flex-1 text-fg-3 truncate">{col.name}</span>
              </ToggleRow>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 pt-1 pb-3">
          <ToggleRow checked={showPropertyLabels} onToggle={() => onShowPropertyLabelsChange?.(!showPropertyLabels)}>
            <span className="text-fg-2">{t('showLabels')}</span>
          </ToggleRow>
          <div className="flex items-center justify-between gap-3 px-4">
            <span className="text-xs text-fg-2 shrink-0">{t('propertyText')}</span>
            <SimpleSelect
              value={propertyTextClamp}
              onValueChange={(v) => onPropertyTextClampChange?.(v as 'truncate' | 'wrap')}
              options={[{ value: 'truncate', label: t('truncate') }, { value: 'wrap', label: t('wrap') }]}
              size="sm"
              className="w-28"
            />
          </div>
          {colorColumns.length > 0 && (
            <div className="flex flex-col gap-1.5 px-4 pt-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-fg-2 shrink-0">{t('cardMark')}</span>
                <SimpleSelect
                  value={cardMarkCol ?? ''}
                  onValueChange={(v) => onCardMarkColChange?.(v)}
                  options={[{ value: '', label: t('none') }, ...colorColumns.map((col: any) => ({ value: col.id, label: col.name }))]}
                  size="sm"
                  className="w-32"
                />
              </div>
              <p className="text-xs leading-relaxed text-fg-3">{t('cardMarkHint')}</p>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </>
  );
}
