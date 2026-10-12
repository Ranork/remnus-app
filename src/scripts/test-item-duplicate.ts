/**
 * Regression check for duplicating inside a workspace (src/lib/services/itemDuplicate.ts)
 * and for the role rule every web write follows (src/lib/auth/workspaceRole.ts).
 *
 * Part 1 needs no database: who may read, edit and manage a workspace.
 * Part 2 is a static audit of the server actions: every exported function that writes
 * names the role it needs, so a new action cannot silently let a Viewer edit.
 * Part 3 seeds one workspace — a page with a sub-page whose body embeds that sub-page and
 * links to a database row; a database with rows, a repeating series and a page nested
 * under a row; knowledge labels — then duplicates:
 *   - the page: its sub-page comes along and the parent's child block points at the copy;
 *   - the database with its rows: rows, the series and the row's sub-page are copied, and
 *     the copied occurrence belongs to the copied series;
 *   - the database without rows: columns and views only, nothing nested under a row;
 *   - one row: a new last card in the same database, with its sub-page, outside the series.
 * The originals must be untouched.
 *
 * **Local only.** It writes rows and deletes them again; it refuses a non-`file:` URL.
 *
 *   DATABASE_URL="file:local.db" npm run test:item-duplicate
 */
import 'dotenv/config';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  databases,
  knowledgeMetadata,
  pages,
  recurrenceSeries,
  standalonePages,
  users,
  workspaceItems,
  workspaceMembers,
  workspaces,
} from '@/db/schema';
import { roleAllows } from '@/lib/auth/workspaceRole';
import { duplicateItemSubtree, duplicateRowSubtree } from '@/lib/services/itemDuplicate';
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

// ── Part 1: the role rule ─────────────────────────────────────────────────────

function roleChecks() {
  console.log('roles (no database):');
  check('everyone may read', roleAllows('owner', 'read') && roleAllows('member', 'read') && roleAllows('viewer', 'read'));
  check('owners and members edit', roleAllows('owner', 'edit') && roleAllows('member', 'edit'));
  check('a viewer does not edit', !roleAllows('viewer', 'edit'));
  check('only the owner manages the workspace', roleAllows('owner', 'own') && !roleAllows('member', 'own') && !roleAllows('viewer', 'own'));
  check('an unknown role does not manage', !roleAllows(null, 'own') && !roleAllows(undefined, 'own'));
}

// ── Part 2: every write names its role ────────────────────────────────────────

/** Exported actions that write but check access some other way, with the reason. */
const AUDIT_EXCEPTIONS: Record<string, string> = {
  // A per-user sidebar preference, open to every member.
  setWorkspaceHidden: 'per-user preference',
  // The user's own ordering of their workspaces.
  updateWorkspacesOrder: 'per-user preference',
  // Creating a workspace makes the caller its owner; there is no workspace yet to check.
  createWorkspace: 'no workspace yet',
  // Takes a copy into a NEW workspace; the copier must not be a Viewer of the source (checked inline).
  duplicateWorkspace: 'checked inline',
  // Leaving is the member's own choice, whatever their role.
  leaveWorkspace: 'any member',
  // Delegate to an action that names the role.
  createDatabase: 'createWorkspaceDatabase (edit)',
  deleteDashboardBlock: 'patchAsUser → loadSpecForWrite (edit)',
  saveDashboardBlock: 'patchAsUser → loadSpecForWrite (edit)',
  createShareWithChildren: 'createShare (edit) first',
  // Opening is a read; creating the missing one goes through createDashboard (edit).
  openOrCreateHomeDashboard: 'createDashboard (edit)',
  // A public share link with write permission is its own grant, independent of membership.
  updateSharedPageContent: 'share permission',
};
const WRITE_VERB = /^(create|update|delete|duplicate|move|reparent|restore|add|revoke|set|reorder|bulk|detach|apply|rename|remove|import|mark|save|open|toggle|patch)/;
const ROLE_NAMED = /'edit'|'own'|assertWorkspaceManagementAccess|loadSpecForWrite|requireWorkspaceRole\([^)]*true/;

