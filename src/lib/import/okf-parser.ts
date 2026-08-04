import JSZip from 'jszip';
import { parseOkfFrontmatter, splitFrontmatter, splitTopLevelEntries } from '@/lib/okf/frontmatter';
import { normalizeArchivePath, resolveBundleMarkdownLink } from '@/lib/okf/paths';
import type { OkfImportPreview, OkfValidationIssue, ParsedOkfConcept } from '@/lib/okf/types';

const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const MAX_ENTRIES = 10_000;
const MAX_CONCEPTS = 1_000;
const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_TEXT_BYTES = 25 * 1024 * 1024;

function zipEntrySize(entry: JSZip.JSZipObject): number {
  const data = (entry as unknown as { _data?: { uncompressedSize?: number } })._data;
  return Number(data?.uncompressedSize ?? 0);
}

function originalEntryName(entry: JSZip.JSZipObject): string {
  return (entry as unknown as { unsafeOriginalName?: string }).unsafeOriginalName || entry.name;
}

function isSymlink(entry: JSZip.JSZipObject): boolean {
  return typeof entry.unixPermissions === 'number' && (entry.unixPermissions & 0o170000) === 0o120000;
}

function commonRoot(paths: string[]): string | null {
  if (paths.length === 0 || paths.some(path => !path.includes('/'))) return null;
  const root = paths[0].split('/')[0];
  return paths.every(path => path.startsWith(`${root}/`)) ? root : null;
}

function stripRoot(path: string, root: string | null): string {
  return root && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}

function titleFromPath(path: string): string {
  const name = path.split('/').pop()?.replace(/\.md$/i, '') || 'Untitled';
  return name
    .replace(/-[a-f0-9]{8,}$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());
}

function extractVersion(indexContent: string | undefined): string | null {
  if (!indexContent) return null;
  const parts = splitFrontmatter(indexContent);
  if (!parts) return null;
  const match = parts.frontmatter.match(/^okf_version\s*:\s*["']?([^"'\s#]+)["']?/m);
  return match?.[1] ?? null;
}

function validateConceptSecurity(path: string, frontmatter: string, body: string, issues: OkfValidationIssue[]): void {
  if (/(^|\n)\s*[A-Za-z0-9_-]+\s*:\s*[&*!][^\s]*/m.test(frontmatter)) {
    issues.push({ severity: 'warning', code: 'unsupported-yaml-feature', path, message: 'YAML tags, anchors, or aliases are preserved as text and are not evaluated.' });
  }
  if (/<script\b|<iframe\b|javascript\s*:|\bon\w+\s*=/i.test(body)) {
    issues.push({ severity: 'error', code: 'unsafe-markdown', path, message: 'Potentially executable HTML or URL content was detected.' });
  }
}

