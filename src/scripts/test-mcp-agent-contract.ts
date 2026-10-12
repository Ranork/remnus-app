/**
 * End-to-end check of what an agent is told and can do, through the real MCP route handler
 * with real PATs (no network):
 *
 *  - `initialize` names the workspace in `serverInfo.title` and tells the agent that deletes
 *    are recoverable (and that it cannot restore them itself);
 *  - `tools/list`: `get_status` is offered to every scope, write tools only to write tokens;
 *  - `delete_page` / `bulk_delete_pages` previews say "Trash", not "permanently";
 *  - `get_status` reports the token's expiry; an expired token gets a 401 challenge with
 *    `error="invalid_token"` (the signal a client refreshes on);
 *  - `bulk_update_pages` answers per entry (`ok` / `error`) when one id is bad;
 *  - `bulk_delete_pages` really sends rows to the Trash (a `page_snapshots` copy) and a read
 *    token cannot call it.
 *
 * **Local only.** It writes rows and deletes them again; it refuses a non-`file:` URL.
 *
 *   DATABASE_URL="file:local.db" npm run test:mcp-agent-contract
 */
import 'dotenv/config';

import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import Module from 'module';
import { db } from '@/db';
import { agentTokens, databases, pageSnapshots, pages, users, workspaceItems, workspaceMembers, workspaces } from '@/db/schema';
import { deleteWorkspaceData } from '@/lib/services/workspaceDeletion';

const url = process.env.DATABASE_URL ?? 'file:local.db';
if (!url.startsWith('file:')) {
  console.error(`Refusing to run against a remote database (${url.split('@').pop()}). Set DATABASE_URL="file:local.db".`);
  process.exit(1);
}

// `server-only` only resolves inside Next; outside it, point it at Next's own empty stub.
const moduleWithResolver = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const resolveFilename = moduleWithResolver._resolveFilename;
moduleWithResolver._resolveFilename = (request, ...rest) =>
  resolveFilename(request === 'server-only' ? 'next/dist/compiled/server-only/empty.js' : request, ...rest);

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

const SUFFIX = `test-mcpc-${Date.now()}`;
const userId = `${SUFFIX}-user`;
const W = `${SUFFIX}-w`;
const DB_ITEM = `${SUFFIX}-dbitem`;
const DB_ID = `${SUFFIX}-db`;
const rowIds = [1, 2, 3].map((n) => `${SUFFIX}-row${n}`);

async function mint(scope: 'read' | 'write', expiresAt: Date | null = null) {
  const prefix8 = randomBytes(4).toString('hex');
  const secret = randomBytes(32).toString('hex');
  await db.insert(agentTokens).values({
    workspaceId: W, name: `${SUFFIX}-${scope}`, tokenPrefix: prefix8, tokenHash: await bcrypt.hash(secret, 4), scope,
    createdBy: userId, createdAt: new Date(), ...(expiresAt ? { expiresAt } : {}),
  });
  return `rmns_${prefix8}_${secret}`;
}

