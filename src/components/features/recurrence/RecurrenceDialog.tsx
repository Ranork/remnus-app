'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { Repeat, X } from 'lucide-react';
import {
  DEFAULT_HORIZON_DAYS,
  WEEKDAYS,
  countOccurrences,
  defaultHorizon,
  parseYMD,
  weekdayOf,
  type MonthlyMode,
  type RecurrenceFreq,
  type RecurrenceRule,
  type Weekday,
} from '@/lib/recurrence/rule';
import { formatRuleSummary, weekdayLabels } from '@/lib/recurrence/summary';
import { OptionTile, Segmented, Stepper } from './parts';

// The repeat editor.
//
// Deliberately not a radio list: picking a rhythm is a visual choice, and what
// actually makes it easy is showing what each option WOULD mean for this
// particular card ("Every month — on the 19th", "Monthly — 3rd Tuesday") rather
// than making the user derive it. So every preset renders its own sub-label
// computed from the card's start date, the live summary sits at the top where
// it reads as the answer instead of a footnote, and the custom controls are
// steppers / day circles / segmented switches rather than number fields and
// dropdowns.
//
// Also deliberately not folded into `DateRangePicker`: that popover is 288px
// wide and saves-and-closes on any outside mousedown, which fights a form.

type PresetId =
  | 'none' | 'daily' | 'weekdays' | 'weekly' | 'biweekly'
  | 'monthly' | 'monthlyNth' | 'yearly' | 'custom';

