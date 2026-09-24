/**
 * P13 C2 — does walking the link graph from more than the top concept help
 * `prepare_context`? Report-only; run as part of `npm run bench:context`.
 *
 * Before P13 the pack added title/id refs from the TOP concept's neighbourhood
 * only, after the bodies had taken the budget (V0, emulated here). Measured:
 *   product  what shipped: 1-step neighbours of the top 3 concepts, ranked by
 *            the seeds' scores, ≤ 6 refs, their room reserved before bodies
 *   C        control without a graph: the next lexical hits as refs
 *   V1       the product's list uncut / cut to 4
 *   V2       personalized PageRank seeded by the concepts' scores → refs
 *   V2c      the same PageRank folded into the concept ranking itself (bodies)
 *
 * Corpus: the repo's own docs/ (46 real pages, real cross-links — relative
 * `.md` links and `/wiki/…`, `/docs/…` URLs), the only linked corpus in the
 * repo; the synthetic mustHit fixture has no links at all. Relevance sets were
 * written from the docs' content BEFORE any variant was run, and are kept
 * small: the pages an agent needs to do the task, not everything on-topic.
 *
 * Measured (2026-09-24): see AGENTS.md → Knowledge Map → "prepare_context and
 * the graph (P13)". Nothing here ships unless a variant wins on both recall and
 * noise; this file stays so the decision can be re-checked on new docs.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { prepareContextPackWithStats, type ContextPackDependencies } from '@/lib/services/contextPack';
import type { KnowledgeCorpusItem } from '@/lib/services/knowledge';

type Doc = { id: string; title: string; body: string };

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.md') ? [path] : [];
  });
}

function loadDocs(): Doc[] {
  const root = join(process.cwd(), 'docs');
  return walk(root).map((path) => {
    const body = readFileSync(path, 'utf8');
    const id = relative(root, path).replace(/\\/g, '/').replace(/\.md$/, '');
    const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? body.match(/^title:\s*"?(.+?)"?\s*$/m)?.[1] ?? id;
    return { id, title, body };
  });
}

/** Directed link graph: `/wiki/<slug>` → mcp/<slug>, `/docs/<slug>` → blog/<slug>, relative `.md` links. */
function linkGraph(docs: Doc[]): Map<string, Set<string>> {
  const ids = new Set(docs.map((d) => d.id));
  const out = new Map<string, Set<string>>();
  for (const doc of docs) {
    const targets = new Set<string>();
    for (const [, href] of doc.body.matchAll(/\]\(([^)\s]+)\)/g)) {
      const clean = href.replace(/#.*$/, '').replace(/^https:\/\/www\.remnus\.com/, '');
      let target: string | null = null;
      const wiki = clean.match(/^\/wiki\/(.+?)(?:\.md)?$/);
      const blog = clean.match(/^\/docs\/(.+?)$/);
      if (wiki) target = `mcp/${wiki[1]}`;
      else if (blog) target = `blog/${blog[1]}`;
      else if (/\.md$/.test(clean) && !/^[a-z]+:/i.test(clean)) {
        target = normalize(join(dirname(doc.id), clean)).replace(/\\/g, '/').replace(/\.md$/, '');
      }
      if (target && ids.has(target) && target !== doc.id) targets.add(target);
    }
    out.set(doc.id, targets);
  }
  return out;
}

const CASES: Array<{ task: string; relevant: string[] }> = [
  { task: 'A teammate cloned the repository and needs their own connection to the workspace', relevant: ['mcp/project-join', 'mcp/project-install'] },
  { task: 'Build a status screen showing open bugs and a status breakdown', relevant: ['mcp/dashboards', 'mcp/resources', 'mcp/write-tools'] },
  { task: 'Reduce the tokens the agent spends reading long pages', relevant: ['mcp/token-efficient-usage', 'mcp/read-tools'] },
  { task: 'Set up the workspace for a game mod project', relevant: ['mcp/calibrate', 'mcp/playbooks', 'mcp/playbooks/game'] },
  { task: 'A daily standup agent should only read what changed since its last run', relevant: ['mcp/read-tools', 'mcp/resources'] },
  { task: 'Writes are rejected because a context run id is missing in strict mode', relevant: ['mcp/context-first', 'mcp/write-tools'] },
  { task: 'Link pages to each other so related pages can be found', relevant: ['mcp/write-tools', 'mcp/read-tools'] },
  { task: 'Connect Cursor to the workspace', relevant: ['mcp/connect-editors', 'blog/connect-cursor-to-remnus-mcp', 'mcp/getting-started'] },
  { task: 'Save what the agent learned at the end of a session for the next one', relevant: ['mcp/agent-memory', 'mcp/prompts'] },
  { task: 'Run an agent in CI without an interactive login', relevant: ['blog/run-headless-ai-agents-with-mcp', 'mcp/authentication'] },
  { task: 'Make context packs prefer knowledge a human reviewed', relevant: ['mcp/context-first', 'mcp/read-tools'] },
  { task: 'Check which agent changed a page and when', relevant: ['mcp/read-tools', 'blog/mcp-security-guide'] },
];

