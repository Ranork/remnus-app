import { db } from '@/db';
import { pages, recurrenceSeries, workspaceItems, pageLinks } from '@/db/schema';
import { and, eq, gte, inArray, or, sql } from 'drizzle-orm';
import {
  MAX_OCCURRENCES_PER_SERIES,
  buildDateValue,
  defaultHorizon,
  endRuleBefore,
  expandOccurrences,
  formatYMD,
  normalizeRule,
  parseDateValue,
  parseYMD,
  addDays,
  type DateValueShape,
  type RecurrenceRule,
} from '@/lib/recurrence/rule';

// ── Recurring calendar cards — cookie-free domain service ─────────────────────
//
// Occurrences are materialized as real `pages` rows (see
// `.ai/RECURRENCE_DESIGN.md` §2 for why a virtual expansion cannot work here),
// bound to a `recurrence_series` row that owns the rule and the template.
//
// Two invariants everything below is built to preserve:
//
//   1. The past is immutable. A "this and following" change never rewrites an
//      already-materialized occurrence — it ENDS the current series the day
//      before and starts a new one, so past cards keep their own frozen rule.
//   2. User work is never silently destroyed. An occurrence someone actually
//      touched (wrote a body, nested a page, linked it, let an agent edit it,
//      dragged it to another day) is "dirty" and gets detached and kept in
//      place instead of being regenerated away.

export type RecurrenceScope = 'this' | 'thisAndFollowing' | 'all';

export interface SeriesTemplate {
  title: string;
  /** Every property EXCEPT the date column, which each occurrence computes. */
  properties: Record<string, unknown>;
  icon: string | null;
  iconColor: string | null;
  content: string;
  /** Time-of-day + duration the rule re-stamps onto each occurrence date. */
  dateShape: Pick<DateValueShape, 'time' | 'durationDays'>;
}

export interface SeriesRow {
  id: string;
  databaseId: string;
  dateColId: string;
  rule: RecurrenceRule;
  template: SeriesTemplate;
  materializedUntil: string | null;
  parentSeriesId: string | null;
}

interface OccurrenceRow {
  id: string;
  title: string;
  content: string;
  properties: Record<string, unknown>;
  occurrenceDate: string | null;
  seriesDetached: boolean;
  agentEditedAt: Date | null;
  sortOrder: number;
}

// ── reads ─────────────────────────────────────────────────────────────────────

export async function getSeries(seriesId: string): Promise<SeriesRow | null> {
  const [row] = await db
    .select()
    .from(recurrenceSeries)
    .where(eq(recurrenceSeries.id, seriesId))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    databaseId: row.databaseId,
    dateColId: row.dateColId,
    rule: row.rule as unknown as RecurrenceRule,
    template: row.template as unknown as SeriesTemplate,
    materializedUntil: row.materializedUntil,
    parentSeriesId: row.parentSeriesId,
  };
}

async function getOccurrences(seriesId: string, fromDate?: string): Promise<OccurrenceRow[]> {
  const rows = await db
    .select({
      id: pages.id,
      title: pages.title,
      content: pages.content,
      properties: pages.properties,
      occurrenceDate: pages.occurrenceDate,
      seriesDetached: pages.seriesDetached,
      agentEditedAt: pages.agentEditedAt,
      sortOrder: pages.sortOrder,
    })
    .from(pages)
    .where(
      fromDate
        ? and(eq(pages.seriesId, seriesId), gte(pages.occurrenceDate, fromDate))
        : eq(pages.seriesId, seriesId),
    );
  return rows as OccurrenceRow[];
}

// ── dirty detection ───────────────────────────────────────────────────────────

/**
 * Which of these occurrences carry user work that regeneration must not throw
 * away. Batched deliberately: sub-items and links would otherwise be one query
 * per card, and a daily series easily has a hundred future occurrences.
 */
