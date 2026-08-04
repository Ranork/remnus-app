import type { ParsedOkfFrontmatter } from './types';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const TOP_LEVEL_KEY_RE = /^([A-Za-z0-9_-]+)\s*:/;

export interface FrontmatterParts {
  frontmatter: string;
  body: string;
}

export function splitFrontmatter(markdown: string): FrontmatterParts | null {
  const normalized = markdown.replace(/^\uFEFF/, '');
  const match = normalized.match(FRONTMATTER_RE);
  if (!match) return null;
  return {
    frontmatter: match[1],
    body: normalized.slice(match[0].length),
  };
}

function unquoteScalar(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try { return JSON.parse(trimmed) as string; } catch { return trimmed.slice(1, -1); }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed.replace(/\s+#.*$/, '').trim();
}

function parseFlowStringArray(value: string): string[] | undefined {
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return undefined;
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map(unquoteScalar).filter(Boolean);
  }
  return undefined;
}

/**
 * Reads the small set of scalar/list fields needed for preview and validation.
 * It deliberately does not execute YAML tags, aliases, or arbitrary types. The
 * complete raw block is retained for loss-aware round trips.
 */
export function parseOkfFrontmatter(raw: string): ParsedOkfFrontmatter {
  const result: ParsedOkfFrontmatter = { raw };
  const lines = raw.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || /^\s/.test(line) || line.trimStart().startsWith('#')) continue;
    const match = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const [, key, rest] = match;

    if (key === 'tags') {
      const flow = parseFlowStringArray(rest);
      if (flow) {
        result.tags = flow;
        continue;
      }
      if (!rest.trim()) {
        const tags: string[] = [];
        for (let j = i + 1; j < lines.length; j++) {
          const item = lines[j].match(/^\s+-\s+(.+)$/);
          if (!item) break;
          tags.push(unquoteScalar(item[1]));
          i = j;
        }
        result.tags = tags.filter(Boolean);
      }
      continue;
    }

    const value = unquoteScalar(rest);
    if (!value) continue;
    if (key === 'type') result.type = value;
    else if (key === 'title') result.title = value;
    else if (key === 'description') result.description = value;
    else if (key === 'resource') result.resource = value;
    else if (key === 'status') result.status = value;
    else if (key === 'stale_after') result.staleAfter = value;
  }

  return result;
}

export function yamlScalar(value: string): string {
  return JSON.stringify(value);
}

export function yamlValue(value: unknown): string {
  if (typeof value === 'string') return yamlScalar(value);
  return JSON.stringify(value);
}

export function serializeFrontmatter(fields: Record<string, unknown>): string {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}: ${yamlValue(value)}`);
  return `---\n${lines.join('\n')}\n---\n`;
}

export function splitTopLevelEntries(raw: string): Array<{ key: string; block: string }> {
  const lines = raw.split(/\r?\n/);
  const entries: Array<{ key: string; block: string }> = [];
  let current: { key: string; lines: string[] } | null = null;

  for (const line of lines) {
    const match = line.match(TOP_LEVEL_KEY_RE);
    if (match && !/^\s/.test(line)) {
      if (current) entries.push({ key: current.key, block: current.lines.join('\n') });
      current = { key: match[1], lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) entries.push({ key: current.key, block: current.lines.join('\n') });
  return entries;
}

/** Preserve unknown/imported blocks verbatim while replacing Remnus-owned keys. */
export function mergeFrontmatter(
  importedRaw: string | undefined,
  fields: Record<string, unknown>,
): string {
  const replaced = new Set(Object.keys(fields));
  const preserved = importedRaw
    ? splitTopLevelEntries(importedRaw).filter(entry => !replaced.has(entry.key))
    : [];
  const generated = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}: ${yamlValue(value)}`);
  return `---\n${[...generated, ...preserved.map(entry => entry.block)].join('\n')}\n---\n`;
}
