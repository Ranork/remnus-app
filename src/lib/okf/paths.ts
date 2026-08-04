export function normalizeBundlePath(value: string): string | null {
  const result: string[] = [];
  for (const segment of value.replace(/\\/g, '/').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (result.length === 0) return null;
      result.pop();
    } else {
      result.push(segment);
    }
  }
  return result.join('/');
}

export function normalizeArchivePath(rawPath: string): string | null {
  const candidate = rawPath.replace(/\\/g, '/');
  if (!candidate || candidate.startsWith('/') || /^[A-Za-z]:/.test(candidate) || candidate.includes('\0')) return null;
  if (candidate.split('/').some(segment => segment === '..')) return null;
  const normalized = normalizeBundlePath(candidate);
  return normalized && normalized !== '.' ? normalized : null;
}

function dirname(value: string): string {
  const index = value.lastIndexOf('/');
  return index === -1 ? '' : value.slice(0, index);
}

export function resolveBundleMarkdownLink(fromPath: string, href: string): string | null {
  let decoded = href;
  try { decoded = decodeURIComponent(href); } catch { /* keep the original */ }
  const clean = decoded.split('#')[0].split('?')[0];
  if (!clean || /^[a-z][a-z0-9+.-]*:/i.test(clean) || clean.startsWith('//')) return null;
  const resolved = clean.startsWith('/')
    ? normalizeBundlePath(clean.slice(1))
    : normalizeBundlePath(`${dirname(fromPath)}/${clean}`);
  if (!resolved) return null;
  return clean.endsWith('/') ? `${resolved}/index.md` : resolved;
}
