/**
 * Remnus Graph (P12) measurements — local database only.
 *
 *   DATABASE_URL="file:local.db" npm run bench:graph                            (same as the next line)
 *   DATABASE_URL="file:local.db" npx tsx src/scripts/bench-graph.ts            mentions + synthetic run, then delete
 *   DATABASE_URL="file:local.db" npx tsx src/scripts/bench-graph.ts --keep     keep the synthetic workspace (UI checks)
 *   DATABASE_URL="file:local.db" npx tsx src/scripts/bench-graph.ts --member <userId>   …and make that user an owner of it
 *   DATABASE_URL="file:local.db" npx tsx src/scripts/bench-graph.ts --cleanup  delete every synthetic "Graph bench" workspace
 *
 * 1. Unlinked-mention thresholds on the repo's own docs/ (a real corpus) and on
 *    the workspaces already in local.db (read-only): how many titles, how many
 *    pairs, and the document-frequency tail the MENTION_MAX_SHARE cut removes.
 * 2. A synthetic 5,000-node workspace (812 sidebar items + 4,188 rows, links,
 *    mentions, tags, reviews, 30k audit rows): model build cold/warm, payload
 *    bytes (raw + gzip) folded / fully expanded / local, and the agent-activity
 *    query plan. Since P13 the labelled items also cite files of a synthetic
 *    300-file repo: the code layer's size and the `get_related_pages`
 *    resource lookup are measured on it.
 *
 * It writes rows and deletes them again, so it refuses any non-`file:` URL.
 */
import 'dotenv/config';

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { eq, like, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  agentActivity,
  databases,
  knowledgeMetadata,
  knowledgeReviews,
  pageLinks,
  pages,
  standalonePages,
  users,
  workspaceItems,
  workspaceMembers,
  workspaces,
} from '@/db/schema';
import { findMentions, getGraphModelStats, getLocalGraph, getWorkspaceGraph, MENTION_MAX_SHARE, MENTION_MIN_DF } from '@/lib/services/graph';
import { getPagesForResource } from '@/lib/services/codeSources';
import { hashKnowledgeContent } from '@/lib/services/knowledge';
import { chunkRows } from '@/lib/services/sqlChunk';
import { deleteWorkspaceData } from '@/lib/services/workspaceDeletion';

const url = process.env.DATABASE_URL ?? 'file:local.db';
if (!url.startsWith('file:')) {
  console.error(`Refusing to run against a remote database (${url.split('@').pop()}). Set DATABASE_URL="file:local.db".`);
  process.exit(1);
}

const args = process.argv.slice(2);
const KEEP = args.includes('--keep') || args.includes('--member');
const MEMBER = args.includes('--member') ? args[args.indexOf('--member') + 1] : null;
const BENCH_PREFIX = 'Graph bench';

// ── 1. Mentions on real text ─────────────────────────────────────────────────

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.md') ? [path] : [];
  });
}

function measureDocsCorpus() {
  const files = walk(join(process.cwd(), 'docs'));
  const docs = files.map((path) => {
    const body = readFileSync(path, 'utf8');
    const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
    return { id: relative(process.cwd(), path), title: heading ?? path, body };
  });
  const result = findMentions(docs, docs);
  const titleOf = (id: string) => docs.find((d) => d.id === id)?.title ?? id;
  console.log(`docs/ corpus: ${docs.length} pages`);
  console.log('  stats', result.stats);
  console.log(`  cut in use: df > max(${MENTION_MIN_DF}, ${MENTION_MAX_SHARE} × sources) = ${Math.max(MENTION_MIN_DF, Math.ceil(result.stats.sources * MENTION_MAX_SHARE))}`);
  const byDf = [...result.documentFrequency].sort((a, b) => b[1] - a[1]);
  console.log('  document frequency, highest first:', byDf.slice(0, 16).map(([id, df]) => `${titleOf(id)}=${df}`).join(' · '));
  // What each candidate threshold keeps: pairs, and the titles it would cut.
  for (const minDf of [4, 6, 8, 12, 1000]) {
    const run = findMentions(docs, docs, { minDf, maxShare: 0 });
    const cutTitles = byDf.filter(([, df]) => df > minDf).map(([id]) => titleOf(id));
    console.log(`  df ≤ ${minDf}: ${run.stats.pairs} pairs; cuts ${cutTitles.length}: ${cutTitles.join(', ') || '—'}`);
  }
}

