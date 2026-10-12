/**
 * Regression check for the bulk row contracts, against a real database:
 *
 *  - `bulkUpdatePages` (MCP `bulk_update_pages`): one bad id no longer sinks the call —
 *    every entry reports `ok` / `error`, and the entries that were fine are applied.
 *  - `bulkMoveRowsToDatabase` (MCP `bulk_move_items`, web "Move to…"): refused as a whole,
 *    naming the columns, when the target cannot hold them (`RowMoveSchemaError`); moves
 *    only rows that live in the caller's workspace; re-maps column ids by name; and keeps
 *    a moved occurrence of a repeating series from following the old series.
 *  - `getConnectionStatus` (MCP `get_status`): what it reports for an expiring OAuth token
 *    and for a write token narrowed to read.
 *
 * **Local only.** It writes rows and deletes them again; it refuses a non-`file:` URL.
 *
 *   DATABASE_URL="file:local.db" npm run test:bulk-contract
 */
import 'dotenv/config';

import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { databases, pages, users, workspaceItems, workspaceMembers, workspaces } from '@/db/schema';
import { bulkMoveRowsToDatabase, bulkUpdatePages, RowMoveSchemaError } from '@/lib/services/workspace';
import { getConnectionStatus } from '@/lib/services/connectionStatus';
import { deleteWorkspaceData } from '@/lib/services/workspaceDeletion';
import type { TokenContext } from '@/app/api/mcp/context';

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

const SUFFIX = `test-bulk-${Date.now()}`;
const userId = `${SUFFIX}-user`;
const W1 = `${SUFFIX}-w1`;
const W2 = `${SUFFIX}-w2`;

const ids = {
  srcDb: `${SUFFIX}-src`, tgtDb: `${SUFFIX}-tgt`, badDb: `${SUFFIX}-bad`, foreignDb: `${SUFFIX}-foreign`,
  rows: [1, 2, 3].map((n) => `${SUFFIX}-row${n}`),
  foreignRow: `${SUFFIX}-foreign-row`,
};

async function seedWorkspace(workspaceId: string, name: string) {
  const now = new Date();
  await db.insert(workspaces).values({ id: workspaceId, name, billingOwnerId: userId, createdAt: now, updatedAt: now });
  await db.insert(workspaceMembers).values({ workspaceId, userId, role: 'owner', createdAt: now });
}

async function seedDatabase(workspaceId: string, databaseId: string, title: string, schema: unknown[]) {
  const now = new Date();
  const itemId = `${databaseId}-item`;
  await db.insert(workspaceItems).values({ id: itemId, workspaceId, type: 'database', title, parentId: null, sortOrder: 0, createdAt: now, updatedAt: now });
  await db.insert(databases).values({ id: databaseId, name: title, itemId, schema, views: [], createdAt: now, updatedAt: now });
}

