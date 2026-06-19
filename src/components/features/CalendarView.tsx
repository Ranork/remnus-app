'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { getOptionColorByValue, getCardBorderDots, getCardBgColor, formatDateValue } from '@/lib/types/properties';
import { ChevronLeft, ChevronRight, GripVertical, Trash2, Calendar as CalendarIcon, Clock, Plus, Copy, ArrowUpRight, Maximize2, Link2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useContextMenu, type MenuItem } from './ContextMenu';
import PageIcon from './PageIcon';
import IconPicker from './IconPicker';
import AgentEditBadge from './AgentEditBadge';
import { StatusChip, UserChip, UserTags } from './PropertyTags';
import { updatePageIcon } from '@/lib/actions/page';
import { ConfirmDialog } from './ConfirmDialog';

interface CalendarViewProps {
  database: any;
  pages: any[];
  dateCol: string;
  viewMode: 'month' | 'week';
  firstDayOfWeek: 'sunday' | 'monday';
  onCardClick: (pageId: string) => void;
  onCardDateChange: (pageId: string, newDateStr: string) => void;
  onDeletePage: (pageId: string) => void;
  onDuplicatePage: (pageId: string) => void;
  cardColorCol?: string;
  cardBorderSide?: 'left' | 'top' | 'right' | 'bottom';
  cardBgCol?: string;
  cardProperties?: string[];
  showPropertyLabels?: boolean;
  propertyTextClamp?: 'truncate' | 'wrap';
  onUpdatePageProperties: (pageId: string, properties: Record<string, any>) => void;
  onCreatePage?: (initialProperties?: Record<string, any>) => void;
  defaultPageIcon?: string;
  defaultPageIconColor?: string;
  onPageIconChange?: (pageId: string, icon: string | null, iconColor: string | null) => void;
}

const formatYYYYMMDD = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonthDays = (date: Date, firstDayOfWeek: 'sunday' | 'monday') => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  
  let startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday, 1 is Monday, etc.
  if (firstDayOfWeek === 'monday') {
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  }
  
  const days = [];
  // Add days from previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, prevMonthLastDay - i),
      isCurrentMonth: false,
    });
  }
  // Add days of current month
  const currentMonthLastDay = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= currentMonthLastDay; i++) {
    days.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }
  // Add days of next month to make complete weeks (multiples of 7, standard 6 rows = 42 cells)
  const totalDays = days.length;
  const remaining = 42 - totalDays;
  for (let i = 1; i <= remaining; i++) {
    days.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }
  return days;
};

const getWeekDays = (date: Date, firstDayOfWeek: 'sunday' | 'monday') => {
  let currentDay = date.getDay();
  if (firstDayOfWeek === 'monday') {
    currentDay = currentDay === 0 ? 6 : currentDay - 1;
  }
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - currentDay);
  
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    days.push({
      date: d,
      isCurrentMonth: d.getMonth() === date.getMonth(),
    });
  }
  return days;
};

