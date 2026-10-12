/**
 * Regression check for `duplicateWorkspaceData` (src/lib/services/workspaceDuplicate.ts).
 *
 * Part 1 needs no database: `remapContentIds` / `remapDashboardSpec` / `copiedIcon`.
 * Part 2 seeds one workspace — a nested page whose body links to a sibling page, a database,
 * a row and a child block; a dashboard over the database; a database with rows, a view and a
 * repeating series; knowledge labels; a home dashboard; an item with a Cloudinary icon;
 * comments and a second member that must NOT travel — then copies it both ways:
 *   - with data: every id is new, parents / links / dashboard sources point at the copy,
 *     rows and the series come along, the source is untouched;
 *   - structure only: the same minus rows and series, and a link to a row becomes a link
 *     to its database;
 *   - the plan's workspace cap still applies.
 *
 * **Local only.** It writes rows and deletes them again; it refuses a non-`file:` URL.
 *
 *   DATABASE_URL="file:local.db" npm run test:workspace-duplicate
 */
import 'dotenv/config';

import { eq, inArray, sql } from 'drizzle-orm';
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
import {
  copiedIcon,
  DuplicateWorkspaceLimitError,
  duplicateWorkspaceData,
  remapContentIds,
  remapDashboardSpec,
} from '@/lib/services/workspaceDuplicate';
import { deleteWorkspaceData } from '@/lib/services/workspaceDeletion';

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

// `isCloudinaryUrl` only recognises the app's own cloud account, read from the environment.
const CLOUD = process.env.CLOUDINARY_CLOUD_NAME || 'test-cloud';
process.env.CLOUDINARY_CLOUD_NAME = CLOUD;

// ── Part 1: pure remapping ────────────────────────────────────────────────────

function unitChecks() {
  console.log('remapping (no database):');
  const maps = {
    items: new Map([['I1', 'N1'], ['I2', 'N2']]),
    databases: new Map([['D1', 'ND1']]),
    rows: new Map([['R1', 'NR1']]),
  };

  const body = [
    '<a data-page-link href="/page/I1" data-type="page">One</a>',
    '<a data-page-link href="/db/D1" data-type="database">Tasks</a>',
    '<a data-page-link href="/db/D1/R1" data-type="database_row">A row</a>',
    '<a data-page-link href="/db/D1/GONE" data-type="database_row">A deleted row</a>',
    '<a data-page-link href="/page/OUTSIDE" data-type="page">Elsewhere</a>',
    '<a href="https://example.com/page/I1">not a page link</a>',
    '<div data-cb-id="I2" data-cb-dbid="" data-cb-type="page" data-cb-title="Two"></div>',
    '<div data-cb-id="I2" data-cb-dbid="D1" data-cb-type="database" data-cb-title="Tasks" data-cb-link="1"></div>',
  ].join('\n');
  const out = remapContentIds(body, maps);
  check('page link points at the copied page', out.includes('href="/page/N1"'));
  check('database link points at the copied database', out.includes('href="/db/ND1" data-type="database"'));
  check('row link points at the copied row', out.includes('href="/db/ND1/NR1"'));
  check('link to an unknown row falls back to the database', out.includes('href="/db/ND1" data-type="database">A deleted row'));
  check('link outside the workspace is left alone', out.includes('href="/page/OUTSIDE"'));
  check('an external URL is never touched', out.includes('href="https://example.com/page/I1"'));
  check('child block id and database id are remapped', out.includes('data-cb-id="N2" data-cb-dbid="" data-cb-type="page"') && out.includes('data-cb-id="N2" data-cb-dbid="ND1" data-cb-type="database"'));
  check('old ids are gone', !out.includes('href="/page/I1"') && !out.includes('href="/db/D1') && !out.includes('data-cb-id="I2"') && !out.includes('data-cb-dbid="D1"'));
  check('empty body stays empty', remapContentIds('', maps) === '');

  const noRows = remapContentIds('<a data-page-link href="/db/D1/R1" data-type="database_row">A row</a>', { ...maps, rows: new Map() });
  check('structure-only copy turns a row link into a database link', noRows.includes('href="/db/ND1"') && noRows.includes('data-type="database"'));

  const spec = { version: 1, blocks: [{ id: 'a', type: 'metric', source: { databaseId: 'D1', filters: [{ columnId: 'D1x', operator: 'equals', value: 'D1' }] } }, { id: 'b', type: 'database_embed', databaseId: 'D1', viewId: 'v1' }] };
  const mapped = remapDashboardSpec(spec, maps.databases) as any;
  check('dashboard sources point at the copied database', mapped.blocks[0].source.databaseId === 'ND1' && mapped.blocks[1].databaseId === 'ND1');
  check('only whole-string matches are swapped', mapped.blocks[0].source.filters[0].columnId === 'D1x');
  check('the source spec is not mutated', (spec.blocks[0] as { source: { databaseId: string } }).source.databaseId === 'D1');

  check('a Cloudinary icon is not shared', copiedIcon(`https://res.cloudinary.com/${CLOUD}/image/upload/v1/x.png`, 'red').icon === null);
  check('an emoji icon is kept', copiedIcon('🚀', null).icon === '🚀');
}

