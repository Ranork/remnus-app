import fs from 'node:fs';
import path from 'node:path';

import { findProjectRoot, readConfig, readCredentials } from '../lib/project.js';
import { bold, detail, dim, fail, ok, say, warn } from '../lib/ui.js';

// Answers one question: is this project's Remnus connection actually working right
// now? Every check that fails says which command fixes it — a diagnosis with no
// remedy is just a different way of saying "broken".

const PROBE_TIMEOUT_MS = 15000;
const REGISTRY_TIMEOUT_MS = 5000;

/** Extracts the `X` from a `.mcp.json` `remnus` entry pinned as `npx -y remnus@X mcp`
 *  (see `mcpEntryFor` in `init.js`). Returns null for `--http` entries (no pin to
 *  check) or an unpinned bare `remnus` (an older install, or hand-edited). */
function pinnedVersionFrom(doc) {
  const entry = doc?.mcpServers?.remnus;
  if (!entry || entry.command !== 'npx' || !Array.isArray(entry.args)) return null;
  const match = entry.args.find((a) => /^remnus@/.test(a));
  return match ? match.slice('remnus@'.length) : null;
}

/** Same idea as `pinnedVersionFrom`, for the SessionStart hook `init` writes (see
 *  `writeSessionStartHook` in `files.js`). Returns null if there's no such hook, or
 *  it's unpinned. */
function pinnedHookVersionFrom(settingsDoc) {
  const entries = settingsDoc?.hooks?.SessionStart;
  if (!Array.isArray(entries)) return null;
  for (const entry of entries) {
    for (const hook of entry?.hooks ?? []) {
      const match = /^npx remnus@(\S+) open$/.exec(hook?.command ?? '');
      if (match) return match[1];
    }
  }
  return null;
}

/** Best-effort, silent on failure — an outdated-version nudge is not worth failing
 *  `doctor` over if the registry is unreachable. */
async function fetchLatestVersion() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REGISTRY_TIMEOUT_MS);
  try {
    const res = await fetch('https://registry.npmjs.org/remnus/latest', { signal: controller.signal });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.version ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function probeConnection(config, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const res = await fetch(config.mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'remnus-cli-doctor', version: '0.1.0' },
        },
      }),
      signal: controller.signal,
    });

    if (res.status === 401) return { state: 'revoked' };
    if (res.status === 403) return { state: 'wrong-workspace' };
    if (!res.ok) return { state: 'http', status: res.status };
    return { state: 'ok' };
  } catch (err) {
    return { state: 'unreachable', message: err?.name === 'AbortError' ? 'timed out' : err?.message };
  } finally {
    clearTimeout(timer);
  }
}

