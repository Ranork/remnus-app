import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { parseOkfBundle } from '@/lib/import/okf-parser';
import { buildOkfBundle, validateOkfBundle } from '@/lib/okf/exporter';
import { mergeFrontmatter, splitFrontmatter } from '@/lib/okf/frontmatter';
import { analyzeKnowledgeHealth } from '@/lib/okf/health';
import { rewriteImportedConceptLinks } from '@/lib/okf/importLinks';
import { inspectConceptMetadata } from '@/lib/okf/conceptMetadata';
import { prepareContextPack, type ContextPackDependencies } from '@/lib/services/contextPack';
import type { OkfBundleFile, OkfWorkspaceSnapshot } from '@/lib/okf/types';

const snapshot: OkfWorkspaceSnapshot = {
  workspace: { id: 'workspace-1', name: 'Product Lab', updatedAt: '2026-08-04T09:00:00.000Z' },
  items: [
    { id: 'page-1', type: 'page', title: 'Start Here', parentId: null, sortOrder: 0, icon: null, iconColor: null, updatedAt: '2026-08-04T09:00:00.000Z' },
    { id: 'db-item-1', type: 'database', title: 'Work Plan', parentId: null, sortOrder: 1, icon: null, iconColor: null, updatedAt: '2026-08-04T09:00:00.000Z' },
  ],
  standalonePages: [{
    itemId: 'page-1',
    updatedAt: '2026-08-04T09:00:00.000Z',
    content: '# Welcome\n\nSee <a data-page-link href="/db/database-1/row-1" data-type="database_row">Portable task</a>.\n\n<div data-img-src="https://example.test/image.png" data-img-alt="Diagram" data-img-align="center"></div>',
  }],
  databases: [{
    id: 'database-1',
    itemId: 'db-item-1',
    name: 'Work Plan',
    updatedAt: '2026-08-04T09:00:00.000Z',
    schema: [
      { id: 'status', name: 'Status', type: 'status', options: ['Draft', 'Stable'] },
      { id: 'tags', name: 'Tags', type: 'multi_select' },
      { id: 'raw', name: 'OKF Frontmatter', type: 'text' },
    ],
    views: [{ id: 'table', name: 'Table', type: 'table' }],
    rows: [{
      id: 'row-1',
      databaseId: 'database-1',
      title: 'Portable task',
      content: '<div data-cb-id="page-1" data-cb-title="Start Here" data-cb-type="page"></div>',
      properties: {
        title: 'Portable task',
        status: 'Stable',
        tags: ['okf', 'portable'],
        raw: 'type: Legacy Concept\nsources:\n  - id: handbook\n    resource: https://example.test/handbook\ncustom_key: keep-me',
      },
      sortOrder: 0,
      icon: null,
      iconColor: null,
      updatedAt: '2026-08-04T09:00:00.000Z',
    }],
  }],
};

