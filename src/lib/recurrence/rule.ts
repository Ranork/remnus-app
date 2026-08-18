// ── Recurrence rule model + expansion engine ──────────────────────────────────
//
// An RFC 5545 (RRULE) subset, stored as JSON rather than an RRULE string: the
// rest of the codebase already keeps structured data as JSON columns
// (`pages.properties`, `databases.schema`, `databases.views`), and JSON is what
// an MCP client can read and write without a parser. The engine below is ~250
// lines of pure functions, which is why there is no `rrule` dependency.
//
// Everything here is local wall-clock and date-only (`YYYY-MM-DD`). Time of day
// lives on the template's date value, not on the rule — so a 09:00 series stays
// 09:00 across a DST boundary, which is what people mean by "every morning".
//
// See `.ai/RECURRENCE_DESIGN.md` for the model and the THISANDFUTURE semantics
// the actions layer builds on top of this.

export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly';

/** How a monthly rule picks its day: the 15th / the 3rd Tuesday / the last day. */
export type MonthlyMode = 'dayOfMonth' | 'nthWeekday' | 'lastDay';

export type RecurrenceEnd =
  | { type: 'never' }
  | { type: 'onDate'; date: string }
  | { type: 'afterCount'; count: number };

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  /** 1 = every, 2 = every other, ... Always >= 1. */
  interval: number;
  /** weekly: which days fire. Defaults to the weekday of `startDate`. */
  byWeekday?: Weekday[];
  monthlyMode?: MonthlyMode;
  /** monthly `dayOfMonth` / yearly: 1-31. Defaults to `startDate`'s day. */
  byMonthDay?: number;
  /** monthly `nthWeekday`: 1..4 = first..fourth, -1 = last. */
  bySetPos?: -1 | 1 | 2 | 3 | 4;
  /** yearly: 1-12. Defaults to `startDate`'s month. */
  byMonth?: number;
  /** Roll an occurrence that lands on a weekend to the adjacent weekday. */
  skipWeekends?: 'none' | 'next' | 'prev';
  end: RecurrenceEnd;
  /** DTSTART, `YYYY-MM-DD`. The first candidate occurrence. */
  startDate: string;
  /** EXDATE: occurrences deleted one-by-one; never regenerated. */
  exDates?: string[];
  /** IANA zone, recorded for future server-side jobs. The engine ignores it. */
  timezone?: string;
}

export const WEEKDAYS: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

/** Per-series ceiling on materialized rows — same order of magnitude as the
 *  existing `MAX_BULK_ROWS = 500` cap on bulk row creation. */
export const MAX_OCCURRENCES_PER_SERIES = 500;

/** How far past today a series is materialized when nothing asks for more. */
export const DEFAULT_HORIZON_DAYS = 90;

/** Belt-and-braces stop for the candidate loop, so a pathological rule
 *  (e.g. `byMonthDay: 31` monthly, which legitimately skips most months)
 *  can never spin forever. */
const MAX_CANDIDATE_STEPS = 4000;

// ── date helpers (local wall-clock, date-only) ────────────────────────────────

export function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parses `YYYY-MM-DD` (and tolerates a trailing `THH:mm`) into a local Date at
 *  midnight. Returns null on anything unparseable — callers treat that as "no
 *  recurrence" rather than throwing, since these values come from user data. */
export function parseYMD(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function daysBetween(a: string, b: string): number {
  const da = parseYMD(a);
  const db = parseYMD(b);
  if (!da || !db) return 0;
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** JS `getDay()` (0 = Sunday) → our Monday-first Weekday code. */
export function weekdayOf(d: Date): Weekday {
  return WEEKDAYS[(d.getDay() + 6) % 7];
}

function weekdayIndex(w: Weekday): number {
  return WEEKDAYS.indexOf(w);
}

/** Monday of the week containing `d`. Weeks are Monday-first for interval
 *  counting regardless of the user's display preference — otherwise "every 2
 *  weeks" would drift depending on a view setting. */
function startOfWeek(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7));
}

// ── date-property value helpers ───────────────────────────────────────────────
//
// A calendar card's date property is one of:
//   `YYYY-MM-DD`  ·  `YYYY-MM-DDTHH:mm`  ·  `start/end` (either side may carry a time)
// A series repeats the *shape* — time of day and duration — not the literal end
// date, so these two helpers are what materialization uses to re-stamp a
// template value onto a new occurrence date.

