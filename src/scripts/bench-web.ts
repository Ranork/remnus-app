/**
 * Web route cost on a local production server (V2 R9) — what the user waits for on
 * /w, /app, /page, /db, /db/<row>, /dashboard and /graph, plus the live-refresh
 * endpoints. **Local database only**: it writes a fixture into local.db.
 *
 *   DATABASE_URL="file:local.db" npm run bench:web -- setup
 *   # build and start a server against the same local.db, e.g.
 *   #   npx next build
 *   #   BENCH_DB_TRACE=1 BENCH_DB_RTT_MS=10 npx next start -p 3200 > server.log
 *   DATABASE_URL="file:local.db" npm run bench:web -- run --base http://localhost:3200 --log server.log
 *   DATABASE_URL="file:local.db" npm run bench:web -- cleanup
 *
 * `setup` seeds one bench account: a large workspace (366 nested pages with linked
 * bodies, a 600-row task database + three smaller ones, a home dashboard, comments and a
 * month of agent activity) and two sample workspaces, the shape of an active calibrated
 * project. `run` signs in as that account (a session cookie minted in memory with the
 * app's own secret — never printed or written) and measures, per route: time to
 * response headers, time to the last byte and size, for the HTML document and for the
 * RSC payload a `router.refresh()` fetches, plus — with `--log` pointing at a server
 * started with `BENCH_DB_TRACE=1` (see `src/db/index.ts`) — the database round trips the
 * request made. Requests run one at a time so the trace lines belong to one request.
 * Start the server with `BENCH_DB_RTT_MS` > 0 to put the round trips' sequential depth
 * into the timings (10 ≈ a Vercel function next to its Turso database).
 */
import 'dotenv/config';

import { readFileSync, statSync, writeFileSync } from 'fs';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { encode } from 'next-auth/jwt';
import { db } from '@/db';
import {
  agentActivity,
  agentTokens,
  databases,
  pageComments,
  pages,
  standalonePages,
  users,
  workspaceItems,
  workspaceMembers,
  workspaces,
} from '@/db/schema';
import { chunkRows } from '@/lib/services/sqlChunk';
import { syncPageLinksBulk } from '@/lib/services/pageLinks';
import { createDashboardInWorkspace, setHomeDashboard } from '@/lib/services/dashboards';
import { composeHomeDashboardBlocks } from '@/lib/services/homeDashboard';
import { deleteWorkspaceData } from '@/lib/services/workspaceDeletion';
import { createSeedWorkspace } from '@/lib/seed';

const url = process.env.DATABASE_URL ?? 'file:local.db';
if (!url.startsWith('file:')) {
  console.error('Refusing to run against a remote database. Set DATABASE_URL="file:local.db".');
  process.exit(1);
}

const EMAIL = 'bench-web@remnus.test';
const LARGE = 'Web bench · Product';
const DAY = 86_400_000;

let seed = 11;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
const ago = (ms: number) => new Date(Date.now() - ms);

async function insertChunked<T extends Record<string, unknown>>(table: Parameters<typeof db.insert>[0], rows: T[]) {
  if (rows.length === 0) return;
  for (const chunk of chunkRows(rows, Object.keys(rows[0]).length)) await db.insert(table).values(chunk as never);
}

async function benchUser() {
  const [user] = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.email, EMAIL)).limit(1);
  return user ?? null;
}

async function cleanup(): Promise<number> {
  const user = await benchUser();
  if (!user) return 0;
  const owned = await db.select({ id: workspaceMembers.workspaceId }).from(workspaceMembers).where(eq(workspaceMembers.userId, user.id));
  for (const { id } of owned) {
    await db.delete(agentActivity).where(eq(agentActivity.workspaceId, id)); // audit rows have no FK
    await deleteWorkspaceData(id);
  }
  await db.delete(agentTokens).where(eq(agentTokens.createdBy, user.id));
  await db.delete(users).where(eq(users.id, user.id));
  return owned.length;
}

// ── Fixture ──────────────────────────────────────────────────────────────────

