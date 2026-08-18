'use server';

import { db } from '@/db';
import { pages, databases, workspaceItems, workspaceMembers } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/session';
import { deleteWorkspaceItem } from './workspace';
import { publish } from '@/lib/realtime/publish';
import { recordDeletionTombstone } from '@/lib/services/workspace';
import { purgeReferencesTo, removePageLinksFor } from '@/lib/services/pageLinks';
import {
  createSeriesFromPage,
  deleteOccurrences,
  detachOccurrence,
  getScopeImpact,
  getSeriesForDatabase,
  horizonFor,
  pruneEmptySeries,
  replaceSeriesRule,
  splitSeriesAt,
  topUpDatabaseSeries,
  type RecurrenceScope,
  type ScopeImpact,
} from '@/lib/services/recurrence';
import { normalizeRule, type RecurrenceRule } from '@/lib/recurrence/rule';

// Session-aware wrappers over `services/recurrence.ts`. Everything here goes
// through `assertDatabaseAccess` and finishes with the same realtime publish +
// revalidate the other database mutations use, so a series change lands on
// other open clients exactly like a normal row edit does.

async function assertDatabaseAccess(databaseId: string): Promise<{ userId: string; workspaceId: string }> {
  const user = await getCurrentUser();

  const [row] = await db
    .select({ workspaceId: workspaceItems.workspaceId })
    .from(databases)
    .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
    .where(eq(databases.id, databaseId))
    .limit(1);

  if (!row) throw new Error('Database not found');

  if (user.role !== 'admin') {
    const [member] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, row.workspaceId),
          eq(workspaceMembers.userId, user.id),
        ),
      )
      .limit(1);

    if (!member) throw new Error('Unauthorized: no access to this database');
  }

  return { userId: user.id, workspaceId: row.workspaceId };
}

async function assertPageAccess(pageId: string) {
  const [page] = await db
    .select({ databaseId: pages.databaseId, seriesId: pages.seriesId, occurrenceDate: pages.occurrenceDate })
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1);
  if (!page) throw new Error('Page not found');
  const access = await assertDatabaseAccess(page.databaseId);
  return { ...access, ...page };
}

function finish(databaseId: string, workspaceId: string, userId: string) {
  revalidatePath(`/db/${databaseId}`);
  publish({ scope: 'database', workspaceId, resourceId: databaseId, actorId: userId });
}

/**
 * Runs the side effects a deleted row normally gets from `deletePage`. Series
 * deletes bypass that action (they remove many rows at once), so the cleanup has
 * to be replayed here — skipping it would leave dead sub-pages, dangling link
 * rows, and embedded child-block buttons pointing at cards that no longer exist.
 */
async function cleanUpDeletedPages(pageIds: string[], workspaceId: string) {
  if (pageIds.length === 0) return;

  const titles = await db
    .select({ id: pages.id, title: pages.title })
    .from(pages)
    .where(inArray(pages.id, pageIds));
  const titleById = new Map(titles.map((t) => [t.id, t.title]));

  const subItems = await db
    .select({ id: workspaceItems.id })
    .from(workspaceItems)
    .where(inArray(workspaceItems.parentId, pageIds));
  for (const item of subItems) {
    await deleteWorkspaceItem(item.id);
  }

  for (let i = 0; i < pageIds.length; i += 50) {
    await db.delete(pages).where(inArray(pages.id, pageIds.slice(i, i + 50)));
  }

  for (const id of pageIds) {
    await recordDeletionTombstone(workspaceId, id, 'database_row', titleById.get(id) ?? '');
  }

  // Order matters: the purge finds referencing pages THROUGH the link rows, so
  // it has to run before those rows are dropped.
  await purgeReferencesTo(pageIds);
  await removePageLinksFor(pageIds);
}

// ── reads ─────────────────────────────────────────────────────────────────────

export interface SeriesSummary {
  id: string;
  dateColId: string;
  rule: RecurrenceRule;
  parentSeriesId: string | null;
}

/**
 * The series map the calendar needs to badge its cards, plus a materialization
 * top-up for the window the user is looking at.
 *
 * Topping up on read is what makes an open-ended series work without any cron:
 * navigating the calendar forward past the horizon simply extends it. `windowEnd`
 * is the last day currently visible.
 */