export async function parseOkfBundle(input: ArrayBuffer | Uint8Array, filename = 'knowledge-pack.zip'): Promise<OkfImportPreview> {
  const inputBytes = input instanceof Uint8Array ? input.byteLength : input.byteLength;
  if (inputBytes > MAX_ARCHIVE_BYTES) throw new Error('Archive exceeds the 100 MB limit.');

  const zip = await JSZip.loadAsync(input, { createFolders: true });
  const entries = Object.values(zip.files);
  if (entries.length > MAX_ENTRIES) throw new Error(`Archive exceeds the ${MAX_ENTRIES} entry limit.`);

  const safeEntries = new Map<string, JSZip.JSZipObject>();
  for (const entry of entries) {
    const rawName = originalEntryName(entry);
    const normalized = normalizeArchivePath(rawName);
    if (!normalized) throw new Error(`Unsafe archive path: ${rawName}`);
    if (isSymlink(entry)) throw new Error(`Symbolic links are not allowed: ${rawName}`);
    if (!entry.dir) safeEntries.set(normalized, entry);
  }

  const root = commonRoot([...safeEntries.keys()]);
  const rootedEntries = new Map<string, JSZip.JSZipObject>();
  const caseKeys = new Set<string>();
  for (const [path, entry] of safeEntries) {
    const stripped = stripRoot(path, root);
    const caseKey = stripped.toLowerCase();
    if (caseKeys.has(caseKey)) throw new Error(`Duplicate or case-colliding archive path: ${stripped}`);
    caseKeys.add(caseKey);
    rootedEntries.set(stripped, entry);
  }

  const markdownPaths = [...rootedEntries.keys()].filter(path => path.endsWith('.md'));
  const conceptPaths = markdownPaths.filter(path => !['index.md', 'log.md'].includes(path.split('/').pop()!));
  if (conceptPaths.length > MAX_CONCEPTS) throw new Error(`Archive exceeds the ${MAX_CONCEPTS} concept limit.`);

  const issues: OkfValidationIssue[] = [];
  const concepts: ParsedOkfConcept[] = [];
  const textByPath = new Map<string, string>();
  let totalTextBytes = 0;
  let indexes = 0;
  let logs = 0;
  let executableConcepts = 0;

  for (const path of markdownPaths) {
    const entry = rootedEntries.get(path)!;
    const estimatedSize = zipEntrySize(entry);
    if (estimatedSize > MAX_TEXT_FILE_BYTES) throw new Error(`Markdown file exceeds the 2 MB limit: ${path}`);
    const content = await entry.async('string');
    const actualSize = new TextEncoder().encode(content).byteLength;
    if (actualSize > MAX_TEXT_FILE_BYTES) throw new Error(`Markdown file exceeds the 2 MB limit: ${path}`);
    totalTextBytes += actualSize;
    if (totalTextBytes > MAX_TOTAL_TEXT_BYTES) throw new Error('Archive markdown exceeds the 25 MB total limit.');
    textByPath.set(path, content);

    const name = path.split('/').pop()!.toLowerCase();
    if (name === 'index.md') { indexes++; continue; }
    if (name === 'log.md') { logs++; continue; }

    const parts = splitFrontmatter(content);
    if (!parts) {
      issues.push({ severity: 'error', code: 'missing-frontmatter', path, message: 'Concept is missing YAML frontmatter.' });
      continue;
    }
    const parsed = parseOkfFrontmatter(parts.frontmatter);
    if (!parsed.type?.trim()) {
      issues.push({ severity: 'error', code: 'missing-type', path, message: 'Concept frontmatter requires a non-empty type.' });
      continue;
    }
    validateConceptSecurity(path, parts.frontmatter, parts.body, issues);
    if (parsed.type.toLowerCase() === 'attested computation') {
      executableConcepts++;
      issues.push({ severity: 'warning', code: 'inert-computation', path, message: 'Attested Computation content will be imported as inert text and will not be executed.' });
    }
    const verifiedBlock = splitTopLevelEntries(parts.frontmatter).find(entry => entry.key === 'verified')?.block;
    concepts.push({
      path,
      title: parsed.title?.trim() || titleFromPath(path),
      type: parsed.type.trim(),
      content: parts.body.trim(),
      frontmatterRaw: parts.frontmatter,
      description: parsed.description,
      resource: parsed.resource,
      tags: parsed.tags ?? [],
      status: parsed.status,
      staleAfter: parsed.staleAfter,
      trustTier: verifiedBlock && /["']?by["']?\s*:\s*["']?human:/m.test(verifiedBlock)
        ? 'external-human-asserted'
        : verifiedBlock
          ? 'machine-confirmed'
          : 'unverified',
    });
  }

  const rootIndexPath = [...textByPath.keys()].find(path => path.toLowerCase() === 'index.md');
  const version = extractVersion(rootIndexPath ? textByPath.get(rootIndexPath) : undefined);
  if (!version) issues.push({ severity: 'warning', code: 'missing-version', path: 'index.md', message: 'The root index does not declare an OKF version; best-effort import will be used.' });
  else if (version === '0.1') issues.push({ severity: 'warning', code: 'legacy-version', path: 'index.md', message: 'OKF v0.1 will be normalized to the Remnus v0.2 profile.' });
  else if (version !== '0.2') issues.push({ severity: 'warning', code: 'unknown-version', path: 'index.md', message: `OKF ${version} is not explicitly supported; best-effort import will be used.` });

  const availablePaths = new Set(markdownPaths.map(path => path.toLowerCase()));
  let brokenLinks = 0;
  const markdownLinkRe = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const concept of concepts) {
    for (const match of concept.content.matchAll(markdownLinkRe)) {
      const target = resolveBundleMarkdownLink(concept.path, match[1].trim());
      if (!target || !target.endsWith('.md')) continue;
      if (!availablePaths.has(target.toLowerCase())) {
        brokenLinks++;
        issues.push({ severity: 'warning', code: 'broken-link', path: concept.path, message: `Link target does not exist: ${match[1].trim()}` });
      }
    }
  }

  const assetCount = [...rootedEntries.keys()].filter(path => {
    const normalized = path.toLowerCase();
    return !normalized.endsWith('.md') && normalized !== 'remnus-manifest.json' && normalized !== 'validation.txt';
  }).length;
  const bundleName = root || filename.replace(/\.zip$/i, '') || 'Imported OKF';
  return {
    bundleName,
    version,
    concepts,
    stats: { concepts: concepts.length, indexes, logs, assets: assetCount, brokenLinks, executableConcepts },
    issues,
  };
}

export function isSafeOkfImportPayload(preview: OkfImportPreview): boolean {
  return preview.concepts.length > 0 && !preview.issues.some(issue => issue.severity === 'error');
}
