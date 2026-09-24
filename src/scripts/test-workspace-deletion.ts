/**
 * Regression check for `deleteWorkspaceData` (src/lib/services/workspaceDeletion.ts)
 * against a real database.
 *
 * Seeds the same content into two workspaces — a page, a dashboard, a database
 * with rows and a recurrence series, comments, links, knowledge metadata, a
 * member — then deletes one the OLD way (bare `DELETE FROM workspaces`) and one
 * through the service:
 *   - the bare delete must still leave the database, its rows, the series and the
 *     comments behind (proves the check can see the bug it guards against);
 *   - the service must leave nothing in any of those tables.
 *
 * **Local only.** It writes rows and deletes them again; it refuses a non-`file:` URL.
 *
 *   DATABASE_URL="file:local.db" npm run test:workspace-deletion
 */
import 'dotenv/config';

import { eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  dashboards,
  databases,
  knowledgeMetadata,
  pageComments,
  pageLinks,
  pages,
  recurrenceSeries,
  standalonePages,
  users,
  workspaceItems,
  workspaceMembers,
  workspaces,
} from '@/db/schema';
import { deleteWorkspaceData } from '@/lib/services/workspaceDeletion';

const url = process.env.DATABASE_URL ?? 'file:local.db';
if (!url.startsWith('file:')) {
  console.error(`Refusing to run against a remote database (${url.split('@').pop()}). Set DATABASE_URL="file:local.db".`);
  process.exit(1);
}

let passed = 0;
const failures: string[] = [];
function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const SUFFIX = `test-wsdel-${Date.now()}`;
const userId = `${SUFFIX}-user`;

type Seeded = { workspaceId: string; ids: string[]; databaseId: string; rowIds: string[]; seriesId: string };

async function seed(tag: string): Promise<Seeded> {
  const now = new Date();
  const workspaceId = `${SUFFIX}-${tag}`;
  const pageItem = `${workspaceId}-page`;
  const dashItem = `${workspaceId}-dash`;
  const dbItem = `${workspaceId}-dbitem`;
  const databaseId = `${workspaceId}-db`;
  const rowIds = [1, 2, 3].map((n) => `${workspaceId}-row${n}`);
  const seriesId = `${workspaceId}-series`;

  await db.insert(workspaces).values({ id: workspaceId, name: `Deletion check ${tag}`, billingOwnerId: userId, createdAt: now, updatedAt: now });
  await db.insert(workspaceMembers).values({ workspaceId, userId, role: 'owner', createdAt: now });
  await db.insert(workspaceItems).values([
    { id: pageItem, workspaceId, type: 'page', title: 'Notes page', parentId: null, sortOrder: 0, createdAt: now, updatedAt: now },
    { id: dashItem, workspaceId, type: 'dashboard', title: 'Status', parentId: null, sortOrder: 1, createdAt: now, updatedAt: now },
    { id: dbItem, workspaceId, type: 'database', title: 'Tasks', parentId: null, sortOrder: 2, createdAt: now, updatedAt: now },
  ]);
  await db.insert(standalonePages).values({ id: `${pageItem}-body`, itemId: pageItem, content: 'private body text', createdAt: now, updatedAt: now });
  await db.insert(dashboards).values({ id: `${dashItem}-spec`, itemId: dashItem, spec: { version: 1, blocks: [] }, createdAt: now, updatedAt: now });
  await db.insert(databases).values({ id: databaseId, name: 'Tasks', itemId: dbItem, schema: [{ id: 'title', name: 'Title', type: 'text' }], views: [], createdAt: now, updatedAt: now });
  await db.insert(pages).values(rowIds.map((id, i) => ({
    id, databaseId, title: `Private row ${i}`, content: 'private row body', properties: {}, sortOrder: i, createdAt: now, updatedAt: now,
  })));
  await db.insert(recurrenceSeries).values({ id: seriesId, databaseId, dateColId: 'due', rule: { freq: 'weekly' }, template: { title: 'Weekly' }, createdAt: now, updatedAt: now });
  await db.insert(pageComments).values([
    { pageId: pageItem, workspaceId, body: 'private comment on a page', authorKind: 'human', authorLabel: 'Tester', createdAt: now, updatedAt: now },
    { pageId: rowIds[0], workspaceId, body: 'private comment on a row', authorKind: 'agent', authorLabel: 'Agent', createdAt: now, updatedAt: now },
  ]);
  await db.insert(pageLinks).values({ workspaceId, fromId: pageItem, fromType: 'page', toId: rowIds[0], toType: 'database_row', linkKind: 'page_link', createdAt: now });
  await db.insert(knowledgeMetadata).values({ workspaceId, itemId: rowIds[0], itemType: 'database_row', conceptType: 'concept', createdAt: now, updatedAt: now });

  return { workspaceId, ids: [pageItem, dashItem, dbItem], databaseId, rowIds, seriesId };
}