async function measureLocalWorkspaces() {
  const list = await db.select({ id: workspaces.id, name: workspaces.name }).from(workspaces).where(sql`${workspaces.name} not like ${BENCH_PREFIX + '%'}`);
  for (const w of list) {
    const stats = await getGraphModelStats(w.id);
    console.log(`local workspace ${w.id.slice(0, 8)}: ${stats.nodes} nodes, edges ${JSON.stringify(stats.edgesByKind)}, mentions ${JSON.stringify(stats.mentions)}`);
  }
}

// ── 2. Synthetic workspace ───────────────────────────────────────────────────

let seed = 42;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];

const WORDS = (
  'auth session token billing webhook retry invoice plan seat agent context pack search index ranking cursor ' +
  'delta digest sidebar editor block table kanban calendar recurrence series occurrence trash snapshot history ' +
  'share slug sitemap export import bundle review metadata trust freshness stale draft stable deprecated link ' +
  'backlink mention graph layout cluster tag concept source owner member invite role viewer quota limit usage ' +
  'savings baseline audit retention cron migration trigger schema column view filter sort group chart metric ' +
  'dashboard catalog template playbook calibrate onboarding install window lock ticket profile consent cookie ' +
  'analytics funnel event capture error boundary crash report upload asset image icon color theme density ' +
  'mobile desktop tauri capacitor offline sync queue worker cache version key hash budget payload gateway proxy ' +
  'locale message namespace translation fallback email campaign bounce suppression unsubscribe deletion token'
).split(' ');
// Body text comes from a SEPARATE vocabulary: with the title words as filler,
// random prose "mentioned" ~48k titles by accident (a first run of this
// script) — a stress test of the renderer, not a picture of a workspace.
const FILLER = (
  'the a of and to in is it that for on with as was at by be this from or have an they which one you had ' +
  'were her all she there would their we him been has when who will more no if out so said what up its about ' +
  'into than them can only other new some could time these two may then do first any my now such like our over'
).split(' ');
const TAGS = Array.from({ length: 60 }, (_, i) => `${pick(WORDS)}-${i}`);

// Code layer (P13): a synthetic repository the labelled items cite, like a
// calibration's `sources`. Its own generator, so adding it did not move any
// number the P12 run above measured.
let codeSeed = 7;
const codeRand = () => {
  codeSeed = (codeSeed * 1664525 + 1013904223) % 4294967296;
  return codeSeed / 4294967296;
};
const codePick = <T,>(list: readonly T[]): T => list[Math.floor(codeRand() * list.length)];
const REPO_DIRS = [
  'src/app/api/mcp', 'src/app/(app)', 'src/lib/services', 'src/lib/actions', 'src/lib/auth', 'src/components/features',
  'src/components/editor', 'src/db', 'cli/src/commands', 'cli/src/lib', 'docs/mcp', 'scripts',
];
const REPO_FILES = Array.from({ length: 300 }, (_, i) => `${codePick(REPO_DIRS)}/${codePick(WORDS)}-${i}.ts`);
const codeSources = () => {
  const r = codeRand();
  // Mostly files, some folders and URLs (URLs must stay off the map), and anchors/`./` as people write them.
  if (r < 0.05) return [{ resource: `https://example.com/spec-${Math.floor(codeRand() * 20)}` }];
  if (r < 0.12) return [{ resource: `${codePick(REPO_DIRS)}/` }];
  const files = Array.from({ length: codeRand() < 0.4 ? 2 : 1 }, () => codePick(REPO_FILES));
  return files.map((file) => ({ resource: codeRand() < 0.1 ? `./${file}#L10-L40` : file }));
};

async function cleanupBench() {
  const benches = await db.select({ id: workspaces.id }).from(workspaces).where(like(workspaces.name, `${BENCH_PREFIX}%`));
  for (const { id } of benches) {
    await db.delete(agentActivity).where(eq(agentActivity.workspaceId, id)); // audit rows have no FK
    await deleteWorkspaceData(id);
  }
  // Audit rows written against a made-up "noise" workspace to make the table realistic.
  await db.delete(agentActivity).where(like(agentActivity.workspaceId, 'graph-bench-noise-%'));
  console.log(`cleanup: removed ${benches.length} synthetic workspace(s)`);
}

async function insertChunked<T extends Record<string, unknown>>(table: Parameters<typeof db.insert>[0], rows: T[]) {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]).length;
  for (const chunk of chunkRows(rows, columns)) await db.insert(table).values(chunk as never);
}