function auditActions() {
  console.log('\nserver actions name the role they need:');
  const dir = path.join(process.cwd(), 'src/lib/actions');
  const files = ['page', 'database', 'workspace', 'dashboard', 'comments', 'trash', 'history', 'sharing', 'recurrence', 'knowledge'];
  let audited = 0;
  for (const file of files) {
    const source = readFileSync(path.join(dir, `${file}.ts`), 'utf8');
    const starts = [...source.matchAll(/^export async function (\w+)\s*\(/gm)];
    starts.forEach((match, i) => {
      const name = match[1];
      if (!WRITE_VERB.test(name) || name in AUDIT_EXCEPTIONS) return;
      const body = source.slice(match.index, i + 1 < starts.length ? starts[i + 1].index : undefined);
      audited += 1;
      check(`${file}.${name}`, ROLE_NAMED.test(body), 'no role named — a Viewer could call it');
    });
  }
  check('the audit found the write actions', audited >= 40, `only ${audited}`);
}

// ── Part 3: against a database ────────────────────────────────────────────────

const url = process.env.DATABASE_URL ?? 'file:local.db';
if (!url.startsWith('file:')) {
  console.error(`Refusing to run against a remote database (${url.split('@').pop()}). Set DATABASE_URL="file:local.db".`);
  process.exit(1);
}

const SUFFIX = `test-itemdup-${Date.now()}`;
const userId = `${SUFFIX}-user`;
const wsId = `${SUFFIX}-ws`;
const ids = {
  page: `${SUFFIX}-page`,
  subPage: `${SUFFIX}-sub`,
  dbItem: `${SUFFIX}-dbitem`,
  database: `${SUFFIX}-db`,
  rows: [1, 2, 3].map((n) => `${SUFFIX}-row${n}`),
  rowChild: `${SUFFIX}-rowchild`,
  series: `${SUFFIX}-series`,
};

async function seed() {
  const now = new Date();
  await db.insert(workspaces).values({ id: wsId, name: 'Item copies', billingOwnerId: userId, createdAt: now, updatedAt: now });
  await db.insert(workspaceMembers).values({ workspaceId: wsId, userId, role: 'owner', createdAt: now });
  await db.insert(workspaceItems).values([
    { id: ids.page, workspaceId: wsId, type: 'page', title: 'Handbook', parentId: null, sortOrder: 0, icon: '📘', createdAt: now, updatedAt: now },
    { id: ids.subPage, workspaceId: wsId, type: 'page', title: 'Onboarding', parentId: ids.page, sortOrder: 0, createdAt: now, updatedAt: now },
    { id: ids.dbItem, workspaceId: wsId, type: 'database', title: 'Tasks', parentId: null, sortOrder: 1, createdAt: now, updatedAt: now },
    { id: ids.rowChild, workspaceId: wsId, type: 'page', title: 'Row notes', parentId: ids.rows[0], sortOrder: 0, createdAt: now, updatedAt: now },
  ]);
  const body =
    `See <a data-page-link href="/db/${ids.database}/${ids.rows[0]}" data-type="database_row">the first task</a>.\n\n`
    + `<div data-cb-id="${ids.subPage}" data-cb-dbid="" data-cb-type="page" data-cb-title="Onboarding" data-cb-icon="" data-cb-iconcolor=""></div>`;
  await db.insert(standalonePages).values([
    { id: `${ids.page}-body`, itemId: ids.page, content: body, createdAt: now, updatedAt: now },
    { id: `${ids.subPage}-body`, itemId: ids.subPage, content: 'Welcome aboard.', createdAt: now, updatedAt: now },
    { id: `${ids.rowChild}-body`, itemId: ids.rowChild, content: 'Notes on the first task.', createdAt: now, updatedAt: now },
  ]);
  await db.insert(databases).values({
    id: ids.database, name: 'Tasks', itemId: ids.dbItem,
    schema: [{ id: 'title', name: 'Title', type: 'text' }, { id: 'due', name: 'Due', type: 'date' }],
    views: [{ id: 'view-cal', name: 'Calendar', type: 'calendar', dateCol: 'due' }],
    createdAt: now, updatedAt: now,
  });
  await db.insert(recurrenceSeries).values({
    id: ids.series, databaseId: ids.database, dateColId: 'due', rule: { freq: 'weekly' }, template: { title: 'Weekly' }, createdBy: userId, createdAt: now, updatedAt: now,
  });
  await db.insert(pages).values(ids.rows.map((id, i) => ({
    id, databaseId: ids.database, title: `Task ${i + 1}`,
    content: i === 0 ? `<div data-cb-id="${ids.rowChild}" data-cb-dbid="" data-cb-type="page" data-cb-title="Row notes" data-cb-icon="" data-cb-iconcolor=""></div>` : '',
    properties: { due: '2026-10-12' }, sortOrder: i,
    seriesId: i === 0 ? ids.series : null, occurrenceDate: i === 0 ? '2026-10-12' : null,
    createdAt: now, updatedAt: now,
  })));
  await db.insert(knowledgeMetadata).values([
    { workspaceId: wsId, itemId: ids.subPage, itemType: 'page', conceptType: 'guide', createdAt: now, updatedAt: now },
    { workspaceId: wsId, itemId: ids.rows[0], itemType: 'database_row', conceptType: 'task', createdAt: now, updatedAt: now },
  ]);
}

async function itemsOf() {
  return db.select().from(workspaceItems).where(eq(workspaceItems.workspaceId, wsId));
}
async function bodyOf(itemId: string) {
  const [b] = await db.select().from(standalonePages).where(eq(standalonePages.itemId, itemId));
  return b?.content ?? null;
}

async function main() {
  roleChecks();
  auditActions();

  await db.run(sql`PRAGMA foreign_keys = ON`);
  await db.insert(users).values({ id: userId, name: 'Copy Tester', email: `${userId}@example.invalid`, role: 'user' });
  try {
    await seed();
    const before = await itemsOf();

    console.log('\na page with a sub-page:');
    const pageCopy = await duplicateItemSubtree({ itemId: ids.page, includeRows: true });
    check('returns the copied page', pageCopy?.type === 'page' && pageCopy.itemId !== ids.page);
    const afterPage = await itemsOf();
    const copiedPage = afterPage.find((i) => i.id === (pageCopy as { itemId: string }).itemId)!;
    check('the copy sits right below the original', copiedPage.parentId === null && copiedPage.sortOrder === 1 && copiedPage.icon === '📘');
    const copiedSub = afterPage.find((i) => i.parentId === copiedPage.id);
    check('the sub-page comes along under the copy', !!copiedSub && copiedSub.title === 'Onboarding' && copiedSub.id !== ids.subPage);
    const copiedBody = await bodyOf(copiedPage.id);
    check('the child block points at the copied sub-page', !!copiedBody && copiedBody.includes(`data-cb-id="${copiedSub?.id}"`) && !copiedBody.includes(`data-cb-id="${ids.subPage}"`));
    check('a link out of the branch is kept', !!copiedBody && copiedBody.includes(`/db/${ids.database}/${ids.rows[0]}`));
    check('the sub-page body is copied', (await bodyOf(copiedSub!.id)) === 'Welcome aboard.');
    const subLabels = await db.select().from(knowledgeMetadata).where(eq(knowledgeMetadata.itemId, copiedSub!.id));
    check('the sub-page knowledge label is copied', subLabels.length === 1 && subLabels[0].conceptType === 'guide');
    check('the original page body is untouched', (await bodyOf(ids.page))!.includes(`data-cb-id="${ids.subPage}"`));

    console.log('\na database with rows:');
    const dbCopy = await duplicateItemSubtree({ itemId: ids.dbItem, includeRows: true });
    check('returns the copied database', dbCopy?.type === 'database' && dbCopy.dbId !== ids.database);
    const newDbId = (dbCopy as { dbId: string }).dbId;
    const copiedRows = await db.select().from(pages).where(eq(pages.databaseId, newDbId));
    check('every row is copied', copiedRows.length === 3 && copiedRows.every((r) => !ids.rows.includes(r.id)));
    const [copiedSeries] = await db.select().from(recurrenceSeries).where(eq(recurrenceSeries.databaseId, newDbId));
    check('the series is copied', !!copiedSeries && copiedSeries.id !== ids.series);
    const copiedOccurrence = copiedRows.find((r) => r.title === 'Task 1')!;
    check('the occurrence belongs to the copied series', copiedOccurrence.seriesId === copiedSeries?.id && copiedOccurrence.occurrenceDate === '2026-10-12');
    const afterDb = await itemsOf();
    const copiedRowChild = afterDb.find((i) => i.parentId === copiedOccurrence.id);
    check('the page nested under a row comes along', !!copiedRowChild && copiedRowChild.title === 'Row notes');
    check('the row body embeds the copied sub-page', copiedOccurrence.content.includes(`data-cb-id="${copiedRowChild?.id}"`));
    const rowLabels = await db.select().from(knowledgeMetadata).where(eq(knowledgeMetadata.itemId, copiedOccurrence.id));
    check('the row knowledge label is copied', rowLabels.length === 1 && rowLabels[0].itemType === 'database_row');

    console.log('\na database without rows:');
    const shapeCopy = await duplicateItemSubtree({ itemId: ids.dbItem, includeRows: false });
    const shapeDbId = (shapeCopy as { dbId: string }).dbId;
    const [shapeDb] = await db.select().from(databases).where(eq(databases.id, shapeDbId));
    check('columns and views are copied', JSON.stringify(shapeDb.schema).includes('"due"') && JSON.stringify(shapeDb.views).includes('view-cal'));
    check('no rows', (await db.select().from(pages).where(eq(pages.databaseId, shapeDbId))).length === 0);
    check('no series', (await db.select().from(recurrenceSeries).where(eq(recurrenceSeries.databaseId, shapeDbId))).length === 0);
    const afterShape = await itemsOf();
    check('nothing nested under a row', afterShape.length === afterDb.length + 1);

    console.log('\none row:');
    const [source] = await db.select().from(pages).where(eq(pages.id, ids.rows[0]));
    const { rowId, nestedItems } = await duplicateRowSubtree({ workspaceId: wsId, row: source, sortOrder: 3 });
    const [rowCopy] = await db.select().from(pages).where(eq(pages.id, rowId));
    check('a new card in the same database, last', !!rowCopy && rowCopy.databaseId === ids.database && rowCopy.sortOrder === 3 && rowCopy.title === 'Task 1');
    check('outside the series', rowCopy.seriesId === null && rowCopy.occurrenceDate === null);
    const rowCopyChild = (await itemsOf()).find((i) => i.parentId === rowId);
    check('its sub-page comes along', nestedItems === 1 && !!rowCopyChild && rowCopyChild.title === 'Row notes');
    check('its body embeds the copied sub-page', rowCopy.content.includes(`data-cb-id="${rowCopyChild?.id}"`));

    console.log('\nthe originals:');
    const originalRows = await db.select().from(pages).where(eq(pages.databaseId, ids.database));
    check('the source database keeps its rows plus the one copy', originalRows.length === 4);
    const [origOccurrence] = await db.select().from(pages).where(and(eq(pages.id, ids.rows[0]), eq(pages.seriesId, ids.series)));
    check('the original occurrence still follows its series', !!origOccurrence);
    const originalItems = (await itemsOf()).filter((i) => before.some((b) => b.id === i.id));
    check('every original item is still where it was', originalItems.length === before.length
      && originalItems.every((i) => { const b = before.find((x) => x.id === i.id)!; return b.parentId === i.parentId && b.title === i.title; }));
  } finally {
    await deleteWorkspaceData(wsId).catch((e) => console.error('cleanup', e));
    await db.delete(users).where(inArray(users.id, [userId]));
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
