/**
 * Regression check: deleting to the Trash and restoring must not lose links.
 *
 *   - a delete to the Trash never rewrites another page: a parent deleted with its
 *     child keeps its link to the child in its trash copy, and a page outside the
 *     deleted set keeps its link to it (both used to be flattened to plain text);
 *   - items deleted in one bulk call keep the links between them;
 *   - a restored page or row gets its link-graph rows back (backlinks, the map,
 *     get_related_pages);
 *   - once a trash copy is gone for good, links to it are stripped — never links
 *     to an item that exists;
 *   - the knowledge map never lists one node as both an orphan and a hub.
 *
 * **Local only.** It writes rows and deletes them again; it refuses a non-`file:` URL.
 *
 *   DATABASE_URL="file:local.db" npm run test:trash-links
 */
import 'dotenv/config';

import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { databases, pageLinks, pageSnapshots, pages, standalonePages, users, workspaceItems, workspaceMembers, workspaces } from '@/db/schema';
import { bulkDeleteItemsFromWorkspace, deleteItemFromWorkspace } from '@/lib/services/workspace';
import { listTrashedIds, releaseTrashedReferences, restoreSnapshot, type SnapshotActor } from '@/lib/services/snapshots';
import { syncPageLinks } from '@/lib/services/pageLinks';
import { getWorkspaceGraph } from '@/lib/services/graph';
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

const SUFFIX = `test-trash-${Date.now()}`;
const userId = `${SUFFIX}-user`;
const W = `${SUFFIX}-ws`;
const id = (name: string) => `${SUFFIX}-${name}`;
const [P, C, S, A, B, M, H, D, E, X] = ['parent', 'child', 'sibling', 'alpha', 'beta', 'mentioned', 'hub', 'dbitem', 'expiring', 'pointer'].map(id);
const DB = id('db');
const [R1, R2] = [id('row1'), id('row2')];
const READERS = [1, 2, 3].map((n) => id(`reader${n}`));
const actor: SnapshotActor = { kind: 'agent', label: 'trash-links test' };

const link = (to: string, label: string) => `<a data-page-link href="/page/${to}">${label}</a>`;
const rowLink = (row: string, label: string) => `<a data-page-link href="/db/${DB}/${row}">${label}</a>`;
const childBlock = (to: string) => `<div data-cb-id="${to}" data-cb-type="page"></div>`;

async function seed() {
  const now = new Date();
  await db.insert(users).values({ id: userId, name: 'Trash Tester', email: `${userId}@example.invalid`, role: 'user' });
  await db.insert(workspaces).values({ id: W, name: 'Trash links check', billingOwnerId: userId, createdAt: now, updatedAt: now });
  await db.insert(workspaceMembers).values({ workspaceId: W, userId, role: 'owner', createdAt: now });

  const bodies: Record<string, { title: string; parentId: string | null; content: string }> = {
    [P]: { title: 'Parent Notes', parentId: null, content: `See ${link(C, 'Child Notes')} and ${link(S, 'Sibling Notes')}.\n\n${childBlock(C)}\n` },
    [C]: { title: 'Child Notes', parentId: P, content: `Back to ${link(P, 'Parent Notes')}, also ${link(S, 'Sibling Notes')}.` },
    [S]: { title: 'Sibling Notes', parentId: null, content: `Up: ${link(P, 'Parent Notes')}.` },
    [A]: { title: 'Alpha Notes', parentId: null, content: `Pairs with ${link(B, 'Beta Notes')}.` },
    [B]: { title: 'Beta Notes', parentId: null, content: `Pairs with ${link(A, 'Alpha Notes')}.` },
    [M]: { title: 'Zebrafish Protocol', parentId: null, content: 'How the lab runs the protocol.' },
    [H]: { title: 'Hub Handbook', parentId: null, content: 'The shared handbook.' },
    [E]: { title: 'Expiring Notes', parentId: null, content: 'Soon gone for good.' },
    [X]: { title: 'Pointer Notes', parentId: null, content: `See ${link(E, 'Expiring Notes')} for the old plan.` },
    ...Object.fromEntries(READERS.map((reader, i) => [reader, {
      title: `Reader ${i + 1}`, parentId: null, content: `Follow the Zebrafish Protocol. Details in ${link(H, 'Hub Handbook')}.`,
    }])),
  };

  await db.insert(workspaceItems).values([
    ...Object.entries(bodies).map(([itemId, body], i) => ({
      id: itemId, workspaceId: W, type: 'page' as const, title: body.title, parentId: body.parentId, sortOrder: i, createdAt: now, updatedAt: now,
    })),
    { id: D, workspaceId: W, type: 'database' as const, title: 'Rows', parentId: null, sortOrder: 99, createdAt: now, updatedAt: now },
  ]);
  await db.insert(standalonePages).values(Object.entries(bodies).map(([itemId, body]) => ({
    id: `${itemId}-body`, itemId, content: body.content, createdAt: now, updatedAt: now,
  })));
  await db.insert(databases).values({ id: DB, name: 'Rows', itemId: D, schema: [{ id: 'title', name: 'Title', type: 'text' }], views: [], createdAt: now, updatedAt: now });
  const rows = { [R1]: `Next: ${rowLink(R2, 'Row Two')}`, [R2]: `Previous: ${rowLink(R1, 'Row One')}` };
  await db.insert(pages).values(Object.entries(rows).map(([rowId, content], i) => ({
    id: rowId, databaseId: DB, title: i === 0 ? 'Row One' : 'Row Two', content, properties: {}, sortOrder: i, createdAt: now, updatedAt: now,
  })));

  for (const [itemId, body] of Object.entries(bodies)) await syncPageLinks(W, itemId, 'page', body.content);
  for (const [rowId, content] of Object.entries(rows)) await syncPageLinks(W, rowId, 'database_row', content);
}