export interface DateValueShape {
  startDate: string;
  /** `HH:mm` when the value carried a time, else null. */
  time: string | null;
  /** Whole days between start and end for a range value; 0 for a single date. */
  durationDays: number;
}

export function parseDateValue(value: unknown): DateValueShape | null {
  if (typeof value !== 'string' || !value) return null;
  const [rawStart, rawEnd] = value.includes('/') ? value.split('/') : [value, ''];
  const start = parseYMD(rawStart);
  if (!start) return null;

  const timeMatch = /T(\d{2}:\d{2})/.exec(rawStart);
  const end = rawEnd ? parseYMD(rawEnd) : null;

  return {
    startDate: formatYMD(start),
    time: timeMatch ? timeMatch[1] : null,
    durationDays: end ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000)) : 0,
  };
}

export function buildDateValue(occurrenceDate: string, shape: DateValueShape): string {
  const start = parseYMD(occurrenceDate);
  if (!start) return occurrenceDate;
  let result = occurrenceDate;
  if (shape.time) result = `${occurrenceDate}T${shape.time}`;
  if (shape.durationDays > 0) result = `${result}/${formatYMD(addDays(start, shape.durationDays))}`;
  return result;
}

// ── rule normalization ────────────────────────────────────────────────────────

/** Fills in every default a rule can omit, so the engine and the summary text
 *  never have to re-derive them. Returns null when the rule is unusable. */
export function normalizeRule(rule: RecurrenceRule | null | undefined): RecurrenceRule | null {
  if (!rule) return null;
  const start = parseYMD(rule.startDate);
  if (!start) return null;

  const interval = Number.isFinite(rule.interval) ? Math.max(1, Math.floor(rule.interval)) : 1;
  const normalized: RecurrenceRule = {
    ...rule,
    interval,
    startDate: formatYMD(start),
    end: rule.end ?? { type: 'never' },
    exDates: rule.exDates ?? [],
    skipWeekends: rule.skipWeekends ?? 'none',
  };

  if (rule.freq === 'weekly') {
    const days = (rule.byWeekday ?? []).filter((d) => WEEKDAYS.includes(d));
    normalized.byWeekday = days.length > 0
      ? [...new Set(days)].sort((a, b) => weekdayIndex(a) - weekdayIndex(b))
      : [weekdayOf(start)];
  }

  if (rule.freq === 'monthly') {
    normalized.monthlyMode = rule.monthlyMode ?? 'dayOfMonth';
    if (normalized.monthlyMode === 'dayOfMonth') {
      normalized.byMonthDay = clampDayOfMonth(rule.byMonthDay ?? start.getDate());
    } else if (normalized.monthlyMode === 'nthWeekday') {
      normalized.bySetPos = rule.bySetPos ?? nthWeekdayOfMonth(start);
      normalized.byWeekday = [rule.byWeekday?.[0] ?? weekdayOf(start)];
    }
  }

  if (rule.freq === 'yearly') {
    normalized.byMonth = clampMonth(rule.byMonth ?? start.getMonth() + 1);
    normalized.byMonthDay = clampDayOfMonth(rule.byMonthDay ?? start.getDate());
  }

  if (normalized.end.type === 'afterCount') {
    normalized.end = {
      type: 'afterCount',
      count: Math.max(1, Math.min(MAX_OCCURRENCES_PER_SERIES, Math.floor(normalized.end.count))),
    };
  }

  return normalized;
}

function clampDayOfMonth(n: number): number {
  return Math.max(1, Math.min(31, Math.floor(n)));
}

function clampMonth(n: number): number {
  return Math.max(1, Math.min(12, Math.floor(n)));
}

/** "This date is the Nth <weekday> of its month" — 1..5. */
function nthWeekdayOfMonth(d: Date): 1 | 2 | 3 | 4 {
  const nth = Math.ceil(d.getDate() / 7);
  return (nth > 4 ? 4 : nth) as 1 | 2 | 3 | 4;
}

// ── expansion ─────────────────────────────────────────────────────────────────