async function main() {
  // The app sets this at module load without awaiting; the cascades below need it now.
  await db.run(sql`PRAGMA foreign_keys = ON`);
  await db.insert(users).values({ id: userId, name: 'Bulk Tester', email: `${userId}@example.invalid`, role: 'user' });

  try {
    const now = new Date();
    await seedWorkspace(W1, 'Bulk one');
    await seedWorkspace(W2, 'Bulk two');
    await seedDatabase(W1, ids.srcDb, 'Tasks', [
      { id: 'title', name: 'Title', type: 'text' },
      { id: 'col_status', name: 'Status', type: 'status' },
    ]);
    // Same columns by name and type, different ids — the move has to re-map them.
    await seedDatabase(W1, ids.tgtDb, 'Archive', [
      { id: 'title', name: 'Title', type: 'text' },
      { id: 'col_other_status', name: 'status', type: 'status' },
      { id: 'col_extra', name: 'Extra', type: 'text' },
    ]);
    await seedDatabase(W1, ids.badDb, 'Different', [
      { id: 'title', name: 'Title', type: 'text' },
      { id: 'col_status', name: 'Status', type: 'text' },
    ]);
    await seedDatabase(W2, ids.foreignDb, 'Other workspace', [
      { id: 'title', name: 'Title', type: 'text' },
      { id: 'col_status', name: 'Status', type: 'status' },
    ]);
    await db.insert(pages).values([
      ...ids.rows.map((id, i) => ({
        id, databaseId: ids.srcDb, title: `Task ${i + 1}`, content: '', properties: { col_status: 'Todo' }, sortOrder: i,
        seriesId: i === 2 ? `${SUFFIX}-series` : null, occurrenceDate: i === 2 ? '2026-10-12' : null, createdAt: now, updatedAt: now,
      })),
      { id: ids.foreignRow, databaseId: ids.foreignDb, title: 'Not yours', content: '', properties: { col_status: 'Todo' }, sortOrder: 0, createdAt: now, updatedAt: now },
    ]);

    console.log('bulkUpdatePages:');
    const updates = await bulkUpdatePages(W1, [
      { pageId: ids.rows[0], title: 'Renamed one' },
      { pageId: `${SUFFIX}-no-such-row`, title: 'Ghost' },
      { pageId: ids.rows[1], title: 'Renamed two' },
    ]);
    check('returns one result per entry, in request order', updates.map((r) => r.id).join() === [ids.rows[0], `${SUFFIX}-no-such-row`, ids.rows[1]].join());
    check('the bad entry reports ok: false with a reason', updates[1].ok === false && !!updates[1].error && updates[1].updated === false, JSON.stringify(updates[1]));
    check('the good entries report ok: true', updates[0].ok && updates[2].ok && updates[0].updated && updates[2].updated);
    const [renamed] = await db.select({ title: pages.title }).from(pages).where(eq(pages.id, ids.rows[1]));
    check('…and were applied despite the failure next to them', renamed?.title === 'Renamed two');
    const crossWorkspace = await bulkUpdatePages(W1, [{ pageId: ids.foreignRow, title: 'Hijacked' }]);
    check('a row of another workspace is refused, not written', crossWorkspace[0].ok === false);
    const [foreign] = await db.select({ title: pages.title }).from(pages).where(eq(pages.id, ids.foreignRow));
    check('…and its title is untouched', foreign?.title === 'Not yours');

    console.log('\nbulkMoveRowsToDatabase:');
    let mismatch: string[] | null = null;
    try {
      await bulkMoveRowsToDatabase(W1, ids.rows, ids.badDb);
    } catch (err) {
      if (err instanceof RowMoveSchemaError) mismatch = err.columns;
    }
    check('a target with a different column type is refused, naming the column', mismatch?.join() === 'Status', JSON.stringify(mismatch));
    const stillThere = await db.select({ id: pages.id }).from(pages).where(eq(pages.databaseId, ids.srcDb));
    check('…and nothing moved', stillThere.length === 3);

    const moved = await bulkMoveRowsToDatabase(W1, [...ids.rows, ids.foreignRow], ids.tgtDb);
    check('rows of this workspace move', ids.rows.every((id) => moved.find((r) => r.id === id)?.ok));
    check('a row of another workspace is refused', moved.find((r) => r.id === ids.foreignRow)?.ok === false);
    const [foreignAfter] = await db.select({ databaseId: pages.databaseId }).from(pages).where(eq(pages.id, ids.foreignRow));
    check('…and stays where it was', foreignAfter?.databaseId === ids.foreignDb);

    const inTarget = await db.select().from(pages).where(inArray(pages.id, ids.rows));
    check('moved rows belong to the target', inTarget.every((r) => r.databaseId === ids.tgtDb));
    check('their properties follow the target column ids', inTarget.every((r) => (r.properties as Record<string, unknown>).col_other_status === 'Todo' && !('col_status' in (r.properties as object))));
    const occurrence = inTarget.find((r) => r.id === ids.rows[2])!;
    const plain = inTarget.find((r) => r.id === ids.rows[0])!;
    check('an occurrence of a repeating series stops following it', occurrence.seriesDetached === true && plain.seriesDetached === false);

    console.log('\ngetConnectionStatus:');
    const base: TokenContext = {
      tokenId: 't1', tokenKind: 'oauth', workspaceId: W1, scope: 'write', storedScope: 'write', agentName: 'Claude',
      ownerUserId: userId, expiresAt: Date.parse('2026-10-12T10:00:00Z'),
    };
    const at = new Date('2026-10-12T09:30:00Z');
    const oauth = await getConnectionStatus(base, at);
    check('names the workspace and the connection', oauth.workspace.name === 'Bulk one' && oauth.connection.kind === 'oauth' && oauth.connection.agentName === 'Claude');
    check('counts down to the token expiry', oauth.expiresAt === '2026-10-12T10:00:00.000Z' && oauth.expiresInSeconds === 1800);
    check('explains how an OAuth token is renewed', /refresh token/i.test(oauth.renewal));
    check('a full write token has write tools and no note', oauth.connection.writeTools && oauth.connection.scopeNote === undefined);

    const expired = await getConnectionStatus({ ...base, expiresAt: Date.parse('2026-10-12T09:00:00Z') }, at);
    check('never reports a negative time left', expired.expiresInSeconds === 0);

    const narrowed = await getConnectionStatus({ ...base, scope: 'read', storedScope: 'write' }, at);
    check('says why a write token reads only', !narrowed.connection.writeTools && /granted write/.test(narrowed.connection.scopeNote ?? ''));

    const pat = await getConnectionStatus({ ...base, tokenKind: 'pat', expiresAt: null }, at);
    check('a PAT without expiry says so', pat.expiresAt === null && pat.expiresInSeconds === null && /no expiry/i.test(pat.renewal));
  } finally {
    await deleteWorkspaceData(W1).catch((e) => console.error('cleanup', W1, e));
    await deleteWorkspaceData(W2).catch((e) => console.error('cleanup', W2, e));
    await db.delete(users).where(eq(users.id, userId));
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().then(() => process.exit(0), (error) => {
  console.error(error);
  process.exit(1);
});
