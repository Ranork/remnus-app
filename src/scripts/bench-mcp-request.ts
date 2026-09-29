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
import 'dotenv/config';

import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { and, eq } from 'drizzle-orm';
import Module from 'module';
import { db } from '@/db';
import { agentTokens, workspaceMembers } from '@/db/schema';

const url = process.env.DATABASE_URL ?? 'file:local.db';
if (!url.startsWith('file:')) {
  console.error('Refusing to run against a remote database. Set DATABASE_URL="file:local.db".');
  process.exit(1);
}

const RTT = Number(process.env.BENCH_DB_RTT_MS ?? 0);
const RUNS = Number(process.env.BENCH_RUNS ?? 5);

// Count (and optionally delay) every round trip the libsql client makes.
let roundTrips = 0;
const client = (db as unknown as { $client: Record<string, (...a: unknown[]) => Promise<unknown>> }).$client;
for (const method of ['execute', 'batch', 'migrate', 'transaction'] as const) {
  const original = client[method]?.bind(client);
  if (!original) continue;
  client[method] = async (...args: unknown[]) => {
    roundTrips += 1;
    if (RTT) await new Promise((r) => setTimeout(r, RTT));
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
  } finally {
    for (const id of minted) await db.delete(agentTokens).where(eq(agentTokens.id, id));
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
