import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { detail, warn } from './ui.js';

export function newDeviceId() {
  return randomUUID();
}

export function installUrl(serverUrl, { deviceId, projectName, authMode }) {
  const params = new URLSearchParams({ device_id: deviceId, project: projectName });
  if (authMode === 'oauth') params.set('mode', 'oauth');
  return `${serverUrl}/install?${params.toString()}`;
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

const POLL_INTERVAL_MS = 2000;
/** Matches the server's own install-session lifetime; waiting longer cannot succeed. */
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Waits for the browser side to finish, then returns the workspace (and, in the
 * default mode, its token) exactly once.
 *
 * Transient network failures are swallowed and retried: a laptop that slept, a Wi-Fi
 * hiccup or a redeploy mid-wait should not abandon an install the user is in the
 * middle of approving. Only the deadline ends the wait.
 */
export async function waitForInstall(serverUrl, deviceId, { signal } = {}) {
  const url = `${serverUrl}/api/install/poll?device_id=${encodeURIComponent(deviceId)}`;
  const deadline = Date.now() + POLL_TIMEOUT_MS;
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
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    'Timed out waiting for the browser step. The setup link is valid for five minutes — run `remnus init` again for a fresh one.',
  );
}
