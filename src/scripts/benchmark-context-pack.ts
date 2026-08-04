/**
 * Deterministic retrieval/token benchmark for Context Pack v2.
 * This fixture is a regression guard, not a claim about customer workspaces.
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
].map(([id, title, text, tags]) => ({
  id: String(id), itemType: 'page' as const, title: String(title), content: paragraph(String(text)), breadcrumb: [],
  metadata: { tags: tags as string[], sources: [], stale: false, trust: id === 'mcp' ? 'human-reviewed' as const : 'unverified' as const, status: 'stable' as const },
}));

const cases = [
  { task: 'Implement strict MCP context write gate', expected: 'mcp' },
  { task: 'Add viewer role to workspace invitations', expected: 'invites' },
  { task: 'Enforce subscription seat and storage limits', expected: 'billing' },
  { task: 'Debug OAuth PKCE token rotation', expected: 'auth' },
];

const dependencies: ContextPackDependencies = {
  listKnowledgeCorpus: async () => corpus,
  getRelatedPages: async (_workspaceId, pageId) => ({
    page: { id: pageId, title: '', type: 'page' as const }, parent: null, children: [], outgoingLinks: [], backlinks: [], siblings: null,
  }),
};

async function main() {
  const naiveTokens = Math.ceil(JSON.stringify(corpus).length / 4);
  let reciprocalRank = 0;
  let topOne = 0;
  let returnedTokens = 0;
  const started = performance.now();

  for (const testCase of cases) {
    const pack = await prepareContextPack('benchmark', { task: testCase.task, maxTokens: 1_000, maxConcepts: 3 }, dependencies);
    const rank = pack.concepts.findIndex(concept => concept.id === testCase.expected) + 1;
    if (rank === 1) topOne++;
    if (rank > 0) reciprocalRank += 1 / rank;
    returnedTokens += pack.estimatedTokens;
    assert.ok(pack.estimatedTokens <= 1_000, 'Pack exceeded its requested budget');
  }

  const result = {
    fixture: 'synthetic-regression-v1',
    cases: cases.length,
    top1Accuracy: topOne / cases.length,
    meanReciprocalRank: reciprocalRank / cases.length,
    naiveTokensPerTask: naiveTokens,
    contextTokensPerTask: Math.round(returnedTokens / cases.length),
    tokenReduction: 1 - (returnedTokens / cases.length) / naiveTokens,
    totalLatencyMs: Number((performance.now() - started).toFixed(2)),
  };
  assert.equal(result.top1Accuracy, 1, 'A known task no longer ranks its canonical concept first');
  console.log(JSON.stringify(result, null, 2));
  console.log('Note: synthetic regression data; do not use these percentages as a customer claim.');
}

void main();
