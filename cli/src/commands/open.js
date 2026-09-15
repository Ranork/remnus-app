import { findProjectRoot, readConfig, readCredentials } from '../lib/project.js';
import { hasAppWindowBrowser, openAppWindow } from '../lib/install.js';
import { requestWindowSignIn, windowProfileDir } from '../lib/window.js';
import { bold, detail, fail, ok, say, warn } from '../lib/ui.js';

// Opens this project's workspace as its own window. With a project token and a
// Chromium-family browser, the window arrives already signed in — to this workspace only.
// Otherwise it opens the plain workspace link and the web app's normal login handles the
// rest. This command still does not diagnose the connection; that's `doctor`.
export async function openCommand() {
  const root = findProjectRoot(process.cwd());
  const config = readConfig(root);

  if (!config?.workspaceId) {
    fail('This project is not connected to Remnus.');
    detail('Run `npx remnus init` in the project directory.');
    return 1;
  }

  const workspaceUrl = `${config.serverUrl}/w/${config.workspaceId}`;
  say(`${bold('Workspace')} ${config.workspaceName ?? config.workspaceId}`);
  detail(workspaceUrl);

  if (await openSignedInWindow(root, config)) {
    ok('Opened, signed in to this workspace.');
    return 0;
  }

  if (openAppWindow(workspaceUrl)) {
    ok('Opened.');
  } else {
    say('Could not open a browser automatically — open the link above.');
  }
  return 0;
}

async function openSignedInWindow(root, config) {
  // `--oauth` projects keep no token here, and without a Chromium-family browser there's no
  // separate profile to put the signed-in session in.
  if (config.authMode === 'oauth' || !hasAppWindowBrowser()) return false;

  const credentials = readCredentials(root);
  if (!credentials?.token) return false;

  const profileDir = windowProfileDir(config.workspaceId);
  if (!profileDir) return false;

  const result = await requestWindowSignIn(config, credentials.token);
  if (result.error === 'rejected') {
    warn('Remnus rejected this project\'s token, so the window will ask you to sign in.');
    detail('Run `npx remnus doctor` to see what to fix.');
    return false;
  }
  if (result.error === 'forbidden') {
    warn('This project\'s token can\'t open a signed-in window, so the window will ask you to sign in.');
    detail('Read-only project tokens, and accounts no longer in the workspace, can\'t open one.');
    return false;
  }
  // 'unavailable' is deliberately quiet: offline, or a Remnus server that predates signed-in
  // project windows — the ordinary window below is exactly what `open` used to do.
  if (result.error) return false;

  return openAppWindow(result.url, { profileDir });
}
