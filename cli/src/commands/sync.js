import fs from 'node:fs';

import { findProjectRoot, readConfig, readCredentials, writeConfig } from '../lib/project.js';
import { ensureGitignore } from '../lib/files.js';
import { MAP_FILE, ignorePatternsFor, mapPath, refreshWorkspaceMap } from '../lib/map.js';
import { RpcError } from '../lib/rpc.js';
import { bold, detail, dim, fail, ok, say, warn } from '../lib/ui.js';

// Rewrites `.remnus/workspace-map.md` from the live workspace. The bridge does this
// on its own while an agent session runs; this is the explicit form — after a
// teammate's changes, before a session, or from a script.
//
// `--track` / `--untrack` decide whether the map is committed. The default is
// ignored: the file changes on every agent write and would sit in every diff. The
// choice is stored in the committed `config.json`, so the whole team gets the same
// answer from `init`, `join` and `sync` alike.
export async function syncCommand(options) {
  const root = findProjectRoot(process.cwd());
  const config = readConfig(root);

  if (!config?.workspaceId) {
    fail('This project is not connected to Remnus.');
    detail('Run `npx remnus init` in the project directory.');
    return 1;
  }

  if (options.track || options.untrack) {
    config.trackMap = Boolean(options.track);
    writeConfig(root, config);
    const gitignore = ensureGitignore(root, ignorePatternsFor(config));
    ok(config.trackMap ? 'The workspace map will be committed with the project.' : 'The workspace map is git-ignored again.');
    detail('.remnus/config.json');
    if (gitignore !== 'unchanged') detail(`.gitignore  (${gitignore})`);
    if (config.trackMap) {
      say(dim('It changes on every agent write, so expect it in your diffs. `npx remnus sync --untrack` reverts.'));
    }
    say();
  }

  if (config.authMode === 'oauth') {
    warn('This project uses browser sign-in, so there is no token here to fetch the map with.');
    detail(`Agents can still read the workspace digest resource directly; ${MAP_FILE} stays absent.`);
    return 0;
  }

  const credentials = readCredentials(root);
  if (!credentials?.token) {
    fail('You have no token for this project on this machine.');
    detail('Run `npx remnus join` to get your own, then `npx remnus sync` again.');
    return 1;
  }

  try {
    const { cursor, bytes } = await refreshWorkspaceMap(root, config, credentials.token);
    ok(`Wrote ${bold(`.remnus/${MAP_FILE}`)} (${Math.round(bytes / 1024 * 10) / 10} KB)`);
    detail(`cursor ${cursor || '(none)'} — agents sync from here with get_changes_since`);
    return 0;
  } catch (err) {
    if (err instanceof RpcError && err.status === 401) {
      fail('Remnus rejected the token — it was revoked or has expired.');
      detail('Run `npx remnus join` to get a fresh one.');
    } else if (err instanceof RpcError && err.status === 403) {
      fail('The token belongs to a different workspace than this project is configured for.');
      detail('Run `npx remnus join` to get a token for the workspace this project names.');
    } else {
      fail(`Could not fetch the workspace map: ${err?.message ?? err}`);
      detail('Check your connection, then run `npx remnus doctor`.');
    }
    if (fs.existsSync(mapPath(root))) detail('The previous map is still in place; its header says how old it is.');
    return 1;
  }
}
