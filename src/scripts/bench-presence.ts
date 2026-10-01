/**
 * Agent presence layer (V2 R8.8) — cost and correctness, local database only.
 *
 *   DATABASE_URL="file:local.db" npm run bench:presence
 *
 * Seeds two synthetic workspaces: a busy one (200 pages, a 2,000-row database, 30,000
 * audit rows over a year with a realistic last hour from two agents) and an idle one
 * (5,000 audit rows, none in the last hour), plus 100,000 audit rows under a made-up
 * workspace id so the table is not small. Then it measures what the presence layer adds:
 *
 *   loadAgentPresence   read by the (app) layout on every render (first load + each
 *                       live-refresh) — idle hour vs busy hour
 *   getPageProvenance   read with a page (`getStandalonePageByItemId` / `getPage`)
 *
 * checks what they return (agents, targets, tree marks incl. rows and bulk writes, the
 * one-hour window, the review hash) and deletes everything again. It writes rows, so it
 * refuses any non-`file:` URL.
 */
import 'dotenv/config';

import { eq, like, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  agentActivity,
  agentTokens,
  databases,
  knowledgeMetadata,
  knowledgeReviews,
  pageSnapshots,
  pages,
  standalonePages,
  users,
  workspaceItems,
  workspaceMembers,
  workspaces,
} from '@/db/schema';
import { loadAgentPresence, PRESENCE_READ_WINDOW_MS } from '@/lib/services/agentPresence';
import { getPageProvenance } from '@/lib/services/pageProvenance';
import { hashKnowledgeContent } from '@/lib/services/knowledge';
import { chunkRows } from '@/lib/services/sqlChunk';
import { deleteWorkspaceData } from '@/lib/services/workspaceDeletion';

const url = process.env.DATABASE_URL ?? 'file:local.db';
if (!url.startsWith('file:')) {
  console.error(`Refusing to run against a remote database (${url.split('@').pop()}). Set DATABASE_URL="file:local.db".`);
  process.exit(1);
}

const PREFIX = 'Presence bench';
const NOISE = 'presence-bench-noise';
const MIN = 60_000;
const DAY = 86_400_000;

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];

async function insertChunked<T extends Record<string, unknown>>(table: Parameters<typeof db.insert>[0], rows: T[]) {
  if (rows.length === 0) return;
  for (const chunk of chunkRows(rows, Object.keys(rows[0]).length)) await db.insert(table).values(chunk as never);
}

async function cleanup() {
  const benches = await db.select({ id: workspaces.id }).from(workspaces).where(like(workspaces.name, `${PREFIX}%`));
  for (const { id } of benches) {
    await db.delete(agentActivity).where(eq(agentActivity.workspaceId, id)); // audit rows have no FK
    await deleteWorkspaceData(id);
  }
  await db.delete(agentActivity).where(like(agentActivity.workspaceId, `${NOISE}%`));
  return benches.length;
}

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
}

async function median(label: string, runs: number, fn: () => Promise<unknown>) {
  await fn(); // warm the connection and the statement cache
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length / 2)];
  const p95 = times[Math.floor(times.length * 0.95)];
  console.log(`  ${label.padEnd(44)} p50 ${p50.toFixed(2)} ms   p95 ${p95.toFixed(2)} ms`);
}