async function leftovers(s: Seeded) {
  const [items, bodies, dash, dbs, rows, series, comments, links, knowledge, members, ws] = await db.batch([
    db.select({ n: sql<number>`count(*)` }).from(workspaceItems).where(eq(workspaceItems.workspaceId, s.workspaceId)),
    db.select({ n: sql<number>`count(*)` }).from(standalonePages).where(inArray(standalonePages.itemId, s.ids)),
    db.select({ n: sql<number>`count(*)` }).from(dashboards).where(inArray(dashboards.itemId, s.ids)),
    db.select({ n: sql<number>`count(*)` }).from(databases).where(eq(databases.id, s.databaseId)),
    db.select({ n: sql<number>`count(*)` }).from(pages).where(or(eq(pages.databaseId, s.databaseId), inArray(pages.id, s.rowIds))),
    db.select({ n: sql<number>`count(*)` }).from(recurrenceSeries).where(eq(recurrenceSeries.id, s.seriesId)),
    db.select({ n: sql<number>`count(*)` }).from(pageComments).where(eq(pageComments.workspaceId, s.workspaceId)),
    db.select({ n: sql<number>`count(*)` }).from(pageLinks).where(eq(pageLinks.workspaceId, s.workspaceId)),
    db.select({ n: sql<number>`count(*)` }).from(knowledgeMetadata).where(eq(knowledgeMetadata.workspaceId, s.workspaceId)),
    db.select({ n: sql<number>`count(*)` }).from(workspaceMembers).where(eq(workspaceMembers.workspaceId, s.workspaceId)),
    db.select({ n: sql<number>`count(*)` }).from(workspaces).where(eq(workspaces.id, s.workspaceId)),
  ]);
  const n = (r: Array<{ n: number }>) => Number(r[0]?.n ?? 0);
  return {
    items: n(items), bodies: n(bodies), dashboards: n(dash), databases: n(dbs), rows: n(rows), series: n(series),
    comments: n(comments), links: n(links), knowledge: n(knowledge), members: n(members), workspace: n(ws),
  };
}

async function purge(s: Seeded) {
  await db.delete(recurrenceSeries).where(eq(recurrenceSeries.id, s.seriesId));
  await db.delete(pages).where(eq(pages.databaseId, s.databaseId));
  await db.delete(databases).where(eq(databases.id, s.databaseId));
  await db.delete(pageComments).where(eq(pageComments.workspaceId, s.workspaceId));
  await db.delete(workspaces).where(eq(workspaces.id, s.workspaceId));
}

async function main() {
  // The app sets this at module load without awaiting; the cascades below need it now.
  await db.run(sql`PRAGMA foreign_keys = ON`);
  await db.insert(users).values({ id: userId, name: 'Deletion Tester', email: `${userId}@example.invalid`, role: 'user' });

  const old = await seed('old');
  const fixed = await seed('new');
  try {
    console.log('Seeded:', await leftovers(fixed));

    console.log('\nbare DELETE FROM workspaces (the old behaviour):');
    await db.delete(workspaces).where(eq(workspaces.id, old.workspaceId));
    const afterBare = await leftovers(old);
    check('the cascade removes items, bodies, links, knowledge and members', afterBare.items + afterBare.bodies + afterBare.dashboards + afterBare.links + afterBare.knowledge + afterBare.members === 0, JSON.stringify(afterBare));
    check('…but the database, its rows, the series and the comments survive (the bug)', afterBare.databases === 1 && afterBare.rows === 3 && afterBare.series === 1 && afterBare.comments === 2, JSON.stringify(afterBare));

    console.log('\ndeleteWorkspaceData:');
    await deleteWorkspaceData(fixed.workspaceId);
    const afterFixed = await leftovers(fixed);
    for (const [table, count] of Object.entries(afterFixed)) check(`${table}: nothing left`, count === 0, `${count} left`);
  } finally {
    await purge(old);
    await purge(fixed);
    await db.delete(users).where(eq(users.id, userId));
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().then(() => process.exit(0), (error) => {
  console.error(error);
  process.exit(1);
});