async function seedSynthetic(): Promise<{ workspaceId: string; hubId: string; ownerId: string }> {
  const now = new Date();
  const workspaceId = crypto.randomUUID();
  const ownerId = MEMBER ?? (await db.select({ id: users.id }).from(users).limit(1))[0]?.id;
  if (!ownerId) throw new Error('local.db has no user to own the synthetic workspace');
  await db.insert(workspaces).values({ id: workspaceId, name: `${BENCH_PREFIX} 5k`, billingOwnerId: ownerId, createdAt: now, updatedAt: now });
  await db.insert(workspaceMembers).values({ workspaceId, userId: ownerId, role: 'owner', createdAt: now });

  const titles = new Set<string>();
  const title = () => {
    for (;;) {
      const t = Array.from({ length: 2 + Math.floor(rand() * 2) }, () => pick(WORDS)).join(' ');
      const cased = t.charAt(0).toUpperCase() + t.slice(1);
      if (!titles.has(cased)) {
        titles.add(cased);
        return cased;
      }
    }
  };

  // Sidebar: 800 pages (4-level tree), 12 databases, 2 dashboards → 814 items.
  type Item = { id: string; title: string; type: 'page' | 'database' | 'dashboard'; parentId: string | null };
  const items: Item[] = [];
  for (let i = 0; i < 800; i++) {
    const parent = i < 20 || rand() < 0.15 ? null : pick(items.filter((it) => it.type === 'page')).id;
    items.push({ id: crypto.randomUUID(), title: title(), type: 'page', parentId: parent });
  }
  const DB_SIZES = [1500, 900, 600, 400, 300, 200, 100, 80, 50, 30, 20, 6];
  const dbItems = DB_SIZES.map(() => ({ id: crypto.randomUUID(), title: title(), type: 'database' as const, parentId: rand() < 0.5 ? null : pick(items).id }));
  items.push(...dbItems);
  items.push({ id: crypto.randomUUID(), title: title(), type: 'dashboard', parentId: null }, { id: crypto.randomUUID(), title: title(), type: 'dashboard', parentId: null });

  type Row = { id: string; databaseId: string; title: string };
  const databaseIds = dbItems.map(() => crypto.randomUUID());
  const rows: Row[] = [];
  DB_SIZES.forEach((size, d) => {
    for (let i = 0; i < size; i++) rows.push({ id: crypto.randomUUID(), databaseId: databaseIds[d], title: title() });
  });

  const everything = [...items.filter((i) => i.type !== 'dashboard'), ...rows];
  const links: Array<{ fromId: string; fromType: 'page' | 'database_row'; toId: string; toType: 'page' | 'database' | 'database_row' }> = [];
  const hub = items[3];
  const body = (selfId: string, fromType: 'page' | 'database_row') => {
    if (fromType === 'database_row' && rand() < 0.55) return ''; // plenty of rows are tasks with no body
    const words = Array.from({ length: 40 + Math.floor(rand() * 160) }, () => (rand() < 0.08 ? pick(WORDS) : pick(FILLER)));
    const mentions = Math.floor(rand() * 3);
    for (let m = 0; m < mentions; m++) words.splice(Math.floor(rand() * words.length), 0, pick(everything).title);
    const linkCount = rand() < 0.35 ? 1 + Math.floor(rand() * 2) : 0;
    for (let l = 0; l < linkCount; l++) {
      const target = rand() < 0.15 ? hub : pick(everything);
      if (target.id === selfId) continue;
      const isRow = 'databaseId' in target;
      const href = isRow ? `/db/${(target as Row).databaseId}/${target.id}` : (target as Item).type === 'database' ? `/db/${databaseIds[dbItems.findIndex((d) => d.id === target.id)]}` : `/page/${target.id}`;
      words.push(`<a data-page-link href="${href}">${target.title}</a>`);
      links.push({ fromId: selfId, fromType, toId: isRow ? target.id : (target as Item).type === 'database' ? databaseIds[dbItems.findIndex((d) => d.id === target.id)] : target.id, toType: isRow ? 'database_row' : (target as Item).type === 'database' ? 'database' : 'page' });
    }
    return words.join(' ');
  };

  const pageBodies = new Map(items.filter((i) => i.type === 'page').map((i) => [i.id, body(i.id, 'page')]));
  const rowBodies = new Map(rows.map((r) => [r.id, body(r.id, 'database_row')]));

  await insertChunked(workspaceItems, items.map((it, i) => ({
    id: it.id, workspaceId, type: it.type, title: it.title, parentId: it.parentId, sortOrder: i, createdAt: now, updatedAt: now,
  })));
  await insertChunked(standalonePages, items.filter((i) => i.type === 'page').map((it) => ({
    id: crypto.randomUUID(), itemId: it.id, content: pageBodies.get(it.id) ?? '', createdAt: now, updatedAt: now,
  })));
  await insertChunked(databases, dbItems.map((it, d) => ({
    id: databaseIds[d], name: it.title, itemId: it.id, schema: [{ id: 'status', name: 'Status', type: 'select', options: [] }], views: [], createdAt: now, updatedAt: now,
  })));
  const agentStamp = new Date(now.getTime() - 2 * 86_400_000);
  await insertChunked(pages, rows.map((r, i) => ({
    id: r.id, databaseId: r.databaseId, title: r.title, content: rowBodies.get(r.id) ?? '', properties: {}, sortOrder: i,
    createdAt: now, updatedAt: now, ...(rand() < 0.04 ? { agentEditedAt: agentStamp } : { agentEditedAt: null }),
  })));
  const uniqueLinks = new Map(links.map((l) => [`${l.fromId}|${l.toId}`, l]));
  await insertChunked(pageLinks, [...uniqueLinks.values()].map((l) => ({
    id: crypto.randomUUID(), workspaceId, ...l, linkKind: 'page_link' as const, createdAt: now,
  })));

  // Knowledge: ~30% of pages and 10% of rows labelled; some reviewed at their current hash.
  const meta: Array<typeof knowledgeMetadata.$inferInsert> = [];
  const reviews: Array<typeof knowledgeReviews.$inferInsert> = [];
  const label = (id: string, itemType: 'page' | 'database_row', t: string, content: string) => {
    const metadataId = crypto.randomUUID();
    const r = rand();
    meta.push({
      id: metadataId, workspaceId, itemId: id, itemType,
      conceptType: 'concept', tags: [pick(TAGS), pick(TAGS)], sources: codeSources(),
      status: r < 0.1 ? 'deprecated' : r < 0.35 ? 'draft' : 'stable',
      staleAfter: rand() < 0.1 ? new Date(now.getTime() - 86_400_000).toISOString() : null,
      generatedBy: rand() < 0.5 ? 'agent:bench' : null,
      createdAt: now, updatedAt: now,
    });
    if (rand() < 0.3) reviews.push({ id: crypto.randomUUID(), metadataId, reviewerUserId: ownerId, contentHash: hashKnowledgeContent(t, content), reviewedAt: now });
  };
  for (const it of items) if (it.type === 'page' && rand() < 0.3) label(it.id, 'page', it.title, pageBodies.get(it.id) ?? '');
  for (const r of rows) if (rand() < 0.1) label(r.id, 'database_row', r.title, rowBodies.get(r.id) ?? '');
  await insertChunked(knowledgeMetadata, meta);
  await insertChunked(knowledgeReviews, reviews);

  // Audit: 30k rows over 120 days here, 100k in a noise workspace.
  const tools = ['get_page', 'update_page', 'query_database', 'create_page', 'get_related_pages'];
  const audit = (ws: string, n: number, targets: string[]) => Array.from({ length: n }, () => ({
    id: crypto.randomUUID(), workspaceId: ws, tool: pick(tools), targetType: 'page', targetId: pick(targets),
    status: 'success' as const, createdAt: new Date(now.getTime() - Math.floor(rand() * 120 * 86_400_000)),
  }));
  await insertChunked(agentActivity, audit(workspaceId, 30_000, everything.map((e) => e.id)));
  await insertChunked(agentActivity, audit(`graph-bench-noise-${workspaceId}`, 100_000, ['x']));

  console.log(`seeded ${workspaceId}: ${items.length} items, ${rows.length} rows, ${uniqueLinks.size} links, ${meta.length} labelled, ${reviews.length} reviews`);
  return { workspaceId, hubId: hub.id, ownerId };
}

