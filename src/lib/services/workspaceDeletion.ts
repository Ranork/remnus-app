/**
 * The ONE way to delete a whole workspace — cookie-free, so user deletion, admin
 * deletion, GDPR account deletion, the demo reaper and the OKF import rollback
 * all go through it.
 *
 * A bare `DELETE FROM workspaces` is NOT enough, and was what every one of those
 * paths did until 2026-09-24: `workspace_items` cascades, but
 * `databases.item_id` is `ON DELETE SET NULL`, so each database survived with a
 * NULL item — and with it every row (`pages`: titles, bodies, properties) and
 * recurrence series. `page_comments.workspace_id` has no FK at all. None of it
 * was reachable from the app, but it was user content left behind, including
 * after a GDPR "delete my account".
 *
 * Everything else a workspace owns is removed by `ON DELETE CASCADE` on
 * `workspace_id` (items, bodies, dashboards, links, knowledge, snapshots,
 * tombstones, shares, tokens, members, …), and the search index rows by the
 * `search_*` triggers. Left on purpose: `agent_activity` / `agent_savings_rollup`
 * (audit, no FK by design) and `uploaded_assets` (`workspace_id` SET NULL; the
 * files' Cloudinary cleanup is a separate decision — account deletion already
 * destroys a user's uploads).
 *
 * Rows and series are deleted explicitly rather than trusted to the databases →
 * pages cascade, so the result does not depend on the connection's
 * `foreign_keys` pragma. One `db.batch`: all-or-nothing, one round-trip.
 */
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { databases, pageComments, pages, recurrenceSeries, workspaceItems, workspaces } from '@/db/schema';

export async function deleteWorkspaceData(workspaceId: string): Promise<void> {
  const itemsOfWorkspace = db
    .select({ id: workspaceItems.id })
    .from(workspaceItems)
    .where(eq(workspaceItems.workspaceId, workspaceId));
  const databasesOfWorkspace = db
    .select({ id: databases.id })
    .from(databases)
    .where(inArray(databases.itemId, itemsOfWorkspace));

  await db.batch([
    db.delete(recurrenceSeries).where(inArray(recurrenceSeries.databaseId, databasesOfWorkspace)),
    db.delete(pages).where(inArray(pages.databaseId, databasesOfWorkspace)),
    db.delete(databases).where(inArray(databases.itemId, itemsOfWorkspace)),
    db.delete(pageComments).where(eq(pageComments.workspaceId, workspaceId)),
    db.delete(workspaces).where(eq(workspaces.id, workspaceId)),
  ]);
}
