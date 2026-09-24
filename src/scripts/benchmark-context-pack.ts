/**
 * Deterministic retrieval/token benchmark for Context Pack v2.
 * This fixture is a regression guard, not a claim about customer workspaces.
 *
 * Two groups of cases:
 * - `mustHit` — asserted: the expected concept must rank first, with no
 *   vocabulary-miss warning (a false alarm costs the agent a second call). A
 *   case moves here only once the retrieval layer reliably solves it.
 * - `tracked` — a Turkish task against an English workspace with no
 *   `keywords`, a synonym the text never uses. The first-call rank is only
 *   reported: retrieval is lexical and stays so (P11, 2026-09-24: no workspace
 *   content goes to an embedding provider). What IS asserted is the recovery —
 *   the pack names the missing task words, and a second call with the
 *   `retryKeywords` an agent would add ranks the concept first.
 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { prepareContextPack, prepareContextPackWithStats, type ContextPackDependencies } from '@/lib/services/contextPack';
import type { KnowledgeCorpusItem } from '@/lib/services/knowledge';
import { graphExpansionReport } from './context-graph-expansion';

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

type Case = { task: string; keywords?: string[]; expected: string; note?: string; retryKeywords?: string[] };

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
  { task: 'Davetlere görüntüleyici rolü ekle', expected: 'invites', note: 'TR task, no keywords', retryKeywords: ['invitation', 'viewer', 'role'] },
  { task: 'Abonelik koltuk limitlerini uygula', expected: 'billing', note: 'TR task, no keywords', retryKeywords: ['subscription', 'seats', 'plan limits'] },
  { task: 'Kullanıcı oturum açma güvenliğini düzelt', expected: 'auth', note: 'TR task, no keywords', retryKeywords: ['login', 'session', 'security', 'authentication'] },
  { task: 'Stop sending mail to people who opted out', expected: 'mail', note: 'synonym, no keywords', retryKeywords: ['email', 'unsubscribe', 'suppression'] },
];

const dependencies: ContextPackDependencies = {
  listKnowledgeCorpus: async () => corpus,
  getRelatedPages: async (_workspaceId, pageId) => ({
    page: { id: pageId, title: '', type: 'page' as const }, parent: null, children: [], outgoingLinks: [], backlinks: [], siblings: null,
  }),
};

async function rankOf(testCase: Case, keywords = testCase.keywords) {
  const { pack, stats } = await prepareContextPackWithStats('benchmark', {
    task: testCase.task,
    maxTokens: 1_000,
    maxConcepts: 3,
    ...(keywords ? { keywords } : {}),
  }, dependencies);
  assert.ok(pack.estimatedTokens <= 1_000, 'Pack exceeded its requested budget');
  const hint = pack.warnings.find(warning => warning.startsWith('Task words not found'));
  assert.equal(!!hint, stats.vocabularyMiss, 'The warning and the stats flag must agree');
  return { rank: pack.concepts.findIndex(concept => concept.id === testCase.expected) + 1, tokens: pack.estimatedTokens, hint };
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
  const table: Array<{ group: string; task: string; keywords: string; expected: string; rank: number | '-'; hint: string; retryRank: number | '-' | '' }> = [];
  const missed: string[] = [];

  for (const testCase of mustHit) {
    const { rank, tokens, hint } = await rankOf(testCase);
    if (rank === 1) topOne++;
    else missed.push(`${testCase.task} (${testCase.note ?? testCase.expected}) → rank ${rank || '-'}`);
    if (hint) missed.push(`${testCase.task} → false vocabulary-miss warning`);
    if (rank > 0) reciprocalRank += 1 / rank;
    returnedTokens += tokens;
    table.push({ group: 'mustHit', task: testCase.task, keywords: (testCase.keywords ?? []).join(', '), expected: testCase.expected, rank: rank || '-', hint: hint ? 'yes' : '', retryRank: '' });
  }

  let trackedHits = 0;
  let trackedHinted = 0;
  let trackedRecovered = 0;
  for (const testCase of tracked) {
    const { rank, hint } = await rankOf(testCase);
    if (rank === 1) trackedHits++;
    // An agent retries only when told to, and only with its own terms.
    const retry = hint ? await rankOf(testCase, testCase.retryKeywords) : undefined;
    if (hint) trackedHinted++;
    if (retry?.rank === 1) trackedRecovered++;
    if (rank !== 1 && retry?.rank !== 1) missed.push(`${testCase.task} (${testCase.note}) → no hint or no recovery`);
    table.push({ group: 'tracked', task: testCase.task, keywords: (testCase.retryKeywords ?? []).join(', '), expected: testCase.expected, rank: rank || '-', hint: hint ? 'yes' : '', retryRank: retry ? retry.rank || '-' : '' });
  }

  const result = {
    fixture: 'synthetic-regression-v2',
    mustHitCases: mustHit.length,
    top1Accuracy: topOne / mustHit.length,
    meanReciprocalRank: reciprocalRank / mustHit.length,
    trackedCases: tracked.length,
    trackedTop1: trackedHits / tracked.length,
    trackedVocabularyMissWarned: trackedHinted / tracked.length,
    trackedTop1AfterRetry: trackedRecovered / tracked.length,
    naiveTokensPerTask: naiveTokens,
    contextTokensPerTask: Math.round(returnedTokens / mustHit.length),
    tokenReduction: 1 - (returnedTokens / mustHit.length) / naiveTokens,
    totalLatencyMs: Number((performance.now() - started).toFixed(2)),
  };
  console.table(table);
  console.log(JSON.stringify(result, null, 2));
  console.log('Note: synthetic regression data; do not use these percentages as a customer claim.');
  assert.deepEqual(missed, [], 'A mustHit task lost its first rank or warned falsely, or a tracked task no longer recovers');

  // P13: related refs over a real linked corpus (docs/). Recall is reported; the
  // one assertion is that the shipped variant keeps beating the no-graph control.
  const expansion = await graphExpansionReport();
  const product = expansion['product (P13)'];
  const control = expansion['C  lexical cut to 6'];
  assert.ok(product.any > control.any, 'Graph refs no longer beat the same number of lexical refs on docs/');
  assert.ok(product.packTokens / 12 <= 2_000, 'The docs/ packs exceeded their budget');
}

void main();