const STATUS = ['Backlog', 'In progress', 'Review', 'Done'] as const;
const PRIORITY = ['High', 'Medium', 'Low'] as const;
const TAGS = ['api', 'ui', 'infra', 'docs', 'billing', 'mobile', 'perf', 'security'] as const;
const WORDS = 'agent page database sync token cursor schema view board calendar refresh sidebar editor link graph context search invite member owner plan billing review release draft'.split(' ');

const sentence = (n: number) => Array.from({ length: n }, () => pick(WORDS)).join(' ');

function pageBody(title: string, linkIds: string[]): string {
  const links = linkIds.map((id) => `<a data-page-link href="/page/${id}">related note</a>`).join(', ');
  return [
    `# ${title}`,
    '',
    `${sentence(40)}.`,
    '',
    '## Context',
    '',
    `${sentence(60)}. See ${links}.`,
    '',
    '## Decisions',
    '',
    ...Array.from({ length: 6 }, () => `- ${sentence(12)}`),
    '',
    '## Open questions',
    '',
    ...Array.from({ length: 4 }, () => `- [ ] ${sentence(10)}`),
    '',
    `${sentence(50)}.`,
  ].join('\n');
}

const taskSchema = [
  { id: 'title', name: 'Title', type: 'text' },
  {
    id: 'status', name: 'Status', type: 'select',
    options: [
      { value: 'Backlog', color: 'gray', group: 'todo' },
      { value: 'In progress', color: 'blue', group: 'in_progress' },
      { value: 'Review', color: 'yellow', group: 'in_progress' },
      { value: 'Done', color: 'green', group: 'complete' },
    ],
  },
  { id: 'priority', name: 'Priority', type: 'select', options: PRIORITY.map((value, i) => ({ value, color: ['red', 'yellow', 'gray'][i] })) },
  { id: 'assignee', name: 'Assignee', type: 'user' },
  { id: 'due', name: 'Due', type: 'date' },
  { id: 'tags', name: 'Tags', type: 'multi_select', options: TAGS.map((value) => ({ value, color: 'default' })) },
  { id: 'estimate', name: 'Estimate', type: 'number' },
  { id: 'id', name: 'ID', type: 'id' },
];

const taskViews = [
  { id: 'v-table', name: 'Table', config: { type: 'table', columnOrder: [], hiddenColumns: [], filters: [], sorts: [], openBehavior: 'center', rowColorCol: 'status' } },
  { id: 'v-board', name: 'Board', config: { type: 'kanban', groupByCol: 'status', groupOrder: [], filters: [], sorts: [], openBehavior: 'center', cardProperties: ['priority', 'assignee'], cardColorCol: 'priority' } },
];