async function main() {
  const removed = await cleanup();
  if (removed) console.log(`cleanup: removed ${removed} leftover bench workspace(s)`);

  const now = Date.now();
  const at = (msAgo: number) => new Date(now - msAgo);
  const ownerId = (await db.select({ id: users.id }).from(users).limit(1))[0]?.id;
  if (!ownerId) throw new Error('local.db has no user to own the synthetic workspaces');

  const busy = crypto.randomUUID();
  const idle = crypto.randomUUID();
  for (const [id, name] of [[busy, `${PREFIX} busy`], [idle, `${PREFIX} idle`]]) {
    await db.insert(workspaces).values({ id, name, billingOwnerId: ownerId, createdAt: new Date(now), updatedAt: new Date(now) });
    await db.insert(workspaceMembers).values({ workspaceId: id, userId: ownerId, role: 'owner', createdAt: new Date(now) });
  }

  // Two connections: Claude Code (brand id set) and a PAT with only a free-text name.
  const claude = crypto.randomUUID();
  const codex = crypto.randomUUID();
  await db.insert(agentTokens).values([
    { id: claude, workspaceId: busy, name: 'remnus-app', agentName: 'claude', tokenPrefix: 'rmns_bench1', tokenHash: 'x', scope: 'write', createdAt: new Date(now) },
    { id: codex, workspaceId: busy, name: 'Codex CLI', agentName: null, tokenPrefix: 'rmns_bench2', tokenHash: 'x', scope: 'write', createdAt: new Date(now) },
  ]);

  // Sidebar: 200 pages (some nested) and one database with 2,000 rows.
  const pageIds = Array.from({ length: 200 }, () => crypto.randomUUID());
  await insertChunked(workspaceItems, pageIds.map((id, i) => ({
    id, workspaceId: busy, type: 'page', title: `Page ${i}`, parentId: i > 20 && rand() < 0.4 ? pageIds[Math.floor(rand() * 20)] : null,
    sortOrder: i, createdAt: new Date(now), updatedAt: new Date(now),
  })));
  await insertChunked(standalonePages, pageIds.map((itemId, i) => ({
    id: crypto.randomUUID(), itemId, content: `Body of page ${i}`, createdAt: new Date(now), updatedAt: new Date(now),
  })));
  const dbItem = crypto.randomUUID();
  const dbId = crypto.randomUUID();
  await db.insert(workspaceItems).values({ id: dbItem, workspaceId: busy, type: 'database', title: 'Decisions', sortOrder: 999, createdAt: new Date(now), updatedAt: new Date(now) });
  await db.insert(databases).values({ id: dbId, name: 'Decisions', itemId: dbItem, schema: [], views: [], createdAt: new Date(now), updatedAt: new Date(now) });
  const rowIds = Array.from({ length: 2000 }, () => crypto.randomUUID());
  await insertChunked(pages, rowIds.map((id, i) => ({
    id, databaseId: dbId, title: `Row ${i}`, content: '', properties: {}, sortOrder: i, createdAt: new Date(now), updatedAt: new Date(now),
  })));

  // Audit history: a year of calls here, older-than-an-hour calls in the idle workspace, noise elsewhere.
  const tools = ['get_page', 'update_page', 'query_database', 'create_page', 'get_related_pages', 'prepare_context'];
  const targets = [...pageIds, ...rowIds];
  const history = (ws: string, n: number, minAgo: number, maxAgo: number, tokenId: string | null) => Array.from({ length: n }, () => ({
    id: crypto.randomUUID(), tokenId, workspaceId: ws, tool: pick(tools), targetType: 'page', targetId: pick(targets),
    status: 'success' as const, createdAt: at(minAgo + Math.floor(rand() * (maxAgo - minAgo))),
  }));
  await insertChunked(agentActivity, history(busy, 30_000, 2 * 60 * MIN, 365 * DAY, claude));
  await insertChunked(agentActivity, history(idle, 5_000, 2 * 60 * MIN, 30 * DAY, claude));
  await insertChunked(agentActivity, history(`${NOISE}-${busy}`, 100_000, 0, 120 * DAY, null));

  // The last hour in the busy workspace — what the sidebar should show.
  const [p1, p2, p3] = pageIds;
  const r1 = rowIds[0];
  const bulkRows = rowIds.slice(1, 6);
  const call = (tokenId: string, tool: string, targetId: string | null, msAgo: number, extra: Partial<typeof agentActivity.$inferInsert> = {}) => ({
    id: crypto.randomUUID(), tokenId, workspaceId: busy, tool, targetType: targetId ? 'page' : null, targetId,
    status: 'success' as const, createdAt: at(msAgo), ...extra,
  });
  const lastHour = [
    call(claude, 'update_page', p1, 30_000),                       // working, last call
    call(claude, 'get_page', p1, 50_000),
    call(claude, 'update_page', r1, 5 * MIN),                      // a row → its database item
    call(claude, 'create_page', p2, 20 * MIN),
    call(codex, 'bulk_update_pages', null, 40 * MIN, { itemsAffected: 5 }), // no target: knowledge stamps carry it
    call(codex, 'query_database', dbId, 41 * MIN),
    call(claude, 'update_page', p3, 70 * MIN),                     // outside the window: no mark
  ];
  // Noise inside the hour so the scan is realistic (reads only — they mark nothing).
  for (let i = 0; i < 250; i++) lastHour.push(call(claude, pick(['get_page', 'query_database', 'prepare_context']), pick(targets), 60_000 + Math.floor(rand() * 55 * MIN)));
  await insertChunked(agentActivity, lastHour);
  await insertChunked(knowledgeMetadata, bulkRows.map((itemId) => ({
    id: crypto.randomUUID(), workspaceId: busy, itemId, itemType: 'database_row' as const, tags: [], sources: [], externalVerified: [],
    generatedBy: `mcp:${codex}`, generatedAt: at(40 * MIN), createdAt: at(40 * MIN), updatedAt: at(40 * MIN),
  })));
  const p1MetadataId = crypto.randomUUID();
  await db.insert(knowledgeMetadata).values({
    id: p1MetadataId, workspaceId: busy, itemId: p1, itemType: 'page', tags: [], sources: [], externalVerified: [],
    generatedBy: `mcp:claude:${claude}`, generatedAt: at(30_000), createdAt: at(30_000), updatedAt: at(30_000),
  });
  await db.insert(pageSnapshots).values({
    workspaceId: busy, reason: 'update', originalId: p1, itemType: 'page', title: 'Page 0', content: 'older', contentHash: 'x',
    deletedByKind: 'human', deletedByLabel: 'Bench Owner', deletedByUserId: ownerId, createdAt: at(DAY),
  });
  console.log(`seeded: busy ${busy.slice(0, 8)} (200 pages, 2,000 rows, ${30_000 + lastHour.length} audit rows), idle ${idle.slice(0, 8)} (5,000), noise 100,000`);

  // ── Query plan ─────────────────────────────────────────────────────────────
  const plan = await db.all<{ detail: string }>(sql`explain query plan
    select token_id, oauth_token_id, tool from agent_activity
    where workspace_id in (${busy}, ${idle}) and created_at >= ${Math.floor((now - PRESENCE_READ_WINDOW_MS) / 1000)}
    order by created_at desc limit 400`);
  console.log('\nquery plan (presence calls):');
  for (const row of plan) console.log(`  ${row.detail}`);

  // ── Cost ───────────────────────────────────────────────────────────────────
  console.log('\ncost (local SQLite, 40 runs):');
  await median('loadAgentPresence — idle hour (1 workspace)', 40, () => loadAgentPresence([idle], now));
  await median('loadAgentPresence — busy hour (1 workspace)', 40, () => loadAgentPresence([busy], now));
  await median('loadAgentPresence — both workspaces', 40, () => loadAgentPresence([busy, idle], now));
  const p1Content = 'Body of page 0';
  const provenanceInput = { workspaceId: busy, itemId: p1, itemType: 'page' as const, title: 'Page 0', content: p1Content, viewerId: ownerId, now };
  await median('getPageProvenance — agent-written page', 40, () => getPageProvenance(provenanceInput));
  await median('getPageProvenance — page no agent wrote', 40, () => getPageProvenance({ ...provenanceInput, itemId: pageIds[150], title: 'Page 150' }));

  const presence = await loadAgentPresence([busy, idle], now);
  console.log(`  presence payload: ${JSON.stringify(presence).length} bytes (rides in the layout's RSC payload, no request of its own)`);

  // ── Correctness ────────────────────────────────────────────────────────────
  console.log('\nchecks:');
  const [first, second] = presence.agents;
  check('newest agent is Claude Code, working on Page 0', first?.key === claude && first.tool === 'update_page' && first.target === 'Page 0' && now - first.lastAt < 3 * MIN);
  check('second agent is the PAT named by its token label', second?.key === codex && second.tokenName === 'Codex CLI' && second.agentName === null);
  check('brand id carried for the mark', first?.agentName === 'claude');
  check('Page 0 marked by Claude', presence.touched[p1]?.agent === claude);
  check('a created page is marked', !!presence.touched[p2]);
  check('a row write marks its database', presence.touched[dbItem]?.agent === claude, `at ${presence.touched[dbItem] ? Math.round((now - presence.touched[dbItem].at) / MIN) : '-'} min ago`);
  check('a write older than the window marks nothing', !presence.touched[p3]);
  check('reads mark nothing', Object.keys(presence.touched).length === 3, `${Object.keys(presence.touched).length} marked`);
  const idlePresence = await loadAgentPresence([idle], now);
  check('idle workspace: no agents, no marks', idlePresence.agents.length === 0 && Object.keys(idlePresence.touched).length === 0);

  // Bulk write without a newer targeted write on the database: a separate database proves the stamp path.
  const dbItem2 = crypto.randomUUID();
  const dbId2 = crypto.randomUUID();
  await db.insert(workspaceItems).values({ id: dbItem2, workspaceId: busy, type: 'database', title: 'Bulk target', sortOrder: 1000, createdAt: new Date(now), updatedAt: new Date(now) });
  await db.insert(databases).values({ id: dbId2, name: 'Bulk target', itemId: dbItem2, schema: [], views: [], createdAt: new Date(now), updatedAt: new Date(now) });
  const bulkRow = crypto.randomUUID();
  await db.insert(pages).values({ id: bulkRow, databaseId: dbId2, title: 'Bulk row', content: '', properties: {}, sortOrder: 0, createdAt: new Date(now), updatedAt: new Date(now) });
  await db.insert(knowledgeMetadata).values({
    id: crypto.randomUUID(), workspaceId: busy, itemId: bulkRow, itemType: 'database_row', tags: [], sources: [], externalVerified: [],
    generatedBy: `mcp:${codex}`, generatedAt: at(40 * MIN), createdAt: at(40 * MIN), updatedAt: at(40 * MIN),
  });
  const withBulk = await loadAgentPresence([busy], now);
  check('a bulk write marks its database through the knowledge stamps', withBulk.touched[dbItem2]?.agent === codex);

  const provenance = await getPageProvenance(provenanceInput);
  check('provenance: agent from the knowledge stamp', provenance?.agent.agentName === 'claude' && now - (provenance?.agent.at ?? 0) < MIN);
  check('provenance: last human edit is "you", a day ago', provenance?.human?.you === true && Math.round((now - (provenance?.human?.at ?? 0)) / DAY) === 1);
  check('provenance: not reviewed yet', provenance?.reviewed === null);
  check('provenance: none for a page no agent wrote', (await getPageProvenance({ ...provenanceInput, itemId: pageIds[150], title: 'Page 150' })) === null);
  await db.insert(knowledgeReviews).values({ id: crypto.randomUUID(), metadataId: p1MetadataId, reviewerUserId: ownerId, contentHash: hashKnowledgeContent('Page 0', p1Content), reviewedAt: new Date(now) });
  const reviewed = await getPageProvenance(provenanceInput);
  check('provenance: a review of the current text counts', reviewed?.reviewed?.you === true);
  const edited = await getPageProvenance({ ...provenanceInput, content: `${p1Content} — edited` });
  check('provenance: any edit clears it', edited?.reviewed === null);
  const codexPage = pageIds[10];
  await db.insert(knowledgeMetadata).values({
    id: crypto.randomUUID(), workspaceId: busy, itemId: codexPage, itemType: 'page', tags: [], sources: [], externalVerified: [],
    generatedBy: `mcp:${codex}`, generatedAt: at(5 * MIN), createdAt: at(5 * MIN), updatedAt: at(5 * MIN),
  });
  const named = await getPageProvenance({ ...provenanceInput, itemId: codexPage, title: 'Page 10' });
  check('provenance: a PAT without a brand id is named by its label', named?.agent.tokenName === 'Codex CLI');
  const legacyRow = await getPageProvenance({
    workspaceId: busy, itemId: rowIds[1500], itemType: 'database_row', title: 'Row 1500', content: '', viewerId: ownerId, now,
    rowStamp: { at: at(2 * DAY), agentName: 'cursor', tokenName: 'Cursor' },
  });
  check('provenance: a row stamped before knowledge stamps still shows', legacyRow?.agent.agentName === 'cursor');
}

main()
  .catch((error) => {
    failures++;
    console.error(error);
  })
  .finally(async () => {
    const removed = await cleanup().catch(() => 0);
    console.log(`\ncleanup: removed ${removed} synthetic workspace(s) and the noise rows`);
    console.log(failures ? `${failures} check(s) FAILED` : 'all checks passed');
    process.exit(failures ? 1 : 0);
  });
