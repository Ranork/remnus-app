/**
 * Deterministic retrieval/token benchmark for Context Pack v2.
 * This fixture is a regression guard, not a claim about customer workspaces.
 *
 * Two groups of cases:
 * - `mustHit` — asserted: the expected concept must rank first. A case moves
 *   here only once the retrieval layer reliably solves it.
 * - `tracked` — reported, never asserted: known retrieval gaps (a Turkish task
 *   against an English workspace with no `keywords`, a synonym the text never
 *   uses). Their hit rate is the number the next retrieval step (P11,
 *   embeddings) has to move.
 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { prepareContextPack, type ContextPackDependencies } from '@/lib/services/contextPack';
import type { KnowledgeCorpusItem } from '@/lib/services/knowledge';

const paragraph = (topic: string) => `${topic}. ${'Implementation notes, decisions, constraints, and examples. '.repeat(120)}`;
const corpus: KnowledgeCorpusItem[] = [
  ['auth', 'Authentication architecture', 'OAuth PKCE session security token rotation', ['oauth', 'security']],
  ['billing', 'Billing plan limits', 'Seats agents storage subscription enforcement', ['billing', 'plans']],
  ['invites', 'Workspace invitation roles', 'Owner member viewer invitations access policy', ['viewer', 'roles']],
  ['mcp', 'MCP context protocol', 'prepare context contextRunId smart strict write gate', ['mcp', 'context']],
  ['mobile', 'Mobile application shell', 'Capacitor Android iOS install deep links', ['mobile']],
  ['mail', 'Lifecycle email system', 'SES newsletters unsubscribe suppression', ['email']],
  ['sharing', 'Public page sharing', 'Share slug permission sitemap public page', ['sharing']],
  ['analytics', 'Activation analytics', 'PostHog funnel agent call signup attribution', ['analytics']],
  // Capital "I" in the title only: a lowercase task must still find it.
  ['integrations', 'Integrations API', 'Slack GitHub connectors webhooks', ['connectors']],
  // A Turkish concept typed with Turkish letters, searched without them.
  ['cozum', 'Çözüm Notları', 'Müşteri şikâyetleri için geçici çözüm adımları', ['destek']],
].map(([id, title, text, tags]) => ({
  id: String(id), itemType: 'page' as const, title: String(title), content: paragraph(String(text)), breadcrumb: [],
  metadata: { tags: tags as string[], sources: [], stale: false, trust: id === 'mcp' ? 'human-reviewed' as const : 'unverified' as const, status: 'stable' as const },
}));

type Case = { task: string; keywords?: string[]; expected: string; note?: string };

const mustHit: Case[] = [
  { task: 'Implement strict MCP context write gate', expected: 'mcp' },
  { task: 'Add viewer role to workspace invitations', expected: 'invites' },
  { task: 'Enforce subscription seat and storage limits', expected: 'billing' },
  { task: 'Debug OAuth PKCE token rotation', expected: 'auth' },
  // Letter folding (P10 A).
  { task: 'debug the integrations api', expected: 'integrations', note: 'capital I' },
  { task: 'cozum notlari guncelle', expected: 'cozum', note: 'Turkish letters typed as ASCII' },
  { task: 'ÇÖZÜM NOTLARI', expected: 'cozum', note: 'upper-case Turkish' },
  // Agent-side query expansion (P10 B): the caller adds the workspace's own terms.
  { task: 'Davetlere görüntüleyici rolü ekle', keywords: ['invitation', 'viewer', 'role'], expected: 'invites', note: 'TR task + keywords' },
  { task: 'Abonelik koltuk limitlerini uygula', keywords: ['subscription', 'seats', 'plan limits'], expected: 'billing', note: 'TR task + keywords' },
  { task: 'Kullanıcı oturum açma güvenliğini düzelt', keywords: ['login', 'session', 'security', 'authentication'], expected: 'auth', note: 'TR task + keywords' },
  { task: 'Stop sending mail to people who opted out', keywords: ['email', 'unsubscribe', 'suppression'], expected: 'mail', note: 'synonym + keywords' },
];

const tracked: Case[] = [
  { task: 'Davetlere görüntüleyici rolü ekle', expected: 'invites', note: 'TR task, no keywords' },
  { task: 'Abonelik koltuk limitlerini uygula', expected: 'billing', note: 'TR task, no keywords' },
  { task: 'Kullanıcı oturum açma güvenliğini düzelt', expected: 'auth', note: 'TR task, no keywords' },
  { task: 'Stop sending mail to people who opted out', expected: 'mail', note: 'synonym, no keywords' },
];

const dependencies: ContextPackDependencies = {
  listKnowledgeCorpus: async () => corpus,
  getRelatedPages: async (_workspaceId, pageId) => ({
    page: { id: pageId, title: '', type: 'page' as const }, parent: null, children: [], outgoingLinks: [], backlinks: [], siblings: null,
  }),
};

async function rankOf(testCase: Case) {
  const pack = await prepareContextPack('benchmark', {
    task: testCase.task,
    maxTokens: 1_000,
    maxConcepts: 3,
    ...(testCase.keywords ? { keywords: testCase.keywords } : {}),
  }, dependencies);
  assert.ok(pack.estimatedTokens <= 1_000, 'Pack exceeded its requested budget');
  return { rank: pack.concepts.findIndex(concept => concept.id === testCase.expected) + 1, tokens: pack.estimatedTokens };
}

/** The corpus cache must follow its version key, never serve a stale corpus. */
async function checkCorpusCache() {
  let loads = 0;
  let version: string | null = 'v1';
  const staleSoon = { ...corpus[0], id: 'aging', title: 'Aging rotation runbook', metadata: { ...corpus[0].metadata, staleAfter: new Date(Date.now() + 150).toISOString(), stale: false } };
  const cached: ContextPackDependencies = {
    ...dependencies,
    listKnowledgeCorpus: async () => { loads++; return [...corpus, staleSoon]; },
    corpusVersion: async () => version,
  };
  const run = () => prepareContextPack('cache-check', { task: 'aging rotation runbook', maxTokens: 1_000, maxConcepts: 2 }, cached);
  const first = await run();
  await run();
  assert.equal(loads, 1, 'Same version must be served from the cache');
  version = 'v2';
  await run();
  assert.equal(loads, 2, 'A new version must rebuild the index');
  version = null;
  await run();
  await run();
  assert.equal(loads, 4, 'A null version (hot second) must never be cached');
  version = 'v3';
  await run();
  await new Promise(resolve => setTimeout(resolve, 200));
  const later = await run();
  assert.equal(loads, 5);
  assert.equal(first.concepts[0].metadata.stale, false);
  assert.equal(later.concepts.find(concept => concept.id === 'aging')?.metadata.stale, true, 'Freshness must be recomputed on a cache hit');
}