/** Presets shown as tiles in the grid, between "no repeat" and "custom". */
const TILE_PRESETS: PresetId[] = ['daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'monthlyNth', 'yearly'];

interface RecurrenceDialogProps {
  /** Date the rule starts from — the card's own date. */
  startDate: string;
  /** Existing rule when editing a series; null when adding repeat to a card. */
  initialRule: RecurrenceRule | null;
  /** Shown only when the card already belongs to a series. */
  onRemove?: () => void;
  onSave: (rule: RecurrenceRule) => void;
  onClose: () => void;
}

function nthOfMonth(date: Date): 1 | 2 | 3 | 4 {
  const nth = Math.ceil(date.getDate() / 7);
  return (nth > 4 ? 4 : nth) as 1 | 2 | 3 | 4;
}

function presetRule(preset: PresetId, startDate: string): RecurrenceRule | null {
  const start = parseYMD(startDate) ?? new Date();
  const base = { startDate, end: { type: 'never' } as const, exDates: [] };

  switch (preset) {
    case 'daily':      return { ...base, freq: 'daily', interval: 1 };
    case 'weekdays':   return { ...base, freq: 'weekly', interval: 1, byWeekday: ['MO', 'TU', 'WE', 'TH', 'FR'] };
    case 'weekly':     return { ...base, freq: 'weekly', interval: 1, byWeekday: [weekdayOf(start)] };
    case 'biweekly':   return { ...base, freq: 'weekly', interval: 2, byWeekday: [weekdayOf(start)] };
    case 'monthly':    return { ...base, freq: 'monthly', interval: 1, monthlyMode: 'dayOfMonth', byMonthDay: start.getDate() };
    case 'monthlyNth': return { ...base, freq: 'monthly', interval: 1, monthlyMode: 'nthWeekday', bySetPos: nthOfMonth(start), byWeekday: [weekdayOf(start)] };
    case 'yearly':     return { ...base, freq: 'yearly', interval: 1, byMonth: start.getMonth() + 1, byMonthDay: start.getDate() };
    default:           return null;
  }
}

/** Which preset an existing rule corresponds to, so reopening the dialog lands
 *  on the tile the user originally picked instead of always on "Custom". */
function matchPreset(rule: RecurrenceRule | null, startDate: string): PresetId {
  if (!rule) return 'none';
  for (const preset of TILE_PRESETS) {
    const candidate = presetRule(preset, startDate);
    if (!candidate) continue;
    if (
      candidate.freq === rule.freq &&
      candidate.interval === rule.interval &&
      JSON.stringify(candidate.byWeekday ?? null) === JSON.stringify(rule.byWeekday ?? null) &&
      (candidate.monthlyMode ?? null) === (rule.monthlyMode ?? null) &&
      rule.end.type === 'never'
    ) {
      return preset;
    }
  }
  return 'custom';
}

// ── dialog ────────────────────────────────────────────────────────────────────

export default function RecurrenceDialog({
  startDate,
  initialRule,
  onRemove,
  onSave,
  onClose,
}: RecurrenceDialogProps) {
  const t = useTranslations('Recurrence');
  const locale = useLocale();
  const start = parseYMD(startDate) ?? new Date();

  const [preset, setPreset] = useState<PresetId>(() => matchPreset(initialRule, startDate));
  const [draft, setDraft] = useState<RecurrenceRule>(
    () => initialRule ?? presetRule('daily', startDate)!,
  );

  const dayNames = useMemo(() => weekdayLabels(locale), [locale]);
  const dayNamesLong = useMemo(() => weekdayLabels(locale, 'long'), [locale]);

  const summary = useMemo(
    () => (preset === 'none' ? '' : formatRuleSummary(draft, t as never, locale)),
    [draft, preset, t, locale],
  );

  // How many cards this rule would actually create in the materialization
  // window — the guardrail against casually picking "every day, forever".
  const preview = useMemo(
    () => (preset === 'none' ? 0 : countOccurrences(draft, startDate, defaultHorizon())),
    [draft, preset, startDate],
  );

  /** Each tile's second line, resolved against this card's own date. */
  const subtitleFor = (id: PresetId): string | undefined => {
    switch (id) {
      case 'weekdays':
        return (['MO', 'TU', 'WE', 'TH', 'FR'] as Weekday[]).map((wd) => dayNames[wd]).join(', ');
      case 'weekly':
      case 'biweekly':
        return dayNamesLong[weekdayOf(start)];
      case 'monthly':
        return t('sumOnMonthDay', { day: start.getDate() });
      case 'monthlyNth':
        return t('sumOnNthWeekday', {
          nth: t(`nth${nthOfMonth(start)}` as 'nth1'),
          weekday: dayNamesLong[weekdayOf(start)],
        });
      case 'yearly':
        return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(start);
      default:
        return undefined;
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const choosePreset = (next: PresetId) => {
    setPreset(next);
    if (next === 'custom') {
      setDraft((prev) => ({ ...prev, startDate }));
      return;
    }
    const rule = presetRule(next, startDate);
    if (rule) setDraft(rule);
  };

  const patch = (changes: Partial<RecurrenceRule>) => {
    setPreset('custom');
    setDraft((prev) => ({ ...prev, ...changes, startDate }));
  };

  const toggleWeekday = (wd: Weekday) => {
    const current = draft.byWeekday ?? [weekdayOf(start)];
    const next = current.includes(wd) ? current.filter((d) => d !== wd) : [...current, wd];
    // Never let the set empty out — a weekly rule with no days can never fire.
    patch({ byWeekday: next.length > 0 ? next : [wd] });
  };

  const monthlyMode: MonthlyMode = draft.monthlyMode ?? 'dayOfMonth';
  const endType = draft.end.type;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 z-300 flex items-center justify-center p-4 md:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-full sm:max-w-lg max-h-full bg-neutral-850 border border-neutral-800 rounded-xl modal-shadow flex flex-col overflow-hidden animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Repeat size={13} className="text-blue-400" />
            </div>
            <h2 className="m-0 text-sm font-semibold text-neutral-100 truncate">{t('title')}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t('cancel')}
            className="shrink-0 p-1.5 rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* Live answer, up top where it gets read — not a footnote. */}
          {preset !== 'none' && (
            <div className="rounded-lg bg-blue-500/[0.07] border border-blue-500/20 px-4 py-3">
              <p className="m-0 text-[13px] font-medium text-neutral-50 leading-snug">{summary}</p>
              <p className="m-0 mt-1 text-[11px] text-blue-300/70">
                {t('previewCount', { count: preview, days: DEFAULT_HORIZON_DAYS })}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <OptionTile
              wide
              title={t('preset_none')}
              selected={preset === 'none'}
              onSelect={() => choosePreset('none')}
            />
            {TILE_PRESETS.map((id) => (
              <OptionTile
                key={id}
                title={t(`preset_${id}` as 'preset_daily')}
                subtitle={subtitleFor(id)}
                selected={preset === id}
                onSelect={() => choosePreset(id)}
              />
            ))}
            <OptionTile
              wide
              title={t('preset_custom')}
              selected={preset === 'custom'}
              onSelect={() => choosePreset('custom')}
            />
          </div>

          {/* Custom builder */}
          {preset === 'custom' && (
            <div className="flex flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
              {/* Frequency + interval */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-neutral-500">{t('every')}</span>
                <Stepper
                  value={draft.interval}
                  min={1}
                  max={99}
                  onChange={(n) => patch({ interval: n })}
                  decreaseLabel={t('decrease')}
                  increaseLabel={t('increase')}
                />
                <Segmented<RecurrenceFreq>
                  value={draft.freq}
                  onChange={(freq) => patch({ freq })}
                  options={[
                    { id: 'daily', label: t('unit_daily') },
                    { id: 'weekly', label: t('unit_weekly') },
                    { id: 'monthly', label: t('unit_monthly') },
                    { id: 'yearly', label: t('unit_yearly') },
                  ]}
                />
              </div>

              {/* Weekday circles */}
              {draft.freq === 'weekly' && (
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((wd) => {
                    const active = (draft.byWeekday ?? [weekdayOf(start)]).includes(wd);
                    return (
                      <button
                        key={wd}
                        type="button"
                        onClick={() => toggleWeekday(wd)}
                        aria-pressed={active}
                        aria-label={dayNamesLong[wd]}
                        className={`w-9 h-9 rounded-full text-[10px] font-semibold border transition-colors ${
                          active
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-neutral-200 hover:border-neutral-700'
                        }`}
                      >
                        {dayNames[wd].slice(0, 2)}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Monthly mode */}
              {draft.freq === 'monthly' && (
                <div className="flex flex-col gap-2">
                  <Segmented<MonthlyMode>
                    value={monthlyMode}
                    onChange={(mode) => patch({
                      monthlyMode: mode,
                      byMonthDay: mode === 'dayOfMonth' ? start.getDate() : draft.byMonthDay,
                      bySetPos: mode === 'nthWeekday' ? (draft.bySetPos ?? nthOfMonth(start)) : draft.bySetPos,
                      byWeekday: mode === 'nthWeekday' ? [draft.byWeekday?.[0] ?? weekdayOf(start)] : draft.byWeekday,
                    })}
                    options={[
                      { id: 'dayOfMonth', label: t('monthlyModeShort_dayOfMonth') },
                      { id: 'nthWeekday', label: t('monthlyModeShort_nthWeekday') },
                      { id: 'lastDay', label: t('monthlyModeShort_lastDay') },
                    ]}
                  />
                  {/* The 31st simply has no match in a 30-day month; say so
                      rather than silently producing fewer cards than expected. */}
                  {monthlyMode === 'dayOfMonth' && (draft.byMonthDay ?? 1) > 28 && (
                    <p className="m-0 text-[10px] text-amber-400/80 leading-snug">
                      {t('monthDaySkipNote', { day: draft.byMonthDay ?? 1 })}
                    </p>
                  )}
                </div>
              )}

              {/* End condition */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-neutral-800">
                <span className="text-[11px] text-neutral-500">{t('endsLabel')}</span>
                <Segmented
                  value={endType}
                  onChange={(type) => {
                    if (type === 'never') patch({ end: { type: 'never' } });
                    else if (type === 'onDate') patch({ end: { type: 'onDate', date: draft.end.type === 'onDate' ? draft.end.date : defaultHorizon() } });
                    else patch({ end: { type: 'afterCount', count: draft.end.type === 'afterCount' ? draft.end.count : 10 } });
                  }}
                  options={[
                    { id: 'never', label: t('endsNever') },
                    { id: 'onDate', label: t('endsOn') },
                    { id: 'afterCount', label: t('endsAfter') },
                  ]}
                />

                {draft.end.type === 'onDate' && (
                  <input
                    type="date"
                    value={draft.end.date}
                    min={startDate}
                    onChange={(e) => patch({ end: { type: 'onDate', date: e.target.value || defaultHorizon() } })}
                    className="bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-[11px] text-neutral-100 focus:outline-none focus:border-neutral-600 scheme-dark"
                  />
                )}

                {draft.end.type === 'afterCount' && (
                  <div className="flex items-center gap-1.5">
                    <Stepper
                      value={draft.end.count}
                      min={1}
                      max={500}
                      onChange={(count) => patch({ end: { type: 'afterCount', count } })}
                      decreaseLabel={t('decrease')}
                      increaseLabel={t('increase')}
                    />
                    <span className="text-[11px] text-neutral-500">{t('occurrences')}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-neutral-800 shrink-0">
          {onRemove ? (
            <button
              onClick={onRemove}
              className="text-[11px] font-medium text-red-400 hover:text-red-300 px-2 py-1.5 rounded-md hover:bg-red-500/10 transition-colors"
            >
              {t('removeRepeat')}
            </button>
          ) : <span />}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-750 rounded-lg transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              onClick={() => onSave({ ...draft, startDate })}
              disabled={preset === 'none'}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:hover:bg-blue-500 rounded-lg transition-colors"
            >
              {t('save')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