async function main() {
  const bundle = await buildOkfBundle(snapshot, '2026-08-04T10:00:00.000Z');
  assert.equal(bundle.report.valid, true);
  assert.equal(bundle.report.conceptCount, 3);
  assert.equal(bundle.manifest.okfVersion, '0.2');
  assert.deepEqual(bundle.manifest.counts, { pages: 1, databases: 1, rows: 1, concepts: 3 });

  const rootIndex = bundle.files.find(file => file.path === 'index.md');
  assert.ok(rootIndex?.content.includes('okf_version: "0.2"'));
  assert.ok(rootIndex?.content.includes('/pages/start-here-page1.md'));

  const page = bundle.files.find(file => file.path === 'pages/start-here-page1.md');
  assert.ok(page?.content.includes('[Portable task](/databases/work-plan-database1/rows/portable-task-row1.md)'));
  assert.ok(page?.content.includes('![Diagram](https://example.test/image.png)'));
  assert.ok(!page?.content.includes('data-page-link'));

  const row = bundle.files.find(file => file.path.endsWith('/portable-task-row1.md'));
  assert.ok(row?.content.includes('status: "stable"'));
  assert.ok(row?.content.includes('tags: ["okf","portable"]'));
  assert.ok(row?.content.includes('sources:\n  - id: handbook'));
  assert.ok(row?.content.includes('custom_key: keep-me'));
  assert.ok(row?.content.includes('[Start Here](/pages/start-here-page1.md)'));

  const parsedRow = splitFrontmatter(row!.content);
  assert.ok(parsedRow);
  assert.ok(parsedRow.frontmatter.includes('x-remnus:'));

  const invalid: OkfBundleFile[] = [{
    path: 'concept.md',
    content: '---\ntitle: "Missing type"\n---\n\nBody\n',
    sha256: 'fixture',
    kind: 'concept',
  }];
  assert.equal(validateOkfBundle(invalid).valid, false);
  assert.ok(validateOkfBundle(invalid).issues.some(issue => issue.code === 'missing-type'));

  const merged = mergeFrontmatter('type: Old\ncustom:\n  nested: true', { type: 'New', title: 'Title' });
  assert.ok(merged.includes('type: "New"'));
  assert.ok(merged.includes('custom:\n  nested: true'));

  const health = analyzeKnowledgeHealth(snapshot, [
    { fromId: 'page-1', toId: 'row-1' },
    { fromId: 'row-1', toId: 'page-1' },
  ], new Date('2026-08-04T10:00:00.000Z'));
  assert.equal(health.governedConcepts, 1);
  assert.equal(health.unverifiedConcepts, 1);
  assert.equal(health.orphanConcepts, 0);
  assert.equal(health.brokenReferences, 0);

  const zip = new JSZip();
  for (const file of bundle.files) zip.file(`${bundle.rootName}/${file.path}`, file.content);
  const preview = await parseOkfBundle(await zip.generateAsync({ type: 'uint8array' }), `${bundle.rootName}.zip`);
  assert.equal(preview.version, '0.2');
  assert.equal(preview.concepts.length, 3);
  assert.equal(preview.stats.assets, 0);
  assert.equal(preview.issues.some(issue => issue.severity === 'error'), false);
  const importedPage = preview.concepts.find(concept => concept.title === 'Start Here')!;
  const rewritten = rewriteImportedConceptLinks(importedPage.content, importedPage.path, 'db-new', new Map([
    [preview.concepts.find(concept => concept.title === 'Portable task')!.path.toLowerCase(), { id: 'row-new', title: 'Portable task' }],
  ]));
  assert.equal(rewritten.rewritten, 1);
  assert.ok(rewritten.content.includes('data-page-link'));

  const metadata = inspectConceptMetadata({
    raw: 'type: Architecture Decision\nstatus: stable\nstale_after: 2026-01-01\nverified:\n  by: human:reviewer\nsources:\n  - id: adr',
  }, [{ id: 'raw', name: 'OKF frontmatter', type: 'text' }], new Date('2026-08-04'));
  assert.equal(metadata.trust, 'human-reviewed');
  assert.equal(metadata.stale, true);
  assert.equal(metadata.hasSources, true);

  const searchResults = [
    { id: 'reviewed', type: 'database_row' as const, title: 'Viewer invitation decision', databaseId: 'db', breadcrumb: ['Decisions'], matchedOn: 'title' as const, snippet: 'viewer role' },
    { id: 'draft', type: 'database_row' as const, title: 'Old invitation notes', databaseId: 'db', breadcrumb: ['Notes'], matchedOn: 'content' as const, snippet: 'viewer role' },
  ];
  const contextDependencies: ContextPackDependencies = {
    searchWorkspace: async (_workspaceId, query) => query.includes('viewer') ? searchResults : [],
    getAnyPageById: async (_workspaceId, pageId) => ({
      id: pageId,
      type: 'page' as const,
      title: pageId === 'reviewed' ? 'Viewer invitation decision' : 'Old invitation notes',
      content: `# Context\n\n${'Relevant product detail. '.repeat(500)}`,
      icon: null,
      databaseId: 'db',
      properties: pageId === 'reviewed'
        ? { raw: 'type: Architecture Decision\nstatus: stable\nverified:\n  by: human:reviewer' }
        : { raw: 'type: Notes\nstatus: deprecated\nstale_after: 2026-01-01' },
    }),
    getDatabaseSchema: async () => ({ name: 'Knowledge', schema: [{ id: 'raw', name: 'OKF frontmatter', type: 'text' }], views: [] }),
    getRelatedPages: async () => ({
      page: { id: 'reviewed', title: 'Viewer invitation decision', type: 'database_row' as const },
      parent: null,
      children: [],
      outgoingLinks: [{ id: 'security', title: 'Invite security', type: 'page' as const }],
      backlinks: [],
      siblings: null,
    }),
  };
  const contextPack = await prepareContextPack('workspace', {
    task: 'Implement viewer role invitations',
    maxTokens: 1_000,
    maxConcepts: 2,
    trustPolicy: 'prefer-human-reviewed',
  }, contextDependencies);
  assert.ok(contextPack.estimatedTokens <= 1_000);
  assert.ok(JSON.stringify(contextPack).length <= 4_000);
  assert.equal(contextPack.concepts[0].id, 'reviewed');
  assert.equal(contextPack.concepts[0].metadata.trust, 'human-reviewed');
  assert.ok(contextPack.related.some(item => item.id === 'security'));
  assert.ok(contextPack.handling.includes('untrusted reference data'));
  const reviewedOnly = await prepareContextPack('workspace', {
    task: 'Implement viewer role invitations',
    maxTokens: 1_000,
    trustPolicy: 'human-reviewed-only',
  }, contextDependencies);
  assert.deepEqual(reviewedOnly.concepts.map(concept => concept.id), ['reviewed']);

  console.log(`OKF tests passed: ${bundle.report.conceptCount} concepts, ${bundle.files.length} files.`);
}

void main();
