import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CLI_VERSION,
  DEFAULT_SERVER_URL,
  normalizeServerUrl,
  projectNameFor,
  readConfig,
  writeConfig,
  writeCredentials,
} from '../lib/project.js';
import {
  detectAgentDocs,
  ensureGitignore,
  inlineText,
  writeAgentSection,
  writeMcpConfig,
  writeSessionStartHook,
} from '../lib/files.js';
import { installUrl, newDeviceId, openSignInPage, serverTime, waitForInstall } from '../lib/install.js';
import { MAP_FILE, ignorePatternsFor, refreshWorkspaceMap } from '../lib/map.js';
import { joinCommand } from './join.js';
import { bold, detail, dim, ok, say, step, warn } from '../lib/ui.js';

const TEMPLATE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates');

/**
 * The MCP entry written into the project.
 *
 * It runs this CLI rather than pointing an HTTP transport straight at Remnus, for
 * three reasons that all matter more than the extra process: no token ends up in a
 * committed file, the token and the OAuth modes produce the *same* .mcp.json, and
 * every request passes through somewhere we can notice a broken connection and say
 * so. `--http` opts out for anyone who would rather have the direct transport.
 *
 * Pinned to this CLI's exact version rather than a bare `remnus` — otherwise every
 * connected project silently pulls whatever is newest on npm the next time an MCP
 * client restarts, which is a real supply-chain exposure a security review will
 * flag (one did, on a real install). Re-running `init` moves the pin forward.
 */
function mcpEntryFor(config, { direct }) {
  if (!direct) {
    return { command: 'npx', args: ['-y', `remnus@${CLI_VERSION}`, 'mcp'] };
  }
  if (config.authMode === 'oauth') {
    return { type: 'http', url: config.mcpUrl };
  }
  return {
    type: 'http',
    url: config.mcpUrl,
    headers: { Authorization: 'Bearer ${REMNUS_TOKEN}' },
  };
}

/**
 * The calibration guide as raw markdown (`/wiki/calibrate.md`) — what an agent should
 * read: the HTML page is ~19× the tokens, and a fetch tool that summarizes HTML can
 * drop rules. A self-hosted instance older than that route has only the HTML page, so
 * probe once and fall back rather than hand the agent a URL that 404s.
 */
async function calibrateUrlFor(serverUrl) {
  const raw = `${serverUrl}/wiki/calibrate.md`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(raw, { signal: controller.signal });
    const isMarkdown = res.ok && (res.headers.get('content-type') ?? '').includes('markdown');
    await res.text();
    if (isMarkdown) return raw;
  } catch {
    // Unreachable right now — the HTML page is the address every version serves.
  } finally {
    clearTimeout(timer);
  }
  return `${serverUrl}/wiki/calibrate`;
}

export function renderTemplate(name, values) {
  const raw = fs.readFileSync(path.join(TEMPLATE_DIR, name), 'utf8');
  return raw.replace(/\{\{(\w+)\}\}/g, (_match, key) => values[key] ?? '');
}

