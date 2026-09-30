'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAYS = ['Mo','Tu','We','Th','Fr','Sa','Su'];

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

    if (isStart || isEnd || (isHoverEnd && phase === 'picking-end' && !isStart)) {
      return `${base} rounded-full bg-ink text-ink-fg font-semibold`;
    }
    if (inRange) {
      return `${base} rounded-none bg-signal/20 text-neutral-200`;
    }
    if (isToday) {
      return `${base} rounded-full ring-1 ring-inset ring-signal/60 text-neutral-200 hover:bg-neutral-700`;
    }
    return `${base} rounded-full text-neutral-300 hover:bg-neutral-700`;
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* transparent backdrop handled by mousedown on document */}
      <div
        ref={containerRef}
        className="absolute z-[9999] bg-neutral-850 border border-neutral-700 shadow-2xl p-3 select-none"
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
          <button onClick={prevMonth} className="p-1 hover:bg-neutral-700 rounded cursor-pointer text-neutral-400 hover:text-neutral-200 transition-colors">
            <ChevronLeft size={13} />
          </button>
          <span className="text-xs font-semibold text-neutral-200">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button onClick={nextMonth} className="p-1 hover:bg-neutral-700 rounded cursor-pointer text-neutral-400 hover:text-neutral-200 transition-colors">
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => (
            <div key={d} className="w-8 h-6 flex items-center justify-center text-[10px] text-neutral-600 font-medium">
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
          <div className="mt-3 pt-3 border-t border-neutral-800 flex items-center gap-2">
            <span className="text-2xs text-neutral-500 w-8">{t('time')}</span>
            <input
              type="time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 text-white text-xs px-2 py-1 focus:outline-none focus:border-neutral-500 transition-colors scheme-dark"
            />
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 pt-2 border-t border-neutral-800 flex items-center justify-between">
          <span className="text-[10px] text-neutral-600 truncate max-w-[160px]">
            {phase === 'picking-end'
              ? t('datePickerClickEnd')
              : startStr && endStr
                ? `${startStr} → ${endStr}`
                : startStr || t('datePickerNoDate')
            }
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setStartStr(''); setEndStr(''); setPhase('idle'); onChange(''); onClose(); }}
              className="text-[10px] text-neutral-500 hover:text-neutral-300 cursor-pointer px-2 py-0.5 hover:bg-neutral-800 rounded transition-colors"
            >
              {t('clear')}
            </button>
            {phase !== 'picking-end' && startStr && (
              <button
                onClick={() => save(startStr, endStr, timeStr)}
                className="text-[10px] text-signal-text hover:text-fg cursor-pointer px-2 py-0.5 hover:bg-neutral-800 rounded transition-colors"
              >
                {t('done')}
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
