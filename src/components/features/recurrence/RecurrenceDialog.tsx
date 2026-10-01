'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {/* Live answer, up top where it gets read — not a footnote. */}
          {preset !== 'none' && (
            <div className="rounded-control bg-raised px-4 py-3 shadow-[inset_0_0_0_1px_var(--color-line)]">
              <p className="m-0 text-ui font-medium text-fg leading-snug">{summary}</p>
              <p className="m-0 mt-1 text-xs text-fg-3">
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
            <div className="flex flex-col gap-4 rounded-control bg-raised p-4 shadow-[inset_0_0_0_1px_var(--color-line)]">
              {/* Frequency + interval */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-fg-3">{t('every')}</span>
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
                        className={`size-9 cursor-pointer rounded-full text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-ink text-ink-fg'
                            : 'bg-sheet text-fg-3 shadow-[inset_0_0_0_1px_var(--color-line)] hover:text-fg hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]'
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
                    <p className="m-0 text-xs text-fg-3 leading-snug">
                      {t('monthDaySkipNote', { day: draft.byMonthDay ?? 1 })}
                    </p>
                  )}
                </div>
              )}

              {/* End condition */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-line">
                <span className="text-xs text-fg-3">{t('endsLabel')}</span>
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
                  <Input
                    size="sm"
                    type="date"
                    value={draft.end.date}
                    min={startDate}
                    onChange={(e) => patch({ end: { type: 'onDate', date: e.target.value || defaultHorizon() } })}
                    aria-label={t('endsOn')}
                    className="w-auto scheme-dark"
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
                    <span className="text-xs text-fg-3">{t('occurrences')}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter className="justify-between">
          {onRemove ? (
            <Button variant="ghost" onClick={onRemove} className="text-red-400 hover:bg-red-500/10 hover:text-red-400">
              {t('removeRepeat')}
            </Button>
          ) : <span />}

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button variant="primary" onClick={() => onSave({ ...draft, startDate })} disabled={preset === 'none'}>
              {t('save')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
