import fs from 'node:fs';
import path from 'node:path';

// Files this CLI writes into someone else's repository. Every one of them is edited
// in place rather than overwritten: a project already has an .mcp.json with other
// servers in it, a .gitignore with its own rules, and an AGENTS.md someone wrote by
// hand. Clobbering any of those would be a worse bug than not installing at all.

const MARKER_START = '<!-- remnus:start -->';
const MARKER_END = '<!-- remnus:end -->';

const GITIGNORE_START = '# remnus:start';
const GITIGNORE_END = '# remnus:end';

/** Keep the file's own newline convention so an edit doesn't rewrite every line in the diff. */
function detectEol(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

/**
 * Adds (or updates) the `remnus` entry in `.mcp.json`, leaving every other MCP server
 * defined there untouched. Returns 'created' | 'updated' | 'unchanged'.
 */
export function writeMcpConfig(root, entry, { serverKey = 'remnus' } = {}) {
  const file = path.join(root, '.mcp.json');
  let doc = {};
  let existed = false;

  if (fs.existsSync(file)) {
    existed = true;
    const raw = fs.readFileSync(file, 'utf8');
    try {
      doc = raw.trim() ? JSON.parse(raw) : {};
    } catch (err) {
      throw new Error(`.mcp.json is not valid JSON (${err.message}). Fix it before running \`remnus init\`.`);
    }
    if (typeof doc !== 'object' || Array.isArray(doc) || doc === null) {
      throw new Error('.mcp.json does not contain a JSON object. Fix it before running `remnus init`.');
    }
  }

  if (!doc.mcpServers || typeof doc.mcpServers !== 'object' || Array.isArray(doc.mcpServers)) {
    doc.mcpServers = {};
  }

  const before = JSON.stringify(doc.mcpServers[serverKey] ?? null);
  doc.mcpServers[serverKey] = entry;
  if (before === JSON.stringify(entry)) return 'unchanged';

  fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return existed ? 'updated' : 'created';
}

/**
 * Keeps a marked block of ignore rules in `.gitignore`. Marked rather than appended
 * so a second install replaces the block instead of stacking duplicates.
 */
export function ensureGitignore(root, patterns) {
  const file = path.join(root, '.gitignore');
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const eol = existing ? detectEol(existing) : '\n';

  const block = [
    GITIGNORE_START,
    '# Holds this project\'s Remnus token — never commit it.',
    ...patterns,
    GITIGNORE_END,
  ].join(eol);

  const startIdx = existing.indexOf(GITIGNORE_START);
  const endIdx = existing.indexOf(GITIGNORE_END);

  if (startIdx !== -1 && endIdx > startIdx) {
    const next = existing.slice(0, startIdx) + block + existing.slice(endIdx + GITIGNORE_END.length);
    if (next === existing) return 'unchanged';
    fs.writeFileSync(file, next, 'utf8');
    return 'updated';
  }

  // Never ignore what is already tracked-by-intent: if the user has explicitly listed
  // the credentials file themselves, adding our block would be noise.
  if (patterns.every((p) => existing.split(/\r?\n/).some((line) => line.trim() === p))) {
    return 'unchanged';
  }

  const prefix = existing && !existing.endsWith('\n') && !existing.endsWith('\r\n') ? eol : '';
  const separator = existing ? eol : '';
  fs.writeFileSync(file, `${existing}${prefix}${separator}${block}${eol}`, 'utf8');
  return existing ? 'updated' : 'created';
}

/**
 * Writes the Remnus section into an agent instruction file (AGENTS.md, CLAUDE.md …).
 *
 * The section is delimited by HTML comments, so a re-install replaces exactly that
 * block and everything the user wrote around it survives. A file that does not exist
 * yet is created with just the section in it.
 */
export function writeAgentSection(root, fileName, section) {
  const file = path.join(root, fileName);
  const existed = fs.existsSync(file);
  const existing = existed ? fs.readFileSync(file, 'utf8') : '';
  const eol = existing ? detectEol(existing) : '\n';

  const block = [MARKER_START, section.trim(), MARKER_END].join(eol);

  const startIdx = existing.indexOf(MARKER_START);
  const endIdx = existing.indexOf(MARKER_END);

  if (startIdx !== -1 && endIdx > startIdx) {
    const next = existing.slice(0, startIdx) + block + existing.slice(endIdx + MARKER_END.length);
    if (next === existing) return 'unchanged';
    fs.writeFileSync(file, next, 'utf8');
    return 'updated';
  }

  const prefix = existed && existing.trim() ? `${existing.replace(/\s*$/, '')}${eol}${eol}` : '';
  fs.writeFileSync(file, `${prefix}${block}${eol}`, 'utf8');
  return existed ? 'updated' : 'created';
}

/** Which agent instruction files this project already keeps. */
export function detectAgentDocs(root) {
  const candidates = ['AGENTS.md', 'CLAUDE.md'];
  const found = candidates.filter((name) => fs.existsSync(path.join(root, name)));
  // A project with neither still gets one, so the agent has somewhere to read this from.
  return found.length ? found : ['AGENTS.md'];
}

const SESSION_START_MATCHER = 'startup';
// Matches our hook regardless of which version it was pinned to, so re-running
// `init` on a newer CLI replaces the old pin instead of adding a second entry.
const SESSION_START_COMMAND_RE = /^npx remnus(?:@\S+)? open$/;

/**
 * Adds (or updates) a Claude Code `SessionStart` hook that opens this project's
 * workspace whenever a fresh session starts — `matcher: "startup"` so it skips
 * resumes/compaction, not just every prompt. `command` should be the full pinned
 * invocation (see `init.js`); finds our own existing entry by pattern (any prior
 * pin) and only ever touches that one, leaving any other tool's hooks in
 * `.claude/settings.json` untouched. Returns 'created' | 'updated' | 'unchanged'.
 */
export function writeSessionStartHook(root, command) {
  const file = path.join(root, '.claude', 'settings.json');
  const existed = fs.existsSync(file);
  let doc = {};

  if (existed) {
    const raw = fs.readFileSync(file, 'utf8');
    try {
      doc = raw.trim() ? JSON.parse(raw) : {};
    } catch (err) {
      throw new Error(`.claude/settings.json is not valid JSON (${err.message}). Fix it before running \`remnus init\`.`);
    }
    if (typeof doc !== 'object' || Array.isArray(doc) || doc === null) {
      throw new Error('.claude/settings.json does not contain a JSON object. Fix it before running `remnus init`.');
    }
  }

  if (!doc.hooks || typeof doc.hooks !== 'object' || Array.isArray(doc.hooks)) doc.hooks = {};
  if (!Array.isArray(doc.hooks.SessionStart)) doc.hooks.SessionStart = [];

  const isOurs = (entry) =>
    entry?.matcher === SESSION_START_MATCHER &&
    Array.isArray(entry.hooks) &&
    entry.hooks.some((h) => SESSION_START_COMMAND_RE.test(h?.command ?? ''));

  const ourEntry = {
    matcher: SESSION_START_MATCHER,
    hooks: [{ type: 'command', command }],
  };

  const idx = doc.hooks.SessionStart.findIndex(isOurs);
  const before = idx === -1 ? null : JSON.stringify(doc.hooks.SessionStart[idx]);
  if (before === JSON.stringify(ourEntry)) return 'unchanged';

  if (idx === -1) doc.hooks.SessionStart.push(ourEntry);
  else doc.hooks.SessionStart[idx] = ourEntry;

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return existed ? 'updated' : 'created';
}