async function setup() {
  const removed = await cleanup();
  if (removed) console.log(`removed a previous bench account (${removed} workspaces)`);

  const userId = crypto.randomUUID();
  await db.insert(users).values({ id: userId, name: 'Web Bench', email: EMAIL, role: 'user' } as never);
  // Two sample workspaces, as a signup gets one (the large one is the active one).
  await createSeedWorkspace(userId, 'Web Bench', 'en');
  await createSeedWorkspace(userId, 'Second', 'en');

  const wsId = crypto.randomUUID();
  const now = new Date();
  await db.insert(workspaces).values({ id: wsId, name: LARGE, billingOwnerId: userId, sortOrder: -1, createdAt: now, updatedAt: now } as never);
  await db.insert(workspaceMembers).values({ id: crypto.randomUUID(), workspaceId: wsId, userId, role: 'owner', createdAt: now } as never);

  // 6 root folders × 10 children × 5 grandchildren = 366 pages.
  const items: Record<string, unknown>[] = [];
  const bodies: Record<string, unknown>[] = [];
  const pageIds: string[] = [];
  const addPage = (title: string, parentId: string | null, sortOrder: number) => {
    const id = crypto.randomUUID();
    const at = ago(rand() * 90 * DAY);
    items.push({ id, workspaceId: wsId, type: 'page', title, parentId, sortOrder, icon: null, iconColor: null, createdAt: at, updatedAt: at });
    pageIds.push(id);
    return id;
  };
  for (let r = 0; r < 6; r++) {
    const root = addPage(`Area ${r + 1}: ${sentence(2)}`, null, r + 10);
    for (let c = 0; c < 10; c++) {
      const child = addPage(`${sentence(3)} ${r + 1}.${c + 1}`, root, c);
      for (let g = 0; g < 5; g++) addPage(`${sentence(4)} ${r + 1}.${c + 1}.${g + 1}`, child, g);
    }
  }
  for (const item of items) {
    const links = [pick(pageIds), pick(pageIds)].filter((id) => id !== item.id);
    bodies.push({ id: crypto.randomUUID(), itemId: item.id, content: pageBody(String(item.title), links), createdAt: item.createdAt, updatedAt: item.updatedAt });
  }

  // Databases at the root: one large tracker and three smaller ones.
  const dbSpecs = [
    { name: 'Tasks', rows: 600 },
    { name: 'Bugs', rows: 150 },
    { name: 'Meeting notes', rows: 80 },
    { name: 'Decisions', rows: 40 },
  ];
  const dbRows: Record<string, unknown>[] = [];
  const dbRecords: Record<string, unknown>[] = [];
  const dbIds: Record<string, string> = {};
  const rowIds: Record<string, string[]> = {};
  dbSpecs.forEach((spec, i) => {
    const itemId = crypto.randomUUID();
    const databaseId = crypto.randomUUID();
    dbIds[spec.name] = databaseId;
    rowIds[spec.name] = [];
    items.push({ id: itemId, workspaceId: wsId, type: 'database', title: spec.name, parentId: null, sortOrder: i, icon: null, iconColor: null, createdAt: ago(80 * DAY), updatedAt: ago(rand() * 10 * DAY) });
    dbRecords.push({ id: databaseId, name: spec.name, itemId, schema: taskSchema, views: taskViews, createdAt: ago(80 * DAY), updatedAt: ago(rand() * 10 * DAY) });
    for (let n = 0; n < spec.rows; n++) {
      const id = crypto.randomUUID();
      rowIds[spec.name].push(id);
      const title = `${sentence(5)} #${n + 1}`;
      const at = ago(rand() * 60 * DAY);
      dbRows.push({
        id, databaseId, title,
        content: rand() < 0.4 ? `${sentence(30)}.\n\n- ${sentence(8)}\n- ${sentence(8)}` : '',
        properties: {
          title,
          status: pick(STATUS),
          priority: pick(PRIORITY),
          assignee: userId,
          due: new Date(Date.now() + (rand() * 60 - 20) * DAY).toISOString().slice(0, 10),
          tags: [pick(TAGS), pick(TAGS)].filter((v, k, a) => a.indexOf(v) === k),
          estimate: Math.ceil(rand() * 8),
        },
        sortOrder: n, createdAt: at, updatedAt: at,
      });
    }
  });

  await insertChunked(workspaceItems, items);
  await insertChunked(standalonePages, bodies);
  await insertChunked(databases, dbRecords);
  await insertChunked(pages, dbRows);
  await syncPageLinksBulk(wsId, bodies.map((b) => ({ fromId: String(b.itemId), fromType: 'page' as const, content: String(b.content) })));

  // Comments (about one page in ten) and a month of agent activity from one connection.
  const comments = Array.from({ length: 60 }, () => {
    const at = ago(rand() * 30 * DAY);
    return { id: crypto.randomUUID(), pageId: pick(pageIds), workspaceId: wsId, body: sentence(20), kind: 'note', authorKind: 'human', authorUserId: userId, authorLabel: 'Web Bench', createdAt: at, updatedAt: at };
  });
  await insertChunked(pageComments, comments);

  const tokenId = crypto.randomUUID();
  await db.insert(agentTokens).values({
    id: tokenId, workspaceId: wsId, name: 'Bench agent', agentName: 'claude-code', tokenPrefix: 'benchweb',
    tokenHash: await bcrypt.hash(crypto.randomUUID(), 4), scope: 'write', createdBy: userId, createdAt: ago(40 * DAY),
  } as never);
  const tools = ['get_page', 'update_page', 'query_database', 'search_workspace', 'prepare_context', 'create_page', 'get_changes_since'];
  const activity = Array.from({ length: 3000 }, (_, k) => {
    const at = k < 20 ? ago(rand() * 50 * 60_000) : ago(rand() * 30 * DAY);
    const tool = pick(tools);
    const bytes = Math.round(500 + rand() * 6000);
    return {
      id: crypto.randomUUID(), tokenId, ownerUserId: userId, workspaceId: wsId, tool,
      targetType: 'page', targetId: pick(pageIds), status: 'success', responseBytes: bytes,
      baselineBytes: tool === 'get_page' || tool === 'query_database' ? bytes * 4 : null,
      durationMs: Math.round(60 + rand() * 400), createdAt: at,
    };
  });
  await insertChunked(agentActivity, activity);

  // The pinned home dashboard, composed the way an uncalibrated workspace gets one.
  const blocks = await composeHomeDashboardBlocks(wsId, {
    note: 'Bench workspace.',
    open: (d) => `Open in ${d}`,
    byStatus: (d) => `${d} by status`,
    nextDue: (d) => `Next due in ${d}`,
    stillOpen: (d) => `Still open in ${d}`,
    latest: (d) => `Latest in ${d}`,
    whereToLook: 'Where to look',
    agentActivity: 'Agent activity',
  });
  const dashboard = await createDashboardInWorkspace(wsId, { title: 'Home', blocks });
  await setHomeDashboard(wsId, dashboard.id);

  console.log(`bench account ready: ${items.length + 1} items in "${LARGE}", ${dbRows.length} rows, ${comments.length} comments, ${activity.length} audit rows`);
  console.log(JSON.stringify(await routeIds(), null, 2));
}

