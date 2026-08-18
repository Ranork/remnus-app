import type { RecurrenceRule, Weekday } from './rule';
import { normalizeRule, parseYMD, WEEKDAYS } from './rule';

// Natural-language rendering of a rule — "Every 2 weeks on Tue and Thu, until
// 12 Dec 2026". This is the single thing that makes a complex rule feel simple,
// so it is shared by the repeat picker, the card tooltip and the series panel
// rather than being re-derived in each.
//
// Composed from small ICU messages instead of one message per rule shape: the
// combinations multiply (4 frequencies × 3 monthly modes × 3 end conditions),
// and 8 locales × that matrix is not something anyone would keep correct.

export type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

/** Locale-aware weekday names, derived from Intl rather than 8 × 7 message keys. */
export function weekdayLabels(locale: string, style: 'short' | 'long' = 'short'): Record<Weekday, string> {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: style });
  // 2024-01-01 is a Monday, matching WEEKDAYS' Monday-first order.
  const base = Date.UTC(2024, 0, 1);
  const out = {} as Record<Weekday, string>;
  WEEKDAYS.forEach((wd, i) => {
    out[wd] = fmt.format(new Date(base + i * 86_400_000));
  });
  return out;
}

function formatDate(date: string, locale: string): string {
  const d = parseYMD(date);
  if (!d) return date;
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function listFormat(items: string[], locale: string): string {
  // `Intl.ListFormat` handles "Tue, Thu and Fri" vs "Sal, Perş ve Cum" per
  // locale; the join fallback keeps this working in any runtime lacking it.
  try {
    return new Intl.ListFormat(locale, { style: 'short', type: 'conjunction' }).format(items);
  } catch {
    return items.join(', ');
  }
}

/**
 * One-line description of a rule.
 *
 * `t` must resolve the `Recurrence` namespace. Returns an empty string for a
 * rule that cannot be normalized, so callers can treat "" as "no repeat".
 */
export function formatRuleSummary(
  rule: RecurrenceRule | null | undefined,
  t: TranslateFn,
  locale: string,
): string {
  const r = normalizeRule(rule);
  if (!r) return '';

  const n = r.interval;
  const days = weekdayLabels(locale);

  let base: string;
  let detail = '';

  switch (r.freq) {
    case 'daily':
      base = n === 1 ? t('sumEveryDay') : t('sumEveryNDays', { count: n });
      break;

    case 'weekly': {
      base = n === 1 ? t('sumEveryWeek') : t('sumEveryNWeeks', { count: n });
      const selected = (r.byWeekday ?? []).map((wd) => days[wd]);
      if (selected.length > 0) detail = t('sumOnDays', { days: listFormat(selected, locale) });
      break;
    }

    case 'monthly': {
      base = n === 1 ? t('sumEveryMonth') : t('sumEveryNMonths', { count: n });
      if (r.monthlyMode === 'lastDay') {
        detail = t('sumOnLastDay');
      } else if (r.monthlyMode === 'nthWeekday') {
        const weekday = days[r.byWeekday?.[0] ?? 'MO'];
        const nth = r.bySetPos === -1 ? t('nthLast') : t(`nth${r.bySetPos ?? 1}`);
        detail = t('sumOnNthWeekday', { nth, weekday });
      } else {
        detail = t('sumOnMonthDay', { day: r.byMonthDay ?? 1 });
      }
      break;
    }

    case 'yearly':
      base = n === 1 ? t('sumEveryYear') : t('sumEveryNYears', { count: n });
      break;
  }

  let out = detail ? `${base}, ${detail}` : base;

  if (r.end.type === 'onDate') {
    out = `${out} · ${t('sumUntil', { date: formatDate(r.end.date, locale) })}`;
  } else if (r.end.type === 'afterCount') {
    out = `${out} · ${t('sumCount', { count: r.end.count })}`;
  }

  return out;
}