// ── Part 2: against a database ────────────────────────────────────────────────

const url = process.env.DATABASE_URL ?? 'file:local.db';
if (!url.startsWith('file:')) {
  console.error(`Refusing to run against a remote database (${url.split('@').pop()}). Set DATABASE_URL="file:local.db".`);
  process.exit(1);
}

const SUFFIX = `test-wsdup-${Date.now()}`;
const userId = `${SUFFIX}-user`;
const otherUserId = `${SUFFIX}-other`;
const sourceId = `${SUFFIX}-src`;

const ids = {
  parentPage: `${SUFFIX}-p-parent`,
  rowChild: `${SUFFIX}-p-rowchild`,
  childPage: `${SUFFIX}-p-child`,
  dashboard: `${SUFFIX}-dash`,
  dbItem: `${SUFFIX}-dbitem`,
  iconItem: `${SUFFIX}-iconitem`,
  database: `${SUFFIX}-db`,
  rows: [1, 2, 3].map((n) => `${SUFFIX}-row${n}`),
  series: `${SUFFIX}-series`,
};
const CLOUDINARY_ICON = `https://res.cloudinary.com/${CLOUD}/image/upload/v1/test-icon.png`;

async function seed() {
  const now = new Date();
  await db.insert(workspaces).values({
    id: sourceId, name: 'Template workspace', billingOwnerId: userId, homeDashboardItemId: ids.dashboard, createdAt: now, updatedAt: now,
  });
  await db.insert(workspaceMembers).values([
    { workspaceId: sourceId, userId, role: 'owner', createdAt: now },
    { workspaceId: sourceId, userId: otherUserId, role: 'member', createdAt: now },
  ]);
  await db.insert(workspaceItems).values([
    { id: ids.parentPage, workspaceId: sourceId, type: 'page', title: 'Handbook', parentId: null, sortOrder: 0, icon: '📘', createdAt: now, updatedAt: now },
    { id: ids.childPage, workspaceId: sourceId, type: 'page', title: 'Onboarding', parentId: ids.parentPage, sortOrder: 0, createdAt: now, updatedAt: now },
    { id: ids.dashboard, workspaceId: sourceId, type: 'dashboard', title: 'Status', parentId: null, sortOrder: 1, createdAt: now, updatedAt: now },
    { id: ids.dbItem, workspaceId: sourceId, type: 'database', title: 'Tasks', parentId: null, sortOrder: 2, createdAt: now, updatedAt: now },
    { id: ids.iconItem, workspaceId: sourceId, type: 'page', title: 'Has an uploaded icon', parentId: null, sortOrder: 3, icon: CLOUDINARY_ICON, iconColor: null, createdAt: now, updatedAt: now },
    // A sub-page of a database ROW (parent_id is the row's id, not a sidebar item's).
    { id: ids.rowChild, workspaceId: sourceId, type: 'page', title: 'Row sub-page', parentId: `${SUFFIX}-row1`, sortOrder: 0, createdAt: now, updatedAt: now },
  ]);
  const body =
    `See <a data-page-link href="/page/${ids.childPage}" data-type="page">Onboarding</a>, `
    + `<a data-page-link href="/db/${ids.database}" data-type="database">Tasks</a> and `
    + `<a data-page-link href="/db/${ids.database}/${ids.rows[0]}" data-type="database_row">the first task</a>.\n\n`
    + `<div data-cb-id="${ids.dbItem}" data-cb-dbid="${ids.database}" data-cb-type="database" data-cb-title="Tasks" data-cb-icon="" data-cb-iconcolor="" data-cb-link="1"></div>`;
  await db.insert(standalonePages).values([
    { id: `${ids.parentPage}-body`, itemId: ids.parentPage, content: body, createdAt: now, updatedAt: now },
    { id: `${ids.childPage}-body`, itemId: ids.childPage, content: 'Welcome aboard.', createdAt: now, updatedAt: now },
    { id: `${ids.iconItem}-body`, itemId: ids.iconItem, content: '', createdAt: now, updatedAt: now },
    { id: `${ids.rowChild}-body`, itemId: ids.rowChild, content: 'Notes on the first task.', createdAt: now, updatedAt: now },
  ]);
  await db.insert(dashboards).values({
    id: `${ids.dashboard}-spec`, itemId: ids.dashboard,
    spec: { version: 1, blocks: [{ id: 'all', type: 'metric', title: 'All', source: { databaseId: ids.database } }] },
    createdAt: now, updatedAt: now,
  });
  await db.insert(databases).values({
    id: ids.database, name: 'Tasks', itemId: ids.dbItem,
    schema: [{ id: 'title', name: 'Title', type: 'text' }, { id: 'status', name: 'Status', type: 'status' }],
    views: [{ id: 'view-board', name: 'Board', type: 'kanban', groupByCol: 'status' }],
    createdAt: now, updatedAt: now,
  });
  await db.insert(recurrenceSeries).values({
    id: ids.series, databaseId: ids.database, dateColId: 'due', rule: { freq: 'weekly' }, template: { title: 'Weekly' }, createdBy: userId, createdAt: now, updatedAt: now,
  });
  await db.insert(pages).values(ids.rows.map((id, i) => ({
    id, databaseId: ids.database, title: `Task ${i + 1}`, content: i === 0 ? `Related: <a data-page-link href="/page/${ids.parentPage}" data-type="page">Handbook</a>` : '',
    properties: { status: i === 0 ? 'Done' : 'Todo' }, sortOrder: i, seriesId: i === 2 ? ids.series : null, occurrenceDate: i === 2 ? '2026-10-12' : null,
    agentTokenId: i === 1 ? 'some-old-token' : null, createdAt: now, updatedAt: now,
  })));
  await db.insert(knowledgeMetadata).values([
    { workspaceId: sourceId, itemId: ids.parentPage, itemType: 'page', conceptType: 'guide', tags: ['onboarding'], createdAt: now, updatedAt: now },
    { workspaceId: sourceId, itemId: ids.rows[0], itemType: 'database_row', conceptType: 'task', createdAt: now, updatedAt: now },
  ]);
  await db.insert(pageComments).values({ pageId: ids.parentPage, workspaceId: sourceId, body: 'old comment', authorKind: 'human', authorLabel: 'Tester', createdAt: now, updatedAt: now });
}

