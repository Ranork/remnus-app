import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
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
  writeAgentSection,
  writeCalibrationGuide,
  writeMcpConfig,
} from '../lib/files.js';
import { installUrl, newDeviceId, openBrowser, waitForInstall } from '../lib/install.js';
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
 */
function mcpEntryFor(config, { direct }) {
  if (!direct) {
    return { command: 'npx', args: ['-y', 'remnus', 'mcp'] };
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

function renderTemplate(name, values) {
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
  if (existing?.workspaceId) {
    warn(`This project is already connected to ${bold(existing.workspaceName ?? existing.workspaceId)}.`);
    detail('Continuing will replace that connection with a new one.');
    say();
  }

  const deviceId = newDeviceId();
  const url = installUrl(serverUrl, { deviceId, projectName, authMode });

  step(`Connecting ${bold(projectName)} to Remnus`);
  detail(root);
  say();
  // Headless boxes, CI and anyone who would rather click the link themselves.
  const skipBrowser = options.noBrowser || process.env.REMNUS_NO_BROWSER === '1';
  step(skipBrowser ? 'Open this link to sign in:' : 'Opening your browser to sign in…');
  detail(url);
  if (!skipBrowser && !openBrowser(url)) {
    warn('Could not open a browser automatically — open the link above.');
  }
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
    calibrated: false,
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

    const gitignore = ensureGitignore(root, ['.remnus/credentials.json']);
    if (gitignore !== 'unchanged') detail(`.gitignore  (${gitignore})`);
  }

  const mcpState = writeMcpConfig(root, mcpEntryFor(config, { direct: options.http }));
  if (mcpState !== 'unchanged') detail(`.mcp.json  (${mcpState})`);

  const calibrateState = writeCalibrationGuide(root, renderTemplate('calibrate.md', {}));
  if (calibrateState !== 'unchanged') detail(`.remnus/calibrate.md  (${calibrateState})`);

  const section = renderTemplate('agents-section.md', {
    WORKSPACE_NAME: config.workspaceName,
    WORKSPACE_ID: config.workspaceId,
    MCP_URL: config.mcpUrl,
    SCOPE: config.scope ?? 'set when the agent connects',
  });

  for (const docName of detectAgentDocs(root)) {
    const state = writeAgentSection(root, docName, section);
    if (state !== 'unchanged') detail(`${docName}  (${state})`);
  }

  say();
  if (options.http && authMode === 'pat') {
    warn('With --http the token is read from the REMNUS_TOKEN environment variable.');
    detail('Set it in your shell before starting an agent, or re-run without --http.');
    say();
  }

  ok('Setup complete.');
  say();
  step('This project is not marked as set up yet.');
  say(dim(`A one-time setup guide is waiting at ${bold('.remnus/calibrate.md')} — it walks`));
  say(dim('whichever agent works in this project through reading the project and filling'));
  say(dim('the workspace in to match it. It is optional: point an agent at that file if'));
  say(dim('you want that done, or use the workspace empty and skip it.'));
  say();
  say(dim(`Check the connection any time with ${bold('npx remnus doctor')}.`));
}