function bytes(value: unknown) {
  const json = JSON.stringify(value);
  return `${(json.length / 1024).toFixed(0)} KB raw / ${(gzipSync(json).length / 1024).toFixed(0)} KB gzip`;
}

async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const out = await fn();
  console.log(`  ${label}: ${(performance.now() - start).toFixed(0)} ms`);
  return out;
}

async function measureSynthetic(workspaceId: string, hubId: string) {
  // Past the hot second, so the version key is cacheable.
  await new Promise((resolve) => setTimeout(resolve, 2_200));
  const folded = await time('graph, cold (model build)', () => getWorkspaceGraph(workspaceId));
  await time('graph, warm', () => getWorkspaceGraph(workspaceId));
  console.log(`  folded: ${folded.nodes.length} nodes, ${folded.edges.length} edges — ${bytes(folded)}`);
  const allDatabases = folded.nodes.filter((n) => n[1] === 1).map((n) => n[0]);
  const expanded = await time('graph, every database expanded (warm)', () => getWorkspaceGraph(workspaceId, { expanded: allDatabases }));
  console.log(`  expanded: ${expanded.nodes.length} nodes, ${expanded.edges.length} edges — ${bytes(expanded)}`);
  const local1 = await time('local graph depth 1 (hub)', () => getLocalGraph(workspaceId, hubId, 1));
  const local2 = await time('local graph depth 2 (hub)', () => getLocalGraph(workspaceId, hubId, 2));
  console.log(`  local d1: ${local1?.nodes.length} nodes — ${bytes(local1)}; d2: ${local2?.nodes.length} nodes${local2?.truncated ? ' (truncated)' : ''} — ${bytes(local2)}`);
  const stats = await getGraphModelStats(workspaceId);
  console.log('  model', { ...stats, approxBytes: `${(stats.approxBytes / 1024).toFixed(0)} KB` });

  // P13 code layer: what turning it on adds, and the file → pages lookup behind get_related_pages.
  const withCode = await time('graph with the code layer (warm)', () => getWorkspaceGraph(workspaceId, { code: true }));
  const codeNodes = withCode.nodes.filter((n) => n[1] === 5 || n[1] === 6);
  console.log(`  code layer: ${withCode.codePaths} cited paths → ${codeNodes.filter((n) => n[1] === 5).length} files + ${codeNodes.filter((n) => n[1] === 6).length} folders; +${withCode.edges.length - folded.edges.length} edges — ${bytes(withCode)} (folded without it: ${bytes(folded)})`);
  const cited = codeNodes.filter((n) => n[1] === 5).sort((a, b) => (b[6] ?? 0) - (a[6] ?? 0))[0];
  const file = cited ? cited[2] : REPO_FILES[0];
  for (const resource of [file, `D:/work/app/${file}`, `${file.split('/').slice(0, 3).join('/')}/`]) {
    const found = await time(`resource lookup ${resource}`, () => getPagesForResource(workspaceId, resource));
    console.log(`    ${found.total} items (${[...new Set(found.pages.map((p) => p.match))].join(', ')}) — ${bytes(found)}`);
  }
  const subject = (await db.select({ itemId: knowledgeMetadata.itemId }).from(knowledgeMetadata).where(eq(knowledgeMetadata.workspaceId, workspaceId)).limit(1))[0]?.itemId;
  if (subject) {
    const localCode = await getLocalGraph(workspaceId, subject, 2);
    console.log(`  local d2 around a labelled item: ${localCode?.nodes.length} nodes, ${localCode?.nodes.filter((n) => n[1] === 5 || n[1] === 6).length} of them code`);
  }

  const since = Math.floor((Date.now() - 7 * 86_400_000) / 1000);
  // The service's query shape: index range, then the exact legacy-TEXT-safe test.
  const activitySql = sql`select target_id, max(case when typeof(created_at) = 'integer' then created_at else unixepoch(created_at) end) from agent_activity where workspace_id = ${workspaceId} and created_at >= ${since} and (case when typeof(created_at) = 'integer' then created_at else unixepoch(created_at) end) >= ${since} and status = 'success' and target_id is not null group by target_id`;
  const plan = await db.all<{ detail: string }>(sql`explain query plan ${activitySql}`);
  console.log('  activity plan:', plan.map((p) => p.detail).join(' | '));
  const scanned = await db.all<{ n: number }>(sql`select count(*) n from agent_activity where workspace_id = ${workspaceId}`);
  const inWindow = await db.all<{ n: number }>(sql`select count(*) n from agent_activity where workspace_id = ${workspaceId} and created_at >= ${since}`);
  console.log(`  activity rows: ${scanned[0].n} in workspace, ${inWindow[0].n} in the 7-day window`);
  await time('activity aggregate', () => db.all(activitySql));
}

async function main() {
  if (args.includes('--cleanup')) {
    await cleanupBench();
    return;
  }
  measureDocsCorpus();
  await measureLocalWorkspaces();
  const { workspaceId, hubId } = await seedSynthetic();
  try {
    await measureSynthetic(workspaceId, hubId);
  } finally {
    if (KEEP) console.log(`kept synthetic workspace ${workspaceId} (remove with --cleanup)`);
    else await cleanupBench();
  }
}

main().then(() => process.exit(0), (error) => {
  console.error(error);
  process.exit(1);
});
