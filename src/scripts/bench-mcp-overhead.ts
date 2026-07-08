// Measures the FIXED context cost of connecting to the Remnus MCP:
// tools/list + prompts/list + resource-template list payload sizes,
// i.e. what an MCP client injects into the model's context at session start.
// Run: DATABASE_URL="file:local.db" npx tsx src/scripts/bench-mcp-overhead.ts
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerReadTools } from '@/app/api/mcp/tools/read';
import { registerWriteTools } from '@/app/api/mcp/tools/write';
import { registerResources } from '@/app/api/mcp/resources';
import { registerPrompts } from '@/app/api/mcp/prompts';
import type { TokenContext } from '@/app/api/mcp/context';

const tok = (n: number) => Math.round(n / 4);

async function main() {
  const ctx: TokenContext = {
    tokenId: 'bench',
    tokenKind: 'pat',
    workspaceId: 'bench-ws-nonexistent',
    scope: 'write',
    agentName: null,
    ownerUserId: null,
  };

  const server = new McpServer({ name: 'remnus-mcp', version: '1.0.0' });
  registerResources(server, ctx);
  registerPrompts(server, ctx);
  registerReadTools(server, ctx);
  registerWriteTools(server, ctx);

  const client = new Client({ name: 'bench', version: '1.0.0' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(ct), server.connect(st)]);

  const tools = await client.listTools();
  const toolsJson = JSON.stringify(tools);
  console.log(`\n[tools/list] ${tools.tools.length} tools — ${toolsJson.length} chars ≈ ${tok(toolsJson.length)} tok (full payload)\n`);

  const per = tools.tools
    .map((t) => {
      const full = JSON.stringify(t).length;
      const noOut = JSON.stringify({ ...t, outputSchema: undefined }).length;
      return { name: t.name, full, outSchema: full - noOut };
    })
    .sort((a, b) => b.full - a.full);
  console.log('  per tool (full / of which outputSchema):');
  for (const p of per) {
    console.log(
      `    ${p.name.padEnd(24)} ${String(p.full).padStart(6)} ch ≈ ${String(tok(p.full)).padStart(4)} tok   (outputSchema: ${String(p.outSchema).padStart(5)} ch ≈ ${String(tok(p.outSchema)).padStart(4)} tok)`,
    );
  }
  const totalOut = per.reduce((s, p) => s + p.outSchema, 0);
  console.log(`  outputSchema share: ${totalOut} ch ≈ ${tok(totalOut)} tok of ${toolsJson.length} ch\n`);

  const prompts = await client.listPrompts();
  const pj = JSON.stringify(prompts);
  console.log(`[prompts/list] ${prompts.prompts.length} prompts — ${pj.length} chars ≈ ${tok(pj.length)} tok`);

  try {
    const rt = await client.listResourceTemplates();
    const rj = JSON.stringify(rt);
    console.log(`[resources/templates/list] ${rt.resourceTemplates.length} templates — ${rj.length} chars ≈ ${tok(rj.length)} tok`);
  } catch (e) {
    console.log(`[resources/templates/list] failed: ${String(e)}`);
  }
  try {
    const rl = await client.listResources();
    const rj = JSON.stringify(rl);
    console.log(`[resources/list] ${rl.resources.length} resources — ${rj.length} chars ≈ ${tok(rj.length)} tok`);
  } catch (e) {
    console.log(`[resources/list] failed (expected with fake ws): ${String(e).slice(0, 120)}`);
  }

  const grand = toolsJson.length + pj.length;
  console.log(`\n[TOTAL fixed-ish payload: tools+prompts] ${grand} chars ≈ ${tok(grand)} tok`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