async function main() {
  await db.run(sql`PRAGMA foreign_keys = ON`);
  const { handleMcpRequest } = await import('@/app/api/mcp/handler');
  const endpoint = { mcpPath: `/api/mcp/w/${W}`, expectedWorkspaceId: W };
  const rpc = async (token: string, method: string, params: object = {}) => {
    const res = await handleMcpRequest(new Request(`http://localhost:3000${endpoint.mcpPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${token}`, 'MCP-Protocol-Version': '2025-06-18' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }), endpoint);
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* a 401 body is still JSON; anything else is reported by the status */ }
    return { status: res.status, headers: res.headers, json };
  };
  const callTool = (token: string, name: string, args: object = {}) => rpc(token, 'tools/call', { name, arguments: args });

  const now = new Date();
  await db.insert(users).values({ id: userId, name: 'MCP Tester', email: `${userId}@example.invalid`, role: 'user' });
  await db.insert(workspaces).values({ id: W, name: 'Contract workspace', billingOwnerId: userId, createdAt: now, updatedAt: now });
  await db.insert(workspaceMembers).values({ workspaceId: W, userId, role: 'owner', createdAt: now });
  await db.insert(workspaceItems).values({ id: DB_ITEM, workspaceId: W, type: 'database', title: 'Tasks', parentId: null, sortOrder: 0, createdAt: now, updatedAt: now });
  await db.insert(databases).values({ id: DB_ID, name: 'Tasks', itemId: DB_ITEM, schema: [{ id: 'title', name: 'Title', type: 'text' }], views: [], createdAt: now, updatedAt: now });
  await db.insert(pages).values(rowIds.map((id, i) => ({ id, databaseId: DB_ID, title: `Task ${i + 1}`, content: 'body', properties: {}, sortOrder: i, createdAt: now, updatedAt: now })));

  try {
    const write = await mint('write', new Date(Date.now() + 3600_000));
    const read = await mint('read');
    const expired = await mint('write', new Date(Date.now() - 1000));

    console.log('initialize:');
    const init = await rpc(write, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'contract-test', version: '1' } });
    const info = init.json?.result?.serverInfo;
    check('serverInfo.name stays the stable identifier', info?.name === 'remnus-mcp', JSON.stringify(info));
    check('serverInfo.title names the workspace', info?.title === 'Remnus: Contract workspace', JSON.stringify(info));
    const instructions: string = init.json?.result?.instructions ?? '';
    check('instructions say deletes are recoverable by a person, not by the agent', /Trash/.test(instructions) && /you cannot/.test(instructions));

    console.log('\ntools/list:');
    const names = async (token: string) => ((await rpc(token, 'tools/list')).json?.result?.tools ?? []).map((t: { name: string }) => t.name) as string[];
    const writeTools = await names(write);
    const readTools = await names(read);
    check('a write token is offered get_status and the bulk tools', ['get_status', 'bulk_update_pages', 'bulk_delete_pages', 'bulk_move_items'].every((n) => writeTools.includes(n)));
    check('a read token is offered get_status but no write tool', readTools.includes('get_status') && !readTools.includes('delete_page') && !readTools.includes('bulk_delete_pages'));
    const tools = (await rpc(write, 'tools/list')).json?.result?.tools ?? [];
    const description = (n: string) => tools.find((t: { name: string }) => t.name === n)?.description ?? '';
    check('delete tool descriptions promise a Trash, not a permanent delete', /Trash/.test(description('delete_page')) && /Trash/.test(description('bulk_delete_pages')) && !/permanent/i.test(description('delete_page') + description('bulk_delete_pages')));
    check('bulk_update_pages promises per-entry results', /ok: false/.test(description('bulk_update_pages')));

    console.log('\nget_status:');
    const status = (await callTool(write, 'get_status')).json?.result?.structuredContent;
    check('names the workspace, scope and connection', status?.workspace?.name === 'Contract workspace' && status?.connection?.scope === 'write' && status?.connection?.kind === 'personal_access_token', JSON.stringify(status));
    check('reports the time left on an expiring token', typeof status?.expiresInSeconds === 'number' && status.expiresInSeconds > 3000 && status.expiresInSeconds <= 3600);
    const readStatus = (await callTool(read, 'get_status')).json?.result?.structuredContent;
    check('a read token says it has no write tools', readStatus?.connection?.scope === 'read' && readStatus?.connection?.writeTools === false && readStatus?.expiresAt === null);

    console.log('\nexpired token:');
    const dead = await callTool(expired, 'get_status');
    const challenge = dead.headers.get('WWW-Authenticate') ?? '';
    check('is a 401 whose challenge says invalid_token (what makes a client refresh)', dead.status === 401 && /error="invalid_token"/.test(challenge) && /resource_metadata=/.test(challenge), `${dead.status} ${challenge}`);

    console.log('\ndeleting:');
    const preview = (await callTool(write, 'delete_page', { pageId: rowIds[0] })).json?.result;
    const previewText: string = preview?.content?.[0]?.text ?? '';
    check('delete_page without confirm previews and mentions the Trash', preview?.structuredContent?.deleted === false && /Trash/.test(previewText) && !/permanently/i.test(previewText), previewText);
    const bulkPreview = (await callTool(write, 'bulk_delete_pages', { pageIds: rowIds })).json?.result;
    check('bulk_delete_pages without confirm previews and mentions the Trash', bulkPreview?.structuredContent?.deleted === false && /Trash/.test(bulkPreview?.content?.[0]?.text ?? ''));
    const refused = (await callTool(read, 'bulk_delete_pages', { pageIds: rowIds, confirm: true })).json;
    check('a read token cannot delete', !!refused?.error || refused?.result?.isError === true);

    console.log('\nbulk_update_pages with one bad id:');
    const bulk = (await callTool(write, 'bulk_update_pages', { updates: [{ pageId: rowIds[0], title: 'One' }, { pageId: `${SUFFIX}-nope`, title: 'Nope' }, { pageId: rowIds[1], title: 'Two' }] })).json?.result?.structuredContent;
    check('answers per entry', bulk?.requested === 3 && bulk?.succeeded === 2 && bulk?.failed === 1, JSON.stringify(bulk));
    check('says which one failed and why', bulk?.results?.[1]?.ok === false && !!bulk?.results?.[1]?.error && bulk?.results?.[0]?.ok === true && bulk?.results?.[2]?.ok === true);

    console.log('\nbulk_delete_pages (confirmed):');
    const del = (await callTool(write, 'bulk_delete_pages', { pageIds: [rowIds[0], `${SUFFIX}-nope`, rowIds[1]], confirm: true })).json?.result?.structuredContent;
    check('deletes what exists and reports what does not', del?.succeeded === 2 && del?.failed === 1 && del?.results?.find((r: { id: string }) => r.id === `${SUFFIX}-nope`)?.ok === false, JSON.stringify(del));
    const left = await db.select({ id: pages.id }).from(pages).where(eq(pages.databaseId, DB_ID));
    const trash = await db.select({ originalId: pageSnapshots.originalId, by: pageSnapshots.deletedByKind }).from(pageSnapshots).where(eq(pageSnapshots.workspaceId, W));
    check('the rows are gone from the database', left.length === 1 && left[0].id === rowIds[2]);
    check('…and a Trash copy of each exists, attributed to the agent', trash.length === 2 && trash.every((t) => t.by === 'agent' && rowIds.slice(0, 2).includes(t.originalId)), JSON.stringify(trash));
  } finally {
    await deleteWorkspaceData(W).catch((e) => console.error('cleanup', W, e));
    await db.delete(users).where(eq(users.id, userId));
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().then(() => process.exit(0), (error) => {
  console.error(error);
  process.exit(1);
});
