import fs from 'node:fs';
import path from 'node:path';

import {
  CLI_VERSION,
  findProjectRoot,
  normalizeServerUrl,
  projectNameFor,
  readConfig,
  readCredentials,
  writeCredentials,
} from '../lib/project.js';
import { ensureGitignore, writeMcpConfig } from '../lib/files.js';
import { ignorePatternsFor } from '../lib/map.js';
import { installUrl, newDeviceId, openBrowser, waitForInstall } from '../lib/install.js';
import { bold, detail, dim, ok, say, step, warn } from '../lib/ui.js';

// ── `remnus join` ────────────────────────────────────────────────────────────
//
// The second person's command. Someone already connected this project and
// committed `.remnus/config.json`; `.remnus/credentials.json` is git-ignored and
// personal, so a teammate who clones the repo has the workspace id but no way in.
// `init` was the wrong answer for them — it offers to *replace* the project's
// connection, which is the most expensive mistake available in this flow.
//
// **This command writes exactly one file: `.remnus/credentials.json`.** It does
// not touch `config.json` (its `calibrated` flag above all), does not rewrite the
// `AGENTS.md` section, does not touch `.claude/settings.json`. It will *create* a
// missing `.mcp.json` entry, because a clone without one simply cannot reach
// Remnus — but it never overwrites one that is already there. Filling a gap is
// help; overwriting a committed file someone else configured is damage.

/**
 * `.mcp.json` as `join` would write it — only ever used when the project has no
 * `remnus` entry at all. Kept in step with `init`'s default (the CLI-bridge form),
 * since that is the shape the rest of the project's files assume.
 */
function defaultMcpEntry() {
  return { command: 'npx', args: ['-y', `remnus@${CLI_VERSION}`, 'mcp'] };
}

/** Does `.mcp.json` already define a `remnus` server? A malformed file counts as
 *  "yes": refusing to touch it is safer than replacing what we cannot parse. */
function hasMcpEntry(root) {
  const file = path.join(root, '.mcp.json');
  if (!fs.existsSync(file)) return false;
  try {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8') || '{}');
    return Boolean(doc?.mcpServers?.remnus);
  } catch {
    return true;
  }
}

