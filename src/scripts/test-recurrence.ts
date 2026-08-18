/**
 * Recurrence engine regression test — `npm run test:recurrence`.
 *
 * Pure functions only: no DB, no network, no fixtures on disk. Covers the
 * cases `.ai/RECURRENCE_DESIGN.md` calls out as the ones that actually bite
 * (month-length skips, leap years, COUNT vs EXDATE ordering, weekend shifting,
 * and the THISANDFUTURE split), plus the non-terminating-rule guard.
 */
import assert from 'node:assert/strict';
import {
  buildDateValue,
  countOccurrences,
  endRuleBefore,
  expandOccurrences,
  nextOccurrenceAfter,
  normalizeRule,
  parseDateValue,
  type RecurrenceRule,
} from '@/lib/recurrence/rule';

function rule(partial: Partial<RecurrenceRule> & Pick<RecurrenceRule, 'freq' | 'startDate'>): RecurrenceRule {
  return { interval: 1, end: { type: 'never' }, ...partial };
}

let checks = 0;
function check(name: string, fn: () => void) {
  fn();
  checks += 1;
  console.log(`  ok  ${name}`);
}

console.log('Recurrence engine');

// ── daily ─────────────────────────────────────────────────────────────────────

check('every day', () => {
  const out = expandOccurrences(rule({ freq: 'daily', startDate: '2026-08-10' }), { to: '2026-08-14' });
  assert.deepEqual(out, ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14']);
});

check('every other day', () => {
  const out = expandOccurrences(rule({ freq: 'daily', interval: 2, startDate: '2026-08-10' }), { to: '2026-08-16' });
  assert.deepEqual(out, ['2026-08-10', '2026-08-12', '2026-08-14', '2026-08-16']);
});

check('COUNT stops the series', () => {
  const out = expandOccurrences(
    rule({ freq: 'daily', startDate: '2026-08-10', end: { type: 'afterCount', count: 3 } }),
    { to: '2026-12-31' },
  );
  assert.deepEqual(out, ['2026-08-10', '2026-08-11', '2026-08-12']);
});

check('UNTIL stops the series (inclusive)', () => {
  const out = expandOccurrences(
    rule({ freq: 'daily', startDate: '2026-08-10', end: { type: 'onDate', date: '2026-08-12' } }),
    { to: '2026-12-31' },
  );
  assert.deepEqual(out, ['2026-08-10', '2026-08-11', '2026-08-12']);
});

check('EXDATE removes an occurrence without shortening a COUNT series', () => {
  // RFC semantics: COUNT counts generated occurrences, so deleting one single
  // occurrence must NOT pull an extra one in from the future to backfill it.
  const out = expandOccurrences(
    rule({
      freq: 'daily',
      startDate: '2026-08-10',
      end: { type: 'afterCount', count: 3 },
      exDates: ['2026-08-11'],
    }),
    { to: '2026-12-31' },
  );
  assert.deepEqual(out, ['2026-08-10', '2026-08-12']);
});

// ── weekly ────────────────────────────────────────────────────────────────────

check('weekly defaults to the start date weekday', () => {
  // 2026-08-10 is a Monday.
  const out = expandOccurrences(rule({ freq: 'weekly', startDate: '2026-08-10' }), { to: '2026-08-31' });
  assert.deepEqual(out, ['2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31']);
});

check('weekly on several weekdays', () => {
  const out = expandOccurrences(
    rule({ freq: 'weekly', startDate: '2026-08-10', byWeekday: ['MO', 'WE', 'FR'] }),
    { to: '2026-08-21' },
  );
  assert.deepEqual(out, [
    '2026-08-10', '2026-08-12', '2026-08-14',
    '2026-08-17', '2026-08-19', '2026-08-21',
  ]);
});

check('every other week keeps its phase', () => {
  const out = expandOccurrences(
    rule({ freq: 'weekly', interval: 2, startDate: '2026-08-10', byWeekday: ['MO'] }),
    { to: '2026-09-30' },
  );
  assert.deepEqual(out, ['2026-08-10', '2026-08-24', '2026-09-07', '2026-09-21']);
});

check('weekly never emits days before DTSTART in the first week', () => {
  // Start Wednesday, rule includes Monday — the Monday of that same week is
  // before the start date and must not appear.
  const out = expandOccurrences(
    rule({ freq: 'weekly', startDate: '2026-08-12', byWeekday: ['MO', 'WE'] }),
    { to: '2026-08-19' },
  );
  assert.deepEqual(out, ['2026-08-12', '2026-08-17', '2026-08-19']);
});

// ── monthly ───────────────────────────────────────────────────────────────────

check('monthly on the 31st SKIPS short months (RFC behavior, not clamping)', () => {
  const out = expandOccurrences(
    rule({ freq: 'monthly', startDate: '2026-01-31', monthlyMode: 'dayOfMonth', byMonthDay: 31 }),
    { to: '2026-05-31' },
  );
  assert.deepEqual(out, ['2026-01-31', '2026-03-31', '2026-05-31']);
});

check('monthly lastDay clamps to each month end', () => {
  const out = expandOccurrences(
    rule({ freq: 'monthly', startDate: '2026-01-31', monthlyMode: 'lastDay' }),
    { to: '2026-04-30' },
  );
  assert.deepEqual(out, ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
});

check('monthly nth weekday — 3rd Tuesday', () => {
  const out = expandOccurrences(
    rule({ freq: 'monthly', startDate: '2026-08-18', monthlyMode: 'nthWeekday', bySetPos: 3, byWeekday: ['TU'] }),
    { to: '2026-11-30' },
  );
  assert.deepEqual(out, ['2026-08-18', '2026-09-15', '2026-10-20', '2026-11-17']);
});

check('monthly last weekday — last Friday', () => {
  const out = expandOccurrences(
    rule({ freq: 'monthly', startDate: '2026-08-28', monthlyMode: 'nthWeekday', bySetPos: -1, byWeekday: ['FR'] }),
    { to: '2026-11-30' },
  );
  assert.deepEqual(out, ['2026-08-28', '2026-09-25', '2026-10-30', '2026-11-27']);
});

// ── yearly ────────────────────────────────────────────────────────────────────

check('yearly repeats the start date', () => {
  const out = expandOccurrences(rule({ freq: 'yearly', startDate: '2026-08-18' }), { to: '2029-12-31' });
  assert.deepEqual(out, ['2026-08-18', '2027-08-18', '2028-08-18', '2029-08-18']);
});

check('Feb 29 yearly skips non-leap years', () => {
  const out = expandOccurrences(rule({ freq: 'yearly', startDate: '2028-02-29' }), { to: '2040-12-31' });
  assert.deepEqual(out, ['2028-02-29', '2032-02-29', '2036-02-29', '2040-02-29']);
});

check('a rule that can never fire terminates instead of hanging', () => {
  // Feb 30 does not exist in any year — the generator must exhaust its step
  // budget and return, not spin forever.
  const out = expandOccurrences(
    rule({ freq: 'yearly', startDate: '2026-01-01', byMonth: 2, byMonthDay: 30 }),
    { to: '2200-12-31' },
  );
  assert.deepEqual(out, []);
});

// ── weekend skipping ──────────────────────────────────────────────────────────

check('skipWeekends:next rolls Sat/Sun forward to Monday and dedupes', () => {
  // 2026-08-15 Sat, 2026-08-16 Sun → both roll to Mon 2026-08-17, one card.
  const out = expandOccurrences(
    rule({ freq: 'daily', startDate: '2026-08-14', skipWeekends: 'next' }),
    { to: '2026-08-18' },
  );
  assert.deepEqual(out, ['2026-08-14', '2026-08-17', '2026-08-18']);
});

check('skipWeekends:prev keeps the window edge sorted', () => {
  const out = expandOccurrences(
    rule({ freq: 'daily', startDate: '2026-08-14', skipWeekends: 'prev' }),
    { to: '2026-08-17' },
  );
  assert.deepEqual(out, ['2026-08-14', '2026-08-17']);
});

// ── windowing ─────────────────────────────────────────────────────────────────

check('from/to windows without shifting the phase', () => {
  const out = expandOccurrences(
    rule({ freq: 'daily', interval: 3, startDate: '2026-08-01' }),
    { from: '2026-08-10', to: '2026-08-20' },
  );
  assert.deepEqual(out, ['2026-08-10', '2026-08-13', '2026-08-16', '2026-08-19']);
});

check('limit caps the returned window', () => {
  const out = expandOccurrences(rule({ freq: 'daily', startDate: '2026-08-01' }), { to: '2026-12-31', limit: 4 });
  assert.equal(out.length, 4);
});

check('countOccurrences previews how many rows a rule creates', () => {
  assert.equal(countOccurrences(rule({ freq: 'daily', startDate: '2026-08-01' }), '2026-08-01', '2026-08-30'), 30);
});

check('nextOccurrenceAfter finds the following date', () => {
  const r = rule({ freq: 'weekly', startDate: '2026-08-10', byWeekday: ['MO'] });
  assert.equal(nextOccurrenceAfter(r, '2026-08-10'), '2026-08-17');
});

// ── THISANDFUTURE split ───────────────────────────────────────────────────────

check('endRuleBefore closes the old series the day before the split point', () => {
  const daily = rule({ freq: 'daily', startDate: '2026-08-10' });
  const closed = endRuleBefore(daily, '2026-08-14');
  assert.deepEqual(closed.end, { type: 'onDate', date: '2026-08-13' });
  // The past keeps exactly the occurrences it already had...
  assert.deepEqual(expandOccurrences(closed, { to: '2026-12-31' }), [
    '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13',
  ]);
  // ...and the new weekly series owns everything from the split point on.
  const weekly = rule({ freq: 'weekly', startDate: '2026-08-14', byWeekday: ['FR'] });
  assert.deepEqual(expandOccurrences(weekly, { to: '2026-09-04' }), [
    '2026-08-14', '2026-08-21', '2026-08-28', '2026-09-04',
  ]);
});

// ── date-value shape ──────────────────────────────────────────────────────────

check('parseDateValue reads plain / timed / range values', () => {
  assert.deepEqual(parseDateValue('2026-08-18'), { startDate: '2026-08-18', time: null, durationDays: 0 });
  assert.deepEqual(parseDateValue('2026-08-18T09:30'), { startDate: '2026-08-18', time: '09:30', durationDays: 0 });
  assert.deepEqual(parseDateValue('2026-08-18/2026-08-20'), { startDate: '2026-08-18', time: null, durationDays: 2 });
  assert.equal(parseDateValue(''), null);
  assert.equal(parseDateValue(null), null);
});

check('buildDateValue repeats the duration, not the literal end date', () => {
  const shape = parseDateValue('2026-08-18T09:30/2026-08-20')!;
  assert.equal(buildDateValue('2026-09-01', shape), '2026-09-01T09:30/2026-09-03');
});

check('normalizeRule fills defaults and rejects a broken start date', () => {
  const n = normalizeRule(rule({ freq: 'weekly', startDate: '2026-08-12' }))!;
  assert.deepEqual(n.byWeekday, ['WE']);
  assert.equal(n.interval, 1);
  assert.equal(normalizeRule(rule({ freq: 'daily', startDate: 'not-a-date' })), null);
});

console.log(`\n${checks} checks passed.`);