type Counts = Awaited<ReturnType<typeof inspect>>;

async function inspect(workspaceId: string) {
  const items = await db.select().from(workspaceItems).where(eq(workspaceItems.workspaceId, workspaceId));
  const itemIds = items.map((i) => i.id);
  const dbs = itemIds.length ? await db.select().from(databases).where(inArray(databases.itemId, itemIds)) : [];
  const dbIds = dbs.map((d) => d.id);
  const [bodies, dashes, rows, series, knowledge, members, comments, links, ws] = await Promise.all([
    itemIds.length ? db.select().from(standalonePages).where(inArray(standalonePages.itemId, itemIds)) : [],
    itemIds.length ? db.select().from(dashboards).where(inArray(dashboards.itemId, itemIds)) : [],
    dbIds.length ? db.select().from(pages).where(inArray(pages.databaseId, dbIds)) : [],
    dbIds.length ? db.select().from(recurrenceSeries).where(inArray(recurrenceSeries.databaseId, dbIds)) : [],
    db.select().from(knowledgeMetadata).where(eq(knowledgeMetadata.workspaceId, workspaceId)),
    db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId)),
    db.select().from(pageComments).where(eq(pageComments.workspaceId, workspaceId)),
    db.select().from(pageLinks).where(eq(pageLinks.workspaceId, workspaceId)),
    db.select().from(workspaces).where(eq(workspaces.id, workspaceId)),
  ]);
  return { items, dbs, bodies, dashes, rows, series, knowledge, members, comments, links, ws: ws[0] };
}