export async function joinCommand(options = {}) {
  // Unlike `init`, this searches upward: someone running it from a subdirectory of
  // a project that is already connected means the same thing as running it at the root.
  const root = options.dir ? path.resolve(options.dir) : findProjectRoot(process.cwd());
  if (!fs.existsSync(root)) throw new Error(`No such directory: ${root}`);

  const config = readConfig(root);
  if (!config?.workspaceId) {
    throw new Error(
      `No Remnus setup found in ${root}. This project has never been connected — run \`npx remnus init\` to connect it.`,
    );
  }

  // The project's own server, not a flag default: joining an existing setup must
  // reach the same instance the rest of the project already points at.
  const serverUrl = normalizeServerUrl(options.server ?? config.serverUrl ?? process.env.REMNUS_SERVER_URL);
  const projectName = projectNameFor(root);

  step(`Joining ${bold(config.workspaceName ?? config.workspaceId)}`);
  detail(root);
  say();

  if (config.authMode === 'oauth') {
    // Nothing personal is stored in an OAuth project — each MCP client runs its own
    // browser flow against the pinned URL and keeps the credential itself. There is
    // no credentials file to write, so the useful thing to do is say so.
    ok('This project uses browser sign-in, so there is no project token to set up.');
    say();
    step('Reload MCP servers, then let the agent sign itself in.');
    say(dim('In Claude Code: run /mcp and reconnect remnus, or start a new session. The first'));
    say(dim('Remnus call opens a sign-in page in your browser.'));
    say();
    detail('If it reports that you have no access to this workspace, ask its owner to add you.');
    return 0;
  }

  const existing = readCredentials(root);
  if (existing?.token) {
    warn('This project already has a token on this machine.');
    detail('Continuing replaces it with a fresh one for your account.');
    say();
  }

  const deviceId = newDeviceId();
  const url = installUrl(serverUrl, { deviceId, projectName, workspaceId: config.workspaceId });

  const skipBrowser = options.noBrowser || process.env.REMNUS_NO_BROWSER === '1';
  step(skipBrowser ? 'Open this link to sign in:' : 'Opening your browser to sign in…');
  detail(url);
  if (!skipBrowser && !openBrowser(url)) {
    warn('Could not open a browser automatically — open the link above.');
  }
  say();
  step('Waiting for you to finish in the browser…');

  const result = await waitForInstall(serverUrl, deviceId, { command: 'join' });

  if (result.status === 'requested') {
    say();
    ok('Your request was sent to the workspace owner.');
    say();
    step('Nothing is connected yet — this project is waiting on their approval.');
    say(dim(`Once they approve, run ${bold('npx remnus join')} again and you are in.`));
    say(dim('No files in this project were changed.'));
    return 0;
  }

  if (result.status === 'denied') {
    say();
    warn('The workspace owner declined this request.');
    if (result.retryAt) {
      const when = new Date(result.retryAt);
      if (!Number.isNaN(when.getTime())) detail(`You can ask again after ${when.toLocaleDateString()}.`);
    }
    say();
    detail('Talk to whoever owns this workspace — nothing in this project was changed.');
    return 1;
  }

  if (!result.token) {
    throw new Error('The server did not return a token for this project. Please try again.');
  }
  // A token minted for a different workspace than this project's config names would
  // fail on the first call with a 403. Catch it here, where the message can be useful.
  if (result.workspaceId && result.workspaceId !== config.workspaceId) {
    throw new Error(
      'The browser step connected a different workspace than this project is configured for. Run `npx remnus doctor` to see what this project expects.',
    );
  }

  writeCredentials(root, {
    token: result.token,
    workspaceId: config.workspaceId,
    serverUrl,
  });

  say();
  ok(`Connected as yourself to ${bold(result.workspaceName ?? config.workspaceName ?? config.workspaceId)}`);
  say();
  detail('.remnus/credentials.json  (git-ignored)');

  // A clone whose `.gitignore` lost the block (or never had it) would commit the
  // token on the next `git add .`. Cheap to check, expensive to miss.
  const gitignore = ensureGitignore(root, ignorePatternsFor(config));
  if (gitignore !== 'unchanged') detail(`.gitignore  (${gitignore})`);

  // Only when there is nothing there — see the header.
  if (!hasMcpEntry(root)) {
    const state = writeMcpConfig(root, defaultMcpEntry());
    if (state !== 'unchanged') detail(`.mcp.json  (${state})`);
  }

  if (result.replacedPrevious) {
    say();
    warn('Your previous token for this project was revoked.');
    detail('Each connected agent counts against the workspace owner\'s plan, so joining');
    detail('again replaces your old one instead of stacking up. Other machines of yours');
    detail('using that old token will need `npx remnus join` again.');
  }

  if (result.scope === 'read') {
    say();
    warn('This connection is read-only.');
    detail('Your role in this workspace does not allow writing, so the agent can read');
    detail('pages and databases but not change them.');
  }

  say();
  step('Reload MCP servers in any agent session that was already running.');
  say(dim('Agents load MCP servers when a session starts. In Claude Code, run /mcp and reconnect'));
  say(dim('remnus, or start a new session — until then that session has no Remnus tools.'));

  if (config.calibrated) {
    say();
    step('This workspace is already set up for this project.');
    say(dim('Do not run the calibration guide again — it is a one-time step and it has'));
    say(dim('already been done. Read what is there instead of rebuilding it.'));
  }

  say();
  say(dim(`Run ${bold('npx remnus open')} to see the workspace, or ${bold('npx remnus doctor')} to check the connection.`));
  return 0;
}