async function routeIds() {
  const user = await benchUser();
  if (!user) throw new Error('No bench account — run `setup` first.');
  const [ws] = await db.select({ id: workspaces.id }).from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, user.id))
    .orderBy(workspaces.sortOrder).limit(1);
  const wsItems = await db.select({ id: workspaceItems.id, type: workspaceItems.type, title: workspaceItems.title, parentId: workspaceItems.parentId })
    .from(workspaceItems).where(eq(workspaceItems.workspaceId, ws.id));
  const tasksItem = wsItems.find((i) => i.type === 'database' && i.title === 'Tasks')!;
  const [tasks] = await db.select({ id: databases.id }).from(databases).where(eq(databases.itemId, tasksItem.id));
  const [row] = await db.select({ id: pages.id }).from(pages).where(eq(pages.databaseId, tasks.id)).orderBy(pages.sortOrder).limit(1);
  // A mid-tree page (has children), and a sibling to navigate to.
  const children = wsItems.filter((i) => i.type === 'page' && i.parentId && wsItems.some((c) => c.parentId === i.id));
  const dashboard = wsItems.find((i) => i.type === 'dashboard')!;
  return {
    userId: user.id,
    workspaceId: ws.id,
    pageId: children[0].id,
    otherPageId: children[1].id,
    rootPageId: children[0].parentId!,
    databaseId: tasks.id,
    rowId: row.id,
    dashboardId: dashboard.id,
  };
}

// ── Measurement ──────────────────────────────────────────────────────────────

async function sessionCookie(user: { id: string; name: string | null; email: string | null }): Promise<string> {
  // BENCH_AUTH_SECRET: a throwaway secret the bench server was started with
  // (AUTH_SECRET=<same> in its environment), so the app's own secret is not needed.
  const secret = process.env.BENCH_AUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error('Set BENCH_AUTH_SECRET (and start the server with AUTH_SECRET set to it).');
  const token = { id: user.id, sub: user.id, role: 'user', name: user.name, email: user.email, picture: null };
  // Both cookie names: which one the server reads depends on whether it thinks it is https.
  const cookies = await Promise.all(
    ['authjs.session-token', '__Secure-authjs.session-token'].map(async (name) =>
      `${name}=${await encode({ token, secret, salt: name, maxAge: 3600 })}`),
  );
  return cookies.join('; ');
}

function argOf(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN;
};

type Sample = { headersMs: number; totalMs: number; bytes: number; status: number; roundTrips: number | null };

