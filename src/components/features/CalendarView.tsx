'use client';

import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { getOptionColorByValue, getCardBorderAccents, getCardBgColor, formatDateValue } from '@/lib/types/properties';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronsDownUp, ChevronsUpDown, GripVertical, Trash2, Calendar as CalendarIcon, Clock, Plus, Copy, ArrowUpRight, Maximize2, Link2, Repeat, Unlink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useContextMenu, type MenuItem } from './ContextMenu';
import PageIcon from './PageIcon';
import IconPicker from './IconPicker';
import AgentEditBadge from './AgentEditBadge';
import { StatusChip, UserAvatarStack, OptionIcon } from './PropertyTags';
import { updatePageIcon, updatePageCardCollapsed, updatePagesCardCollapsed } from '@/lib/actions/page';
import { ConfirmDialog } from './ConfirmDialog';
import { useRecurrenceControls } from './recurrence/useRecurrenceControls';
import RecurringBadge from './recurrence/RecurringBadge';
import { parseDateValue, type RecurrenceRule } from '@/lib/recurrence/rule';
import { detachPageFromSeries, loadRecurrenceState } from '@/lib/actions/recurrence';

interface CalendarViewProps {
  database: any;
  currentUserId?: string;
  pages: any[];
  dateCol: string;
  viewMode: 'month' | 'week';
  firstDayOfWeek: 'sunday' | 'monday';
  hasSorts?: boolean;
  onCardClick: (pageId: string) => void;
  onCardDateChange: (pageId: string, newDateStr: string, targetPageId?: string, position?: 'before' | 'after') => void;
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
  onCardCollapsedChange?: (pageId: string, collapsed: boolean) => void;
  onCardsCollapsedChange?: (pageIds: string[], collapsed: boolean) => void;
  /** Fired after a recurrence mutation. A series change rewrites many rows at
   *  once, so the parent re-fetches rather than trying to patch local state. */
  onSeriesChanged?: () => void;
}