async function snapshotOf(originalId: string) {
  const [snap] = await db
    .select({ id: pageSnapshots.id, content: pageSnapshots.content })
    .from(pageSnapshots)
    .where(and(eq(pageSnapshots.workspaceId, W), eq(pageSnapshots.originalId, originalId), eq(pageSnapshots.reason, 'delete')))
    .limit(1);
  return snap;
}

async function liveContent(itemId: string) {
  const [row] = await db.select({ content: standalonePages.content }).from(standalonePages).where(eq(standalonePages.itemId, itemId)).limit(1);
  return row?.content ?? null;
}

async function linkRows(ids: string[]) {
  return db
    .select({ fromId: pageLinks.fromId, toId: pageLinks.toId, linkKind: pageLinks.linkKind })
    .from(pageLinks)
    .where(and(eq(pageLinks.workspaceId, W), or(inArray(pageLinks.fromId, ids), inArray(pageLinks.toId, ids))));
}

async function main() {
  // The app sets this at module load without awaiting; the cascades in cleanup need it now.
  await db.run(sql`PRAGMA foreign_keys = ON`);
  await seed();
  try {
    console.log('\ndelete a parent together with its child:');
    await deleteItemFromWorkspace(W, P, actor);
    const parentSnap = await snapshotOf(P);
    const childSnap = await snapshotOf(C);
    check('the parent\'s trash copy keeps its inline link to the child', !!parentSnap?.content?.includes(`href="/page/${C}"`), parentSnap?.content ?? 'no snapshot');
    check('the parent\'s trash copy keeps the child block', !!parentSnap?.content?.includes(`data-cb-id="${C}"`), parentSnap?.content ?? 'no snapshot');
    check('the child\'s trash copy keeps its link to the parent', !!childSnap?.content?.includes(`href="/page/${P}"`), childSnap?.content ?? 'no snapshot');
    const afterDelete = await linkRows([P, C]);
    check('the deleted pages\' own link-graph rows are gone', afterDelete.every((row) => row.fromId !== P && row.fromId !== C), JSON.stringify(afterDelete));
    const siblingAfter = await liveContent(S);
    check('an outside page keeps its link to the trashed page', !!siblingAfter?.includes(`href="/page/${P}"`), siblingAfter ?? 'missing');
    check('…and its link-graph row', afterDelete.some((row) => row.fromId === S && row.toId === P));
    const trashed = (await listTrashedIds(W, [P, C, S, 'unknown-id'])).sort();
    check('the trash lookup finds exactly the trashed targets', JSON.stringify(trashed) === JSON.stringify([C, P].sort()), JSON.stringify(trashed));

    console.log('\nrestore the parent, then the child:');
    const restoredParent = await restoreSnapshot(W, parentSnap!.id);
    const restoredChild = await restoreSnapshot(W, childSnap!.id);
    check('both restore', restoredParent.restored && restoredChild.restored, JSON.stringify([restoredParent, restoredChild]));
    check('the child is back under its parent', restoredChild.restored && !restoredChild.rerootedToRoot);
    const parentBody = await liveContent(P);
    check('the restored parent links to the child again', !!parentBody?.includes(`href="/page/${C}"`) && !!parentBody?.includes(`data-cb-id="${C}"`), parentBody ?? 'missing');
    const restoredLinks = await linkRows([P, C]);
    const from = (source: string) => restoredLinks.filter((row) => row.fromId === source).map((row) => `${row.toId.replace(`${SUFFIX}-`, '')}:${row.linkKind}`).sort();
    check('the restored parent\'s link-graph rows are back', JSON.stringify(from(P)) === JSON.stringify(['child:child_block', 'child:page_link', 'sibling:page_link']), JSON.stringify(from(P)));
    check('the restored child\'s link-graph rows are back', JSON.stringify(from(C)) === JSON.stringify(['parent:page_link', 'sibling:page_link']), JSON.stringify(from(C)));
    check('the restored parent has its backlink from the outside page', restoredLinks.some((row) => row.fromId === S && row.toId === P));
    check('nothing is left in the trash for them', (await listTrashedIds(W, [P, C])).length === 0);

    console.log('\nbulk-delete two pages that link to each other:');
    const pageResults = await bulkDeleteItemsFromWorkspace(W, [A, B], actor);
    check('both deletes succeed', pageResults.every((r) => r.ok), JSON.stringify(pageResults));
    const alphaSnap = await snapshotOf(A);
    const betaSnap = await snapshotOf(B);
    check('the first page\'s trash copy keeps its link to the second', !!alphaSnap?.content?.includes(`href="/page/${B}"`), alphaSnap?.content ?? 'no snapshot');
    check('the second page\'s trash copy keeps its link to the first', !!betaSnap?.content?.includes(`href="/page/${A}"`), betaSnap?.content ?? 'no snapshot');

    console.log('\nbulk-delete two rows that link to each other, restore one:');
    const rowResults = await bulkDeleteItemsFromWorkspace(W, [R1, R2], actor);
    check('both row deletes succeed', rowResults.every((r) => r.ok), JSON.stringify(rowResults));
    const rowOneSnap = await snapshotOf(R1);
    const rowTwoSnap = await snapshotOf(R2);
    check('row one\'s trash copy keeps its link to row two', !!rowOneSnap?.content?.includes(`/db/${DB}/${R2}`), rowOneSnap?.content ?? 'no snapshot');
    check('row two\'s trash copy keeps its link to row one', !!rowTwoSnap?.content?.includes(`/db/${DB}/${R1}`), rowTwoSnap?.content ?? 'no snapshot');
    await restoreSnapshot(W, rowOneSnap!.id);
    check('the restored row\'s link-graph row is back', (await linkRows([R1])).some((row) => row.fromId === R1 && row.toId === R2));

    console.log('\na trash copy gone for good (expired or evicted):');
    await deleteItemFromWorkspace(W, E, actor);
    check('while it is in the trash, the pointing page keeps its link', !!(await liveContent(X))?.includes(`href="/page/${E}"`));
    const expired = await db
      .delete(pageSnapshots)
      .where(and(eq(pageSnapshots.workspaceId, W), eq(pageSnapshots.originalId, E)))
      .returning({ reason: pageSnapshots.reason, itemType: pageSnapshots.itemType, originalId: pageSnapshots.originalId, databaseId: pageSnapshots.databaseId });
    await releaseTrashedReferences(expired);
    const pointerBody = await liveContent(X);
    check('the link is stripped to its label', !!pointerBody && !pointerBody.includes(`/page/${E}`) && pointerBody.includes('Expiring Notes'), pointerBody ?? 'missing');
    check('…and no link-graph row points at it', (await linkRows([E])).length === 0);
    await releaseTrashedReferences([{ reason: 'delete', itemType: 'page', originalId: H, databaseId: null }]);
    const readerBody = await liveContent(READERS[0]);
    check('a stale trash row for a live page never strips links to it', !!readerBody?.includes(`href="/page/${H}"`), readerBody ?? 'missing');

    console.log('\nknowledge map attention lists:');
    const { attention } = await getWorkspaceGraph(W);
    check('the map returns attention lists', !!attention);
    const orphans = new Set((attention?.orphans ?? []).map((entry) => entry[0]));
    const hubs = new Set((attention?.hubs ?? []).map((entry) => entry[0]));
    check('a page named in 3 pages but never linked is an orphan', orphans.has(M));
    check('…and not also a hub', !hubs.has(M));
    check('a page linked from 3 pages is still a hub', hubs.has(H), JSON.stringify([...hubs]));
    check('no node is both an orphan and a hub', [...orphans].every((node) => !hubs.has(node)));
    check('the restored parent and child are not orphans', !orphans.has(P) && !orphans.has(C), JSON.stringify([...orphans]));
  } finally {
    await deleteWorkspaceData(W);
    await db.delete(users).where(eq(users.id, userId));
  }

  const [left] = await db.select({ n: sql<number>`count(*)` }).from(workspaceItems).where(eq(workspaceItems.workspaceId, W));
  check('cleanup left no test items behind', Number(left?.n ?? 0) === 0);

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().then(() => process.exit(0), (error) => {
  console.error(error);
  process.exit(1);
});
