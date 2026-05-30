'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { GripVertical } from 'lucide-react';
import { getPropertyIcon, Checkbox, selectCls } from './shared';

interface CalendarLayoutSectionProps {
  schema: any[];
  dateCol?: string;
  onDateColChange?: (colId: string) => void;
  viewMode?: 'month' | 'week';
  onViewModeChange?: (mode: 'month' | 'week') => void;
  firstDayOfWeek?: 'sunday' | 'monday';
  onFirstDayOfWeekChange?: (day: 'sunday' | 'monday') => void;
  cardColorCol?: string;
  onCardColorColChange?: (colId: string) => void;
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
  cardColorCol,
  onCardColorColChange,
  cardProperties,
  onCardPropertiesChange,
  showPropertyLabels = true,
  onShowPropertyLabelsChange,
  propertyTextClamp = 'truncate',
  onPropertyTextClampChange,
}: CalendarLayoutSectionProps) {
  const t = useTranslations('Database');

  const dateColumns = schema.filter((c: any) => c.type === 'date' || c.type === 'datetime');
  const colorColumns = schema.filter((c: any) => c.type === 'select' || c.type === 'multi_select');
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
      {/* Calendar date & view settings */}
      <div className="px-4 py-3 flex flex-col gap-3">
        <div>
          <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5">{t('calendarBy')}</span>
          {dateColumns.length > 0 ? (
            <select value={dateCol} onChange={(e) => onDateColChange?.(e.target.value)} className={`${selectCls} w-full text-xs py-1.5 px-2`}>
              <option value="">Select property…</option>
              {dateColumns.map((col: any) => <option key={col.id} value={col.id}>{col.name}</option>)}
            </select>
          ) : (
            <span className="text-xs text-amber-500/80">{t('addDateForCalendar')}</span>
          )}
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5">View</span>
            <select value={viewMode} onChange={(e) => onViewModeChange?.(e.target.value as 'month' | 'week')} className={`${selectCls} w-full text-xs py-1.5 px-2`}>
              <option value="month">Month</option>
              <option value="week">Week</option>
            </select>
          </div>
          <div className="flex-1">
            <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5">{t('weekStart')}</span>
            <select value={firstDayOfWeek || 'sunday'} onChange={(e) => onFirstDayOfWeekChange?.(e.target.value as 'sunday' | 'monday')} className={`${selectCls} w-full text-xs py-1.5 px-2`}>
              <option value="sunday">{t('sunday')}</option>
              <option value="monday">{t('monday')}</option>
            </select>
          </div>
        </div>
        {colorColumns.length > 0 && (
          <div>
            <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5">{t('cardColor')}</span>
            <select value={cardColorCol ?? ''} onChange={(e) => onCardColorColChange?.(e.target.value)} className={`${selectCls} w-full text-xs py-1.5 px-2`}>
              <option value="">None</option>
              {colorColumns.map((col: any) => <option key={col.id} value={col.id}>{col.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Card properties */}
      <div>
        <div className="px-4 py-2.5">
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider">{t('cardProperties')}</span>
        </div>
        {calAvailableCardProps.length === 0 ? (
          <p className="text-[11px] text-neutral-700 text-center pb-3">{t('noAdditionalProperties')}</p>
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
                className={`flex items-center gap-2 px-4 py-2 border-b border-neutral-800/30 hover:bg-neutral-800/10 transition-colors cursor-default ${draggingCalProp === col.id ? 'opacity-30' : ''} ${dragOverCalProp === col.id ? 'border-t-2 border-t-blue-500/50' : ''}`}
              >
                <GripVertical size={11} className="text-neutral-600 cursor-grab shrink-0" />
                {getPropertyIcon(col.type)}
                <span className="flex-1 text-xs text-neutral-300 truncate">{col.name}</span>
                <button onClick={() => toggleCalCardProp(col.id)} className="cursor-pointer"><Checkbox checked={true} /></button>
              </div>
            ))}
            {hiddenCalCardProps.map((col: any) => (
              <button key={col.id} onClick={() => toggleCalCardProp(col.id)} className="flex items-center gap-2 px-4 py-2 border-b border-neutral-800/30 hover:bg-neutral-800/10 transition-colors cursor-pointer text-left">
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
    </>
  );
}
