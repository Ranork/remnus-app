// Server-side cost of the MCP requests an agent session opens with, in-process
// (no network, no npx): module import (a serverless cold start pays it), then
// initialize / tools/list / prompts/list / resources/list / digest read through
// the real route handler with a real PAT — timing and database round trips each.
//
// BENCH_DB_RTT_MS adds that much latency to every database call, to model a
// function region far from the database (e.g. 80 ≈ Vercel iad1 → Turso eu-west-1).
//
// **Local only.** It mints a PAT for a local workspace and deletes it again.
//
//   DATABASE_URL="file:local.db" npx tsx src/scripts/bench-mcp-request.ts [workspaceId]
//   DATABASE_URL="file:local.db" BENCH_DB_RTT_MS=80 npx tsx src/scripts/bench-mcp-request.ts
//   BENCH_TOOLS=1 adds tool calls: reads of the workspace's pages, and writes to scratch
//   items the run creates and deletes again (e.g. against the `bench:web` fixture's workspace).
import 'dotenv/config';

import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import Module from 'module';
import { db } from '@/db';
import { agentTokens, databases, knowledgeMetadata, pageLinks, pageSnapshots, pages, workspaceItems, workspaceMembers } from '@/db/schema';

const url = process.env.DATABASE_URL ?? 'file:local.db';
if (!url.startsWith('file:')) {
  console.error('Refusing to run against a remote database. Set DATABASE_URL="file:local.db".');
  process.exit(1);
}

const RTT = Number(process.env.BENCH_DB_RTT_MS ?? 0);
const RUNS = Number(process.env.BENCH_RUNS ?? 5);

// Count every round trip the libsql client makes. The delay itself is added by the
// client hook in src/db/index.ts, which reads the same BENCH_DB_RTT_MS (R9).
let roundTrips = 0;
const client = (db as unknown as { $client: Record<string, (...a: unknown[]) => Promise<unknown>> }).$client;
for (const method of ['execute', 'batch', 'migrate', 'transaction'] as const) {
  const original = client[method]?.bind(client);
  if (!original) continue;
  client[method] = async (...args: unknown[]) => {
    roundTrips += 1;
    return original(...args);
  };
}