async function findDirtyOccurrenceIds(
  occurrences: OccurrenceRow[],
  series: SeriesRow,
): Promise<Set<string>> {
  const dirty = new Set<string>();
  if (occurrences.length === 0) return dirty;

  const template = series.template;
  const templateProps = template.properties ?? {};

  for (const occ of occurrences) {
    if (occ.seriesDetached) { dirty.add(occ.id); continue; }
    if (occ.agentEditedAt) { dirty.add(occ.id); continue; }
    if ((occ.content ?? '') !== (template.content ?? '')) { dirty.add(occ.id); continue; }
    if ((occ.title ?? '') !== (template.title ?? '')) { dirty.add(occ.id); continue; }

    const props = (occ.properties ?? {}) as Record<string, unknown>;

    // Manually dragged to another day: the card's actual date no longer matches
    // the date the rule generated it for.
    const actual = parseDateValue(props[series.dateColId]);
    if (occ.occurrenceDate && actual && actual.startDate !== occ.occurrenceDate) {
      dirty.add(occ.id);
      continue;
    }

    // Any user field diverging from the template (the date column is excluded —
    // it is supposed to differ, that is the whole point of an occurrence).
    const keys = new Set([...Object.keys(templateProps), ...Object.keys(props)]);
    keys.delete(series.dateColId);
    let diverged = false;
    for (const key of keys) {
      if (JSON.stringify(props[key] ?? null) !== JSON.stringify(templateProps[key] ?? null)) {
        diverged = true;
        break;
      }
    }
    if (diverged) dirty.add(occ.id);
  }

  const candidateIds = occurrences.filter((o) => !dirty.has(o.id)).map((o) => o.id);
  if (candidateIds.length === 0) return dirty;

  // A nested sub-page or any link in/out is user work even when the card body
  // itself is still the untouched template.
  const [nested, linked] = await Promise.all([
    db
      .select({ parentId: workspaceItems.parentId })
      .from(workspaceItems)
      .where(inArray(workspaceItems.parentId, candidateIds)),
    db
      .select({ fromId: pageLinks.fromId, toId: pageLinks.toId })
      .from(pageLinks)
      .where(or(inArray(pageLinks.fromId, candidateIds), inArray(pageLinks.toId, candidateIds))),
  ]);

  for (const row of nested) if (row.parentId) dirty.add(row.parentId);
  for (const row of linked) {
    if (candidateIds.includes(row.fromId)) dirty.add(row.fromId);
    if (row.toId && candidateIds.includes(row.toId)) dirty.add(row.toId);
  }

  return dirty;
}

// ── materialization ───────────────────────────────────────────────────────────

/**
 * Creates the rows the rule calls for between the series start and `horizon`,
 * skipping dates that already have a card.
 *
 * Idempotent by construction (the unique index on `(series_id, occurrence_date)`
 * is the backstop), so the read-triggered top-up and a future cron job can both
 * run without producing duplicates.
 */
export async function materializeSeries(
  seriesId: string,
  horizon: string = defaultHorizon(),
): Promise<{ created: number }> {
  const series = await getSeries(seriesId);
  if (!series) return { created: 0 };

  const rule = normalizeRule(series.rule);
  if (!rule) return { created: 0 };

  const wanted = expandOccurrences(rule, { to: horizon, limit: MAX_OCCURRENCES_PER_SERIES });
  if (wanted.length === 0) {
    await db
      .update(recurrenceSeries)
      .set({ materializedUntil: horizon, updatedAt: new Date() })
      .where(eq(recurrenceSeries.id, seriesId));
    return { created: 0 };
  }

  const existing = await getOccurrences(seriesId);
  const have = new Set(existing.map((o) => o.occurrenceDate).filter(Boolean) as string[]);
  const missing = wanted.filter((d) => !have.has(d));

  if (missing.length > 0) {
    const [{ maxSort }] = await db
      .select({ maxSort: sql<number>`coalesce(max(${pages.sortOrder}), 0)` })
      .from(pages)
      .where(eq(pages.databaseId, series.databaseId));

    const now = new Date();
    const template = series.template;
    const rows = missing.map((date, i) => ({
      id: crypto.randomUUID(),
      databaseId: series.databaseId,
      title: template.title,
      content: template.content ?? '',
      properties: {
        ...template.properties,
        title: template.title,
        [series.dateColId]: buildDateValue(date, {
          startDate: date,
          time: template.dateShape?.time ?? null,
          durationDays: template.dateShape?.durationDays ?? 0,
        }),
      } as Record<string, unknown>,
      sortOrder: Number(maxSort ?? 0) + i + 1,
      icon: template.icon,
      iconColor: template.iconColor,
      // Explicit timestamps: a SQLite `DEFAULT CURRENT_TIMESTAMP` writes TEXT
      // into these timestamp-mode columns and reads back as `Invalid Date`.
      createdAt: now,
      updatedAt: now,
      seriesId,
      occurrenceDate: date,
      seriesDetached: false,
    }));

    // Chunked: a single INSERT with hundreds of rows blows past libsql's
    // statement-argument ceiling.
    for (let i = 0; i < rows.length; i += 50) {
      await db.insert(pages).values(rows.slice(i, i + 50)).onConflictDoNothing();
    }
  }

  await db
    .update(recurrenceSeries)
    .set({ materializedUntil: horizon, updatedAt: new Date() })
    .where(eq(recurrenceSeries.id, seriesId));

  return { created: missing.length };
}

