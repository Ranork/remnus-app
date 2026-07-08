import 'dotenv/config';
import { db } from '@/db';
import { workspaces } from '@/db/schema';
import {
  listWorkspaceItems,
  queryDatabaseRows,
  getAnyPageById,
  buildContentOutline,
  getWorkspaceDigest,
} from '@/lib/services/workspace';

const chars = (o: unknown) => JSON.stringify(o).length;
const tok = (n: number) => Math.round(n / 4);
const pct = (from: number, to: number) => Math.round((1 - to / from) * 100);

async function main() {
  const [ws] = await db.select({ id: workspaces.id, name: workspaces.name }).from(workspaces).limit(1);
  if (!ws) return console.log('no workspace');
  console.log(`Workspace: ${ws.name} (${ws.id})\n`);

  const { items } = await listWorkspaceItems(ws.id, undefined, 200);

  // 1) query_database — with bodies (opt-in) vs default (no bodies) vs fields projection
  const dbItem = items.find(i => i.type === 'database' && i.databaseId);
  if (dbItem?.databaseId) {
    const dflt = await queryDatabaseRows(ws.id, dbItem.databaseId, 100);
    const allCols = (dflt.schema ?? []).filter(c => c.id !== 'title').map(c => c.name);
    // bodies are opt-in since 2026-07-08 — the old "full" behavior needs an explicit 'content'
    const full = await queryDatabaseRows(ws.id, dbItem.databaseId, 100, undefined, undefined, [...allCols, 'content']);
    const cols = allCols.slice(0, 2);
    const proj = await queryDatabaseRows(ws.id, dbItem.databaseId, 100, undefined, undefined, cols);
    const f = chars(full), d = chars(dflt), p = chars(proj);
    console.log(`[1] query_database "${dbItem.title}" (${dflt.rows?.length ?? 0} rows)`);
    console.log(`    with bodies (fields=[...all,"content"]): ${f} chars ≈ ${tok(f)} tok`);
    console.log(`    default (no bodies)                    : ${d} chars ≈ ${tok(d)} tok  (−${pct(f, d)}%)`);
    console.log(`    fields=${JSON.stringify(cols)}         : ${p} chars ≈ ${tok(p)} tok  (−${pct(f, p)}%)\n`);
  }

  // 2) get_page — full vs outline (longest page)
  let longest: { id: string; title: string; len: number; body: string } | null = null;
  for (const it of items.filter(i => i.type === 'page')) {
    try {
      const pg = await getAnyPageById(ws.id, it.id);
      const body = pg.content ?? '';
      if (!longest || body.length > longest.len) longest = { id: it.id, title: pg.title, len: body.length, body };
    } catch { /* skip */ }
  }
  if (longest) {
    const outline = buildContentOutline(longest.body);
    const f = longest.len, o = outline.length;
    console.log(`[2] get_page "${longest.title}"`);
    console.log(`    full     : ${f} chars ≈ ${tok(f)} tok`);
    console.log(`    outline  : ${o} chars ≈ ${tok(o)} tok`);
    console.log(`    reduction: ${pct(f, o)}%\n`);
  }

  // 3) workspace digest vs naive "read every page body"
  const digest = await getWorkspaceDigest(ws.id);
  let naive = 0;
  for (const it of items.filter(i => i.type === 'page')) {
    try { const pg = await getAnyPageById(ws.id, it.id); naive += (pg.content ?? '').length + (pg.title ?? '').length; } catch { /* skip */ }
  }
  console.log(`[3] workspace orientation (${items.length} items)`);
  console.log(`    digest              : ${digest.length} chars ≈ ${tok(digest.length)} tok`);
  console.log(`    read every page body: ${naive} chars ≈ ${tok(naive)} tok`);
  if (naive) console.log(`    reduction           : ${pct(naive, digest.length)}%\n`);

  // 4) Notion block-JSON vs Remnus markdown for one representative paragraph
  const para =
    'The staging API rate-limits at 100 requests per minute, so the importer batches writes in groups of 50 and backs off on 429.';
  const remnusMd = para; // Remnus stores + serves plain markdown
  // A representative Notion "paragraph" block as returned by the blocks API.
  const notionBlock = {
    object: 'block',
    id: '5a3f2b10-9c4e-4d21-8f77-2b6a1e0c9d34',
    parent: { type: 'page_id', page_id: 'b21c7e88-4a90-4f2a-9e33-77c0d5a1b2e4' },
    created_time: '2026-07-05T09:12:00.000Z',
    last_edited_time: '2026-07-05T09:12:00.000Z',
    created_by: { object: 'user', id: 'c9d1a2b3-4e5f-6071-8293-a4b5c6d7e8f9' },
    last_edited_by: { object: 'user', id: 'c9d1a2b3-4e5f-6071-8293-a4b5c6d7e8f9' },
    has_children: false,
    archived: false,
    type: 'paragraph',
    paragraph: {
      rich_text: [
        {
          type: 'text',
          text: { content: para, link: null },
          annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' },
          plain_text: para,
          href: null,
        },
      ],
      color: 'default',
    },
  };
  const md = remnusMd.length, nb = chars(notionBlock);
  console.log(`[4] one paragraph — Remnus markdown vs representative Notion block-JSON`);
  console.log(`    Remnus markdown   : ${md} chars ≈ ${tok(md)} tok`);
  console.log(`    Notion block-JSON : ${nb} chars ≈ ${tok(nb)} tok`);
  console.log(`    Notion multiple   : ${(nb / md).toFixed(1)}x`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