// `server-only` only resolves inside Next; outside it, point it at Next's own empty stub.
const moduleWithResolver = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const resolveFilename = moduleWithResolver._resolveFilename;
moduleWithResolver._resolveFilename = (request, ...rest) =>
  resolveFilename(request === 'server-only' ? 'next/dist/compiled/server-only/empty.js' : request, ...rest);

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function main() {
  const wsArg = process.argv[2];
  const [owner] = await db
    .select({ workspaceId: workspaceMembers.workspaceId, userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(wsArg ? and(eq(workspaceMembers.workspaceId, wsArg), eq(workspaceMembers.role, 'owner')) : eq(workspaceMembers.role, 'owner'))
    .limit(1);
  if (!owner) throw new Error('No owned workspace found in local.db');

  const t0 = performance.now();
  const { handleMcpRequest } = await import('@/app/api/mcp/handler');
  const importMs = performance.now() - t0;

  const minted: string[] = [];
  const mint = async (scope: 'read' | 'write') => {
    const prefix8 = randomBytes(4).toString('hex');
    const secret = randomBytes(32).toString('hex');
    const [row] = await db.insert(agentTokens).values({
      workspaceId: owner.workspaceId, name: 'bench-mcp-request', tokenPrefix: prefix8,
      tokenHash: await bcrypt.hash(secret, 12), scope, createdBy: owner.userId, createdAt: new Date(),
    }).returning({ id: agentTokens.id });
    minted.push(row.id);
    return `rmns_${prefix8}_${secret}`;
  };

  const scratch = { items: [] as string[], rows: [] as string[] };
  const endpoint = { mcpPath: `/api/mcp/w/${owner.workspaceId}`, expectedWorkspaceId: owner.workspaceId };
  const call = async (token: string, method: string, params: object = {}) => {
    const req = new Request(`http://localhost:3000${endpoint.mcpPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${token}`,
        'MCP-Protocol-Version': '2025-06-18',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const before = roundTrips;
    const t = performance.now();
    const res = await handleMcpRequest(req, endpoint);
    const body = await res.text();
    const ms = performance.now() - t;
    if (res.status !== 200) throw new Error(`${method}: HTTP ${res.status} ${body.slice(0, 200)}`);
    return { ms, trips: roundTrips - before, bytes: body.length, body };
  };

  const methods: Array<[string, string, object]> = [
    ['initialize', 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'bench', version: '1' } }],
    ['tools/list', 'tools/list', {}],
    ['prompts/list', 'prompts/list', {}],
    ['resources/list', 'resources/list', {}],
    ['digest read', 'resources/read', { uri: `remnus://workspace/${owner.workspaceId}/digest` }],
  ];

  try {
    console.log(`workspace ${owner.workspaceId}  simulated DB RTT ${RTT} ms  runs ${RUNS}`);
    console.log(`import handler module (cold start share): ${Math.round(importMs)} ms`);

    for (const scope of ['write', 'read'] as const) {
      const token = await mint(scope);
      const first = await call(token, 'initialize', methods[0][2]);
      console.log(`\n[${scope} token] first request on this "instance" (bcrypt, cold modules): ${Math.round(first.ms)} ms, ${first.trips} DB round trips`);
      console.log('  method            median ms   DB trips   bytes');
      for (const [label, method, params] of methods) {
        const samples: number[] = [];
        let trips = 0;
        let bytes = 0;
        let body = '';
        for (let i = 0; i < RUNS; i++) ({ ms: samples[i], trips, bytes, body } = { ...(await call(token, method, params)) });
        let extra = '';
        if (method === 'tools/list') {
          const tools = JSON.parse(body).result.tools as Array<{ annotations?: { readOnlyHint?: boolean } }>;
          extra = `   ${tools.length} tools, ${tools.filter((t) => t.annotations?.readOnlyHint === false).length} write`;
        }
        console.log(`  ${label.padEnd(16)} ${String(Math.round(median(samples))).padStart(9)} ${String(trips).padStart(10)} ${String(bytes).padStart(7)}${extra}`);
      }
    }
    // Tool calls (R9): what an agent waits on once connected. Reads go to the
    // workspace's own pages; writes go to scratch items this run creates first and
    // deletes at the end, so the workspace is left as it was.
    if (process.env.BENCH_TOOLS === '1') {
      const token = await mint('write');
      const [standalone] = await db.select({ id: workspaceItems.id }).from(workspaceItems)
        .where(and(eq(workspaceItems.workspaceId, owner.workspaceId), eq(workspaceItems.type, 'page'))).limit(1);
      const [database] = await db.select({ id: databases.id }).from(databases)
        .innerJoin(workspaceItems, eq(databases.itemId, workspaceItems.id))
        .where(eq(workspaceItems.workspaceId, owner.workspaceId))
        .orderBy(desc(sql`(select count(*) from pages p where p.database_id = ${databases.id})`)).limit(1);
      const tool = (name: string, args: object) => ['tools/call', { name, arguments: args }] as const;
      const createdId = (body: string) => (JSON.parse(body) as { result: { structuredContent: { id: string } } }).result.structuredContent.id;
      const scratchPage = createdId((await call(token, ...tool('create_page', { title: 'bench scratch' }))).body);
      scratch.items.push(scratchPage);
      for (let i = 0; i < 5; i++) {
        scratch.rows.push(createdId((await call(token, ...tool('create_page', { databaseId: database.id, title: `bench row ${i}` }))).body));
      }
      let n = 0;
      const toolCalls: Array<[string, readonly [string, object]]> = [
        ['get_page outline', tool('get_page', { pageId: standalone.id, mode: 'outline' })],
        ['get_page full', tool('get_page', { pageId: standalone.id })],
        ['query_database', tool('query_database', { databaseId: database.id, fields: ['title', 'status'], limit: 50 })],
        ['search_workspace', tool('search_workspace', { query: 'agent sync' })],
        ['prepare_context', tool('prepare_context', { task: 'review the sync and token decisions' })],
        ['get_changes_since', tool('get_changes_since', { since: new Date(Date.now() - 86_400_000).toISOString() })],
        ['update_page body', tool('update_page', { pageId: scratchPage, content: 'bench body' })],
        ['update_page row', tool('update_page', { pageId: scratch.rows[0], properties: { status: 'Review' } })],
        ['bulk_update 5', tool('bulk_update_pages', { updates: scratch.rows.map((id) => ({ pageId: id, properties: { status: 'Backlog' } })) })],
        ['create_page', tool('create_page', { parentId: scratchPage, title: 'bench page' })],
      ];
      console.log('\n[tools/call]       median ms   DB trips   bytes');
      for (const [label, [method, params]] of toolCalls) {
        const samples: number[] = [];
        let trips = 0;
        let bytes = 0;
        for (let i = 0; i < RUNS; i++) {
          const p = label === 'update_page body' ? tool('update_page', { pageId: scratchPage, content: `bench body ${n++}` })[1] : params;
          const res = await call(token, method, p);
          ({ ms: samples[i], trips, bytes } = res);
          if (label === 'create_page') scratch.items.push(createdId(res.body));
        }
        console.log(`  ${label.padEnd(18)} ${String(Math.round(median(samples))).padStart(7)} ${String(trips).padStart(10)} ${String(bytes).padStart(7)}`);
      }
    }
  } finally {
    // Scratch items first (their versions, links and knowledge rows with them), then the
    // tokens — deleting a token cascades to the audit rows it made.
    const ids = [...scratch.items, ...scratch.rows];
    if (ids.length) {
      await db.delete(pageSnapshots).where(inArray(pageSnapshots.originalId, ids));
      await db.delete(knowledgeMetadata).where(inArray(knowledgeMetadata.itemId, ids));
      await db.delete(pageLinks).where(inArray(pageLinks.fromId, ids));
      if (scratch.rows.length) await db.delete(pages).where(inArray(pages.id, scratch.rows));
      if (scratch.items.length) await db.delete(workspaceItems).where(inArray(workspaceItems.id, scratch.items));
    }
    for (const id of minted) await db.delete(agentTokens).where(eq(agentTokens.id, id));
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