/**
 * Extends every series of a database up to `horizon`. Called when the calendar
 * asks for a window past what has been materialized — self-healing, so the
 * feature works on self-hosted deployments with no cron at all.
 */
export async function topUpDatabaseSeries(
  databaseId: string,
  horizon: string = defaultHorizon(),
): Promise<{ created: number }> {
  const rows = await db
    .select({ id: recurrenceSeries.id, materializedUntil: recurrenceSeries.materializedUntil })
    .from(recurrenceSeries)
    .where(eq(recurrenceSeries.databaseId, databaseId));

  let created = 0;
  for (const row of rows) {
    if (row.materializedUntil && row.materializedUntil >= horizon) continue;
    const result = await materializeSeries(row.id, horizon);
    created += result.created;
  }
  return { created };
}

// ── creating a series from an existing card ───────────────────────────────────

export function buildTemplateFromPage(
  page: { title: string; content: string; properties: Record<string, unknown>; icon: string | null; iconColor: string | null },
  dateColId: string,
): { template: SeriesTemplate; startDate: string } | null {
  const shape = parseDateValue(page.properties?.[dateColId]);
  if (!shape) return null;

  const properties = { ...(page.properties ?? {}) };
  delete properties[dateColId];

  return {
    startDate: shape.startDate,
    template: {
      title: page.title,
      properties,
      icon: page.icon,
      iconColor: page.iconColor,
      content: page.content ?? '',
      dateShape: { time: shape.time, durationDays: shape.durationDays },
    },
  };
}

