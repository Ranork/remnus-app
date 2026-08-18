import { createHash } from 'node:crypto';
import { cleanupCopiedMarkdown } from '@/components/features/editor/clipboardMarkdown';
import { mergeFrontmatter, parseOkfFrontmatter, serializeFrontmatter, splitFrontmatter } from './frontmatter';
import {
  OKF_VERSION,
  REMNUS_OKF_PROFILE_VERSION,
  type OkfBundle,
  type OkfBundleFile,
  type OkfDatabaseSnapshot,
  type OkfValidationIssue,
  type OkfValidationReport,
  type OkfWorkspaceSnapshot,
} from './types';

const RESERVED_NAMES = new Set(['index', 'log']);

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  const safe = slug || 'concept';
  return RESERVED_NAMES.has(safe) ? `${safe}-concept` : safe;
}

function shortId(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toLowerCase() || sha256(value).slice(0, 10);
}

function conceptFilename(title: string, id: string): string {
  return `${slugify(title)}-${shortId(id)}.md`;
}

function decodeEntities(value: string): string {
  return (value || '')
    .replace(/&#10;/g, '\n')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function attrValue(element: string, name: string): string {
  const match = new RegExp(`${name}="([^"]*)"`, 'i').exec(element);
  return match ? decodeEntities(match[1]) : '';
}

function markdownLabel(value: string): string {
  return value.replace(/([\\\[\]])/g, '\\$1').trim() || 'Untitled';
}

function resolveRemnusHref(href: string, pathById: Map<string, string>): string | null {
  const page = href.match(/^\/page\/([^/?#]+)/);
  if (page) return pathById.get(page[1]) ?? null;
  const database = href.match(/^\/db\/([^/?#]+)(?:\/([^/?#]+))?/);
  if (database) return pathById.get(database[2] || database[1]) ?? null;
  return null;
}

function toPortableMarkdown(content: string, pathById: Map<string, string>): string {
  let output = content || '';

  output = output.replace(
    /<a\b[^>]*\bdata-page-link\b[^>]*>([\s\S]*?)<\/a>/gi,
    (element, label: string) => {
      const target = resolveRemnusHref(attrValue(element, 'href'), pathById);
      return target
        ? `[${markdownLabel(decodeEntities(label).replace(/<[^>]+>/g, ''))}](/${target})`
        : markdownLabel(decodeEntities(label).replace(/<[^>]+>/g, ''));
    },
  );

  output = output.replace(
    /<div\b[^>]*\bdata-cb-id="[^"]+"[^>]*><\/div>/gi,
    (element) => {
      const target = pathById.get(attrValue(element, 'data-cb-id'));
      const title = attrValue(element, 'data-cb-title') || 'Untitled';
      return target ? `[${markdownLabel(title)}](/${target})` : markdownLabel(title);
    },
  );

  output = output.replace(/\]\((\/page\/[^)]+|\/db\/[^)]+)\)/g, (whole, href: string) => {
    const target = resolveRemnusHref(href, pathById);
    return target ? `](/${target})` : whole;
  });

  return cleanupCopiedMarkdown(output);
}

function descriptionFrom(content: string): string | undefined {
  const line = content
    .split(/\r?\n/)
    .map(value => value
      .replace(/^#{1,6}\s+/, '')
      .replace(/^[-*>\s]+/, '')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[`_*~]/g, '')
      .replace(/<[^>]+>/g, '')
      .trim())
    .find(Boolean);
  if (!line) return undefined;
  return line.length > 180 ? `${line.slice(0, 177).trimEnd()}...` : line;
}

interface SchemaColumn {
  id?: string;
  name?: string;
  type?: string;
  options?: unknown[];
  [key: string]: unknown;
}

function rowPropertiesByName(database: OkfDatabaseSnapshot, values: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const raw of database.schema) {
    const column = raw as SchemaColumn;
    if (!column.id || !column.name) continue;
    if (Object.prototype.hasOwnProperty.call(values, column.id)) result[column.name] = values[column.id];
  }
  for (const [key, value] of Object.entries(values)) {
    if (key === 'title') continue;
    if (!database.schema.some(raw => (raw as SchemaColumn).id === key)) result[key] = value;
  }
  return result;
}

function findProperty(properties: Record<string, unknown>, names: string[]): unknown {
  const wanted = new Set(names.map(name => name.toLowerCase()));
  const entry = Object.entries(properties).find(([name]) => wanted.has(name.toLowerCase()));
  return entry?.[1];
}

function normalizeTags(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const tags = value.map(String).map(tag => tag.trim()).filter(Boolean);
    return tags.length ? tags : undefined;
  }
  if (typeof value === 'string') {
    const tags = value.split(',').map(tag => tag.trim()).filter(Boolean);
    return tags.length ? tags : undefined;
  }
  return undefined;
}

function normalizeStatus(value: unknown): 'draft' | 'stable' | 'deprecated' | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.toLowerCase().replace(/[\s_-]+/g, '');
  if (normalized === 'draft' || normalized === 'taslak') return 'draft';
  if (normalized === 'stable' || normalized === 'stabil' || normalized === 'kararli') return 'stable';
  if (normalized === 'deprecated' || normalized === 'kullanimdisi') return 'deprecated';
  return undefined;
}

function rawImportedFrontmatter(properties: Record<string, unknown>): string | undefined {
  const entry = Object.entries(properties).find(([name, value]) =>
    name.toLowerCase().includes('frontmatter') && typeof value === 'string',
  );
  return typeof entry?.[1] === 'string' ? entry[1] : undefined;
}

function schemaMarkdown(database: OkfDatabaseSnapshot): string {
  if (database.schema.length === 0) return '# Schema\n\nThis database has no custom properties.';
  const lines = [
    '# Schema',
    '',
    '| Property | Type | Options |',
    '| --- | --- | --- |',
  ];
  for (const raw of database.schema) {
    const column = raw as SchemaColumn;
    const options = Array.isArray(column.options)
      ? column.options.map(option => typeof option === 'string' ? option : String((option as { value?: unknown }).value ?? '')).filter(Boolean).join(', ')
      : '';
    const escape = (value: string) => value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
    lines.push(`| ${escape(String(column.name ?? 'Unnamed'))} | ${escape(String(column.type ?? 'unknown'))} | ${escape(options)} |`);
  }
  if (database.views.length > 0) {
    lines.push('', '# Views', '', `Remnus preserves ${database.views.length} saved view(s) in the \`x-remnus\` extension metadata.`);
  }
  return lines.join('\n');
}

function makeConcept(
  path: string,
  fields: Record<string, unknown>,
  body: string,
  importedRaw?: string,
): OkfBundleFile {
  const content = `${mergeFrontmatter(importedRaw, fields)}\n${body.trim()}\n`;
  return { path, content, sha256: sha256(content), kind: 'concept' };
}

function buildIndex(snapshot: OkfWorkspaceSnapshot, pathById: Map<string, string>): string {
  const children = new Map<string | null, typeof snapshot.items>();
  for (const item of snapshot.items) {
    const bucket = children.get(item.parentId) ?? [];
    bucket.push(item);
    children.set(item.parentId, bucket);
  }
  for (const bucket of children.values()) bucket.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));

  const lines = [serializeFrontmatter({ okf_version: OKF_VERSION }).trimEnd(), '', `# ${snapshot.workspace.name}`, '', 'Portable Remnus workspace knowledge, exported as OKF v0.2.', '', '## Workspace contents', ''];
  const visited = new Set<string>();
  const walk = (parentId: string | null, depth: number) => {
    for (const item of children.get(parentId) ?? []) {
      if (visited.has(item.id)) continue;
      visited.add(item.id);
      const target = pathById.get(item.id);
      if (target) lines.push(`${'  '.repeat(depth)}* [${markdownLabel(item.title)}](/${target}) - ${item.type === 'database' ? 'Remnus database' : 'Remnus page'}`);
      walk(item.id, depth + 1);
    }
  };
  walk(null, 0);
  for (const item of snapshot.items) {
    if (!visited.has(item.id)) walk(item.parentId, 0);
  }
  return `${lines.join('\n')}\n`;
}

function validateInternalLinks(files: OkfBundleFile[], issues: OkfValidationIssue[]): void {
  const paths = new Set(files.map(file => file.path));
  const linkRe = /\[[^\]]*\]\((\/[^)#?]+\.md)(?:#[^)]*)?\)/g;
  for (const file of files.filter(candidate => candidate.path.endsWith('.md'))) {
    for (const match of file.content.matchAll(linkRe)) {
      const target = match[1].replace(/^\//, '');
      if (!paths.has(target)) {
        issues.push({ severity: 'warning', code: 'broken-link', path: file.path, message: `Link target does not exist: /${target}` });
      }
    }
  }
}

export function validateOkfBundle(files: OkfBundleFile[]): OkfValidationReport {
  const issues: OkfValidationIssue[] = [];
  const seen = new Set<string>();
  let conceptCount = 0;

  for (const file of files) {
    if (seen.has(file.path.toLowerCase())) {
      issues.push({ severity: 'error', code: 'duplicate-path', path: file.path, message: 'Duplicate or case-colliding bundle path.' });
      continue;
    }
    seen.add(file.path.toLowerCase());
    if (!file.path.endsWith('.md')) continue;

    const name = file.path.split('/').pop()?.toLowerCase();
    if (name === 'index.md') {
      if (file.path === 'index.md') {
        const parts = splitFrontmatter(file.content);
        if (!parts || parseOkfFrontmatter(parts.frontmatter).raw.length === 0 || !/^okf_version\s*:\s*["']?0\.2["']?\s*$/m.test(parts.frontmatter)) {
          issues.push({ severity: 'error', code: 'missing-version', path: file.path, message: 'Root index.md must declare okf_version: "0.2".' });
        }
      } else if (splitFrontmatter(file.content)) {
        issues.push({ severity: 'error', code: 'nested-index-frontmatter', path: file.path, message: 'Only the bundle-root index.md may contain frontmatter.' });
      }
      continue;
    }
    if (name === 'log.md') {
      if (!/^#\s+/m.test(file.content)) issues.push({ severity: 'error', code: 'invalid-log', path: file.path, message: 'log.md must contain a heading.' });
      continue;
    }

    conceptCount++;
    const parts = splitFrontmatter(file.content);
    if (!parts) {
      issues.push({ severity: 'error', code: 'missing-frontmatter', path: file.path, message: 'Concept is missing YAML frontmatter.' });
      continue;
    }
    const parsed = parseOkfFrontmatter(parts.frontmatter);
    if (!parsed.type?.trim()) issues.push({ severity: 'error', code: 'missing-type', path: file.path, message: 'Concept frontmatter requires a non-empty type.' });
    if (/<script\b|javascript\s*:|\bon\w+\s*=/i.test(parts.body)) {
      issues.push({ severity: 'warning', code: 'unsafe-html', path: file.path, message: 'Concept contains potentially unsafe HTML and must be sanitized before rendering.' });
    }
  }

  validateInternalLinks(files, issues);
  return {
    version: OKF_VERSION,
    valid: !issues.some(issue => issue.severity === 'error'),
    conceptCount,
    issues,
  };
}

export async function buildOkfBundle(snapshot: OkfWorkspaceSnapshot, exportedAt = new Date().toISOString()): Promise<OkfBundle> {
  const pathById = new Map<string, string>();
  const databaseByItem = new Map(snapshot.databases.map(database => [database.itemId, database]));
  const knowledgeByItem = new Map(snapshot.knowledge.map(metadata => [`${metadata.itemType}:${metadata.itemId}`, metadata]));
  const knowledgeFields = (itemType: 'page' | 'database' | 'database_row', itemId: string) => {
    const metadata = knowledgeByItem.get(`${itemType}:${itemId}`);
    if (!metadata) return {};
    const verified = metadata.trust === 'human-reviewed'
      ? { by: 'human:remnus', at: metadata.reviewedAt }
      : metadata.trust === 'machine-confirmed'
        ? { by: metadata.generatedBy ?? 'agent:remnus' }
        : undefined;
    return {
      ...(metadata.conceptType ? { type: metadata.conceptType } : {}),
      ...(metadata.description ? { description: metadata.description } : {}),
      ...(metadata.tags.length ? { tags: metadata.tags } : {}),
      ...(metadata.sources.length ? { sources: metadata.sources } : {}),
      ...(metadata.status ? { status: metadata.status } : {}),
      ...(metadata.staleAfter ? { stale_after: metadata.staleAfter } : {}),
      ...(verified ? { verified } : {}),
    };
  };

  for (const item of snapshot.items) {
    if (item.type === 'page') pathById.set(item.id, `pages/${conceptFilename(item.title, item.id)}`);
    else {
      const database = databaseByItem.get(item.id);
      if (!database) continue;
      const folder = `databases/${slugify(database.name)}-${shortId(database.id)}`;
      pathById.set(item.id, `${folder}/database.md`);
      pathById.set(database.id, `${folder}/database.md`);
      for (const row of database.rows) pathById.set(row.id, `${folder}/rows/${conceptFilename(row.title, row.id)}`);
    }
  }

  const pageByItem = new Map(snapshot.standalonePages.map(page => [page.itemId, page]));
  const files: OkfBundleFile[] = [];

  for (const item of snapshot.items) {
    const path = pathById.get(item.id);
    if (!path) continue;
    if (item.type === 'page') {
      const page = pageByItem.get(item.id);
      const body = toPortableMarkdown(page?.content ?? '', pathById);
      files.push(makeConcept(path, {
        type: 'Remnus Page',
        title: item.title,
        description: descriptionFrom(body),
        ...knowledgeFields('page', item.id),
        'x-remnus': {
          profile_version: REMNUS_OKF_PROFILE_VERSION,
          stable_id: item.id,
          subject_kind: 'page',
          parent_id: item.parentId,
          icon: item.icon,
          icon_color: item.iconColor,
          updated_at: page?.updatedAt ?? item.updatedAt,
          exported_at: exportedAt,
        },
      }, body || `# ${item.title}`));
      continue;
    }

    const database = databaseByItem.get(item.id);
    if (!database) continue;
    files.push(makeConcept(path, {
      type: 'Remnus Database',
      title: database.name,
      description: `Structured Remnus database with ${database.rows.length} row(s).`,
      ...knowledgeFields('database', item.id),
      'x-remnus': {
        profile_version: REMNUS_OKF_PROFILE_VERSION,
        stable_id: database.id,
        workspace_item_id: database.itemId,
        subject_kind: 'database',
        parent_id: item.parentId,
        schema: database.schema,
        views: database.views,
        updated_at: database.updatedAt,
        exported_at: exportedAt,
      },
    }, schemaMarkdown(database)));

    for (const row of database.rows) {
      const rowPath = pathById.get(row.id);
      if (!rowPath) continue;
      const properties = rowPropertiesByName(database, row.properties);
      const rawFrontmatter = rawImportedFrontmatter(properties);
      const importedFields = rawFrontmatter ? parseOkfFrontmatter(rawFrontmatter) : undefined;
      const body = toPortableMarkdown(row.content, pathById);
      const typeValue = findProperty(properties, ['Type', 'Concept Type']);
      const status = normalizeStatus(findProperty(properties, ['Status', 'OKF Status'])) ?? normalizeStatus(importedFields?.status);
      const tags = normalizeTags(findProperty(properties, ['Tags', 'Labels'])) ?? importedFields?.tags;
      const resource = findProperty(properties, ['Resource', 'URL']);
      const staleAfter = findProperty(properties, ['Stale after', 'Stale After']);
      files.push(makeConcept(rowPath, {
        type: typeof typeValue === 'string' && typeValue.trim() ? typeValue.trim() : importedFields?.type || 'Remnus Database Row',
        title: row.title,
        description: descriptionFrom(body),
        resource: typeof resource === 'string' ? resource : importedFields?.resource,
        tags,
        status,
        stale_after: typeof staleAfter === 'string' ? staleAfter : importedFields?.staleAfter,
        ...knowledgeFields('database_row', row.id),
        'x-remnus': {
          profile_version: REMNUS_OKF_PROFILE_VERSION,
          stable_id: row.id,
          subject_kind: 'database_row',
          database_id: database.id,
          properties,
          property_values_by_id: row.properties,
          icon: row.icon,
          icon_color: row.iconColor,
          updated_at: row.updatedAt,
          // Recurrence lives under x-remnus rather than as a top-level OKF
          // field: OKF v0.2 has no concept of a repeating concept, and
          // inventing a core-namespace key would misrepresent the spec.
          // Nested here it is preserved on round-trip and readable by anything
          // that understands the Remnus profile.
          ...(row.recurrence ? { recurrence: row.recurrence } : {}),
          exported_at: exportedAt,
        },
      }, body || `# ${row.title}`, rawFrontmatter));
    }
  }

  const rootIndex = buildIndex(snapshot, pathById);
  files.unshift({ path: 'index.md', content: rootIndex, sha256: sha256(rootIndex), kind: 'index' });
  const date = exportedAt.slice(0, 10);
  const log = `# Workspace Update Log\n\n## ${date}\n\n* **Snapshot**: Exported this Remnus workspace as an OKF v0.2 knowledge pack.\n`;
  files.push({ path: 'log.md', content: log, sha256: sha256(log), kind: 'log' });

  const report = validateOkfBundle(files);
  const reportMarkdown = [
    '# OKF Validation Report',
    '',
    `* Version: ${report.version}`,
    `* Valid: ${report.valid ? 'yes' : 'no'}`,
    `* Concepts: ${report.conceptCount}`,
    `* Errors: ${report.issues.filter(issue => issue.severity === 'error').length}`,
    `* Warnings: ${report.issues.filter(issue => issue.severity === 'warning').length}`,
    '',
    ...(report.issues.length
      ? ['## Issues', '', ...report.issues.map(issue => `* **${issue.severity.toUpperCase()} ${issue.code}**${issue.path ? ` (${issue.path})` : ''}: ${issue.message}`)]
      : ['No validation issues were found.']),
    '',
    'Remnus-specific schema and view metadata is stored under the `x-remnus` extension and in `remnus-manifest.json`.',
    'Assets remain linked to their existing URLs in this export profile.',
    '',
  ].join('\n');
  files.push({ path: 'VALIDATION.txt', content: reportMarkdown, sha256: sha256(reportMarkdown), kind: 'report' });

  const counts = {
    pages: snapshot.items.filter(item => item.type === 'page').length,
    databases: snapshot.databases.length,
    rows: snapshot.databases.reduce((total, database) => total + database.rows.length, 0),
    concepts: report.conceptCount,
  };
  const manifest: OkfBundle['manifest'] = {
    format: 'remnus-okf-knowledge-pack',
    profileVersion: REMNUS_OKF_PROFILE_VERSION,
    okfVersion: OKF_VERSION,
    exportedAt,
    workspace: { id: snapshot.workspace.id, name: snapshot.workspace.name },
    counts,
    fidelity: {
      content: 'standard-markdown',
      internalLinks: 'rewritten-to-bundle-absolute-links',
      assets: 'linked-not-embedded',
      databaseSchema: 'preserved-in-remnus-extension',
      databaseViews: 'preserved-in-remnus-extension',
    },
    files: files.map(file => ({ path: file.path, sha256: file.sha256, kind: file.kind })),
  };
  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  files.push({ path: 'remnus-manifest.json', content: manifestContent, sha256: sha256(manifestContent), kind: 'manifest' });

  return {
    rootName: `${slugify(snapshot.workspace.name)}-okf`,
    files,
    report,
    manifest,
  };
}
