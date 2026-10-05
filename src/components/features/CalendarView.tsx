'use client';

import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateValue } from '@/lib/types/properties';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronsDownUp, ChevronsUpDown, GripVertical, Trash2, Calendar as CalendarIcon, Plus, Copy, ArrowUpRight, Maximize2, Link2, Repeat, Unlink } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Tooltip } from '@/components/ui/tooltip';
import { useContextMenu, type MenuItem } from './ContextMenu';
import PageIcon from './PageIcon';
import { IconPicker } from './lazyDialogs';
import AgentEditBadge from './AgentEditBadge';
import { StatusChip, UserAvatarStack, OptionChip, MarkDot, CardAccent, cardTintStyle } from './PropertyTags';
import type { CardAccentSide, CardAppearance } from '@/lib/types/views';
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
  /** The view's card colouring: the mark (a dot before the title, or an accent line)
   *  and the background tint. */
  cardAppearance?: CardAppearance;
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

// Extra padding on the side an accent bar sits on, so the bar never touches the title.
const ACCENT_ROOM: Record<CardAccentSide, string> = {
  left: 'pl-2.5 lg:pl-3',
  right: 'pr-2.5 lg:pr-3',
  top: 'pt-2 lg:pt-2.5',
  bottom: 'pb-2 lg:pb-2.5',
};
const hasAccentValue = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== '');

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

/** "septiembre de 2026" → "Septiembre de 2026": a heading starts with a capital in every locale. */
const sentenceCase = (text: string, locale: string) =>
  text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);

/** Localized short weekday names in grid order, with which of them fall on a weekend.
 *  4 Jan 2026 is a Sunday — any known Sunday works as the reference week. */