export async function createSeriesFromPage(
  pageId: string,
  dateColId: string,
  rule: RecurrenceRule,
  userId: string,
  horizon: string = defaultHorizon(),
): Promise<{ seriesId: string; created: number } | null> {
  const [page] = await db.select().from(pages).where(eq(pages.id, pageId)).limit(1);
  if (!page) return null;

  const built = buildTemplateFromPage(
    {
      title: page.title,
      content: page.content ?? '',
      properties: (page.properties ?? {}) as Record<string, unknown>,
      icon: page.icon,
      iconColor: page.iconColor,
    },
    dateColId,
  );
  if (!built) return null;

  const normalized = normalizeRule({ ...rule, startDate: built.startDate });
  if (!normalized) return null;

  const seriesId = crypto.randomUUID();
  const now = new Date();

  await db.insert(recurrenceSeries).values({
    id: seriesId,
    databaseId: page.databaseId,
    dateColId,
    rule: normalized as unknown as Record<string, unknown>,
    template: built.template as unknown as Record<string, unknown>,
    materializedUntil: null,
    parentSeriesId: null,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  // The card the user set the rule on becomes the series' first occurrence.
  await db
    .update(pages)
    .set({ seriesId, occurrenceDate: built.startDate, seriesDetached: false, updatedAt: now })
    .where(eq(pages.id, pageId));

  const { created } = await materializeSeries(seriesId, horizon);
  return { seriesId, created };
}

// ── impact preview ────────────────────────────────────────────────────────────

export interface ScopeImpact {
  /** Cards the operation would remove or regenerate. */
  affected: number;
  /** Of those, how many carry user work and would be preserved instead. */
  dirty: number;
}

export async function getScopeImpact(
  pageId: string,
  scope: RecurrenceScope,
): Promise<ScopeImpact | null> {
  const [page] = await db
    .select({ seriesId: pages.seriesId, occurrenceDate: pages.occurrenceDate })
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1);
  if (!page?.seriesId) return null;

  const series = await getSeries(page.seriesId);
  if (!series) return null;

  if (scope === 'this') return { affected: 1, dirty: 0 };

  const from = scope === 'thisAndFollowing' ? page.occurrenceDate ?? undefined : undefined;
  const occurrences = await getOccurrences(page.seriesId, from);
  const dirty = await findDirtyOccurrenceIds(occurrences, series);

  return { affected: occurrences.length, dirty: dirty.size };
}

// ── rule changes ──────────────────────────────────────────────────────────────

export interface RuleChangeResult {
  seriesId: string;
  created: number;
  removed: number;
  preserved: number;
}

/**
 * THISANDFUTURE: closes the current series the day before `fromDate` and starts
 * a new one there with `newRule`. Past occurrences are not touched — they keep
 * belonging to the old series and its old, now-frozen rule.
 *
 * Future occurrences of the old series are cleared to make room for the new
 * rhythm, except the dirty ones, which are detached and left exactly where they
 * are. Any date a preserved card already occupies is added to the new series'
 * EXDATE list, so the new rhythm does not stack a second, empty card on top of
 * work the user already did.
 */
export async function splitSeriesAt(
  seriesId: string,
  fromDate: string,
  newRule: RecurrenceRule,
  userId: string,
  horizon: string = defaultHorizon(),
): Promise<RuleChangeResult | null> {
  const series = await getSeries(seriesId);
  if (!series) return null;

  const oldRule = normalizeRule(series.rule);
  if (!oldRule) return null;

  const now = new Date();
  const future = await getOccurrences(seriesId, fromDate);
  const dirty = await findDirtyOccurrenceIds(future, series);

  const removable = future.filter((o) => !dirty.has(o.id)).map((o) => o.id);
  const preserved = future.filter((o) => dirty.has(o.id));

  // 1. Freeze the old series at the split point.
  await db
    .update(recurrenceSeries)
    .set({ rule: endRuleBefore(oldRule, fromDate) as unknown as Record<string, unknown>, updatedAt: now })
    .where(eq(recurrenceSeries.id, seriesId));

  // 2. Drop the clean future cards; keep the dirty ones, detached in place.
  if (removable.length > 0) {
    for (let i = 0; i < removable.length; i += 50) {
      await db.delete(pages).where(inArray(pages.id, removable.slice(i, i + 50)));
    }
  }
  if (preserved.length > 0) {
    await db
      .update(pages)
      .set({ seriesDetached: true, updatedAt: now })
      .where(inArray(pages.id, preserved.map((o) => o.id)));
  }

  // 3. Start the new series at the split point, stepping around preserved days.
  const preservedDates = new Set(
    preserved.map((o) => o.occurrenceDate).filter(Boolean) as string[],
  );
  const normalized = normalizeRule({
    ...newRule,
    startDate: fromDate,
    exDates: [...new Set([...(newRule.exDates ?? []), ...preservedDates])],
  });
  if (!normalized) return null;

  const newSeriesId = crypto.randomUUID();
  await db.insert(recurrenceSeries).values({
    id: newSeriesId,
    databaseId: series.databaseId,
    dateColId: series.dateColId,
    rule: normalized as unknown as Record<string, unknown>,
    template: series.template as unknown as Record<string, unknown>,
    materializedUntil: null,
    parentSeriesId: seriesId,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  const { created } = await materializeSeries(newSeriesId, horizon);

  return {
    seriesId: newSeriesId,
    created,
    removed: removable.length,
    preserved: preserved.length,
  };
}

/** ALL: re-rhythms the whole series from its own start date. Past occurrences
 *  ARE rewritten here — that is what the scope means — but dirty ones are still
 *  preserved, so this can never eat a card someone filled in. */
export async function replaceSeriesRule(
  seriesId: string,
  newRule: RecurrenceRule,
  horizon: string = defaultHorizon(),
): Promise<RuleChangeResult | null> {
  const series = await getSeries(seriesId);
  if (!series) return null;

  const all = await getOccurrences(seriesId);
  const dirty = await findDirtyOccurrenceIds(all, series);
  const removable = all.filter((o) => !dirty.has(o.id)).map((o) => o.id);
  const preserved = all.filter((o) => dirty.has(o.id));
  const now = new Date();

  if (removable.length > 0) {
    for (let i = 0; i < removable.length; i += 50) {
      await db.delete(pages).where(inArray(pages.id, removable.slice(i, i + 50)));
    }
  }
  if (preserved.length > 0) {
    await db
      .update(pages)
      .set({ seriesDetached: true, updatedAt: now })
      .where(inArray(pages.id, preserved.map((o) => o.id)));
  }

  const preservedDates = new Set(preserved.map((o) => o.occurrenceDate).filter(Boolean) as string[]);
  const normalized = normalizeRule({
    ...newRule,
    exDates: [...new Set([...(newRule.exDates ?? []), ...preservedDates])],
  });
  if (!normalized) return null;

  await db
    .update(recurrenceSeries)
    .set({
      rule: normalized as unknown as Record<string, unknown>,
      materializedUntil: null,
      updatedAt: now,
    })
    .where(eq(recurrenceSeries.id, seriesId));

  const { created } = await materializeSeries(seriesId, horizon);
  return { seriesId, created, removed: removable.length, preserved: preserved.length };
}

// ── deletion ──────────────────────────────────────────────────────────────────

export interface DeleteResult {
  /** Page ids that were removed — the caller runs the usual link/tombstone cleanup. */
  deletedIds: string[];
  preserved: number;
  /** Set when the whole series record was dropped too. */
  seriesDeleted: boolean;
}

/**
 * The three-way delete the product exposes: this card / this and the following
 * ones / every card in the series.
 *
 * `includeDirty` is the escape hatch the confirm dialog offers once it has told
 * the user how many cards actually have content in them — preserving is the
 * default so nothing is destroyed by a reflex click, but the choice is theirs.
 */
export async function deleteOccurrences(
  pageId: string,
  scope: RecurrenceScope,
  includeDirty = false,
): Promise<DeleteResult | null> {
  const [page] = await db
    .select({
      id: pages.id,
      seriesId: pages.seriesId,
      occurrenceDate: pages.occurrenceDate,
    })
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1);
  if (!page?.seriesId) return null;

  const series = await getSeries(page.seriesId);
  if (!series) return null;

  const now = new Date();

  if (scope === 'this') {
    // EXDATE the occurrence so no later top-up ever brings it back.
    const rule = normalizeRule(series.rule);
    if (rule && page.occurrenceDate) {
      await db
        .update(recurrenceSeries)
        .set({
          rule: {
            ...rule,
            exDates: [...new Set([...(rule.exDates ?? []), page.occurrenceDate])],
          } as unknown as Record<string, unknown>,
          updatedAt: now,
        })
        .where(eq(recurrenceSeries.id, page.seriesId));
    }
    return { deletedIds: [page.id], preserved: 0, seriesDeleted: false };
  }

  const from = scope === 'thisAndFollowing' ? page.occurrenceDate ?? undefined : undefined;
  const targets = await getOccurrences(page.seriesId, from);
  const dirty = includeDirty ? new Set<string>() : await findDirtyOccurrenceIds(targets, series);

  const deletedIds = targets.filter((o) => !dirty.has(o.id)).map((o) => o.id);
  const preservedIds = targets.filter((o) => dirty.has(o.id)).map((o) => o.id);

  if (preservedIds.length > 0) {
    await db
      .update(pages)
      .set({ seriesDetached: true, updatedAt: now })
      .where(inArray(pages.id, preservedIds));
  }

  if (scope === 'thisAndFollowing') {
    const rule = normalizeRule(series.rule);
    if (rule && page.occurrenceDate) {
      await db
        .update(recurrenceSeries)
        .set({
          rule: endRuleBefore(rule, page.occurrenceDate) as unknown as Record<string, unknown>,
          updatedAt: now,
        })
        .where(eq(recurrenceSeries.id, page.seriesId));
    }
    return { deletedIds, preserved: preservedIds.length, seriesDeleted: false };
  }

  // scope === 'all' — the series record goes too. Preserved cards keep their
  // `series_id` as provenance, so drop the row only when nothing is left
  // pointing at it (an FK-less orphan would break the detached badge's lookup).
  if (preservedIds.length === 0) {
    await db.delete(recurrenceSeries).where(eq(recurrenceSeries.id, page.seriesId));
    return { deletedIds, preserved: 0, seriesDeleted: true };
  }

  // Something survived: park the rule so it can never generate again.
  await db
    .update(recurrenceSeries)
    .set({
      rule: endRuleBefore(normalizeRule(series.rule)!, series.rule.startDate) as unknown as Record<string, unknown>,
      updatedAt: now,
    })
    .where(eq(recurrenceSeries.id, page.seriesId));

  return { deletedIds, preserved: preservedIds.length, seriesDeleted: false };
}

/** Removes one card from its series without touching the rest — "seriden çıkar". */
export async function detachOccurrence(pageId: string): Promise<boolean> {
  const [page] = await db
    .select({ seriesId: pages.seriesId, occurrenceDate: pages.occurrenceDate })
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1);
  if (!page?.seriesId) return false;

  await db
    .update(pages)
    .set({ seriesDetached: true, updatedAt: new Date() })
    .where(eq(pages.id, pageId));
  return true;
}

// ── lookups for the UI ────────────────────────────────────────────────────────

/** Every series of a database, keyed by id — the calendar needs the rule to
 *  render a card's "repeats weekly" tooltip without an extra round-trip. */
export async function getSeriesForDatabase(databaseId: string): Promise<SeriesRow[]> {
  const rows = await db
    .select()
    .from(recurrenceSeries)
    .where(eq(recurrenceSeries.databaseId, databaseId));
  return rows.map((row) => ({
    id: row.id,
    databaseId: row.databaseId,
    dateColId: row.dateColId,
    rule: row.rule as unknown as RecurrenceRule,
    template: row.template as unknown as SeriesTemplate,
    materializedUntil: row.materializedUntil,
    parentSeriesId: row.parentSeriesId,
  }));
}

/** Drops series rows whose occurrences are all gone — housekeeping after a
 *  plain (non-series-aware) row delete removed the last card. */
export async function pruneEmptySeries(databaseId: string): Promise<number> {
  const orphans = await db
    .select({ id: recurrenceSeries.id })
    .from(recurrenceSeries)
    .where(
      and(
        eq(recurrenceSeries.databaseId, databaseId),
        sql`not exists (select 1 from ${pages} where ${pages.seriesId} = ${recurrenceSeries.id})`,
      ),
    );
  if (orphans.length === 0) return 0;
  await db.delete(recurrenceSeries).where(inArray(recurrenceSeries.id, orphans.map((o) => o.id)));
  return orphans.length;
}

/** Widens the materialization horizon to cover a calendar window the user has
 *  navigated to, never shrinking below the default 90-day floor. */
export function horizonFor(windowEnd: string | null | undefined): string {
  const base = defaultHorizon();
  if (!windowEnd) return base;
  const parsed = parseYMD(windowEnd);
  if (!parsed) return base;
  const padded = formatYMD(addDays(parsed, 7));
  return padded > base ? padded : base;
}