const MAX_CONCEPTS = 6;
const BUDGET = 2_000;
/** Ranks 7–16 are all a 16-concept ranking can offer the lexical control, so every ref list is cut to 10. */
const MAX_RELATED = 10;
const SEEDS = 3;

function personalizedPageRank(graph: Map<string, Set<string>>, seeds: Map<string, number>, restart = 0.15, rounds = 40): Map<string, number> {
  // Undirected: a backlink is as much a relation as a link.
  const neighbours = new Map<string, string[]>();
  for (const [from, targets] of graph) {
    for (const to of targets) {
      neighbours.set(from, [...(neighbours.get(from) ?? []), to]);
      neighbours.set(to, [...(neighbours.get(to) ?? []), from]);
    }
  }
  const total = [...seeds.values()].reduce((a, b) => a + b, 0) || 1;
  const teleport = new Map([...seeds].map(([id, w]) => [id, w / total]));
  let rank = new Map(teleport);
  for (let i = 0; i < rounds; i++) {
    const next = new Map<string, number>();
    for (const [id, p] of teleport) next.set(id, restart * p);
    for (const [id, mass] of rank) {
      const list = neighbours.get(id) ?? [];
      if (list.length === 0) {
        for (const [seed, p] of teleport) next.set(seed, (next.get(seed) ?? 0) + (1 - restart) * mass * p);
        continue;
      }
      for (const to of list) next.set(to, (next.get(to) ?? 0) + ((1 - restart) * mass) / list.length);
    }
    rank = next;
  }
  return rank;
}

const refTokens = (refs: Array<{ id: string; title: string }>) =>
  Math.ceil(JSON.stringify(refs.map((r) => ({ id: r.id, type: 'page', title: r.title, relation: 'related' }))).length / 4);