export async function loadRecurrenceState(
  databaseId: string,
  windowEnd?: string,
): Promise<{ series: SeriesSummary[]; created: number }> {
  const { userId, workspaceId } = await assertDatabaseAccess(databaseId);

  const { created } = await topUpDatabaseSeries(databaseId, horizonFor(windowEnd));
  const series = await getSeriesForDatabase(databaseId);

  if (created > 0) finish(databaseId, workspaceId, userId);

  return {
    created,
    series: series.map((s) => ({
      id: s.id,
      dateColId: s.dateColId,
      rule: s.rule,
      parentSeriesId: s.parentSeriesId,
    })),
  };
}

/** Powers the "this will affect N cards, M of them have content" line in the
 *  scope dialog — read-only, safe to call while the user is still deciding. */
export async function previewScopeImpact(
  pageId: string,
  scope: RecurrenceScope,
): Promise<ScopeImpact | null> {
  await assertPageAccess(pageId);
  return getScopeImpact(pageId, scope);
}

// ── writes ────────────────────────────────────────────────────────────────────

/** Turns an ordinary card into the first occurrence of a new series. */
export async function setPageRecurrence(
  pageId: string,
  dateColId: string,
  rule: RecurrenceRule,
): Promise<{ seriesId: string; created: number } | null> {
  const { userId, workspaceId, databaseId } = await assertPageAccess(pageId);

  if (!normalizeRule(rule)) throw new Error('Invalid recurrence rule');

  const result = await createSeriesFromPage(pageId, dateColId, rule, userId);
  finish(databaseId, workspaceId, userId);
  return result;
}

/**
 * Changes the rhythm of a series.
 *
 * `thisAndFollowing` (the default the UI offers) SPLITS: the current series is
 * closed the day before this occurrence and a new one starts here — which is
 * what makes "I ran this daily for a week, now make it weekly" leave last
 * week's cards exactly as they were.
 *
 * `all` re-rhythms the series from its own start date instead, rewriting the
 * past as well. Both scopes preserve occurrences that already carry content.
 */
export async function changeSeriesRule(
  pageId: string,
  newRule: RecurrenceRule,
  scope: 'thisAndFollowing' | 'all',
) {
  const { userId, workspaceId, databaseId, seriesId, occurrenceDate } = await assertPageAccess(pageId);
  if (!seriesId) throw new Error('This card is not part of a series');
  if (!normalizeRule(newRule)) throw new Error('Invalid recurrence rule');

  const result =
    scope === 'all'
      ? await replaceSeriesRule(seriesId, newRule)
      : await splitSeriesAt(seriesId, occurrenceDate ?? newRule.startDate, newRule, userId);

  finish(databaseId, workspaceId, userId);
  return result;
}

/** The three-way delete: this card / this and the following / all of them. */
export async function deleteRecurringPage(
  pageId: string,
  scope: RecurrenceScope,
  includeDirty = false,
): Promise<{ deleted: number; preserved: number }> {
  const { userId, workspaceId, databaseId } = await assertPageAccess(pageId);

  const result = await deleteOccurrences(pageId, scope, includeDirty);
  if (!result) {
    // Not a series card after all — fall back to the plain single-row delete.
    await cleanUpDeletedPages([pageId], workspaceId);
    finish(databaseId, workspaceId, userId);
    return { deleted: 1, preserved: 0 };
  }

  await cleanUpDeletedPages(result.deletedIds, workspaceId);
  await pruneEmptySeries(databaseId);
  finish(databaseId, workspaceId, userId);

  return { deleted: result.deletedIds.length, preserved: result.preserved };
}

/** "Seriden çıkar" — the card stays, stops following the rule. */
export async function detachPageFromSeries(pageId: string): Promise<boolean> {
  const { userId, workspaceId, databaseId } = await assertPageAccess(pageId);
  const ok = await detachOccurrence(pageId);
  if (ok) finish(databaseId, workspaceId, userId);
  return ok;
}

/** Removes the rule entirely: the series record goes, every generated card
 *  becomes an ordinary standalone card. Nothing is deleted. */
export async function clearSeriesRecurrence(pageId: string): Promise<boolean> {
  const { userId, workspaceId, databaseId, seriesId } = await assertPageAccess(pageId);
  if (!seriesId) return false;

  await db
    .update(pages)
    .set({ seriesId: null, occurrenceDate: null, seriesDetached: false, updatedAt: new Date() })
    .where(eq(pages.seriesId, seriesId));
  await pruneEmptySeries(databaseId);

  finish(databaseId, workspaceId, userId);
  return true;
}