function checkCopy(label: string, copy: Counts, src: Counts, withData: boolean) {
  console.log(`\n${label}:`);
  const srcIds = new Set([...src.items.map((i) => i.id), ...src.dbs.map((d) => d.id), ...src.rows.map((r) => r.id)]);
  const allNew = [...copy.items.map((i) => i.id), ...copy.dbs.map((d) => d.id), ...copy.rows.map((r) => r.id)].every((id) => !srcIds.has(id));
  check('every copied id is new', allNew);
  const expectedItems = withData ? src.items : src.items.filter((i) => i.title !== 'Row sub-page');
  check('same sidebar items', copy.items.length === expectedItems.length && copy.items.map((i) => i.title).sort().join('|') === expectedItems.map((i) => i.title).sort().join('|'), `${copy.items.length} vs ${expectedItems.length}`);

  const byTitle = (t: string) => copy.items.find((i) => i.title === t)!;
  check('the nested page still sits under its parent', byTitle('Onboarding').parentId === byTitle('Handbook').id);
  check('the home dashboard is the copied dashboard', copy.ws.homeDashboardItemId === byTitle('Status').id);
  check('an uploaded (Cloudinary) icon is dropped, an emoji kept', byTitle('Has an uploaded icon').icon === null && byTitle('Handbook').icon === '📘');

  const newDb = copy.dbs[0];
  check('the database keeps its columns and views', copy.dbs.length === 1 && JSON.stringify(newDb.schema) === JSON.stringify(src.dbs[0].schema) && JSON.stringify(newDb.views) === JSON.stringify(src.dbs[0].views));
  const dashSpec = JSON.stringify(copy.dashes[0]?.spec);
  check('the dashboard reads from the copied database', dashSpec.includes(newDb.id) && !dashSpec.includes(src.dbs[0].id));

  const handbook = copy.bodies.find((b) => b.itemId === byTitle('Handbook').id)!;
  check('page body links point at the copy', handbook.content.includes(`/page/${byTitle('Onboarding').id}`) && handbook.content.includes(`/db/${newDb.id}`) && handbook.content.includes(`data-cb-id="${byTitle('Tasks').id}"`));
  check('page body no longer mentions the source', ![...srcIds].some((id) => handbook.content.includes(id)));
  const graphTargets = new Set(copy.links.map((l) => l.toId));
  check('the link graph was rebuilt for the copy', copy.links.length > 0 && copy.links.every((l) => !srcIds.has(l.toId) && !srcIds.has(l.fromId)) && graphTargets.has(byTitle('Onboarding').id));

  check('only the copier is a member, as owner', copy.members.length === 1 && copy.members[0].userId === userId && copy.members[0].role === 'owner');
  check('comments are not copied', copy.comments.length === 0);
  check('knowledge labels follow the items they describe', copy.knowledge.some((k) => k.itemId === byTitle('Handbook').id && k.conceptType === 'guide'));

  if (withData) {
    const copiedRow = copy.rows.find((r) => r.title === 'Task 1')!;
    check('a sub-page of a row hangs on the copied row', byTitle('Row sub-page').parentId === copiedRow.id);
    check('rows are copied', copy.rows.length === 3 && copy.rows.map((r) => r.title).sort().join() === 'Task 1,Task 2,Task 3');
    check('rows belong to the copied database', copy.rows.every((r) => r.databaseId === newDb.id));
    check('row bodies are re-pointed', copy.rows.find((r) => r.title === 'Task 1')!.content.includes(`/page/${byTitle('Handbook').id}`));
    check('agent attribution is not carried over', copy.rows.every((r) => r.agentTokenId === null));
    check('the repeating series comes along and its occurrence follows it', copy.series.length === 1 && copy.rows.find((r) => r.title === 'Task 3')!.seriesId === copy.series[0].id && copy.series[0].databaseId === newDb.id);
    check('row knowledge labels are copied', copy.knowledge.some((k) => k.itemType === 'database_row'));
  } else {
    check('no rows and no series', copy.rows.length === 0 && copy.series.length === 0);
    check('a sub-page of a row is left out, not dropped on the root', !copy.items.some((i) => i.title === 'Row sub-page') && !copy.bodies.some((b) => b.content.startsWith('Notes on the first task')));
    check('a link to a row now links to its database', handbook.content.includes(`href="/db/${newDb.id}" data-type="database"`) && !handbook.content.includes('database_row'));
    check('knowledge labels of rows are left out', copy.knowledge.every((k) => k.itemType !== 'database_row'));
  }
}