async function run() {
  const base = argOf('base', 'http://localhost:3200')!;
  const logPath = argOf('log');
  const runs = Number(argOf('runs', '5'));
  const out = argOf('out');
  const ids = await routeIds();
  const user = (await benchUser())!;
  const cookie = `${await sessionCookie(user)}; remnus_workspace_id=${ids.workspaceId}; NEXT_LOCALE=${argOf('locale', 'en')}`;

  const logSize = () => (logPath ? statSync(logPath).size : 0);
  const tripsSince = (offset: number) => {
    if (!logPath) return null;
    const text = readFileSync(logPath).subarray(offset).toString('utf8');
    return (text.match(/\[db-rt\]/g) ?? []).length;
  };

  async function sample(path: string, init: RequestInit & { rsc?: boolean } = {}): Promise<Sample> {
    const headers: Record<string, string> = { cookie, ...(init.headers as Record<string, string> | undefined) };
    if (init.rsc) headers.RSC = '1';
    else if (!init.method || init.method === 'GET') headers.Accept = 'text/html';
    const before = logSize();
    const t0 = performance.now();
    const res = await fetch(base + path, { ...init, headers, redirect: 'manual' });
    const headersMs = performance.now() - t0;
    const body = new Uint8Array(await res.arrayBuffer());
    const totalMs = performance.now() - t0;
    await new Promise((r) => setTimeout(r, 120)); // let the server flush its trace lines
    return { headersMs, totalMs, bytes: body.length, status: res.status, roundTrips: tripsSince(before) };
  }

  const routes: Array<{ name: string; path: string; init?: RequestInit & { rsc?: boolean } }> = [
    { name: '/w/<id> (redirect)', path: `/w/${ids.workspaceId}` },
    { name: '/app (redirect)', path: '/app' },
    { name: '/page/<id>', path: `/page/${ids.pageId}` },
    { name: '/page/<id> RSC', path: `/page/${ids.pageId}`, init: { rsc: true } },
    { name: '/db/<id>', path: `/db/${ids.databaseId}` },
    { name: '/db/<id> RSC', path: `/db/${ids.databaseId}`, init: { rsc: true } },
    { name: '/db/<id>/<row>', path: `/db/${ids.databaseId}/${ids.rowId}` },
    { name: '/db/<id>/<row> RSC', path: `/db/${ids.databaseId}/${ids.rowId}`, init: { rsc: true } },
    { name: '/dashboard/<id>', path: `/dashboard/${ids.dashboardId}` },
    { name: '/dashboard/<id> RSC', path: `/dashboard/${ids.dashboardId}`, init: { rsc: true } },
    { name: '/graph/<id>', path: `/graph/${ids.workspaceId}` },
    { name: 'GET /api/activity/changes', path: '/api/activity/changes' },
    { name: 'POST /api/activity/ping', path: '/api/activity/ping', init: { method: 'POST' } },
  ];

  const results: Record<string, { status: number; headersMs: number; totalMs: number; kb: number; roundTrips: number | null }> = {};
  for (const route of routes) {
    await sample(route.path, route.init); // warm: compile caches, statement caches
    const samples: Sample[] = [];
    for (let i = 0; i < runs; i++) samples.push(await sample(route.path, route.init));
    const trips = samples.map((s) => s.roundTrips).filter((n): n is number => n !== null);
    results[route.name] = {
      status: samples[0].status,
      headersMs: Math.round(median(samples.map((s) => s.headersMs))),
      totalMs: Math.round(median(samples.map((s) => s.totalMs))),
      kb: Math.round(median(samples.map((s) => s.bytes)) / 102.4) / 10,
      roundTrips: trips.length ? median(trips) : null,
    };
    console.log(route.name.padEnd(28), JSON.stringify(results[route.name]));
  }
  if (out) writeFileSync(out, JSON.stringify({ base, runs, at: new Date().toISOString(), results }, null, 2));
}

async function main() {
  const command = process.argv[2];
  if (command === 'setup') return setup();
  if (command === 'cleanup') return console.log(`removed ${await cleanup()} bench workspaces`);
  if (command === 'ids') return console.log(JSON.stringify(await routeIds(), null, 2));
  if (command === 'run') return run();
  console.error('usage: bench-web.ts setup | run [--base url] [--log server.log] [--runs n] [--out file] | ids | cleanup');
  process.exit(1);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