export interface ExpandOptions {
  /** Inclusive lower bound. Occurrences before it are still counted against
   *  `afterCount` (RFC semantics) but not returned. Defaults to the rule start. */
  from?: string;
  /** Inclusive upper bound. Required — expansion is always windowed. */
  to: string;
  /** Max dates to return. Defaults to `MAX_OCCURRENCES_PER_SERIES`. */
  limit?: number;
}

/**
 * Expands a rule into concrete `YYYY-MM-DD` occurrence dates.
 *
 * Windowed by design: there is no "give me everything" mode, because a
 * `{ freq: 'daily', end: { type: 'never' } }` rule has no end. Callers pass the
 * horizon they intend to materialize.
 */
export function expandOccurrences(
  rule: RecurrenceRule | null | undefined,
  opts: ExpandOptions,
): string[] {
  const r = normalizeRule(rule);
  if (!r) return [];

  const to = parseYMD(opts.to);
  if (!to) return [];
  const from = parseYMD(opts.from ?? r.startDate) ?? parseYMD(r.startDate)!;
  const limit = Math.min(opts.limit ?? MAX_OCCURRENCES_PER_SERIES, MAX_OCCURRENCES_PER_SERIES);

  const until = r.end.type === 'onDate' ? parseYMD(r.end.date) : null;
  const maxCount = r.end.type === 'afterCount' ? r.end.count : Infinity;
  const exDates = new Set(r.exDates ?? []);

  // `skipWeekends: 'prev'` can move an occurrence up to two days *earlier*, so
  // the shifted stream is only near-sorted. Stopping the scan the instant a
  // candidate passes `to` would drop a Sunday-that-became-Friday sitting right
  // at the window edge; scan a few days past the edge and filter instead.
  const scanCutoff = to.getTime() + 3 * 86_400_000;

  const out: string[] = [];
  let generated = 0; // counts pre-EXDATE occurrences, per RFC COUNT semantics

  for (const candidate of candidateDates(r)) {
    if (generated >= maxCount) break;
    if (until && candidate.getTime() > until.getTime()) break;
    if (candidate.getTime() > scanCutoff) break;

    generated += 1;

    if (candidate.getTime() > to.getTime()) continue;

    const ymd = formatYMD(candidate);
    if (exDates.has(ymd)) continue;
    if (candidate.getTime() < from.getTime()) continue;

    out.push(ymd);
    if (out.length >= limit) break;
  }

  return out.sort();
}

/**
 * Lazily yields every candidate date the rule produces, in ascending order,
 * starting at `startDate`. Weekend-shifting is applied here, and shifted dates
 * are de-duplicated (Sat→Mon and Sun→Mon can collide).
 */
function* candidateDates(r: RecurrenceRule): Generator<Date> {
  const start = parseYMD(r.startDate)!;
  const seen = new Set<string>();
  let steps = 0;

  for (const raw of rawCandidates(r, start)) {
    if (++steps > MAX_CANDIDATE_STEPS) return;
    const shifted = applyWeekendSkip(raw, r.skipWeekends ?? 'none');
    if (!shifted) continue;
    const key = formatYMD(shifted);
    if (seen.has(key)) continue;
    seen.add(key);
    yield shifted;
  }
}