const formatYYYYMMDD = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonthDays = (date: Date, firstDayOfWeek: 'sunday' | 'monday') => {
  // Rolling 6-week grid anchored on `date`. Instead of always opening on the
  // 1st of the month (which pushes "today" to the bottom rows and shows several
  // stale past weeks on top when we're mid-month), the grid starts one week
  // before the week that contains `date`. So the current week + one prior week
  // are visible up top and the rest of the window looks ahead — "today" sits on
  // the 2nd row. Monthly prev/next navigation is preserved (it shifts `date` by
  // a month, re-anchoring the window), as is the current-month highlighting.
  const anchorMonth = date.getMonth();

  // Start of the week that contains `date`, honoring firstDayOfWeek.
  let dow = date.getDay(); // 0 = Sunday
  if (firstDayOfWeek === 'monday') {
    dow = dow === 0 ? 6 : dow - 1;
  }
  const gridStart = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dow - 7);

  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push({
      date: d,
      isCurrentMonth: d.getMonth() === anchorMonth,
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
  currentUserId,
  pages,
  dateCol,
  viewMode,
  firstDayOfWeek,
  hasSorts = false,
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
  onCardCollapsedChange,
  onCardsCollapsedChange,
  onSeriesChanged,
}: CalendarViewProps) {
  const t = useTranslations('Database');
  const tPage = useTranslations('Page');
  const tRec = useTranslations('Recurrence');
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

  const handleToggleCollapsed = (pageId: string, collapsed: boolean) => {
    onCardCollapsedChange?.(pageId, collapsed);
    updatePageCardCollapsed(pageId, collapsed);
  };

  // Day header toggle — collapses/expands every card sitting on that day at once.
  const handleToggleDayCollapsed = (dayPages: any[], collapsed: boolean) => {
    const ids = dayPages.map((p) => p.id);
    if (ids.length === 0) return;
    onCardsCollapsedChange?.(ids, collapsed);
    updatePagesCardCollapsed(ids, collapsed);
  };

  // Card dragging states
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverDayStr, setDragOverDayStr] = useState<string | null>(null);
  // Intra-day reorder: which card is being hovered and on which side of it
  // the dragged card would land (mirrors KanbanBoard's own indicator).
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null);
  const [activeMenuCardId, setActiveMenuCardId] = useState<string | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── Recurrence ─────────────────────────────────────────────────────────────
  // Rules are keyed by series id; each card carries its own `seriesId`, so the
  // badge and the summary tooltip need no per-card round-trip. The dialogs and
  // the mutation flow live in a shared hook — the page editor offers the same
  // conversation and must not grow a second, drifting copy of it.
  const [seriesRules, setSeriesRules] = useState<Record<string, RecurrenceRule>>({});

  const getPage = (pageId: string) => pages.find((p) => p.id === pageId);

  const recurrence = useRecurrenceControls({
    dateColId: dateCol,
    seriesRules,
    getPage,
    onChanged: () => onSeriesChanged?.(),
    onPlainDelete: (pageId) => setConfirmDeleteId(pageId),
  });

  const resetDragState = () => {
    setDraggedCardId(null);
    setDragOverDayStr(null);
    setDragOverCardId(null);
    setDragOverPosition(null);
  };

  // Notion-style right-click menu for calendar cards
  const cardMenu = useContextMenu();
  const buildCardMenu = (pageId: string): MenuItem[] => {
    const page = getPage(pageId);
    const inSeries = !!page?.seriesId && !page?.seriesDetached;

    const items: MenuItem[] = [
      { id: 'open', label: t('open'), icon: ArrowUpRight, onSelect: () => onCardClick(pageId) },
      { id: 'open-full', label: t('openInFullPage'), icon: Maximize2, onSelect: () => router.push(`/db/${database.id}/${pageId}`) },
      { id: 'copy-link', label: t('copyLink'), icon: Link2, onSelect: () => { navigator.clipboard?.writeText(`${window.location.origin}/db/${database.id}/${pageId}`); } },
      { kind: 'separator' },
      {
        id: 'repeat',
        label: inSeries ? tRec('menuEditRepeat') : tRec('menuRepeat'),
        icon: Repeat,
        // A rule needs a start date to hang off, so the option is only live on
        // a card that actually sits on the calendar's date column.
        disabled: !parseDateValue(page?.properties?.[dateCol]),
        onSelect: () => recurrence.openRepeat(pageId),
      },
    ];

    if (inSeries) {
      items.push({
        id: 'detach',
        label: tRec('menuDetach'),
        icon: Unlink,
        onSelect: () => recurrence.run(() => detachPageFromSeries(pageId)),
      });
    }

    items.push(
      { id: 'duplicate', label: t('duplicatePage'), icon: Copy, onSelect: () => onDuplicatePage(pageId) },
      { id: 'delete', label: tPage('deletePage'), icon: Trash2, danger: true, onSelect: () => recurrence.requestDelete(pageId) },
    );

    return items;
  };

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

  // ── Recurrence: load rules + extend materialization to the visible window ──
  //
  // Topping up on read is what lets an open-ended series work with no cron at
  // all: paging the calendar forward past the horizon simply extends it, and
  // the unique (series_id, occurrence_date) index keeps that idempotent. The
  // parent only re-fetches when rows were actually created.
  const windowEnd = days.length > 0 ? formatYYYYMMDD(days[days.length - 1].date) : null;

  useEffect(() => {
    if (!database?.id || !windowEnd) return;
    let cancelled = false;

    loadRecurrenceState(database.id, windowEnd)
      .then(({ series, created }) => {
        if (cancelled) return;
        setSeriesRules(Object.fromEntries(series.map((s) => [s.id, s.rule])));
        if (created > 0) onSeriesChanged?.();
      })
      // A failed top-up must not blank the calendar — the cards already on
      // screen are real rows and stay valid; only the badges go missing.
      .catch(() => {});

    return () => { cancelled = true; };
  }, [database?.id, windowEnd, onSeriesChanged]);


  // Vertical scroll container (the weekday header's sticky anchor) + a ref
  // planted on the first cell of the anchor week (index 7 — see getMonthDays:
  // the week containing `currentDate` always lands on the grid's 2nd row).
  // On month view, land that row a little below the viewport's top edge
  // instead of at the grid's actual top (row 1, the prior week) — the prior
  // week is still rendered above and one scroll-up away, but on a tall week
  // you no longer have to scroll DOWN just to reach "this week".
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const anchorWeekRowRef = useRef<HTMLDivElement | null>(null);
  // useLayoutEffect (not useEffect) so the scroll position is corrected before
  // the browser paints — otherwise the grid would flash at its natural
  // scrollTop-0 position (prior week visible) for one frame before jumping.
  useLayoutEffect(() => {
    if (viewMode !== 'month') return;
    const container = scrollContainerRef.current;
    const row = anchorWeekRowRef.current;
    if (!container || !row) return;
    const ANCHOR_OFFSET_PX = 32;
    const containerTop = container.getBoundingClientRect().top;
    const rowTop = row.getBoundingClientRect().top;
    container.scrollTop += rowTop - containerTop - ANCHOR_OFFSET_PX;
  }, [days, viewMode]);

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
            {t('today')}
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
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-auto">
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
            // `auto` (not `1fr`) so each week row grows to fit its busiest day
            // independently — a week packed with cards expands without dragging
            // every other row to the same height. The min (~2 default cards tall)
            // keeps sparse weeks from collapsing too short.
            gridTemplateRows: viewMode === 'month' ? 'repeat(6, minmax(11rem, auto))' : 'minmax(22rem, auto)'
          }}
        >
          {days.map(({ date, isCurrentMonth }, idx) => {
            const dayStr = formatYYYYMMDD(date);
            const isToday = dayStr === todayStr;
            const dayPages = getPagesForDay(date);
            // "Expand all" only once every card on the day is collapsed; a single
            // expanded card keeps the button meaning "collapse all".
            const allDayCardsCollapsed = dayPages.length > 0 && dayPages.every((p: any) => p.cardCollapsed);
            const isDragOver = dragOverDayStr === dayStr;

            return (
              <div
                key={idx}
                ref={idx === 7 ? anchorWeekRowRef : undefined}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedCardId) {
                    setDragOverDayStr(dayStr);
                    // Left a card's own drop zone for the day's empty area — clear
                    // the stale per-card insertion indicator (mirrors KanbanBoard).
                    setDragOverCardId(null);
                    setDragOverPosition(null);
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
                  resetDragState();
                }}
                className={`relative border-r border-b border-neutral-800/80 p-1 lg:p-2 min-h-24 flex flex-col transition-colors overflow-visible group/day ${
                  isDragOver
                    ? 'bg-neutral-800/15'
                    : isToday
                    ? 'bg-blue-500/12'
                    : !isCurrentMonth && viewMode === 'month'
                    ? 'bg-neutral-950/20'
                    : 'bg-transparent'
                } ${isToday ? 'ring-1 ring-inset ring-blue-500/70 z-10' : ''}`}
              >
                {/* Day Number / Indicator */}
                <div className="flex items-center justify-between gap-1 mb-1.5 shrink-0 select-none">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`shrink-0 text-xs font-semibold py-0.5 px-1.5 ${
                        isToday
                          ? 'bg-blue-600 text-white font-bold'
                          : isCurrentMonth
                          ? 'text-neutral-200'
                          : 'text-neutral-500'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    {/* Spells out what the blue square means, so "today" reads as
                        today instead of just "the highlighted one". */}
                    {isToday && (
                      <span className="truncate rounded border border-blue-500/40 bg-blue-500/15 px-1 py-px text-[9px] font-bold uppercase tracking-wider text-blue-300">
                        {t('today')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 h-6 shrink-0">
                    {dayPages.length > 0 && (
                      <span className="text-[10px] text-neutral-600 font-medium font-mono group-hover/day:hidden">
                        {dayPages.length}
                      </span>
                    )}
                    {dayPages.length > 0 && (
                      <button
                        onClick={() => handleToggleDayCollapsed(dayPages, !allDayCardsCollapsed)}
                        className="opacity-0 group-hover/day:opacity-100 transition-opacity p-0.5 hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200 rounded cursor-pointer duration-100"
                        title={allDayCardsCollapsed ? t('expandAllCards') : t('collapseAllCards')}
                      >
                        {allDayCardsCollapsed ? <ChevronsUpDown size={12} /> : <ChevronsDownUp size={12} />}
                      </button>
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
                    const borderAccents = getCardBorderAccents(colorColSchema, page.properties[cardColorCol ?? '']);
                    // Only worth thickening the line for the icon when the card is
                    // actually collapsed — expanded cards already show the select's
                    // icon in its own property chip, no need to duplicate it here.
                    const showAccentIcons = page.cardCollapsed && borderAccents.some((a) => a.icon);
                    const bgColSchema = cardBgCol ? schema.find((c) => c.id === cardBgCol) : null;
                    const bgColor = getCardBgColor(bgColSchema, page.properties[cardBgCol ?? '']);
                    // Thick+icon only while truly collapsed — the card root already
                    // carries `group` (used by the existing hover-peek), so on hover
                    // the bar animates straight back to its normal thin state, same
                    // moment the property list peeks back open beneath it. `lg:`-gated
                    // like the property block itself: mobile never reveals the peek
                    // (touch has no real hover), so the bar shouldn't try to thin
                    // there either — it'd revert with nothing to reveal underneath.
                    const borderLineClass = cardBorderSide === 'top'
                      ? `absolute top-0 inset-x-0 flex flex-row transition-[height] duration-200 ease-out ${showAccentIcons ? 'h-6 lg:group-hover:h-0.75' : 'h-0.75'}`
                      : cardBorderSide === 'right'
                      ? `absolute right-0 inset-y-0 flex flex-col transition-[width] duration-200 ease-out ${showAccentIcons ? 'w-6 lg:group-hover:w-0.75' : 'w-0.75'}`
                      : cardBorderSide === 'bottom'
                      ? `absolute bottom-0 inset-x-0 flex flex-row transition-[height] duration-200 ease-out ${showAccentIcons ? 'h-6 lg:group-hover:h-0.75' : 'h-0.75'}`
                      : `absolute left-0 inset-y-0 flex flex-col transition-[width] duration-200 ease-out ${showAccentIcons ? 'w-6 lg:group-hover:w-0.75' : 'w-0.75'}`;
                    // Calendar cards are much tighter than Kanban's (py-1/px-1 on
                    // mobile), so the 24px thickened bar needs its own side's
                    // padding pulled out to 28px or the icon would sit under the
                    // title text instead of beside it. On hover (lg: only, matching
                    // the bar's own gate — mobile has no real hover to revert on)
                    // it eases back to the normal responsive value in step with the
                    // bar thinning, so the title/properties actually slide over to
                    // meet it instead of leaving a gap; the other three sides never move.
                    const cardPaddingClass = !showAccentIcons
                      ? 'py-1 lg:py-2.5 px-1 lg:px-2'
                      : cardBorderSide === 'right'
                      ? 'py-1 lg:py-2.5 pl-1 lg:pl-2 pr-7 lg:group-hover:pr-2'
                      : cardBorderSide === 'top'
                      ? 'px-1 lg:px-2 pb-1 lg:pb-2.5 pt-7 lg:group-hover:pt-2.5'
                      : cardBorderSide === 'bottom'
                      ? 'px-1 lg:px-2 pt-1 lg:pt-2.5 pb-7 lg:group-hover:pb-2.5'
                      : 'py-1 lg:py-2.5 pr-1 lg:pr-2 pl-7 lg:group-hover:pl-2';
                    return (
                    <div
                      key={page.id}
                      onClick={() => onCardClick(page.id)}
                      onContextMenu={(e) => cardMenu.open(e, buildCardMenu(page.id))}
                      draggable={true}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setDraggedCardId(page.id);
                        e.dataTransfer.setData('text/plain', page.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!draggedCardId || draggedCardId === page.id) return;
                        setDragOverDayStr(dayStr);
                        // Same reasoning as KanbanBoard: an active sort would just
                        // re-order cards back, so don't show a misleading indicator.
                        if (hasSorts) return;
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setDragOverPosition(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
                        setDragOverCardId(page.id);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const cardId = draggedCardId || e.dataTransfer.getData('text/plain');
                        if (!cardId || cardId === page.id) {
                          resetDragState();
                          return;
                        }
                        onCardDateChange(cardId, dayStr, page.id, dragOverPosition ?? 'before');
                        resetDragState();
                      }}
                      onDragEnd={resetDragState}
                      className={`database-card relative cursor-pointer transition-colors group flex flex-col select-none overflow-hidden rounded ${
                        draggedCardId === page.id ? 'opacity-25' : ''
                      } ${dragOverCardId === page.id && dragOverPosition === 'before' ? 'border-t-2 border-t-blue-500/60' : ''} ${
                        dragOverCardId === page.id && dragOverPosition === 'after' ? 'border-b-2 border-b-blue-500/60' : ''
                      }`}
                      style={{ backgroundColor: bgColor ?? 'var(--database-card-bg, rgba(64,68,75,0.55))' }}
                    >
                      {borderAccents.length > 0 && (
                        <div className={`${borderLineClass} pointer-events-none`} aria-hidden>
                          {borderAccents.map((accent, i) => (
                            <div key={i} className="flex-1 flex items-center justify-center" style={{ backgroundColor: accent.color }}>
                              {showAccentIcons && accent.icon && (
                                <span className="transition-opacity duration-150 lg:group-hover:opacity-0">
                                  <PageIcon icon={accent.icon} iconColor={accent.iconColor} size={16} hideFallback style={{ color: '#fff' }} />
                                </span>
                              )}
                            </div>
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
                        {/* Collapse/expand — hides the property list, keeping just the title */}
                        <button
                          onClick={() => handleToggleCollapsed(page.id, !page.cardCollapsed)}
                          className="p-1 hover:bg-neutral-700/60 text-neutral-400 hover:text-neutral-200 transition-colors rounded cursor-pointer"
                          title={page.cardCollapsed ? t('expandCard') : t('collapseCard')}
                        >
                          {page.cardCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                        </button>
                        {/* Drag handle & Actions */}
                        <button
                          draggable={true}
                          onDragStart={(e) => {
                            e.stopPropagation();
                            setDraggedCardId(page.id);
                            e.dataTransfer.setData('text/plain', page.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
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
                            className="fixed z-9999 bg-neutral-900 border border-neutral-800 shadow-xl py-1 w-40 rounded text-left animate-fade-in animate-duration-100 overflow-hidden"
                            style={{ top: menuCoords.top, left: menuCoords.left }}
                          >
                            {/* Repeat lives here as well as in the right-click
                                menu: this ⋯ button is the only affordance most
                                people ever find on a card, so leaving recurrence
                                exclusively behind a right-click hid the feature. */}
                            {parseDateValue(page.properties?.[dateCol]) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  recurrence.openRepeat(page.id);
                                  setActiveMenuCardId(null);
                                  setMenuCoords(null);
                                }}
                                className="w-full px-2.5 py-1.5 text-[11px] text-neutral-300 hover:bg-neutral-800 flex items-center gap-1.5 cursor-pointer transition-colors border-b border-neutral-850"
                              >
                                <Repeat size={11} />
                                <span>{page.seriesId && !page.seriesDetached ? tRec('menuEditRepeat') : tRec('menuRepeat')}</span>
                              </button>
                            )}
                            {page.seriesId && !page.seriesDetached && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  recurrence.run(() => detachPageFromSeries(page.id));
                                  setActiveMenuCardId(null);
                                  setMenuCoords(null);
                                }}
                                className="w-full px-2.5 py-1.5 text-[11px] text-neutral-300 hover:bg-neutral-800 flex items-center gap-1.5 cursor-pointer transition-colors border-b border-neutral-850"
                              >
                                <Unlink size={11} />
                                <span>{tRec('menuDetach')}</span>
                              </button>
                            )}
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
                                recurrence.requestDelete(page.id);
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

                      {/* Owns the padding (not the `group` root above) — `group-hover:`
                          utilities only match descendants of `.group`, never the
                          group element itself, so the accent-side padding's hover
                          reversion has to live on a child for it to actually fire. */}
                      <div className={`${cardPaddingClass} transition-[padding] duration-200 ease-out flex-1 flex flex-col min-w-0`}>
                      {/* Page Title. lg:pr-8 (room for the collapse/grip buttons,
                          `hidden lg:flex` themselves) only reserved on hover —
                          those buttons are `opacity-0` until then, so holding the
                          space permanently truncated titles that had the room to
                          show more. */}
                      <h4 className={`text-[11px] lg:text-sm text-neutral-100 group-hover:text-neutral-50 font-medium leading-snug transition-[padding-right] duration-200 ease-out pr-1 lg:group-hover:pr-8 mb-0 lg:mb-1 flex items-center gap-1 ${propertyTextClamp === 'truncate' ? 'overflow-hidden' : 'wrap-break-word whitespace-normal overflow-visible'}`}>
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
                        <RecurringBadge
                          seriesId={page.seriesId}
                          detached={page.seriesDetached}
                          rule={page.seriesId ? seriesRules[page.seriesId] : null}
                        />
                      </h4>

                      <AgentEditBadge
                        agentName={page.agentName ?? null}
                        tokenName={page.agentTokenName ?? null}
                        editedAt={page.agentEditedAt ?? null}
                        className="absolute bottom-0 right-0 rounded-tl-xl p-1.5 z-10 translate-x-0.5 translate-y-0.5"
                      />

                      {/* Card properties — hidden on mobile for a compact,
                          Google/iOS-calendar-style title-only card. When the
                          card is collapsed, this is hidden via CSS alone (not
                          a JS conditional) so hovering the card — via the
                          `group` class on the card root — can peek it back
                          open on desktop without touching the persisted
                          collapsed state. Grid-rows 0fr→1fr animates to the
                          block's natural height (same technique as
                          PendingGiftToast's hover-expand panel) — plain
                          `hidden`/`flex` has no in-between state to animate. */}
                      <div className="hidden lg:block shrink-0">
                      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${page.cardCollapsed ? 'grid-rows-[0fr] group-hover:grid-rows-[1fr]' : 'grid-rows-[1fr]'}`}>
                      <div className="overflow-hidden">
                      <div className="pt-1.5 flex flex-col gap-1.5 select-none">
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
                                <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-px rounded-full font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>
                                  <OptionIcon value={val} options={c.options} size={9} />
                                  {val}
                                </span>
                              );
                            } else if (c.type === 'status' && typeof val === 'string') {
                              display = <StatusChip value={val} options={c.options} iconSize={10} />;
                            } else if (c.type === 'user' || c.type === 'multi_user') {
                              display = <UserAvatarStack value={val} currentUserId={currentUserId} size={18} />;
                            } else if (c.type === 'multi_select' && Array.isArray(val)) {
                              display = (
                                <span className={`flex gap-0.5 ${propertyTextClamp === 'wrap' ? 'flex-wrap' : 'flex-nowrap overflow-hidden'}`}>
                                  {val.map((optVal: string) => {
                                    const mc = getOptionColorByValue(c.options || [], optVal);
                                    return (
                                      <span key={optVal} className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-px rounded-full font-medium shrink-0" style={{ backgroundColor: mc.bg, color: mc.text }}>
                                        <OptionIcon value={optVal} options={c.options} size={9} />
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
                      </div>
                      </div>
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

      {recurrence.node}

      {cardMenu.node}
    </div>
  );
}