export async function doctorCommand() {
  const root = findProjectRoot(process.cwd());
  const config = readConfig(root);

  say(`${dim('Project')} ${root}`);
  say();

  if (!config?.workspaceId) {
    fail('This project is not connected to Remnus.');
    detail('Run `npx remnus init` in the project directory.');
    return 1;
  }

  ok(`Workspace ${bold(config.workspaceName ?? config.workspaceId)}`);
  detail(config.mcpUrl);
  detail(`mode: ${config.authMode === 'oauth' ? 'browser sign-in (no token stored here)' : 'project token'}`);

  let problems = 0;
  let pinnedVersion = null;

  // .mcp.json — without this entry the agent never even tries to connect.
  const mcpFile = path.join(root, '.mcp.json');
  if (!fs.existsSync(mcpFile)) {
    problems += 1;
    fail('.mcp.json is missing, so agents in this project cannot see Remnus.');
    detail('Run `npx remnus init` to write it again.');
  } else {
    try {
      const doc = JSON.parse(fs.readFileSync(mcpFile, 'utf8'));
      if (!doc?.mcpServers?.remnus) {
        problems += 1;
        fail('.mcp.json has no `remnus` server entry.');
        detail('Run `npx remnus init` to write it again.');
      } else {
        ok('.mcp.json points at Remnus');
        pinnedVersion = pinnedVersionFrom(doc);
      }
    } catch {
      problems += 1;
      fail('.mcp.json is not valid JSON.');
      detail('Fix the file, then run `npx remnus init`.');
    }
  }

  // The SessionStart hook (if any) is pinned the same way and for the same reason —
  // an auto-run command shouldn't silently float to whatever's newest on npm.
  let pinnedHookVersion = null;
  const settingsFile = path.join(root, '.claude', 'settings.json');
  if (fs.existsSync(settingsFile)) {
    try {
      pinnedHookVersion = pinnedHookVersionFrom(JSON.parse(fs.readFileSync(settingsFile, 'utf8')));
    } catch {
      // Malformed .claude/settings.json isn't this command's problem to diagnose.
    }
  }

  // Pinned on purpose (see mcpEntryFor in init.js) so a compromised or broken future
  // release doesn't silently run here — but that means nobody gets nudged when a real
  // update ships either, unless doctor says so.
  if (pinnedVersion || pinnedHookVersion) {
    const latest = await fetchLatestVersion();
    if (latest && pinnedVersion && latest !== pinnedVersion) {
      warn(`A newer remnus is available: ${pinnedVersion} → ${bold(latest)}.`);
      detail(`This project is pinned and won't pick it up on its own. In .mcp.json, change`);
      detail(`"remnus@${pinnedVersion}" to "remnus@${latest}" (or run \`npx remnus init\` to reconnect on it).`);
    }
    if (latest && pinnedHookVersion && latest !== pinnedHookVersion) {
      warn(`The SessionStart hook is also pinned to an older remnus: ${pinnedHookVersion} → ${bold(latest)}.`);
      detail(`In .claude/settings.json, change "remnus@${pinnedHookVersion} open" to`);
      detail(`"remnus@${latest} open" (or run \`npx remnus init\` to reconnect on it).`);
    }
  }

  if (config.authMode === 'oauth') {
    say();
    warn('Sign-in is held by your MCP client, so there is nothing to verify from here.');
    detail('If the agent reports an authorization error, let it run its browser sign-in again.');
    return problems ? 1 : 0;
  }

  const credentials = readCredentials(root);
  if (!credentials?.token) {
    problems += 1;
    fail('This project has no stored token.');
    detail('Run `npx remnus init` to reconnect.');
    return 1;
  }
  ok('Project token is present');

  // The credential file must stay out of version control.
  const gitignore = path.join(root, '.gitignore');
  const ignoreText = fs.existsSync(gitignore) ? fs.readFileSync(gitignore, 'utf8') : '';
  if (!ignoreText.includes('.remnus/credentials.json')) {
    problems += 1;
    warn('.remnus/credentials.json is not listed in .gitignore.');
    detail('Add it before committing — it holds this project\'s token.');
  }

  say();
  const probe = await probeConnection(config, credentials.token);

  if (probe.state === 'ok') {
    ok('Remnus answered — the connection works.');
  } else if (probe.state === 'revoked') {
    problems += 1;
    fail('Remnus rejected the token — it was revoked or has expired.');
    detail('Run `npx remnus init` to reconnect.');
  } else if (probe.state === 'wrong-workspace') {
    problems += 1;
    fail('The token belongs to a different workspace than this project is configured for.');
    detail('Run `npx remnus init` to reconnect.');
  } else if (probe.state === 'unreachable') {
    problems += 1;
    fail(`Could not reach Remnus (${probe.message ?? 'network error'}).`);
    detail('Check your connection, then run `npx remnus doctor` again.');
  } else {
    problems += 1;
    fail(`Remnus returned HTTP ${probe.status}.`);
  }

  say();
  if (problems === 0) {
    ok('Everything checks out.');
    return 0;
  }
  fail(`${problems} problem${problems === 1 ? '' : 's'} found.`);
  return 1;
}
