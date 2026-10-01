'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { GripVertical } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { getPropertyIcon, CollapsibleSection, ToggleRow } from './shared';
import { SimpleSelect } from '@/components/ui/select';

interface CalendarLayoutSectionProps {
  schema: any[];
  dateCol?: string;
  onDateColChange?: (colId: string) => void;
  viewMode?: 'month' | 'week';
  onViewModeChange?: (mode: 'month' | 'week') => void;
  firstDayOfWeek?: 'sunday' | 'monday';
  onFirstDayOfWeekChange?: (day: 'sunday' | 'monday') => void;
  /** The property whose colour marks every event (a dot before its title). */
  cardMarkCol?: string;
  onCardMarkColChange?: (colId: string) => void;
  cardProperties?: string[];
  onCardPropertiesChange?: (props: string[]) => void;
  showPropertyLabels?: boolean;
  onShowPropertyLabelsChange?: (show: boolean) => void;
  propertyTextClamp?: 'truncate' | 'wrap';
  onPropertyTextClampChange?: (clamp: 'truncate' | 'wrap') => void;
}

export default function CalendarLayoutSection({
  schema,
  dateCol,
  onDateColChange,
  viewMode,
  onViewModeChange,
  firstDayOfWeek,
  onFirstDayOfWeekChange,
  cardMarkCol,
  onCardMarkColChange,
  cardProperties,
  onCardPropertiesChange,
  showPropertyLabels = true,
  onShowPropertyLabelsChange,
  propertyTextClamp = 'truncate',
  onPropertyTextClampChange,
}: CalendarLayoutSectionProps) {
  const t = useTranslations('Database');

  const dateColumns = schema.filter((c: any) => c.type === 'date' || c.type === 'datetime');
  const colorColumns = schema.filter((c: any) => c.type === 'select' || c.type === 'multi_select' || c.type === 'status');
  const calAvailableCardProps = schema.filter((c: any) => c.id !== 'title' && c.id !== dateCol);
  const effectiveCalVisible: string[] =
    cardProperties !== undefined
      ? cardProperties.filter((id) => calAvailableCardProps.some((c: any) => c.id === id))
      : calAvailableCardProps.slice(0, 1).map((c: any) => c.id);

  const visibleCalCardProps = effectiveCalVisible.map((id) => calAvailableCardProps.find((c: any) => c.id === id)).filter(Boolean) as any[];
  const hiddenCalCardProps = calAvailableCardProps.filter((c: any) => !effectiveCalVisible.includes(c.id));

  const toggleCalCardProp = (colId: string) => {
    onCardPropertiesChange?.(
      effectiveCalVisible.includes(colId)
        ? effectiveCalVisible.filter((id) => id !== colId)
        : [...effectiveCalVisible, colId],
    );
  };

  const [draggingCalProp, setDraggingCalProp] = useState<string | null>(null);
  const [dragOverCalProp, setDragOverCalProp] = useState<string | null>(null);

  const handleDrop = (targetColId: string) => {
    if (!draggingCalProp || draggingCalProp === targetColId) return;
    const current = [...effectiveCalVisible];
    const fromIdx = current.indexOf(draggingCalProp);
    const toIdx = current.indexOf(targetColId);
    if (fromIdx !== -1 && toIdx !== -1) {
      const [moved] = current.splice(fromIdx, 1);
      current.splice(toIdx, 0, moved);
      onCardPropertiesChange?.(current);
    }
    setDraggingCalProp(null);
    setDragOverCalProp(null);
  };

  return (
    <>
      {/* Calendar settings */}
      <CollapsibleSection label={t('sectionCalendar')}>
        <div className="px-4 pb-3 flex flex-col gap-2">
          <div>
            <span className="block text-xs text-fg-3 mb-1.5">{t('calendarBy')}</span>
            {dateColumns.length > 0 ? (
              <SimpleSelect
                value={dateCol ?? ''}
                onValueChange={(v) => onDateColChange?.(v)}
                options={[{ value: '', label: t('selectProperty') }, ...dateColumns.map((col: any) => ({ value: col.id, label: col.name }))]}
                className="w-full"
              />
            ) : (
              <span className="text-xs text-fg-3">{t('addDateForCalendar')}</span>
            )}
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <span className="block text-xs text-fg-3 mb-1.5">{t('calendarViewMode')}</span>
              <SimpleSelect
                value={viewMode ?? 'month'}
                onValueChange={(v) => onViewModeChange?.(v as 'month' | 'week')}
                options={[{ value: 'month', label: t('calendarMonth') }, { value: 'week', label: t('calendarWeek') }]}
                className="w-full"
              />
            </div>
            <div className="flex-1">
              <span className="block text-xs text-fg-3 mb-1.5">{t('weekStart')}</span>
              <SimpleSelect
                value={firstDayOfWeek || 'sunday'}
                onValueChange={(v) => onFirstDayOfWeekChange?.(v as 'sunday' | 'monday')}
                options={[{ value: 'sunday', label: t('sunday') }, { value: 'monday', label: t('monday') }]}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Cards */}
      <CollapsibleSection label={t('sectionCards')}>
        {calAvailableCardProps.length === 0 ? (
          <p className="text-xs text-fg-3 text-center pb-3">{t('noAdditionalProperties')}</p>
        ) : (
          <div className="flex flex-col">
            {visibleCalCardProps.map((col) => (
              <div
                key={col.id}
                draggable
                onDragStart={() => setDraggingCalProp(col.id)}
                onDragOver={(e) => { e.preventDefault(); if (draggingCalProp && draggingCalProp !== col.id) setDragOverCalProp(col.id); }}
                onDrop={() => handleDrop(col.id)}
                onDragEnd={() => { setDraggingCalProp(null); setDragOverCalProp(null); }}
                className={`flex items-center gap-2 px-4 py-1.5 text-xs transition-colors hover:bg-hover/60 cursor-default ${draggingCalProp === col.id ? 'opacity-30' : ''} ${dragOverCalProp === col.id ? 'shadow-[inset_0_2px_0_var(--color-signal)]' : ''}`}
              >
                <GripVertical size={12} className="text-fg-4 cursor-grab shrink-0" />
                {getPropertyIcon(col.type)}
                <span className="flex-1 text-fg-2 truncate">{col.name}</span>
                <Checkbox size="sm" checked onCheckedChange={() => toggleCalCardProp(col.id)} aria-label={col.name} />
              </div>
            ))}
            {hiddenCalCardProps.map((col: any) => (
              <ToggleRow key={col.id} checked={false} onToggle={() => toggleCalCardProp(col.id)}>
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
              <p className="text-xs leading-relaxed text-fg-3">{t('cardMarkCalendarHint')}</p>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </>
  );
}
