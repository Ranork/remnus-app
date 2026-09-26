import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { detail, step, warn } from './ui.js';

export function newDeviceId() {
  return randomUUID();
}

/**
 * The browser URL for either flow.
 *
 * `workspaceId` is what turns the page into the `join` screen: it names the
 * workspace this project already belongs to, so the person is not asked to pick
 * one. It is **not** a credential — it comes out of a committed file — and the
 * server re-checks membership on every request regardless of what is in this URL.
 */
export function installUrl(serverUrl, { deviceId, projectName, authMode, workspaceId, issuedAt }) {
  const params = new URLSearchParams({ device_id: deviceId, project: projectName });
  if (authMode === 'oauth') params.set('mode', 'oauth');
  if (workspaceId) params.set('workspace', workspaceId);
  // Lets the page say "this link has expired" instead of minting a token that no
  // terminal is waiting for any more. Display logic only, never a credential.
  if (issuedAt) params.set('issued', String(Math.floor(issuedAt / 1000)));
  return `${serverUrl}/install?${params.toString()}`;
}

/**
 * The server's clock, read from the `Date` header of one cheap poll. The link's age is
 * judged by the server, so it has to be stamped in server time — a laptop clock that
 * is a few minutes off would otherwise open a fresh link as "expired". Null when the
 * server can't be reached; the link then simply carries no stamp.
 */
