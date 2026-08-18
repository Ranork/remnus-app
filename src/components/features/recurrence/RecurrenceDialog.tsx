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

// The repeat editor: a preset list for the rhythms people actually pick, and a
// custom builder behind them for everything else. Deliberately NOT folded into
// `DateRangePicker` — that popover is 288px wide and closes on any outside
// mousedown, which fights a multi-control form.

type PresetId =
  | 'none' | 'daily' | 'weekdays' | 'weekly' | 'biweekly'
  | 'monthly' | 'monthlyNth' | 'yearly' | 'custom';

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
 *  on the row the user originally picked instead of always on "Custom". */
function matchPreset(rule: RecurrenceRule | null, startDate: string): PresetId {
  if (!rule) return 'none';
  for (const preset of ['daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'monthlyNth', 'yearly'] as const) {
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
  const summary = useMemo(
    () => (preset === 'none' ? '' : formatRuleSummary(draft, t as never, locale)),
    [draft, preset, t, locale],
  );

  // How many cards this rule would actually create in the materialization
  // window — the guardrail against casually picking "every day, forever".
  const preview = useMemo(() => {
    if (preset === 'none') return 0;
    return countOccurrences(draft, startDate, defaultHorizon());
  }, [draft, preset, startDate]);

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
    patch({ byWeekday: next.length > 0 ? next : [wd] });
  };

  const presets: PresetId[] = ['none', 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'monthlyNth', 'yearly', 'custom'];
  const showCustom = preset === 'custom';

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
        className="w-full max-w-full sm:max-w-md max-h-full bg-neutral-850 border border-neutral-800 rounded-lg modal-shadow flex flex-col overflow-hidden animate-scale-in"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-neutral-800 bg-neutral-900/30 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Repeat size={14} className="text-blue-400" />
            </div>
            <h2 className="m-0 text-sm font-semibold text-neutral-100 truncate">{t('title')}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t('cancel')}
            className="shrink-0 p-1.5 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* Presets */}
          <div className="flex flex-col">
            {presets.map((id) => (
              <label
                key={id}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                  preset === id ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:bg-neutral-800/50'
                }`}
              >
                <input
                  type="radio"
                  name="recurrence-preset"
                  checked={preset === id}
                  onChange={() => choosePreset(id)}
                  className="accent-blue-500"
                />
                <span className="text-xs">{t(`preset_${id}`)}</span>
              </label>
            ))}
          </div>

          {/* Custom builder */}
          {showCustom && (
            <div className="flex flex-col gap-3 pt-3 border-t border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-neutral-500 shrink-0">{t('every')}</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={draft.interval}
                  onChange={(e) => patch({ interval: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-14 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-100 focus:outline-none focus:border-neutral-500"
                />
                <select
                  value={draft.freq}
                  onChange={(e) => patch({ freq: e.target.value as RecurrenceFreq })}
                  className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-100 focus:outline-none focus:border-neutral-500"
                >
                  <option value="daily">{t('unit_daily')}</option>
                  <option value="weekly">{t('unit_weekly')}</option>
                  <option value="monthly">{t('unit_monthly')}</option>
                  <option value="yearly">{t('unit_yearly')}</option>
                </select>
              </div>

              {draft.freq === 'weekly' && (
                <div className="flex flex-wrap gap-1">
                  {WEEKDAYS.map((wd) => {
                    const active = (draft.byWeekday ?? [weekdayOf(start)]).includes(wd);
                    return (
                      <button
                        key={wd}
                        type="button"
                        onClick={() => toggleWeekday(wd)}
                        className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                          active
                            ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                            : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        {dayNames[wd]}
                      </button>
                    );
                  })}
                </div>
              )}

              {draft.freq === 'monthly' && (
                <div className="flex flex-col gap-1">
                  {(['dayOfMonth', 'nthWeekday', 'lastDay'] as MonthlyMode[]).map((mode) => (
                    <label key={mode} className="flex items-center gap-2.5 px-2 py-1 rounded cursor-pointer text-neutral-400 hover:bg-neutral-800/50">
                      <input
                        type="radio"
                        name="monthly-mode"
                        checked={(draft.monthlyMode ?? 'dayOfMonth') === mode}
                        onChange={() => patch({
                          monthlyMode: mode,
                          byMonthDay: mode === 'dayOfMonth' ? start.getDate() : draft.byMonthDay,
                          bySetPos: mode === 'nthWeekday' ? (draft.bySetPos ?? nthOfMonth(start)) : draft.bySetPos,
                          byWeekday: mode === 'nthWeekday' ? [draft.byWeekday?.[0] ?? weekdayOf(start)] : draft.byWeekday,
                        })}
                        className="accent-blue-500"
                      />
                      <span className="text-xs">{t(`monthlyMode_${mode}`)}</span>
                    </label>
                  ))}
                  {/* The 31st simply has no match in a 30-day month; say so
                      rather than silently producing fewer cards than expected. */}
                  {(draft.monthlyMode ?? 'dayOfMonth') === 'dayOfMonth' && (draft.byMonthDay ?? 1) > 28 && (
                    <p className="m-0 px-2 text-[10px] text-amber-400/80 leading-snug">
                      {t('monthDaySkipNote', { day: draft.byMonthDay ?? 1 })}
                    </p>
                  )}
                </div>
              )}

              {/* End condition */}
              <div className="flex flex-col gap-1 pt-2 border-t border-neutral-800">
                <span className="text-[11px] text-neutral-500 px-2">{t('endsLabel')}</span>

                <label className="flex items-center gap-2.5 px-2 py-1 rounded cursor-pointer text-neutral-400 hover:bg-neutral-800/50">
                  <input
                    type="radio"
                    name="recurrence-end"
                    checked={draft.end.type === 'never'}
                    onChange={() => patch({ end: { type: 'never' } })}
                    className="accent-blue-500"
                  />
                  <span className="text-xs">{t('endsNever')}</span>
                </label>

                <label className="flex items-center gap-2.5 px-2 py-1 rounded cursor-pointer text-neutral-400 hover:bg-neutral-800/50">
                  <input
                    type="radio"
                    name="recurrence-end"
                    checked={draft.end.type === 'onDate'}
                    onChange={() => patch({
                      end: {
                        type: 'onDate',
                        date: draft.end.type === 'onDate' ? draft.end.date : defaultHorizon(),
                      },
                    })}
                    className="accent-blue-500"
                  />
                  <span className="text-xs shrink-0">{t('endsOn')}</span>
                  <input
                    type="date"
                    value={draft.end.type === 'onDate' ? draft.end.date : ''}
                    min={startDate}
                    onChange={(e) => patch({ end: { type: 'onDate', date: e.target.value || defaultHorizon() } })}
                    disabled={draft.end.type !== 'onDate'}
                    className="bg-neutral-800 border border-neutral-700 rounded px-2 py-0.5 text-[11px] text-neutral-100 focus:outline-none focus:border-neutral-500 disabled:opacity-40 scheme-dark"
                  />
                </label>

                <label className="flex items-center gap-2.5 px-2 py-1 rounded cursor-pointer text-neutral-400 hover:bg-neutral-800/50">
                  <input
                    type="radio"
                    name="recurrence-end"
                    checked={draft.end.type === 'afterCount'}
                    onChange={() => patch({
                      end: { type: 'afterCount', count: draft.end.type === 'afterCount' ? draft.end.count : 10 },
                    })}
                    className="accent-blue-500"
                  />
                  <span className="text-xs shrink-0">{t('endsAfter')}</span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={draft.end.type === 'afterCount' ? draft.end.count : 10}
                    onChange={(e) => patch({ end: { type: 'afterCount', count: Math.max(1, Number(e.target.value) || 1) } })}
                    disabled={draft.end.type !== 'afterCount'}
                    className="w-14 bg-neutral-800 border border-neutral-700 rounded px-2 py-0.5 text-[11px] text-neutral-100 focus:outline-none focus:border-neutral-500 disabled:opacity-40"
                  />
                  <span className="text-[11px] text-neutral-500">{t('occurrences')}</span>
                </label>
              </div>
            </div>
          )}

          {/* Live summary + how many cards this actually creates */}
          {preset !== 'none' && (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/30 px-3.5 py-2.5">
              <p className="m-0 text-xs text-neutral-200 leading-snug">{summary}</p>
              <p className="m-0 mt-1 text-[10px] text-neutral-500">
                {t('previewCount', { count: preview, days: DEFAULT_HORIZON_DAYS })}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-neutral-800 bg-neutral-900/30 shrink-0">
          {onRemove ? (
            <button
              onClick={onRemove}
              className="text-[11px] font-medium text-red-400 hover:text-red-300 px-2 py-1.5 rounded hover:bg-neutral-800 transition-colors"
            >
              {t('removeRepeat')}
            </button>
          ) : <span />}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
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