function* rawCandidates(r: RecurrenceRule, start: Date): Generator<Date> {
  // The loops below are unbounded by design (a `never`-ending rule has no last
  // occurrence) and the consumer stops them. But a rule can also *skip* every
  // period without ever yielding — `{freq:'yearly', byMonth:2, byMonthDay:30}`
  // is the clean example — so the step budget has to be counted here, on
  // periods considered, not only in `candidateDates` on values produced.
  let periods = 0;
  const budgetExhausted = () => ++periods > MAX_CANDIDATE_STEPS;

  switch (r.freq) {
    case 'daily': {
      for (let i = 0; ; i += 1) {
        if (budgetExhausted()) return;
        yield addDays(start, i * r.interval);
      }
    }
    case 'weekly': {
      const days = (r.byWeekday ?? [weekdayOf(start)]).map(weekdayIndex).sort((a, b) => a - b);
      const anchor = startOfWeek(start);
      for (let w = 0; ; w += 1) {
        if (budgetExhausted()) return;
        const weekStart = addDays(anchor, w * r.interval * 7);
        for (const dayIdx of days) {
          const d = addDays(weekStart, dayIdx);
          // The first week can contain days before DTSTART — skip those rather
          // than emitting occurrences the user never asked for.
          if (d.getTime() >= start.getTime()) yield d;
        }
      }
    }
    case 'monthly': {
      for (let m = 0; ; m += 1) {
        if (budgetExhausted()) return;
        const cursor = new Date(start.getFullYear(), start.getMonth() + m * r.interval, 1);
        const d = monthlyDate(r, cursor.getFullYear(), cursor.getMonth());
        // `null` = this month legitimately has no matching day (the 31st of a
        // 30-day month, a 5th Friday that doesn't exist). RFC behavior is to
        // skip the month, not to clamp — `monthlyMode: 'lastDay'` is the
        // explicit opt-in for clamping.
        if (d && d.getTime() >= start.getTime()) yield d;
      }
    }
    case 'yearly': {
      const month = (r.byMonth ?? start.getMonth() + 1) - 1;
      const day = r.byMonthDay ?? start.getDate();
      for (let y = 0; ; y += 1) {
        if (budgetExhausted()) return;
        const year = start.getFullYear() + y * r.interval;
        // Feb 29 in a non-leap year: skip, same rule as monthly.
        if (day > daysInMonth(year, month)) continue;
        const d = new Date(year, month, day);
        if (d.getTime() >= start.getTime()) yield d;
      }
    }
  }
}

function monthlyDate(r: RecurrenceRule, year: number, month: number): Date | null {
  const mode = r.monthlyMode ?? 'dayOfMonth';

  if (mode === 'lastDay') {
    return new Date(year, month, daysInMonth(year, month));
  }

  if (mode === 'nthWeekday') {
    const target = weekdayIndex(r.byWeekday?.[0] ?? 'MO');
    const pos = r.bySetPos ?? 1;
    if (pos === -1) {
      const last = new Date(year, month, daysInMonth(year, month));
      const delta = ((last.getDay() + 6) % 7) - target;
      return addDays(last, delta >= 0 ? -delta : -(delta + 7));
    }
    const first = new Date(year, month, 1);
    const delta = target - ((first.getDay() + 6) % 7);
    const day = 1 + (delta >= 0 ? delta : delta + 7) + (pos - 1) * 7;
    return day <= daysInMonth(year, month) ? new Date(year, month, day) : null;
  }

  const day = r.byMonthDay ?? 1;
  return day <= daysInMonth(year, month) ? new Date(year, month, day) : null;
}

function applyWeekendSkip(d: Date, mode: 'none' | 'next' | 'prev'): Date | null {
  if (mode === 'none') return d;
  const dow = d.getDay(); // 0 = Sun, 6 = Sat
  if (dow !== 0 && dow !== 6) return d;
  if (mode === 'next') return addDays(d, dow === 6 ? 2 : 1);
  return addDays(d, dow === 6 ? -1 : -2);
}

// ── convenience ───────────────────────────────────────────────────────────────

/** The first occurrence strictly after `date`, or null within the horizon. */
export function nextOccurrenceAfter(
  rule: RecurrenceRule,
  date: string,
  horizonDays = 366,
): string | null {
  const from = parseYMD(date);
  if (!from) return null;
  const dates = expandOccurrences(rule, {
    from: formatYMD(addDays(from, 1)),
    to: formatYMD(addDays(from, horizonDays)),
    limit: 1,
  });
  return dates[0] ?? null;
}

/** Closes a series the day before `date` — the THISANDFUTURE split's first half. */
export function endRuleBefore(rule: RecurrenceRule, date: string): RecurrenceRule {
  const d = parseYMD(date);
  if (!d) return rule;
  return { ...rule, end: { type: 'onDate', date: formatYMD(addDays(d, -1)) } };
}

/** The horizon a series should be materialized to, given "now". */
export function defaultHorizon(now: Date = new Date()): string {
  return formatYMD(addDays(now, DEFAULT_HORIZON_DAYS));
}

/** How many rows a rule would create between two dates — powers the "this will
 *  create N cards" preview before the user commits to `every day, forever`. */
export function countOccurrences(rule: RecurrenceRule, from: string, to: string): number {
  return expandOccurrences(rule, { from, to, limit: MAX_OCCURRENCES_PER_SERIES }).length;
}
