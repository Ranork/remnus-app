'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Localized short weekday names, Monday first (5 Jan 2026 is a Monday). */
function weekdayNames(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2026, 0, 5 + i)));
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(str: string): Date | null {
  if (!str) return null;
  const d = new Date(str + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function sameDay(a: Date, b: Date) {
  return ymd(a) === ymd(b);
}

interface DateRangePickerProps {
  value: string;
  showTime?: boolean;
  anchorRect: DOMRect | null;
  onChange: (val: string) => void;
  onClose: () => void;
}

export default function DateRangePicker({
  value,
  showTime = false,
  anchorRect,
  onChange,
  onClose,
}: DateRangePickerProps) {
  const t = useTranslations('Database');
  const locale = useLocale();

  // Parse incoming value (single date, range, or datetime)
  const parts = typeof value === 'string' && value.includes('/') ? value.split('/') : [value ?? '', ''];
  const initStartFull = parts[0] ?? '';
  const initEnd       = (parts[1] ?? '').split('T')[0];
  const initStart     = initStartFull.split('T')[0];
  const initTime      = initStartFull.includes('T') ? initStartFull.split('T')[1] : '';

  const [startStr, setStartStr] = useState(initStart);
  const [endStr,   setEndStr]   = useState(initEnd);
  const [timeStr,  setTimeStr]  = useState(initTime);
  const [hover,    setHover]    = useState('');
  // 'picking-end': start selected, waiting for end; 'idle': no active selection in progress
  const [phase, setPhase] = useState<'idle' | 'picking-end'>(
    initStart && !initEnd ? 'picking-end' : 'idle',
  );

  const startDate = parseDate(startStr);
  const endDate   = parseDate(endStr);

  const [viewYear,  setViewYear]  = useState(() => (startDate ?? new Date()).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (startDate ?? new Date()).getMonth());
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!anchorRect) return;
    const W = 288;
    const H = showTime ? 370 : 330;
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const top = spaceBelow >= H + 4
      ? anchorRect.bottom + window.scrollY + 4
      : anchorRect.top  + window.scrollY - H - 4;
    const left = Math.min(
      anchorRect.left + window.scrollX,
      window.innerWidth - W - 8,
    );
    setPos({ top, left });
  }, [anchorRect, showTime]);

  const save = useCallback((s: string, e: string, t: string) => {
    if (!s) { onChange(''); onClose(); return; }
    let result = s;
    if (showTime && t) result = `${s}T${t}`;
    if (e && e !== s)  result = `${s}/${e}`;
    onChange(result);
    onClose();
  }, [onChange, onClose, showTime]);

  // Backdrop click saves
  const containerRef = useRef<HTMLDivElement>(null);
  const latestState  = useRef({ startStr, endStr, timeStr });
  useEffect(() => { latestState.current = { startStr, endStr, timeStr }; }, [startStr, endStr, timeStr]);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const { startStr: s, endStr: end, timeStr: t } = latestState.current;
        save(s, end, t);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [save]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleDayClick = (d: Date) => {
    const dStr = ymd(d);
    if (phase === 'idle' || !startStr) {
      setStartStr(dStr);
      setEndStr('');
      setPhase('picking-end');
      return;
    }
    // We have a start, now placing the end
    const start = parseDate(startStr)!;
    if (d < start) {
      // Clicked before start → becomes new start, reset end
      setStartStr(dStr);
      setEndStr('');
      // stay in picking-end
      return;
    }
    if (sameDay(d, start)) {
      // Same day → confirm single date
      setEndStr('');
      setPhase('idle');
      save(dStr, '', timeStr);
      return;
    }
    // Valid end date → confirm range
    setEndStr(dStr);
    setPhase('idle');
    save(startStr, dStr, timeStr);
  };

  // Build grid
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const offset      = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Mon=0
  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(viewYear, viewMonth, i));
  while (cells.length % 7 !== 0) cells.push(null);

  const getDayClasses = (d: Date): string => {
    const dStr        = ymd(d);
    const isStart     = dStr === startStr;
    const isEnd       = dStr === endStr && !!endStr;
    const hoverDate   = phase === 'picking-end' && hover ? parseDate(hover) : null;
    const effectiveEnd = endDate ?? hoverDate;
    const inRange     = startDate && effectiveEnd && d > startDate && d < effectiveEnd;
    const isToday     = sameDay(d, new Date());
    const isHoverEnd  = hoverDate ? sameDay(d, hoverDate) : false;

    const base = 'w-8 h-8 flex items-center justify-center text-xs cursor-pointer select-none transition-colors';

    // Chosen days are ink; the span between them a soft signal tint; today keeps the
    // calendar's signal as a ring (the fill belongs to the choice).
    if (isStart || isEnd || (isHoverEnd && phase === 'picking-end' && !isStart)) {
      return `${base} rounded-full bg-ink text-ink-fg font-semibold`;
    }
    if (inRange) {
      return `${base} rounded-none bg-signal-soft text-fg`;
    }
    if (isToday) {
      return `${base} rounded-full font-semibold text-fg shadow-[inset_0_0_0_1.5px_var(--color-signal)] hover:bg-hover`;
    }
    return `${base} rounded-full text-fg-2 hover:bg-hover hover:text-fg`;
  };

  if (typeof document === 'undefined') return null;

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const formatDay = (str: string) => {
    const d = parseDate(str);
    return d ? d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : str;
  };

  return createPortal(
    <>
      {/* transparent backdrop handled by mousedown on document */}
      <div
        ref={containerRef}
        className="absolute z-9999 rounded-surface bg-float p-3 text-fg shadow-float select-none animate-scale-in"
        style={{
          width: 288,
          top:  pos?.top  ?? 0,
          left: pos?.left ?? 0,
          visibility: pos ? 'visible' : 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" size="icon-sm" onClick={prevMonth} aria-label={t('calendarPrevMonth')}>
            <ChevronLeft />
          </Button>
          <span className="text-ui font-semibold text-fg">
            {monthLabel.charAt(0).toLocaleUpperCase(locale) + monthLabel.slice(1)}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={nextMonth} aria-label={t('calendarNextMonth')}>
            <ChevronRight />
          </Button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {weekdayNames(locale).map((d, i) => (
            <div key={i} className={`w-8 h-6 flex items-center justify-center text-2xs font-medium ${i >= 5 ? 'text-fg-4' : 'text-fg-3'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {cells.map((d, i) => (
            <div key={i} className="flex items-center justify-center">
              {d ? (
                <div
                  className={getDayClasses(d)}
                  onClick={() => handleDayClick(d)}
                  onMouseEnter={() => phase === 'picking-end' && setHover(ymd(d))}
                  onMouseLeave={() => phase === 'picking-end' && setHover('')}
                >
                  {d.getDate()}
                </div>
              ) : (
                <div className="w-8 h-8" />
              )}
            </div>
          ))}
        </div>

        {/* Time input (datetime only) */}
        {showTime && (
          <div className="mt-3 pt-3 border-t border-line flex items-center gap-2">
            <span className="text-xs text-fg-3">{t('time')}</span>
            <Input
              size="sm"
              type="time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              aria-label={t('time')}
              className="w-28 scheme-dark"
            />
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 pt-2 border-t border-line flex items-center justify-between">
          <span className="text-xs text-fg-3 truncate max-w-40">
            {phase === 'picking-end'
              ? t('datePickerClickEnd')
              : startStr && endStr
                ? t('dateRange', { start: formatDay(startStr), end: formatDay(endStr) })
                : startStr ? formatDay(startStr) : t('datePickerNoDate')
            }
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => { setStartStr(''); setEndStr(''); setPhase('idle'); onChange(''); onClose(); }}
            >
              {t('clear')}
            </Button>
            {phase !== 'picking-end' && startStr && (
              <Button variant="primary" size="xs" onClick={() => save(startStr, endStr, timeStr)}>
                {t('done')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