export async function serverTime(serverUrl, deviceId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${serverUrl}/api/install/poll?device_id=${encodeURIComponent(deviceId)}`, {
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      signal: controller.signal,
    });
    await res.text();
    const at = Date.parse(res.headers.get('date') ?? '');
    return Number.isNaN(at) ? null : at;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Opens the sign-in page in the user's default browser.
 *
 * Best-effort by design: headless boxes, SSH sessions and locked-down desktops have
 * nothing to open. The URL is always printed as well, so a failure here costs the
 * user a copy-paste rather than the whole install.
 */
export function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      // Quoted through cmd's `start`, whose first quoted argument is the window title —
      // hence the empty "". The quotes around the URL matter: an unquoted `&` would be
      // read by cmd as a command separator and truncate the query string.
      spawn('cmd.exe', ['/c', `start "" "${url}"`], {
        windowsVerbatimArguments: true,
        detached: true,
        stdio: 'ignore',
      }).unref();
      return true;
    }
    const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawn(opener, [url], { detached: true, stdio: 'ignore' }).unref();
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens the sign-in page and says so, for `init` and `join` alike.
 *
 * When the browser opened, the link is still printed, but labelled as a fallback: a
 * successful spawn does not prove a window appeared (WSL, a remote desktop, an
 * `xdg-open` with no handler), and hiding the link would leave that person staring at
 * a five-minute wait with nothing to click. The label is also for an agent running
 * this command — it reads the output only after the browser step is over, and must
 * not hand the link back to the human as something still to do.
 */
export function openSignInPage(url, { skipBrowser }) {
  if (skipBrowser) {
    step('Open this link to sign in:');
    detail(url);
    return;
  }
  if (openBrowser(url)) {
    step('Opened the sign-in page in your browser.');
    detail(`Only if no browser window appeared: ${url}`);
    return;
  }
  warn('Could not open a browser automatically — open this link to sign in:');
  detail(url);
}

/** Absolute path to Edge or Chrome on Windows, or null if neither is installed
 *  where we'd expect. Both ship a `--app` mode; no reason to prefer one over
 *  whichever the machine actually has. */
function findChromiumWindows() {
  const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean);
  const relatives = [
    ['Microsoft', 'Edge', 'Application', 'msedge.exe'],
    ['Google', 'Chrome', 'Application', 'chrome.exe'],
  ];
  for (const rel of relatives) {
    for (const root of roots) {
      const candidate = path.join(root, ...rel);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/** macOS `.app` bundle name for Edge or Chrome, or null if neither is in /Applications. */
function findChromiumMac() {
  return ['Microsoft Edge', 'Google Chrome'].find((name) => fs.existsSync(`/Applications/${name}.app`)) ?? null;
}

/** First Chromium-family browser found on PATH (Linux), or null. */
function findChromiumLinux() {
  const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const name of names) {
    for (const dir of dirs) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * Whether `openAppWindow` can open a real app window on this machine rather than falling back
 * to a tab. `open` only signs a window in when this is true: a sign-in link that fell back into
 * the user's everyday browser profile would land in the wrong cookie jar.
 */
export function hasAppWindowBrowser() {
  if (process.platform === 'win32') return Boolean(findChromiumWindows());
  if (process.platform === 'darwin') return Boolean(findChromiumMac());
  return Boolean(findChromiumLinux());
}

/**
 * Opens a URL as its own minimal window — no tabs, no address bar, no toolbar —
 * instead of a tab in whatever the default browser is. Chrome/Edge's `--app` mode
 * is the lightest way to get something that reads as "an app opened", not "a
 * browser tab opened": no new dependency, no native binary to ship, unlike a real
 * embedded-webview wrapper (see the gotcha below).
 *
 * Firefox and Safari have no equivalent app-mode flag, so this only fires for a
 * detected Chromium browser and falls straight back to `openBrowser` (a normal
 * tab) otherwise — never worse than before, just not always the nicer window.
 */
export function openAppWindow(url, { profileDir } = {}) {
  const args = [`--app=${url}`];
  // With a profile directory the window runs in its own browser profile (see lib/window.js).
  // In that mode there is no tab fallback: the URL is a sign-in link, and it must never be
  // opened in the everyday profile instead.
  if (profileDir) args.push(`--user-data-dir=${profileDir}`, '--no-first-run', '--no-default-browser-check');
  const fallback = () => (profileDir ? false : openBrowser(url));

  try {
    if (process.platform === 'win32') {
      const exe = findChromiumWindows();
      if (!exe) return fallback();
      spawn(exe, args, { detached: true, stdio: 'ignore' }).unref();
      return true;
    }
    if (process.platform === 'darwin') {
      const app = findChromiumMac();
      if (!app) return fallback();
      spawn('open', ['-na', app, '--args', ...args], { detached: true, stdio: 'ignore' }).unref();
      return true;
    }
    const exe = findChromiumLinux();
    if (!exe) return fallback();
    spawn(exe, args, { detached: true, stdio: 'ignore' }).unref();
    return true;
  } catch {
    return fallback();
  }
}

/**
 * Poll fast while the user is most likely to be finishing the browser step, then
 * back off. A flat 2s put up to two seconds of dead air between "approved" in the
 * browser and the terminal moving on — the one moment of the install the person is
 * actually watching. Backing off afterwards keeps a walked-away install from
 * hammering the server for the full five minutes.
 */
const POLL_SCHEDULE = [
  { untilMs: 60 * 1000, intervalMs: 750 },
  { untilMs: 3 * 60 * 1000, intervalMs: 2000 },
];
const POLL_INTERVAL_MAX_MS = 3000;
/** The server stops accepting a link five minutes after it was issued. The extra seconds
 *  pick up an approval that landed in the last moment, between two polls. */
const POLL_TIMEOUT_MS = 5 * 60 * 1000 + 15 * 1000;

const pollIntervalAt = (elapsedMs) =>
  POLL_SCHEDULE.find((step) => elapsedMs < step.untilMs)?.intervalMs ?? POLL_INTERVAL_MAX_MS;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Waits for the browser side to finish, then returns the workspace (and, in the
 * default mode, its token) exactly once.
 *
 * Transient network failures are swallowed and retried: a laptop that slept, a Wi-Fi
 * hiccup or a redeploy mid-wait should not abandon an install the user is in the
 * middle of approving. Only the deadline ends the wait.
 */
export async function waitForInstall(serverUrl, deviceId, { signal, command = 'init' } = {}) {
  const url = `${serverUrl}/api/install/poll?device_id=${encodeURIComponent(deviceId)}`;
  const startedAt = Date.now();
  const deadline = startedAt + POLL_TIMEOUT_MS;
  let warnedOffline = false;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
        signal,
      });
      if (res.ok) {
        const body = await res.json();
        if (body?.ready) return body;
        warnedOffline = false;
      }
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      if (!warnedOffline) {
        warnedOffline = true;
        warn(`Could not reach ${serverUrl} — still waiting.`);
        detail(err?.message ?? String(err));
      }
    }
    await sleep(pollIntervalAt(Date.now() - startedAt));
  }

  // Names the command the caller actually ran: telling someone who ran `join` to
  // run `init` would send them to the one screen they must not use.
  throw new Error(
    `Timed out waiting for the browser step. The link is valid for five minutes — run \`remnus ${command}\` again for a fresh one.`,
  );
}