export async function initCommand(options) {
  const root = path.resolve(options.dir ?? process.cwd());
  if (!fs.existsSync(root)) throw new Error(`No such directory: ${root}`);

  const serverUrl = normalizeServerUrl(options.server ?? process.env.REMNUS_SERVER_URL ?? DEFAULT_SERVER_URL);
  const projectName = projectNameFor(root);
  const authMode = options.oauth ? 'oauth' : 'pat';

  const existing = readConfig(root);
  if (existing?.workspaceId && !options.reconnect) {
    // A project that is already connected almost always means "someone else set this
    // up and I just cloned it" — so `init` hands over to `join`, which only writes
    // this person's own credentials.
    //
    // Replacing the connection stays possible but has to be asked for (`--reconnect`).
    // Quietly re-pointing a committed `.remnus/config.json` at a different workspace
    // is the most expensive mistake this flow allows: the rest of the team keeps
    // writing to the old workspace while whoever ran it writes to a new empty one,
    // and nobody notices until the shared memory has already forked.
    say(dim(`Already connected to ${bold(existing.workspaceName ?? existing.workspaceId)} — joining it instead.`));
    say(dim('To connect this project to a different workspace, run `npx remnus init --reconnect`.'));
    say();
    return joinCommand(options);
  }

  if (existing?.workspaceId) {
    warn(`This project is already connected to ${bold(existing.workspaceName ?? existing.workspaceId)}.`);
    detail('Continuing will replace that connection with a new one.');
    say();
  }

  const deviceId = newDeviceId();
  const issuedAt = await serverTime(serverUrl, deviceId);
  const url = installUrl(serverUrl, { deviceId, projectName, authMode, issuedAt });

  step(`Connecting ${bold(projectName)} to Remnus`);
  detail(root);
  say();
  // Headless boxes, CI and anyone who would rather click the link themselves.
  const skipBrowser = options.noBrowser || process.env.REMNUS_NO_BROWSER === '1';
  openSignInPage(url, { skipBrowser });
  say();
  step('Waiting for you to finish in the browser…');

  const result = await waitForInstall(serverUrl, deviceId);

  if (!result.workspaceId || !result.mcpUrl) {
    throw new Error('The server returned an incomplete setup response. Please try again.');
  }
  if (authMode === 'pat' && !result.token) {
    throw new Error('The server did not return a token for this project. Please try again.');
  }

  const config = {
    version: 1,
    serverUrl,
    workspaceId: result.workspaceId,
    workspaceName: result.workspaceName ?? projectName,
    mcpUrl: result.mcpUrl,
    authMode,
    scope: result.scope ?? null,
    // The calibrating agent flips this and adds `calibratedAt` + `calibrationGuide`
    // (the guide version it followed) — see docs/mcp/calibrate.md. A reconnect is a
    // different workspace, so none of the three carries over.
    calibrated: false,
    // Whether .remnus/workspace-map.md is committed; `remnus sync --track` flips it.
    // A re-connect keeps the team's earlier choice.
    trackMap: existing?.trackMap === true,
    connectedAt: new Date().toISOString(),
  };

  say();
  ok(`Connected to workspace ${bold(config.workspaceName)}`);
  say();

  writeConfig(root, config);
  detail('.remnus/config.json');

  if (authMode === 'pat') {
    writeCredentials(root, {
      token: result.token,
      workspaceId: config.workspaceId,
      serverUrl,
    });
    detail('.remnus/credentials.json  (git-ignored)');

    const gitignore = ensureGitignore(root, ignorePatternsFor(config));
    if (gitignore !== 'unchanged') detail(`.gitignore  (${gitignore})`);

    // The first session's cold start: the agent reads this file before its first
    // MCP call. Best-effort — the bridge rewrites it whenever a session starts.
    try {
      await refreshWorkspaceMap(root, config, result.token);
      detail(`.remnus/${MAP_FILE}  (${config.trackMap ? 'committed' : 'git-ignored'})`);
    } catch {
      // The bridge will retry on the next session; nothing to report at install time.
    }
  }

  const mcpState = writeMcpConfig(root, mcpEntryFor(config, { direct: options.http }));
  if (mcpState !== 'unchanged') detail(`.mcp.json  (${mcpState})`);

  // Served live from the connected Remnus instance rather than copied into the
  // project: a local `.remnus/calibrate.md` would go stale as the guide improves,
  // and this way a self-hosted instance always serves the guide matching its own
  // deployed version instead of remnus.com's.
  const calibrateUrl = await calibrateUrlFor(serverUrl);
  // A fetch tool that summarizes (Claude Code's WebFetch does) hands the agent a digest
  // of the guide, and the rules are what gets dropped. Only said for the raw file: the
  // HTML fallback is too large to read whole.
  const readWhole = calibrateUrl.endsWith('.md') ? ' (read the whole file, e.g. with curl)' : '';

  // Name and scope come from the server (the workspace's owner names it): inline and bounded.
  const section = renderTemplate('agents-section.md', {
    WORKSPACE_NAME: inlineText(config.workspaceName, 80),
    WORKSPACE_ID: inlineText(config.workspaceId, 80),
    MCP_URL: inlineText(config.mcpUrl, 300),
    SCOPE: inlineText(config.scope ?? 'set when the agent connects', 40),
    CALIBRATE_URL: calibrateUrl,
    CALIBRATE_READ: readWhole,
  });

  for (const docName of detectAgentDocs(root)) {
    const state = writeAgentSection(root, docName, section);
    if (state !== 'unchanged') detail(`${docName}  (${state})`);
  }

  // Claude Code only (inert, harmless file for any other client). On a fresh session it
  // opens this workspace, so the human sees it without a separate step, and — `--hook` —
  // tells that session's agent in one line whether setup still has a step to go (see
  // `open.js`). Pinned to this CLI's version for the same reason as the .mcp.json entry
  // above — an auto-run hook is exactly the kind of thing that shouldn't silently float
  // to whatever npm has today.
  const hookState = writeSessionStartHook(root, `npx remnus@${CLI_VERSION} open --hook`);
  if (hookState !== 'unchanged') detail(`.claude/settings.json  (${hookState})`);

  say();
  if (options.http && authMode === 'pat') {
    warn('With --http the token is read from the REMNUS_TOKEN environment variable.');
    detail('Set it in your shell before starting an agent, or re-run without --http.');
    say();
  }

  ok('Setup complete.');
  say();
  printNextStep();
  say();
  say(dim(`Step 2 is optional — the workspace also works empty. Anytime: ${bold('npx remnus open')} shows the`));
  say(dim(`workspace, ${bold('npx remnus doctor')} checks the connection.`));
}

/**
 * The one set of instructions `init` ends with, addressed to the agent that ran it.
 *
 * That agent cannot finish the setup itself: MCP servers load when a session starts, so
 * the session that ran `init` has no Remnus tools. What it can do is tell the human the
 * one thing to do next — in their language, which only the agent knows. The prompt it
 * hands over is short on purpose: in the new session the `AGENTS.md` block (and, in
 * Claude Code, the SessionStart hook) says what "continue the Remnus setup" means.
 */
function printNextStep() {
  const rule = '─'.repeat(64);
  say(dim(`── For the agent ${rule.slice(17)}`));
  say('Step 1 of 2 is done. Step 2 — reading this project into the workspace — needs a');
  say('new session: agents load Remnus tools only when a session starts. The sign-in');
  say('link above has been used; do not repeat it. Tell the human, in their language:');
  say();
  say(`  Remnus is connected. To finish the setup, open a new chat in this project`);
  say(`  (or restart your agent) and paste: ${bold('Continue the Remnus setup')}`);
  say();
  say('Translate that message, the prompt included.');
  say(dim(rule));
}
