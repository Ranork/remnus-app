import fs from 'node:fs';
import path from 'node:path';

import { REMNUS_DIR } from './project.js';
import { callRpc } from './rpc.js';

// The local workspace map: `.remnus/workspace-map.md`, a cached copy of the
// workspace digest resource (`remnus://workspace/<id>/digest`) with a header that
// says where it came from and how fresh it is.
//
// It exists for the first turn of a session. An agent that can read (or grep) a
// file next to the code knows which ids to go to before it has made a single
// MCP call, instead of "read the whole map over the network, then read the page"
// — and the digest's own `cursor:` line lets it ask `get_changes_since` for the
// delta rather than re-reading the map when it suspects the map is stale.
//
// It is a cache, so it says so, in the header comment (for tooling) and in the
// blockquote (for whoever reads it). Nothing in this file is authoritative past
// its cursor. It is git-ignored by default (see `ignorePatternsFor`) because a
// file that changes on every write would be diff noise in every commit; a team
// that wants it shared runs `remnus sync --track`.

export const MAP_FILE = 'workspace-map.md';
const HEADER_RE = /^<!-- remnus:map ([^\n]*?) -->/;

export function mapPath(root) {
  return path.join(root, REMNUS_DIR, MAP_FILE);
}

/** The ignore rules `init`, `join` and `sync` all agree on. One list, so a later
 *  writer never drops a pattern an earlier one added. */
export function ignorePatternsFor(config) {
  const patterns = ['.remnus/credentials.json'];
  if (!config?.trackMap) patterns.push(`.remnus/${MAP_FILE}`);
  return patterns;
}

/** Parses the header of an existing map: `{ workspace, server, cursor, generated }`
 *  or null when there is no map (or it is not ours). */
export function readMapMeta(root) {
  const file = mapPath(root);
  if (!fs.existsSync(file)) return null;
  let head;
  try {
    head = fs.readFileSync(file, 'utf8').slice(0, 1024);
  } catch {
    return null;
  }
  const match = HEADER_RE.exec(head);
  if (!match) return null;
  const meta = {};
  for (const pair of match[1].split(/\s+/)) {
    const eq = pair.indexOf('=');
    if (eq > 0) meta[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return meta;
}

export function renderMap({ config, digest, cursor, generatedAt }) {
  const header = `<!-- remnus:map workspace=${config.workspaceId} server=${config.serverUrl} cursor=${cursor} generated=${generatedAt} -->`;
  const note = [
    `> **Cached map** of the Remnus workspace **${config.workspaceName ?? config.workspaceId}**, written by \`remnus\` on ${generatedAt}.`,
    `> It is a snapshot: nothing after the \`cursor:\` line below is verified. Before writing, or when it`,
    `> looks stale, call \`get_changes_since\` with that cursor for the delta — do not re-crawl the tree.`,
  ].join('\n');
  return `${header}\n${note}\n\n${digest.trimEnd()}\n`;
}

/**
 * Fetches the digest for this project's workspace and writes the map. Returns
 * `{ cursor, bytes }`. Throws on any failure — callers decide whether that is
 * worth a word (`sync`, `doctor`) or silence (the bridge, best-effort).
 */
export async function refreshWorkspaceMap(root, config, token, { timeoutMs } = {}) {
  const uri = `remnus://workspace/${config.workspaceId}/digest`;
  const result = await callRpc(config.mcpUrl, token, 'resources/read', { uri }, { timeoutMs });
  const digest = result?.contents?.[0]?.text;
  if (typeof digest !== 'string' || !digest) throw new Error('The digest resource came back empty.');

  const cursor = /^cursor: (\S+)$/m.exec(digest)?.[1] ?? '';
  const text = renderMap({ config, digest, cursor, generatedAt: new Date().toISOString() });

  const file = mapPath(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Write-then-rename so a reader (an agent grepping the map mid-refresh) never
  // sees a half-written file.
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text, 'utf8');
  try {
    fs.renameSync(tmp, file);
  } catch {
    // Windows refuses to replace a file another process has open. The plain
    // write is the lesser evil there; the header still says when it was made.
    fs.writeFileSync(file, text, 'utf8');
    try { fs.unlinkSync(tmp); } catch { /* already gone */ }
  }

  return { cursor, bytes: Buffer.byteLength(text, 'utf8') };
}