const WEEKDAYS_SUN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const WEEKDAYS_MON = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export default function CalendarView({
  database,
  pages,
  dateCol,
  viewMode,
  firstDayOfWeek,
  onCardClick,
  onCardDateChange,
  onDeletePage,
  onDuplicatePage,
  cardColorCol,
  cardBorderSide = 'left',
  cardBgCol,
  cardProperties,
  showPropertyLabels = true,
  propertyTextClamp = 'truncate',
  onCreatePage,
  defaultPageIcon,
  defaultPageIconColor,
  onPageIconChange,
}: CalendarViewProps) {
  const t = useTranslations('Database');
  const tPage = useTranslations('Page');
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [activeIconPickerPageId, setActiveIconPickerPageId] = useState<string | null>(null);
  // Anchor for the open icon picker — set from the button's click handler (an
  // event handler, so no ref access during render) instead of reading a
  // per-row ref map mid-render.
  const activeAnchorRef = useRef<HTMLButtonElement | null>(null);

  const handleCalendarIconSelect = (pageId: string, newIcon: string | null, newColor: string | null) => {
    onPageIconChange?.(pageId, newIcon, newColor);
    updatePageIcon(pageId, newIcon, newColor);
  };

  // Card dragging states
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [isCardDragReady, setIsCardDragReady] = useState(false);
  const [dragOverDayStr, setDragOverDayStr] = useState<string | null>(null);
  const [activeMenuCardId, setActiveMenuCardId] = useState<string | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Notion-style right-click menu for calendar cards
  const cardMenu = useContextMenu();
  const buildCardMenu = (pageId: string): MenuItem[] => [
    { id: 'open', label: t('open'), icon: ArrowUpRight, onSelect: () => onCardClick(pageId) },
    { id: 'open-full', label: t('openInFullPage'), icon: Maximize2, onSelect: () => router.push(`/db/${database.id}/${pageId}`) },
    { id: 'copy-link', label: t('copyLink'), icon: Link2, onSelect: () => { navigator.clipboard?.writeText(`${window.location.origin}/db/${database.id}/${pageId}`); } },
    { kind: 'separator' },
    { id: 'duplicate', label: t('duplicatePage'), icon: Copy, onSelect: () => onDuplicatePage(pageId) },
    { id: 'delete', label: tPage('deletePage'), icon: Trash2, danger: true, onSelect: () => setConfirmDeleteId(pageId) },
  ];

  const schema = database.schema as any[];
  const dateProperty = schema.find((c) => c.id === dateCol);

  const availableProps = schema.filter((c) => c.id !== 'title' && c.id !== dateCol);
  const propsToShow = cardProperties !== undefined && cardProperties.length > 0
    ? cardProperties.map((id) => availableProps.find((c) => c.id === id)).filter(Boolean) as any[]
    : availableProps.slice(0, 1);
  const textClass = propertyTextClamp === 'wrap' ? 'break-words whitespace-pre-wrap' : 'truncate';

  const days = useMemo(() => {
    return viewMode === 'month' ? getMonthDays(currentDate, firstDayOfWeek) : getWeekDays(currentDate, firstDayOfWeek);
  }, [currentDate, viewMode, firstDayOfWeek]);

  const handlePrev = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === 'month') {
        d.setMonth(d.getMonth() - 1);
      } else {
        d.setDate(d.getDate() - 7);
      }
      return d;
    });
  };

  const handleNext = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === 'month') {
        d.setMonth(d.getMonth() + 1);
      } else {
        d.setDate(d.getDate() + 7);
      }
      return d;
    });
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getHeaderLabel = () => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
      let currentDay = currentDate.getDay();
      if (firstDayOfWeek === 'monday') {
        currentDay = currentDay === 0 ? 6 : currentDay - 1;
      }
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDay);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      
      const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
      const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
      
      if (start.getFullYear() !== end.getFullYear()) {
        return `${startMonth} ${start.getDate()}, ${start.getFullYear()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
      } else if (start.getMonth() !== end.getMonth()) {
        return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
      } else {
        return `${startMonth} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
      }
    }
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const getPagesForDay = (dayDate: Date) => {
    if (!dateCol) return [];
    return pages.filter((page) => {
      const val = page.properties[dateCol];
      if (!val) return false;
      // Range format: "start/end"
      if (typeof val === 'string' && val.includes('/')) {
        const [startStr, endStr] = val.split('/');
        const start = new Date(startStr);
        const end = new Date(endStr);
        if (isNaN(start.getTime())) return false;
        const dayTime = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate()).getTime();
        const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
        const endTime = isNaN(end.getTime())
          ? startTime
          : new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
        return dayTime >= startTime && dayTime <= endTime;
      }
      const d = new Date(val);
      if (isNaN(d.getTime())) return false;
      return isSameDay(d, dayDate);
    });
  };

  if (!dateCol) {
    return (
      <div className="flex flex-col items-center justify-center text-neutral-500 py-20 text-center gap-3">
        <CalendarIcon size={28} className="text-neutral-600 animate-pulse" />
        <span className="text-sm">Please select a date property in the Layout Settings to enable the Calendar View.</span>
        <span className="text-xs text-neutral-600 max-w-xs">
          Open <strong>Settings &gt; Layout</strong> tab in the top right to bind this calendar to a date property.
        </span>
      </div>
    );
  }

  const todayStr = formatYYYYMMDD(new Date());

  return (
    <div className="flex flex-col bg-neutral-850 text-neutral-200 h-full">
      {/* Calendar Header Nav */}
      <div className="flex items-center justify-between pb-3.5 mb-2.5 border-b border-neutral-850/60 shrink-0 select-none">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePrev}
            className="p-1.5 hover:bg-neutral-800/60 hover:text-neutral-100 border border-neutral-850 bg-neutral-900/10 transition-colors cursor-pointer rounded"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1 text-xs font-semibold hover:bg-neutral-800/60 hover:text-neutral-100 border border-neutral-850 bg-neutral-900/10 transition-colors cursor-pointer rounded"
          >
            Today
          </button>
          <button
            onClick={handleNext}
            className="p-1.5 hover:bg-neutral-800/60 hover:text-neutral-100 border border-neutral-850 bg-neutral-900/10 transition-colors cursor-pointer rounded"
          >
            <ChevronRight size={14} />
          </button>
          <span className="text-sm font-semibold ml-2.5 text-neutral-100 shrink-0">
            {getHeaderLabel()}
          </span>
        </div>

        {/* Small badge of dateCol binding — desktop only; on mobile it collides
            with the nav row and is secondary info (set in Layout settings). */}
        <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-neutral-500 bg-neutral-900/30 border border-neutral-850 px-2 py-0.5 uppercase tracking-wider rounded">
          <Clock size={10} />
          <span>Mapped to: {dateProperty?.name || 'Unknown'}</span>
        </div>
      </div>

      {/* Scrollable calendar body — on phones a 7-col month grid squeezes each
          day to ~50px (unreadable). Give it a usable min-width and let the
          weekday row + grid scroll horizontally together; desktop is unchanged.
          This wrapper is also the vertical scroll container so the weekday row
          can stay sticky to its top while the grid scrolls under it. */}
      <div className="flex-1 min-h-0 overflow-auto">
      <div className="min-w-170 lg:min-w-0">
      {/* Weekdays names row — sticky so it never scrolls out of view */}
      <div className="grid grid-cols-7 border-b border-neutral-800/80 bg-neutral-850 shrink-0 select-none sticky top-0 z-20">
        {(firstDayOfWeek === 'monday' ? WEEKDAYS_MON : WEEKDAYS_SUN).map((day) => (
          <div
            key={day}
            className="text-[10px] text-neutral-500 font-semibold tracking-wider text-center py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Grid Container */}
      <div>
        <div
          className="grid grid-cols-7 border-l border-t border-neutral-800/80 bg-neutral-850 h-auto"
          style={{
            gridTemplateRows: viewMode === 'month' ? 'repeat(6, minmax(6rem, 1fr))' : 'minmax(22rem, 1fr)'
          }}
        >
          {days.map(({ date, isCurrentMonth }, idx) => {
            const dayStr = formatYYYYMMDD(date);
            const isToday = dayStr === todayStr;
            const dayPages = getPagesForDay(date);
            const isDragOver = dragOverDayStr === dayStr;

            return (
              <div
                key={idx}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedCardId) {
                    setDragOverDayStr(dayStr);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverDayStr === dayStr) {
                    setDragOverDayStr(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const cardId = e.dataTransfer.getData('text/plain') || draggedCardId;
                  if (cardId) {
                    onCardDateChange(cardId, dayStr);
                  }
                  setDragOverDayStr(null);
                  setDraggedCardId(null);
                  setIsCardDragReady(false);
                }}
                className={`border-r border-b border-neutral-800/80 p-1 lg:p-2 min-h-24 flex flex-col transition-colors overflow-visible group/day ${
                  !isCurrentMonth && viewMode === 'month' ? 'bg-neutral-950/20' : 'bg-transparent'
                } ${isDragOver ? 'bg-neutral-800/15' : ''}`}
              >
                {/* Day Number / Indicator */}
                <div className="flex items-center justify-between mb-1.5 shrink-0 select-none">
                  <span
                    className={`text-xs font-semibold py-0.5 px-1.5 ${
                      isToday
                        ? 'bg-blue-600 text-white font-bold'
                        : isCurrentMonth
                        ? 'text-neutral-200'
                        : 'text-neutral-500'
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  <div className="flex items-center gap-1.5 h-6">
                    {dayPages.length > 0 && (
                      <span className="text-[10px] text-neutral-600 font-medium font-mono group-hover/day:hidden">
                        {dayPages.length}
                      </span>
                    )}
                    <button
                      onClick={() => onCreatePage?.({ [dateCol]: dayStr })}
                      className="opacity-0 group-hover/day:opacity-100 transition-opacity p-0.5 hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200 rounded cursor-pointer duration-100"
                      title="Add a page to this day"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>

                {/* Cards Container inside day */}
                <div className="flex-1 flex flex-col gap-1.5 min-h-10">
                  {dayPages.map((page) => {
                    const colorColSchema = cardColorCol ? schema.find((c) => c.id === cardColorCol) : null;
                    const borderDots = getCardBorderDots(colorColSchema, page.properties[cardColorCol ?? '']);
                    const bgColSchema = cardBgCol ? schema.find((c) => c.id === cardBgCol) : null;
                    const bgColor = getCardBgColor(bgColSchema, page.properties[cardBgCol ?? '']);
                    const borderLineClass = cardBorderSide === 'top'
                      ? 'absolute top-0 inset-x-0 h-0.75 flex flex-row'
                      : cardBorderSide === 'right'
                      ? 'absolute right-0 inset-y-0 w-0.75 flex flex-col'
                      : cardBorderSide === 'bottom'
                      ? 'absolute bottom-0 inset-x-0 h-0.75 flex flex-row'
                      : 'absolute left-0 inset-y-0 w-0.75 flex flex-col';
                    return (
                    <div
                      key={page.id}
                      onClick={() => onCardClick(page.id)}
                      onContextMenu={(e) => cardMenu.open(e, buildCardMenu(page.id))}
                      draggable={isCardDragReady}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setDraggedCardId(page.id);
                        e.dataTransfer.setData('text/plain', page.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        setDraggedCardId(page.id);
                        setIsCardDragReady(false);
                      }}
                      className={`relative py-1 lg:py-2.5 px-1 lg:px-2 cursor-pointer transition-colors group flex flex-col select-none overflow-hidden rounded ${
                        draggedCardId === page.id ? 'opacity-25' : ''
                      }`}
                      style={{ backgroundColor: bgColor ?? 'rgba(64,68,75,0.55)' }}
                    >
                      {borderDots.length > 0 && (
                        <div className={`${borderLineClass} pointer-events-none`} aria-hidden>
                          {borderDots.map((dot, i) => (
                            <div key={i} className="flex-1" style={{ backgroundColor: dot }} />
                          ))}
                        </div>
                      )}
                      {/* Hover Actions — desktop only (drag-reschedule uses HTML5
                          DnD which doesn't fire on touch; the invisible grip also
                          stole taps meant to open the card on mobile). */}
                      <div
                        className="hidden lg:flex absolute right-1 top-1.5 opacity-0 group-hover:opacity-100 items-center transition-opacity z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Drag handle & Actions */}
                        <button
                          draggable={true}
                          onDragStart={(e) => {
                            e.stopPropagation();
                            setDraggedCardId(page.id);
                            e.dataTransfer.setData('text/plain', page.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onMouseDown={() => setIsCardDragReady(true)}
                          onMouseLeave={() => setIsCardDragReady(false)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeMenuCardId === page.id) {
                              setActiveMenuCardId(null);
                              setMenuCoords(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuCoords({ top: rect.bottom + 4, left: rect.right - 128 });
                              setActiveMenuCardId(page.id);
                            }
                          }}
                          className="p-1 hover:bg-neutral-700/60 text-neutral-400 hover:text-neutral-200 cursor-grab active:cursor-grabbing transition-colors rounded"
                          title={t('dragReschedule')}
                        >
                          <GripVertical size={12} />
                        </button>
                      </div>

                      {/* Card Dropdown Menu — rendered via portal to escape overflow-hidden */}
                      {activeMenuCardId === page.id && menuCoords && createPortal(
                        <div onClick={(e) => e.stopPropagation()}>
                          <div
                            className="fixed inset-0 z-9998 cursor-default"
                            onClick={(e) => { e.stopPropagation(); setActiveMenuCardId(null); setMenuCoords(null); }}
                          />
                          <div
                            className="fixed z-9999 bg-neutral-900 border border-neutral-800 shadow-xl py-1 w-32 rounded text-left animate-fade-in animate-duration-100 overflow-hidden"
                            style={{ top: menuCoords.top, left: menuCoords.left }}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDuplicatePage(page.id);
                                setActiveMenuCardId(null);
                                setMenuCoords(null);
                              }}
                              className="w-full px-2.5 py-1.5 text-[11px] text-neutral-300 hover:bg-neutral-800 flex items-center gap-1.5 cursor-pointer transition-colors border-b border-neutral-850"
                            >
                              <Copy size={11} />
                              <span>{t('duplicatePage')}</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(page.id);
                                setActiveMenuCardId(null);
                                setMenuCoords(null);
                              }}
                              className="w-full px-2.5 py-1.5 text-[11px] text-red-400 hover:bg-neutral-800 flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Trash2 size={11} />
                              <span>{tPage('deletePage')}</span>
                            </button>
                          </div>
                        </div>,
                        document.body
                      )}

                      {/* Page Title */}
                      <h4 className={`text-[11px] lg:text-sm text-neutral-100 group-hover:text-neutral-50 font-medium leading-snug pr-1 lg:pr-8 mb-0 lg:mb-1 flex items-center gap-1 ${propertyTextClamp === 'truncate' ? 'overflow-hidden' : 'wrap-break-word whitespace-normal overflow-visible'}`}>
                        <div className="relative shrink-0 select-none hidden lg:block">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              activeAnchorRef.current = e.currentTarget;
                              setActiveIconPickerPageId(activeIconPickerPageId === page.id ? null : page.id);
                            }}
                            className="hover:bg-neutral-800 p-0.5 rounded transition-colors flex items-center justify-center cursor-pointer"
                            title="Change icon"
                          >
                            <PageIcon 
                              icon={page.icon || defaultPageIcon} 
                              iconColor={page.iconColor || defaultPageIconColor} 
                              size={14} 
                              fallbackType="page" 
                              className="shrink-0" 
                            />
                          </button>
                          {activeIconPickerPageId === page.id && (
                            <IconPicker
                              currentIcon={page.icon}
                              currentIconColor={page.iconColor}
                              onSelect={(newIcon, newColor) => handleCalendarIconSelect(page.id, newIcon, newColor)}
                              onClose={() => setActiveIconPickerPageId(null)}
                              anchorRef={activeAnchorRef}
                            />
                          )}
                        </div>
                        <span className={propertyTextClamp === 'truncate' ? 'truncate min-w-0' : ''}>{page.properties['title'] || tPage('untitled')}</span>
                      </h4>

                      <AgentEditBadge
                        agentName={page.agentName ?? null}
                        tokenName={page.agentTokenName ?? null}
                        editedAt={page.agentEditedAt ?? null}
                        className="absolute bottom-0 right-0 rounded-tl-xl p-1.5 z-10 translate-x-0.5 translate-y-0.5"
                      />

                      {/* Card properties — hidden on mobile for a compact,
                          Google/iOS-calendar-style title-only card. */}
                      <div className="mt-1.5 hidden lg:flex flex-col gap-1.5 select-none shrink-0">
                        {propsToShow.map((c) => {
                            const val = page.properties[c.id];
                            const isEmpty =
                              val === undefined ||
                              val === null ||
                              val === '' ||
                              (Array.isArray(val) && val.length === 0);
                            if (isEmpty) return null;

                            let display: React.ReactNode;
                            if (c.type === 'select' && typeof val === 'string') {
                              const sc = getOptionColorByValue(c.options || [], val);
                              display = (
                                <span className="text-[9px] px-1.5 py-px rounded-full font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>
                                  {val}
                                </span>
                              );
                            } else if (c.type === 'status' && typeof val === 'string') {
                              display = <StatusChip value={val} options={c.options} iconSize={10} />;
                            } else if (c.type === 'user') {
                              display = <UserChip userId={String(val)} avatarSize={14} />;
                            } else if (c.type === 'multi_user' && Array.isArray(val)) {
                              display = <UserTags value={val} avatarSize={14} wrap={propertyTextClamp === 'wrap'} />;
                            } else if (c.type === 'multi_select' && Array.isArray(val)) {
                              display = (
                                <span className={`flex gap-0.5 ${propertyTextClamp === 'wrap' ? 'flex-wrap' : 'flex-nowrap overflow-hidden'}`}>
                                  {val.map((optVal: string) => {
                                    const mc = getOptionColorByValue(c.options || [], optVal);
                                    return (
                                      <span key={optVal} className="text-[9px] px-1.5 py-px rounded-full font-medium shrink-0" style={{ backgroundColor: mc.bg, color: mc.text }}>
                                        {optVal}
                                      </span>
                                    );
                                  })}
                                </span>
                              );
                            } else if ((c.type === 'date' || c.type === 'datetime') && val) {
                              display = (
                                <span className={`text-neutral-100 text-[9px] ${textClass}`}>
                                  {formatDateValue(val, c.type as 'date' | 'datetime', c.dateFormat)}
                                </span>
                              );
                            } else {
                              display = (
                                <span className={`text-neutral-100 text-[9px] ${textClass}`}>{val !== undefined && val !== null ? String(val) : ''}</span>
                              );
                            }

                             return (
                               <div
                                 key={c.id}
                                 className={`text-[9px] leading-relaxed flex gap-1 ${propertyTextClamp === 'wrap' ? 'items-start' : 'items-center'}`}
                               >
                                 {showPropertyLabels && (
                                   <span className="text-neutral-300 shrink-0">{c.name}:</span>
                                 )}
                                 {display}
                               </div>
                             );
                          })}
                      </div>
                    </div>
                  );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
      </div>
      {confirmDeleteId && (
        <ConfirmDialog
          title={t('deletePageConfirm')}
          confirmLabel={t('delete')}
          cancelLabel={t('deleteCancel')}
          onConfirm={() => { onDeletePage(confirmDeleteId); setConfirmDeleteId(null); }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      {cardMenu.node}
    </div>
  );
}