async function main() {
  await checkCorpusCache();
  const naiveTokens = Math.ceil(JSON.stringify(corpus).length / 4);
  let reciprocalRank = 0;
  let topOne = 0;
  let returnedTokens = 0;
  const started = performance.now();
  const table: Array<{ group: string; task: string; keywords: string; expected: string; rank: number | '-' }> = [];
  const missed: string[] = [];

  for (const testCase of mustHit) {
    const { rank, tokens } = await rankOf(testCase);
    if (rank === 1) topOne++;
    else missed.push(`${testCase.task} (${testCase.note ?? testCase.expected}) → rank ${rank || '-'}`);
    if (rank > 0) reciprocalRank += 1 / rank;
    returnedTokens += tokens;
    table.push({ group: 'mustHit', task: testCase.task, keywords: (testCase.keywords ?? []).join(', '), expected: testCase.expected, rank: rank || '-' });
  }

  let trackedHits = 0;
  for (const testCase of tracked) {
    const { rank } = await rankOf(testCase);
    if (rank === 1) trackedHits++;
    table.push({ group: 'tracked', task: testCase.task, keywords: '', expected: testCase.expected, rank: rank || '-' });
  }

  const result = {
    fixture: 'synthetic-regression-v2',
    mustHitCases: mustHit.length,
    top1Accuracy: topOne / mustHit.length,
    meanReciprocalRank: reciprocalRank / mustHit.length,
    trackedCases: tracked.length,
    trackedTop1: trackedHits / tracked.length,
    naiveTokensPerTask: naiveTokens,
    contextTokensPerTask: Math.round(returnedTokens / mustHit.length),
    tokenReduction: 1 - (returnedTokens / mustHit.length) / naiveTokens,
    totalLatencyMs: Number((performance.now() - started).toFixed(2)),
  };
  console.table(table);
  console.log(JSON.stringify(result, null, 2));
  console.log('Note: synthetic regression data; do not use these percentages as a customer claim.');
  assert.deepEqual(missed, [], 'A mustHit task no longer ranks its canonical concept first');
}

void main();