function weekdayHeaders(locale: string, firstDayOfWeek: 'sunday' | 'monday') {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const order = firstDayOfWeek === 'monday' ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  return order.map((dow) => ({
    dow,
    label: fmt.format(new Date(2026, 0, 4 + dow)),
    isWeekend: dow === 0 || dow === 6,
  }));
}

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
  cardAppearance,
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
  const locale = useLocale();
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
  // The "Mark events by" property — only a select/status can mark (a dot needs a colour).
  const isColorColumn = (c: any) => ['select', 'multi_select', 'status'].includes(c.type);
  const markColumn = cardAppearance?.markCol
    ? schema.find((c) => c.id === cardAppearance.markCol && isColorColumn(c))
    : undefined;
  const markAsAccent = cardAppearance?.markStyle === 'accent';
  const tintColumn = cardAppearance?.tintCol
    ? schema.find((c) => c.id === cardAppearance.tintCol && isColorColumn(c))
    : undefined;

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
      return currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    }
    let currentDay = currentDate.getDay();
    if (firstDayOfWeek === 'monday') {
      currentDay = currentDay === 0 ? 6 : currentDay - 1;
    }
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - currentDay);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    // formatRange drops the repeated month/year the way each locale expects
    // ("Sep 28 – Oct 4, 2026", "28 Eyl – 4 Eki 2026").
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).formatRange(start, end);
  };

  const weekdays = weekdayHeaders(locale, firstDayOfWeek);

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
      <EmptyState
        icon={<CalendarIcon />}
        title={t('calendarNeedsDate')}
        description={t('calendarNeedsDateHint')}
      />
    );
  }

  const todayStr = formatYYYYMMDD(new Date());
  const prevLabel = viewMode === 'month' ? t('calendarPrevMonth') : t('calendarPrevWeek');
  const nextLabel = viewMode === 'month' ? t('calendarNextMonth') : t('calendarNextWeek');

  return (
    <div className="flex flex-col text-fg h-full">
      {/* Calendar Header Nav */}
      <div className="flex items-center justify-between gap-3 pb-3 mb-2 shrink-0 select-none">
        <div className="flex items-center gap-1">
          <Tooltip content={prevLabel}>
            <Button variant="ghost" size="icon-sm" onClick={handlePrev} aria-label={prevLabel}>
              <ChevronLeft />
            </Button>
          </Tooltip>
          <Button variant="secondary" size="sm" onClick={handleToday}>
            {t('today')}
          </Button>
          <Tooltip content={nextLabel}>
            <Button variant="ghost" size="icon-sm" onClick={handleNext} aria-label={nextLabel}>
              <ChevronRight />
            </Button>
          </Tooltip>
          <h3 className="ml-2 shrink-0 text-sm font-semibold text-fg">
            {sentenceCase(getHeaderLabel(), locale)}
          </h3>
        </div>

        {/* Which date property the calendar follows — desktop only; on mobile it
            collides with the nav row and is secondary info (set in Layout settings). */}
        {dateProperty && (
          <span className="hidden lg:inline-flex items-center gap-1.5 text-xs text-fg-3">
            <CalendarIcon size={12} aria-hidden />
            {t('calendarByProperty', { name: dateProperty.name })}
          </span>
        )}
      </div>

      {/* Scrollable calendar body — on phones a 7-col month grid squeezes each
          day to ~50px (unreadable). Give it a usable min-width and let the
          weekday row + grid scroll horizontally together; desktop is unchanged.
          This wrapper is also the vertical scroll container so the weekday row
          can stay sticky to its top while the grid scrolls under it. */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-auto">
      <div className="min-w-170 lg:min-w-0">
      {/* Weekdays names row — sticky so it never scrolls out of view */}
      <div className="grid grid-cols-7 bg-sheet shrink-0 select-none sticky top-0 z-20">
        {weekdays.map(({ dow, label, isWeekend }) => (
          <div
            key={dow}
            className={`px-2 py-1.5 text-xs font-medium ${isWeekend ? 'text-fg-4' : 'text-fg-3'}`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Grid Container */}
      <div>
        <div
          className="grid grid-cols-7 border-l border-t border-line h-auto"
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
            const isOutside = !isCurrentMonth && viewMode === 'month';
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
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
                className={`relative border-r border-b border-line p-1 lg:p-1.5 min-h-24 flex flex-col transition-colors overflow-visible group/day ${
                  isDragOver
                    ? 'bg-hover/50'
                    : isToday
                    ? 'bg-signal-soft/60'
                    : isOutside
                    ? 'bg-desk/40'
                    : ''
                }`}
              >
                {/* Today's frame: a signal ring drawn over the grid lines, so the
                    whole day reads at a glance, not just its number. */}
                {isToday && (
                  <span aria-hidden className="pointer-events-none absolute -inset-px z-10 shadow-[inset_0_0_0_2px_var(--color-signal)]" />
                )}
                {/* Day Number / Indicator */}
                <div className="flex items-center justify-between gap-1 mb-1 shrink-0 select-none">
                  {/* Today is the one filled number (signal) with a "Today" badge;
                      weekend and other-month days step back to the faintest ink. */}
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      aria-current={isToday ? 'date' : undefined}
                      aria-label={isToday ? `${t('today')}, ${date.getDate()}` : undefined}
                      className={`inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1 text-xs tabular-nums ${
                        isToday
                          ? 'bg-signal font-semibold text-signal-fg'
                          : isOutside || isWeekend
                          ? 'font-medium text-fg-4'
                          : 'font-medium text-fg-2'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    {/* Only on wide screens, where a day cell has room for it; a narrower
                        cell keeps the frame and the filled number. (Not a container query:
                        containment would re-anchor the fixed-position IconPicker to the cell.) */}
                    {isToday && (
                      <span aria-hidden className="hidden truncate rounded-full bg-signal-soft px-1.5 py-px text-2xs font-semibold text-signal-text xl:inline">
                        {t('today')}
                      </span>
                    )}
                  </span>
                  {/* The day's card count sits at the right edge; on hover (or when
                      a button inside has focus) the day's actions take its place. */}
                  <div className="relative flex h-6 shrink-0 items-center justify-end">
                    {dayPages.length > 0 && (
                      <span className="px-1 text-2xs text-fg-4 tabular-nums group-hover/day:invisible group-focus-within/day:invisible">
                        {dayPages.length}
                      </span>
                    )}
                    <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/day:opacity-100 focus-within:opacity-100">
                      {dayPages.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleToggleDayCollapsed(dayPages, !allDayCardsCollapsed)}
                          className="flex size-6 items-center justify-center rounded text-fg-3 transition-colors hover:bg-hover hover:text-fg cursor-pointer"
                          title={allDayCardsCollapsed ? t('expandAllCards') : t('collapseAllCards')}
                          aria-label={allDayCardsCollapsed ? t('expandAllCards') : t('collapseAllCards')}
                        >
                          {allDayCardsCollapsed ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onCreatePage?.({ [dateCol]: dayStr })}
                        className="flex size-6 items-center justify-center rounded text-fg-3 transition-colors hover:bg-hover hover:text-fg cursor-pointer"
                        title={t('calendarAddToDay')}
                        aria-label={t('calendarAddToDay')}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Cards Container inside day */}
                <div className="flex-1 flex flex-col gap-1.5 min-h-10">
                  {dayPages.map((page) => {
                    const markValue = markColumn ? page.properties[markColumn.id] : undefined;
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
                      // The board's card language: a raised surface with a hairline,
                      // tinted only when the view sets a "Card background". The mark is
                      // a dot before the title (or an accent line), and the drop line
                      // (signal) shows where a dragged card lands.
                      className={`group relative flex cursor-pointer flex-col rounded-control bg-raised shadow-[inset_0_0_0_1px_var(--card-edge,var(--color-line))] transition-shadow select-none hover:shadow-[inset_0_0_0_1px_var(--card-edge-strong,var(--color-line-strong))] ${
                        draggedCardId === page.id ? 'opacity-25' : ''
                      } ${dragOverCardId === page.id && dragOverPosition === 'before' ? 'before:absolute before:inset-x-0 before:-top-1 before:h-0.5 before:rounded-full before:bg-signal' : ''} ${
                        dragOverCardId === page.id && dragOverPosition === 'after' ? 'after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-signal' : ''
                      }`}
                      style={tintColumn ? cardTintStyle(tintColumn, page.properties[tintColumn.id]) : undefined}
                    >
                      {markColumn && markAsAccent && (
                        <CardAccent column={markColumn} value={markValue} side={cardAppearance!.accentSide} size="sm" />
                      )}
                      {/* Hover Actions — desktop only (drag-reschedule uses HTML5
                          DnD which doesn't fire on touch; the invisible grip also
                          stole taps meant to open the card on mobile). */}
                      <div
                        className="hidden lg:flex absolute right-1 top-1 z-10 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Collapse/expand — hides the property list, keeping just the title */}
                        <button
                          type="button"
                          onClick={() => handleToggleCollapsed(page.id, !page.cardCollapsed)}
                          className="flex size-6 cursor-pointer items-center justify-center rounded text-fg-3 transition-colors hover:bg-hover hover:text-fg"
                          title={page.cardCollapsed ? t('expandCard') : t('collapseCard')}
                          aria-label={page.cardCollapsed ? t('expandCard') : t('collapseCard')}
                        >
                          {page.cardCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </button>
                        {/* Drag handle; a click opens the same menu as a right-click
                            (repeat, detach, duplicate, delete — this button is the
                            only affordance most people ever find on a card). */}
                        <button
                          type="button"
                          draggable={true}
                          onDragStart={(e) => {
                            e.stopPropagation();
                            setDraggedCardId(page.id);
                            e.dataTransfer.setData('text/plain', page.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            cardMenu.open(e, buildCardMenu(page.id));
                          }}
                          className="flex size-6 cursor-grab items-center justify-center rounded text-fg-3 transition-colors hover:bg-hover hover:text-fg active:cursor-grabbing"
                          title={t('dragReschedule')}
                          aria-label={t('dragReschedule')}
                        >
                          <GripVertical size={14} />
                        </button>
                      </div>

                      <div className={`flex min-w-0 flex-1 flex-col px-1.5 py-1 lg:px-2 lg:py-1.5 ${markColumn && markAsAccent && hasAccentValue(markValue) ? ACCENT_ROOM[cardAppearance!.accentSide] : ''}`}>
                      {/* Page Title. lg:pr-12 (room for the collapse/grip buttons,
                          `hidden lg:flex` themselves) only reserved on hover —
                          those buttons are `opacity-0` until then, so holding the
                          space permanently truncated titles that had the room to
                          show more. */}
                      <h4 className={`flex items-center gap-1.5 pr-1 text-2xs font-medium leading-snug text-fg transition-[padding-right] duration-200 ease-out lg:text-ui lg:group-hover:pr-12 ${propertyTextClamp === 'truncate' ? 'overflow-hidden' : 'wrap-break-word whitespace-normal overflow-visible'}`}>
                        {markColumn && !markAsAccent && <MarkDot column={markColumn} value={markValue} />}
                        {/* Room is short in a day cell: only a chosen icon is shown,
                            not the generic page glyph every untouched row has. */}
                        {(page.icon || defaultPageIcon) && (
                        <div className="relative shrink-0 select-none hidden lg:block">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              activeAnchorRef.current = e.currentTarget;
                              setActiveIconPickerPageId(activeIconPickerPageId === page.id ? null : page.id);
                            }}
                            className="flex cursor-pointer items-center justify-center rounded p-0.5 transition-colors hover:bg-hover"
                            title={t('changeIcon')}
                            aria-label={t('changeIcon')}
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
                        )}
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
                        className="absolute bottom-1 right-1 z-10 hidden lg:inline-flex"
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
                      <div className="flex flex-col gap-1 pt-1.5 select-none">
                        {propsToShow.map((c) => {
                            const val = page.properties[c.id];
                            const isEmpty =
                              val === undefined ||
                              val === null ||
                              val === '' ||
                              (Array.isArray(val) && val.length === 0);
                            // An unticked checkbox is a value too ("not done"), but on a
                            // card it only adds noise — show it only once ticked.
                            const isUnchecked = c.type === 'checkbox' && !(val === true || val === 'true');
                            if (isEmpty || isUnchecked) return null;

                            let display: React.ReactNode;
                            if (c.type === 'select' && typeof val === 'string') {
                              display = <OptionChip value={val} options={c.options} dense />;
                            } else if (c.type === 'status' && typeof val === 'string') {
                              display = <StatusChip value={val} options={c.options} iconSize={11} dense />;
                            } else if (c.type === 'user' || c.type === 'multi_user') {
                              display = <UserAvatarStack value={val} currentUserId={currentUserId} size={18} />;
                            } else if (c.type === 'multi_select' && Array.isArray(val)) {
                              display = (
                                <span className={`flex gap-1 ${propertyTextClamp === 'wrap' ? 'flex-wrap' : 'flex-nowrap overflow-hidden'}`}>
                                  {val.map((optVal: string) => <OptionChip key={optVal} value={optVal} options={c.options} dense />)}
                                </span>
                              );
                            } else if ((c.type === 'date' || c.type === 'datetime') && val) {
                              display = (
                                <span className={`text-fg-2 ${textClass}`}>
                                  {formatDateValue(val, c.type as 'date' | 'datetime', c.dateFormat, locale)}
                                </span>
                              );
                            } else if (c.type === 'checkbox') {
                              display = <Checkbox size="sm" checked readOnly aria-label={c.name} className="cursor-default" />;
                            } else {
                              display = (
                                <span className={`text-fg-2 ${textClass}`}>{String(val)}</span>
                              );
                            }

                            return (
                              <div
                                key={c.id}
                                className={`flex min-w-0 gap-1.5 text-2xs leading-relaxed ${propertyTextClamp === 'wrap' ? 'items-start' : 'items-center'}`}
                              >
                                {showPropertyLabels && (
                                  <span className="shrink-0 text-fg-3">{c.name}</span>
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