export async function graphExpansionReport() {
  const docs = loadDocs();
  const graph = linkGraph(docs);
  const title = new Map(docs.map((d) => [d.id, d.title]));
  const corpus: KnowledgeCorpusItem[] = docs.map((d) => ({
    id: d.id, itemType: 'page', title: d.title, content: d.body, breadcrumb: [],
    metadata: { tags: [], sources: [], stale: false, trust: 'unverified', status: 'stable' },
  }));
  const incoming = new Map<string, Set<string>>();
  for (const [from, targets] of graph) for (const to of targets) incoming.set(to, new Set([...(incoming.get(to) ?? []), from]));
  const ref = (id: string) => ({ id, title: title.get(id) ?? id, type: 'page' as const });
  const dependencies: ContextPackDependencies = {
    listKnowledgeCorpus: async () => corpus,
    getRelatedPages: async (_workspaceId, pageId) => ({
      page: ref(pageId), parent: null, children: [],
      outgoingLinks: [...(graph.get(pageId) ?? [])].map((id) => ({ ...ref(id), linkKind: 'page_link' as const })),
      backlinks: [...(incoming.get(pageId) ?? [])].map((id) => ({ ...ref(id), linkKind: 'page_link' as const })),
      siblings: null,
    }),
  };

  const edges = [...graph.values()].reduce((sum, set) => sum + set.size, 0);
  const rows: Array<Record<string, string | number>> = [];
  type Total = { body: number; any: number; related: number; hits: number; tokens: number; packTokens: number; top1: number };
  const totals: Record<string, Total> = {};
  const add = (variant: string, body: number, any: number, related: number, hits: number, tokens: number, packTokens: number, top1: boolean) => {
    const t = (totals[variant] ??= { body: 0, any: 0, related: 0, hits: 0, tokens: 0, packTokens: 0, top1: 0 });
    t.body += body; t.any += any; t.related += related; t.hits += hits; t.tokens += tokens; t.packTokens += packTokens; t.top1 += top1 ? 1 : 0;
  };
  /** How often each page is pushed into bodies by V2c although lexical ranking left it out — a hub would show here. */
  const promoted = new Map<string, number>();

  for (const testCase of CASES) {
    const relevant = new Set(testCase.relevant);
    const recall = (ids: Iterable<string>) => [...new Set(ids)].filter((id) => relevant.has(id)).length / relevant.size;
    const hits = (refs: Array<{ id: string }>) => refs.filter((r) => relevant.has(r.id)).length;

    // The product as it ships (P13: top-3 neighbourhoods, ≤ 6 refs, room reserved first).
    const { pack } = await prepareContextPackWithStats('docs', { task: testCase.task, maxTokens: BUDGET, maxConcepts: MAX_CONCEPTS }, dependencies);
    const concepts = pack.concepts.map((c) => c.id);
    const top1 = relevant.has(concepts[0]);
    add('product (P13)', recall(concepts), recall([...concepts, ...pack.related.map((r) => r.id)]), pack.related.length, hits(pack.related), refTokens(pack.related), pack.estimatedTokens, top1);

    // V0: how it worked before P13 — bodies sized first, then the TOP concept's
    // neighbours (parent, children, outgoing, backlinks) while the pack still fits.
    const { pack: bare } = await prepareContextPackWithStats('docs', { task: testCase.task, maxTokens: BUDGET, maxConcepts: MAX_CONCEPTS, includeRelated: false }, dependencies);
    const before = await dependencies.getRelatedPages('docs', bare.concepts[0]?.id ?? '');
    const oldRefs: Array<{ id: string; type: string; title: string; relation: string }> = [];
    for (const r of [...before.outgoingLinks.map((x) => ({ ...x, relation: 'outgoing' })), ...before.backlinks.map((x) => ({ ...x, relation: 'backlink' }))]) {
      if (bare.concepts.some((c) => c.id === r.id) || oldRefs.some((o) => o.id === r.id)) continue;
      oldRefs.push({ id: r.id, type: r.type, title: r.title, relation: r.relation });
      if (oldRefs.length >= 12 || JSON.stringify({ ...bare, related: oldRefs }).length > BUDGET * 4) break;
    }
    while (oldRefs.length && JSON.stringify({ ...bare, related: oldRefs }).length > BUDGET * 4) oldRefs.pop();
    const bareIds = bare.concepts.map((c) => c.id);
    add('V0 before P13', recall(bareIds), recall([...bareIds, ...oldRefs.map((r) => r.id)]), oldRefs.length, hits(oldRefs), refTokens(oldRefs), Math.ceil(JSON.stringify({ ...bare, related: oldRefs }).length / 4), relevant.has(bareIds[0]));

    // The full ranking behind it, for seeds and for re-ranking.
    const { pack: wide } = await prepareContextPackWithStats('docs', { task: testCase.task, maxTokens: 16_000, maxConcepts: 16, includeRelated: false }, dependencies);
    const scores = new Map(wide.concepts.map((c) => [c.id, c.score]));
    const conceptSet = new Set(concepts);
    const withRefs = (refs: Array<{ id: string; title: string }>) => bare.estimatedTokens + refTokens(refs);

    // Control: no graph at all — the next lexical candidates (ranks 7–16) as refs.
    // A graph variant has to beat THIS, not V0: on a 46-page corpus ten refs of
    // anything find something.
    const lexical = wide.concepts.map((c) => c.id).filter((id) => !conceptSet.has(id)).slice(0, MAX_RELATED).map(ref);
    add('C  lexical ranks 7-16', recall(concepts), recall([...concepts, ...lexical.map((r) => r.id)]), lexical.length, hits(lexical), refTokens(lexical), withRefs(lexical), top1);

    // V1: 1-step neighbours of the top SEEDS concepts, ranked by summed seed score.
    const votes = new Map<string, number>();
    for (const seed of concepts.slice(0, SEEDS)) {
      for (const id of [...(graph.get(seed) ?? []), ...(incoming.get(seed) ?? [])]) {
        if (!conceptSet.has(id)) votes.set(id, (votes.get(id) ?? 0) + (scores.get(seed) ?? 0));
      }
    }
    const v1 = [...votes].sort((a, b) => b[1] - a[1]).slice(0, MAX_RELATED).map(([id]) => ref(id));
    add(`V1 1-step, top ${SEEDS}, uncut`, recall(concepts), recall([...concepts, ...v1.map((r) => r.id)]), v1.length, hits(v1), refTokens(v1), withRefs(v1), top1);
    const cut4 = v1.slice(0, 4);
    add('V1 cut to 4', recall(concepts), recall([...concepts, ...cut4.map((r) => r.id)]), cut4.length, hits(cut4), refTokens(cut4), withRefs(cut4), top1);
    // The product's own control: as many refs, no graph.
    const lexicalCut = lexical.slice(0, 6);
    add('C  lexical cut to 6', recall(concepts), recall([...concepts, ...lexicalCut.map((r) => r.id)]), lexicalCut.length, hits(lexicalCut), refTokens(lexicalCut), withRefs(lexicalCut), top1);

    // V2: personalized PageRank from the concepts' scores → related refs.
    const ppr = personalizedPageRank(graph, new Map(concepts.map((id) => [id, scores.get(id) ?? 0])));
    const v2 = [...ppr].filter(([id, mass]) => !conceptSet.has(id) && mass > 0).sort((a, b) => b[1] - a[1]).slice(0, MAX_RELATED).map(([id]) => ref(id));
    add('V2 PPR related', recall(concepts), recall([...concepts, ...v2.map((r) => r.id)]), v2.length, hits(v2), refTokens(v2), withRefs(v2), top1);

    // V2c: the same walk folded into which bodies are sent (score' = bm25/max + ppr/max).
    const wideIds = wide.concepts.map((c) => c.id);
    const pprWide = personalizedPageRank(graph, new Map(wideIds.map((id) => [id, scores.get(id) ?? 0])));
    const maxScore = Math.max(...wide.concepts.map((c) => c.score), 1e-9);
    const maxMass = Math.max(...pprWide.values(), 1e-9);
    const reranked = [...new Set([...wideIds, ...pprWide.keys()])]
      .map((id) => [id, (scores.get(id) ?? 0) / maxScore + (pprWide.get(id) ?? 0) / maxMass] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CONCEPTS)
      .map(([id]) => id);
    for (const id of reranked) if (!conceptSet.has(id)) promoted.set(id, (promoted.get(id) ?? 0) + 1);
    add('V2c PPR in ranking', recall(reranked), recall([...reranked, ...pack.related.map((r) => r.id)]), pack.related.length, hits(pack.related), refTokens(pack.related), pack.estimatedTokens, relevant.has(reranked[0]));

    rows.push({
      task: testCase.task.slice(0, 48),
      relevant: testCase.relevant.length,
      'body': recall(concepts).toFixed(2),
      'V0 +refs': recall([...bareIds, ...oldRefs.map((r) => r.id)]).toFixed(2),
      'P13 +refs': recall([...concepts, ...pack.related.map((r) => r.id)]).toFixed(2),
      'C6 +refs': recall([...concepts, ...lexicalCut.map((r) => r.id)]).toFixed(2),
      'V2 +refs': recall([...concepts, ...v2.map((r) => r.id)]).toFixed(2),
      'V2c body': recall(reranked).toFixed(2),
    });
  }

  console.log(`\nGraph expansion (P13 C2): docs/ corpus ${docs.length} pages, ${edges} directed links; ${CASES.length} tasks, maxConcepts ${MAX_CONCEPTS}, maxTokens ${BUDGET}`);
  console.table(rows);
  const n = CASES.length;
  console.table(Object.entries(totals).map(([variant, t]) => ({
    variant,
    'top-1 relevant': `${t.top1}/${n}`,
    'recall (bodies)': (t.body / n).toFixed(3),
    'recall (bodies + refs)': (t.any / n).toFixed(3),
    'refs / pack': (t.related / n).toFixed(1),
    'ref precision': t.related ? (t.hits / t.related).toFixed(2) : '-',
    'ref tokens': Math.round(t.tokens / n),
    'pack tokens': Math.round(t.packTokens / n),
  })));
  console.log('V2c pushed into bodies (page → tasks):', [...promoted].sort((a, b) => b[1] - a[1]).map(([id, count]) => `${id}×${count}`).join(' · ') || '—');
  return totals;
}
