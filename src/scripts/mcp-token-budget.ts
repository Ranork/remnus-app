/**
 * MCP session token budget — where the bytes go.
 *
 * Registers the real tool/prompt/resource surfaces on an McpServer, talks to it over
 * the SDK's in-memory transport (so what we measure is the exact JSON-RPC wire form),
 * and reports bytes + estimated tokens (bytes/4, the project's own convention from
 * agent_activity.response_bytes) for every fixed per-session cost, then models the
 * first five minutes of a typical session against a local workspace.
 *
 *   DATABASE_URL="file:local.db" npm run bench:mcp-budget [-- <workspaceId>] [--dump=tools.json]
 *
 * `--dump` writes the raw tools/list JSON so a schema can be read in full.
 *
 * Read-only: nothing here writes. resources/list does hit the DB for the sample
 * workspace, which is why DATABASE_URL must be the local file.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import fs from 'node:fs';
import path from 'node:path';

import { registerReadTools } from '@/app/api/mcp/tools/read';
import { registerWriteTools } from '@/app/api/mcp/tools/write';
import { registerPrompts } from '@/app/api/mcp/prompts';
import { registerResources } from '@/app/api/mcp/resources';
import { renderInstructions } from '@/app/api/mcp/handler';
import type { TokenContext } from '@/app/api/mcp/context';
import { getWorkspaceDigest, getAnyPageById, queryDatabaseRows, listWorkspaceItems, getChangesSince, buildContentOutline } from '@/lib/services/workspace';

if (!(process.env.DATABASE_URL ?? 'file:local.db').startsWith('file:')) {
  throw new Error('Refusing to run against a non-local database.');
}

const args = process.argv.slice(2);
const dumpTo = args.find((a) => a.startsWith('--dump='))?.slice('--dump='.length);
const WORKSPACE_ID = args.find((a) => !a.startsWith('--')) ?? '8437a708-1209-4d5b-85d1-3e32c868026c';

const bytes = (v: unknown) => Buffer.byteLength(typeof v === 'string' ? v : JSON.stringify(v), 'utf8');
const tok = (b: number) => Math.round(b / 4);
const row = (label: string, b: number, extra = '') => `| ${label.padEnd(34)} | ${String(b).padStart(7)} | ${String(tok(b)).padStart(6)} |${extra}`;
const header = (a: string) => `| ${a.padEnd(34)} |   bytes |  ~tok |\n|${'-'.repeat(36)}|--------:|------:|`;

function ctxFor(scope: 'read' | 'write'): TokenContext {
  return { tokenId: 'measure', tokenKind: 'pat', workspaceId: WORKSPACE_ID, scope, agentName: 'measure', ownerUserId: null };
}

async function connect(scope: 'read' | 'write') {
  const ctx = ctxFor(scope);
  const instructions = renderInstructions(ctx, { mode: 'smart', autoMaxTokens: 2000 });
  const server = new McpServer({ name: 'remnus-mcp', version: '1.1.0' }, { instructions });
  registerResources(server, ctx);
  registerPrompts(server, ctx);
  registerReadTools(server, ctx);
  // Mirrors handler.ts: a read-scoped session never sees the write tools.
  if (scope === 'write') registerWriteTools(server, ctx);
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await server.connect(serverT);
  const client = new Client({ name: 'measure', version: '0' });
  await client.connect(clientT);
  return { client, server, instructions };
}

async function main() {
  const out: string[] = [];
  const { client, instructions } = await connect('write');

  // ── tools/list ───────────────────────────────────────────────────────────
  const tools = await client.listTools();
  if (dumpTo) fs.writeFileSync(dumpTo, JSON.stringify(tools, null, 2));
  out.push('## tools/list (write scope)', '', header('tool'));
  const perTool = tools.tools.map((t) => {
    const b = bytes(t);
    return { name: t.name, b, desc: bytes(t.description ?? ''), input: bytes(t.inputSchema), output: bytes(t.outputSchema ?? ''), ann: bytes(t.annotations ?? '') };
  }).sort((a, b) => b.b - a.b);
  for (const t of perTool) out.push(row(t.name, t.b, ` desc ${t.desc} · in ${t.input} · out ${t.output} · ann ${t.ann}`));
  out.push(row(`TOTAL (${tools.tools.length} tools)`, bytes(tools)));
  const sum = (k: 'desc' | 'input' | 'output' | 'ann') => perTool.reduce((s, t) => s + t[k], 0);
  out.push('', `descriptions ${sum('desc')} B · inputSchema ${sum('input')} B · outputSchema ${sum('output')} B · annotations ${sum('ann')} B`);
  // Only name + description + inputSchema become part of the model's tool definition
  // (the Anthropic tools API has no output-schema field); outputSchema and
  // annotations stay on the wire between server and client.
  const modelVisible = sum('desc') + sum('input');
  out.push(`MODEL-VISIBLE (description + inputSchema): ${modelVisible} B ≈ ${tok(modelVisible)} tok`);

  // ── read scope ───────────────────────────────────────────────────────────
  const read = await connect('read');
  const readTools = await read.client.listTools();
  const readVisible = readTools.tools.reduce((n, t) => n + bytes(t.description ?? '') + bytes(t.inputSchema), 0);
  out.push('', `## tools/list (read scope): ${readTools.tools.length} tools, ${bytes(readTools)} B ≈ ${tok(bytes(readTools))} tok on the wire; model-visible ${readVisible} B ≈ ${tok(readVisible)} tok`);

  // ── prompts / resources ──────────────────────────────────────────────────
  const prompts = await client.listPrompts();
  const resources = await client.listResources();
  const templates = await client.listResourceTemplates();
  out.push('', '## Other fixed surfaces', '', header('surface'));
  out.push(row(`prompts/list (${prompts.prompts.length})`, bytes(prompts)));
  out.push(row(`resources/list (${resources.resources.length})`, bytes(resources)));
  out.push(row(`resources/templates/list (${templates.resourceTemplates.length})`, bytes(templates)));
  out.push(row('instructions (smart, write)', bytes(instructions)));
  out.push(row('instructions (smart, read)', bytes(read.instructions)));
  out.push(row('instructions (strict, write)', bytes(renderInstructions(ctxFor('write'), { mode: 'strict', autoMaxTokens: 2000 }))));
  out.push(row('instructions (manual, write)', bytes(renderInstructions(ctxFor('write'), { mode: 'manual', autoMaxTokens: 2000 }))));

  const template = fs.readFileSync(path.join(process.cwd(), 'cli/templates/agents-section.md'), 'utf8')
    .replace(/\{\{(\w+)\}\}/g, (_m, k: string) => ({ WORKSPACE_NAME: 'Acme Project', SCOPE: 'write', CALIBRATE_URL: 'https://www.remnus.com/wiki/calibrate', WORKSPACE_ID: WORKSPACE_ID, MCP_URL: `https://www.remnus.com/api/mcp/w/${WORKSPACE_ID}` } as Record<string, string>)[k] ?? '');
  out.push(row('AGENTS.md block (rendered)', bytes(template)));

  // ── session model ────────────────────────────────────────────────────────
  const { text: digest } = await getWorkspaceDigest(WORKSPACE_ID);
  const { items } = await listWorkspaceItems(WORKSPACE_ID, undefined, 200);
  const firstDb = items.find((i) => i.type === 'database' && i.databaseId);
  const firstPage = items.find((i) => i.type === 'page');
  const query = firstDb ? await queryDatabaseRows(WORKSPACE_ID, firstDb.databaseId!, 50) : null;
  const page = firstPage ? await getAnyPageById(WORKSPACE_ID, firstPage.id) : null;
  const changes = await getChangesSince(WORKSPACE_ID, undefined, undefined, 100);
  const outline = page?.content ? { ...page, content: buildContentOutline(page.content), mode: 'outline', fullContentChars: page.content.length } : page;

  out.push('', `## Session model — workspace ${WORKSPACE_ID} (${items.length} items)`, '', header('step'));
  const init = bytes({ protocolVersion: '2025-06-18', capabilities: { resources: {}, prompts: {}, tools: {} }, serverInfo: { name: 'remnus-mcp', version: '1.1.0' }, instructions });
  const steps: Array<[string, number]> = [
    ['initialize (incl. instructions)', init],
    ['tools/list', bytes(tools)],
    ['AGENTS.md block', bytes(template)],
    ['digest resource', bytes(digest)],
    ['get_changes_since (bootstrap)', bytes(changes)],
    [`query_database (${query?.rows.length ?? 0} rows, all cols)`, query ? bytes(query) : 0],
    ['get_page (full)', page ? bytes(page) : 0],
    ['get_page (outline)', outline ? bytes(outline) : 0],
  ];
  for (const [l, b] of steps) out.push(row(l, b));


  const session = init + bytes(tools) + bytes(template) + bytes(digest) + (query ? bytes(query) : 0) + (page ? bytes(page) : 0);
  out.push(row('SESSION (init+tools+block+digest+query+page)', session));

  // How much of a read payload is null / '' / [] / {} — the candidate for dropping.
  const compact = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(compact);
    if (v && typeof v === 'object') {
      const o: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (x === null || x === '' || (Array.isArray(x) && x.length === 0) || (x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length === 0)) continue;
        o[k] = compact(x);
      }
      return o;
    }
    return v;
  };
  const shares: string[] = [];
  for (const [l, v] of [['list_workspace', { items }], ['query_database', query], ['get_page', page], ['get_changes_since', changes]] as const) {
    if (!v) continue;
    const full = bytes(v); const slim = bytes(compact(v));
    shares.push(`${l} ${full}→${slim} B (−${Math.round((1 - slim / full) * 100)}%)`);
  }
  out.push('', `null/empty share of raw service payloads (before tool-level shaping): ${shares.join(' · ')}`);

  out.push('', `Tool result on the wire = content.text + structuredContent (2 copies). What the MODEL sees: Claude Code → structuredContent only; Claude Desktop/Cursor → content only. Either way one copy.`);

  console.log(out.join('\n'));
  await client.close();
  await read.client.close();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