async function main() {
  unitChecks();

  // The app sets this at module load without awaiting; the cascades below need it now.
  await db.run(sql`PRAGMA foreign_keys = ON`);
  await db.insert(users).values([
    { id: userId, name: 'Duplicate Tester', email: `${userId}@example.invalid`, role: 'user' },
    { id: otherUserId, name: 'Other Member', email: `${otherUserId}@example.invalid`, role: 'user' },
  ]);

  const created: string[] = [];
  try {
    await seed();
    const src = await inspect(sourceId);
    console.log('\nSeeded:', { items: src.items.length, rows: src.rows.length, members: src.members.length });

    const withDataId = await duplicateWorkspaceData({ sourceWorkspaceId: sourceId, userId, name: 'Copy with data', includeData: true, skipPlanLimit: true });
    created.push(withDataId);
    const withData = await inspect(withDataId);
    check('the copy has the requested name', withData.ws.name === 'Copy with data');
    checkCopy('copy with data', withData, src, true);

    const structureId = await duplicateWorkspaceData({ sourceWorkspaceId: sourceId, userId, name: '  ', includeData: false, skipPlanLimit: true });
    created.push(structureId);
    const structure = await inspect(structureId);
    check('a blank name falls back to the source name', structure.ws.name === 'Template workspace');
    checkCopy('copy, structure only', structure, src, false);

    const after = await inspect(sourceId);
    console.log('\nthe source:');
    check('is untouched', after.items.length === src.items.length && after.rows.length === 3 && after.members.length === 2 && after.comments.length === 1 && JSON.stringify(after.bodies.map((b) => b.content).sort()) === JSON.stringify(src.bodies.map((b) => b.content).sort()));

    console.log('\nplan limit:');
    // The free plan allows two owned workspaces; the source and the two copies make three.
    let limited = false;
    try {
      await duplicateWorkspaceData({ sourceWorkspaceId: sourceId, userId, name: 'One too many', includeData: false });
    } catch (err) {
      limited = err instanceof DuplicateWorkspaceLimitError;
    }
    check('a user at the workspace cap cannot copy', limited);
  } finally {
    for (const id of [...created, sourceId]) await deleteWorkspaceData(id).catch((e) => console.error('cleanup', id, e));
    await db.delete(users).where(inArray(users.id, [userId, otherUserId]));
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().then(() => process.exit(0), (error) => {
  console.error(error);
  process.exit(1);
});
