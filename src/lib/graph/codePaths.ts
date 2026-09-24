/**
 * Project map (P13) — reading `knowledge_metadata.sources[].resource` as repo
 * paths. Pure and database-free: the graph service builds the code layer from
 * it and `get_related_pages` answers "which pages rest on this file?" with it.
 *
 * A source is whatever an agent or an OKF import wrote. Calibration writes
 * repo-relative files (`src/auth.ts`); people also write line anchors, globs,
 * `./` prefixes, backslashes and URLs. Only what reads as a path inside the
 * repository becomes a file or folder:
 *   - no scheme (`https:`, `file:`, a `C:` drive) — a URL is not part of the
 *     tree, and a drive path names someone's disk, not the repo (a leading
 *     `/` is read as the repo root);
 *   - contains `/`, ends in an extension, is a dotfile, or is one of the few
 *     extension-less file names projects share (Dockerfile, Makefile…);
 *   - `#L10-L20` / `:12` anchors are dropped (the file is the node), a glob
 *     names the folder it starts in, `..` is refused (outside the repo);
 *   - a trailing `/` makes it a folder.
 */

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const EXTENSION = /\.[a-z][a-z0-9]{0,7}$/i;
const PLAIN_FILE_NAMES = new Set([
  'dockerfile', 'makefile', 'procfile', 'gemfile', 'rakefile', 'jenkinsfile', 'vagrantfile',
  'license', 'readme', 'changelog', 'codeowners', 'brewfile', 'justfile',
]);
const MAX_PATH_CHARS = 300;

function cleanPath(value: string): string {
  return value
    .replace(/\\/g, '/')
    .replace(/#.*$/, '')
    .replace(/:\d+(?:[-:]\d+)*$/, '')
    .replace(/^(?:\.\/)+/, '')
    .replace(/\/{2,}/g, '/');
}

/** Cut a glob back to the folder it starts in: `src/lib/**\/*.ts` → `src/lib/`. */
function stripGlob(value: string): string {
  const star = value.search(/[*?[{]/);
  if (star === -1) return value;
  const head = value.slice(0, star);
  return head.slice(0, head.lastIndexOf('/') + 1);
}

/**
 * The repo-relative path a source names (`src/lib/auth.ts`, or `src/lib/` for
 * a folder), or null when it is not a path inside the repository.
 */
export function normalizeSourcePath(resource: string): string | null {
  const trimmed = resource.trim();
  if (!trimmed || trimmed.length > MAX_PATH_CHARS || SCHEME.test(trimmed) || /^[\\/]{2}/.test(trimmed)) return null;
  const value = stripGlob(cleanPath(trimmed).replace(/^\/+/, ''));
  const parts = value.split('/').filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === '..' || part === '.')) return null;
  const folder = value.endsWith('/');
  // "Meeting notes" is prose; "docs/Meeting notes.md" is a path.
  if (parts.length === 1 && /\s/.test(parts[0])) return null;
  const last = parts[parts.length - 1];
  const pathLike = folder || parts.length > 1 || last.startsWith('.') || EXTENSION.test(last) || PLAIN_FILE_NAMES.has(last.toLowerCase());
  return pathLike ? `${parts.join('/')}${folder ? '/' : ''}` : null;
}

/**
 * What an agent asks about: usually the path its own tools use, which may be
 * absolute (`D:/work/app/src/auth.ts`, `/home/me/app/src/auth.ts`). The drive
 * and leading slash go; the tail is matched against repo-relative sources.
 */
export function normalizeQueryPath(resource: string): string | null {
  const trimmed = resource.trim().replace(/^[a-z]:(?=[\\/])/i, '');
  if (!trimmed || trimmed.length > 1_000 || SCHEME.test(trimmed)) return null;
  const value = stripGlob(cleanPath(trimmed).replace(/^\/+/, ''));
  const parts = value.split('/').filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === '..')) return null;
  return `${parts.filter((part) => part !== '.').join('/')}${value.endsWith('/') ? '/' : ''}`;
}

/**
 * How a page's source relates to the path asked about:
 *   exact   the same file or folder (an absolute query matches by its
 *           repo-relative tail)
 *   folder  the page rests on a folder the asked path is in
 *   inside  the asked path is a folder and the page rests on something in it
 * Both arguments are normalized (normalizeQueryPath / normalizeSourcePath).
 * Case-insensitive: agents on Windows and macOS do not agree on case.
 */
export type SourceMatch = 'exact' | 'folder' | 'inside';

export function matchSource(query: string, source: string): SourceMatch | null {
  const q = query.toLowerCase().replace(/\/$/, '');
  const s = source.toLowerCase().replace(/\/$/, '');
  if (!q || !s) return null;
  const sourceIsFolder = source.endsWith('/');
  const nested = s.includes('/');
  if (q === s) return 'exact';
  // An absolute query ends with the repo-relative path. A one-segment source
  // ("README.md") must match exactly — every folder has one.
  if (!sourceIsFolder && nested && q.endsWith(`/${s}`)) return 'exact';
  if (sourceIsFolder && (q.startsWith(`${s}/`) || (nested && `/${q}/`.includes(`/${s}/`)))) return 'folder';
  if (s.startsWith(`${q}/`)) return 'inside';
  return null;
}

export const MATCH_ORDER: Record<SourceMatch, number> = { exact: 0, folder: 1, inside: 2 };

/** `src/lib/auth.ts` → `auth.ts`; `src/lib/` → `lib`. */
export function pathBasename(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}
