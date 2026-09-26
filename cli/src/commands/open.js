import { findProjectRoot, readConfig, readCredentials } from '../lib/project.js';
import { hasAppWindowBrowser, openAppWindow, openBrowser } from '../lib/install.js';
import { desktopKnowsOpen, DESKTOP_OPEN_MIN_VERSION, findDesktopApp, openInDesktop } from '../lib/desktop.js';
import {
  isWindowOpen,
  OPEN_MODES,
  openPreference,
  requestWindowSignIn,
  saveOpenPreference,
  windowProfileDir,
} from '../lib/window.js';
import { bold, detail, fail, ok, say, warn } from '../lib/ui.js';

// Shows this project's workspace, in the first of these that works:
//
//   1. the Remnus desktop app, when it is installed and new enough — the person's own full
//      session, the workspace opened in it (a tab, not another window);
//   2. a project window: an app window in a browser profile of its own, signed in to this
//      workspace only (needs the project token and a Chromium-family browser). One per
//      project — if it is already open, nothing new is opened;
//   3. the workspace link in an ordinary window, where the web app's own login takes over.
//
// `--prefer desktop|window|browser|auto|off` saves a personal choice (see lib/window.js);
// `off` only stops the SessionStart hook, a hand-typed `open` still opens.
//
// `--hook` is how the SessionStart hook runs it. Claude Code adds a hook's **stdout** to the
// new session's context (stderr only reaches its debug log), so in that mode this command
// may say one thing to the agent there — and only while setup has a step to go.
// This command still does not diagnose the connection; that's `doctor`.
export async function openCommand(options = {}) {
  if (options.hook) {
    // A hook that fails shows up as an error notice at the top of every new session, and
    // nothing here is worth that. Whatever goes wrong, the session starts clean.
    try {
      return await openProject({ hook: true });
    } catch {
      return 0;
    }
  }

  if (options.prefer) {
    const mode = String(options.prefer).toLowerCase();
    if (!OPEN_MODES.includes(mode)) {
      fail(`Unknown choice: ${options.prefer}. Use one of: ${OPEN_MODES.join(', ')}.`);
      return 1;
    }
    saveOpenPreference(mode);
    ok(`Saved for this computer: ${bold(mode)}.`);
    if (mode === 'off') {
      detail('New agent sessions will no longer open Remnus. `npx remnus open` still does.');
      return 0;
    }
  }

  return openProject({ hook: false });
}

async function openProject({ hook }) {
  const root = findProjectRoot(process.cwd());
  const config = readConfig(root);

  if (!config?.workspaceId) {
    if (hook) return 0;
    fail('This project is not connected to Remnus.');
    detail('Run `npx remnus init` in the project directory.');
    return 1;
  }

  if (hook) printSessionContext(config);

  const { mode } = openPreference();
  if (hook && mode === 'off') return 0;

  const workspaceUrl = `${config.serverUrl}/w/${config.workspaceId}`;
  say(`${bold('Workspace')} ${config.workspaceName ?? config.workspaceId}`);

  if (mode === 'browser') {
    say(openBrowser(workspaceUrl) ? 'Opened in your browser.' : `Could not open a browser automatically — open ${workspaceUrl}`);
    return 0;
  }

  if (mode !== 'window') {
    const app = findDesktopApp();
    // An explicit `desktop` choice trusts an app whose version can't be read (Linux).
    if (app && (desktopKnowsOpen(app) || (mode === 'desktop' && !app.version))) {
      if (openInDesktop(app, config.workspaceId)) {
        ok('Opened in the Remnus desktop app.');
        return 0;
      }
    } else if (app) {
      detail(`The Remnus desktop app here is older than ${DESKTOP_OPEN_MIN_VERSION}; update it to open projects there.`);
    } else if (mode === 'desktop') {
      warn('The Remnus desktop app was not found on this computer — opening a window instead.');
    }
  }

  const signedIn = await openSignedInWindow(root, config);
  if (signedIn === 'already-open') {
    ok('This project\'s window is already open.');
    return 0;
  }
  if (signedIn === 'opened') {
    ok('Opened, signed in to this workspace.');
    // That window runs in a browser profile of its own, and a page has no way to hand a
    // link to the OS default browser. Printing the address here is the one reliable way
    // for someone to carry on in the browser they actually use.
    detail(`For your own browser and the rest of your account: ${workspaceUrl}`);
    return 0;
  }

  if (openAppWindow(workspaceUrl)) {
    ok('Opened.');
  } else {
    say(`Could not open a browser automatically — open ${workspaceUrl}`);
  }
  return 0;
}

/**
 * The only thing the hook tells a new agent session, on stdout: that setup has a second
 * step, and where it is — so a human who opens a new chat and says "continue the Remnus
 * setup" (the prompt `init` hands them) gets exactly that. Every fresh session pays for
 * these lines, so they stay few, and once the project is calibrated there are none.
 * Deliberately no link the agent could relay to the human: none of them is a next step.
 */
function printSessionContext(config) {
  if (config.calibrated === true) return;
  const guide = `${String(config.serverUrl).replace(/\/+$/, '')}/wiki/calibrate.md`;
  process.stdout.write(
    'Remnus: this project is connected to its Remnus workspace, but step 2 of the setup ' +
      '(calibration: reading the project into the workspace) has not run yet. If the human ' +
      `asks to continue or finish the Remnus setup, in any language, follow ${guide} ` +
      '(read the whole file, e.g. with curl). Do not start it unasked.\n',
  );
}

async function openSignedInWindow(root, config) {
  // `--oauth` projects keep no token here, and without a Chromium-family browser there's no
  // separate profile to put the signed-in session in.
  if (config.authMode === 'oauth' || !hasAppWindowBrowser()) return false;

  const credentials = readCredentials(root);
  if (!credentials?.token) return false;

  const profileDir = windowProfileDir(config.workspaceId);
  if (!profileDir) return false;
  // Checked before asking for a sign-in link: there is nothing to sign in, and a second
  // launch on this profile would only add another window.
  if (isWindowOpen(profileDir)) return 'already-open';

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

  return openAppWindow(result.url, { profileDir }) ? 'opened' : false;
}
