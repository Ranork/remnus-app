import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Signed-in project windows. `open` trades this project's token for a single-use, 60-second
// sign-in link, then opens it in a browser profile of its own, so the window arrives already
// signed in — to this project's workspace and nothing else (the server locks that session to
// the workspace).

const WORKSPACE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TICKET_TIMEOUT_MS = 8000;

/**
 * A browser profile per workspace, in the user's app-data directory — never inside the
 * project, since it is an entire browser profile.
 *
 * Its own cookie jar is the point: the window's workspace-locked session never replaces the
 * session in the user's everyday browser profile, and two projects' windows never overwrite
 * each other's sign-in. Returns null if the directory can't be created.
 */
export function windowProfileDir(workspaceId) {
  if (!WORKSPACE_ID_RE.test(workspaceId ?? '')) return null;

  const dir = path.join(userDataDir(), 'windows', workspaceId);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    return null;
  }
  return dir;
}

/** This CLI's per-user directory (never inside a project): window profiles, personal settings. */
function userDataDir() {
  let base;
  if (process.platform === 'win32') {
    base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  } else if (process.platform === 'darwin') {
    base = path.join(os.homedir(), 'Library', 'Application Support');
  } else {
    base = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  }
  return path.join(base, 'remnus');
}

/**
 * Whether a browser is already running on this profile — i.e. the project window is open.
 *
 * Launching Chromium again on a profile that is in use does not fail: the running browser
 * takes the arguments over and opens *another* `--app` window. With the SessionStart hook
 * calling `open` on every fresh agent session, that stacked up one window per session.
 *
 * Chromium's own profile lock says whether it is in use. On Windows that is `lockfile`,
 * held open without sharing while the browser runs (EBUSY), and deleted on exit. Elsewhere
 * it is the `SingletonLock` symlink to `<host>-<pid>`, which can outlive a crash, so the
 * process is checked too.
 */
export function isWindowOpen(profileDir) {
  if (!profileDir) return false;
  if (process.platform === 'win32') {
    try {
      fs.closeSync(fs.openSync(path.join(profileDir, 'lockfile'), 'r+'));
      return false;
    } catch (err) {
      return err?.code === 'EBUSY' || err?.code === 'EPERM';
    }
  }
  let target;
  try {
    target = fs.readlinkSync(path.join(profileDir, 'SingletonLock'));
  } catch {
    return false;
  }
  const dash = target.lastIndexOf('-');
  const host = target.slice(0, dash);
  const pid = Number.parseInt(target.slice(dash + 1), 10);
  if (!pid) return false;
  // Held from another machine (a shared home directory): Chromium itself would refuse it.
  if (host !== os.hostname()) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err?.code === 'EPERM';
  }
}

// ── Where `open` opens ───────────────────────────────────────────────────────
//
// A personal choice, so it lives in this person's own settings file and never in the
// committed `.remnus/config.json` — a teammate's preference must not travel with the repo.
// `REMNUS_OPEN` overrides it for one shell.

export const OPEN_MODES = ['auto', 'desktop', 'window', 'browser', 'off'];

function settingsFile() {
  return path.join(userDataDir(), 'settings.json');
}

function readSettings() {
  try {
    const parsed = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** `{ mode, source }` — source is 'env', 'saved' or 'default'. */
export function openPreference() {
  const env = (process.env.REMNUS_OPEN ?? '').trim().toLowerCase();
  if (OPEN_MODES.includes(env)) return { mode: env, source: 'env' };
  const saved = readSettings().open;
  if (OPEN_MODES.includes(saved)) return { mode: saved, source: 'saved' };
  return { mode: 'auto', source: 'default' };
}

export function saveOpenPreference(mode) {
  const file = settingsFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ ...readSettings(), open: mode }, null, 2)}\n`, 'utf8');
}

/**
 * Asks the configured server for a sign-in link. Never throws — `open` falls back to an
 * ordinary, not-signed-in window on any failure.
 *
 * Resolves to `{ url }`, or `{ error }` with one of:
 *   'rejected'    — the token was revoked, expired, or unknown;
 *   'forbidden'   — the token can't open a window (read-only, or no longer a member);
 *   'unavailable' — offline, or a Remnus server that predates project windows.
 *
 * The server answers with a path, joined here onto `serverUrl`, so the CLI never follows a
 * sign-in link to an origin other than the one this project is configured for. Redirects are
 * not followed: a login-page redirect means the endpoint isn't there.
 */
export async function requestWindowSignIn(config, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TICKET_TIMEOUT_MS);

  try {
    const res = await fetch(`${config.serverUrl}/api/window/ticket`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ workspaceId: config.workspaceId }),
      redirect: 'manual',
      signal: controller.signal,
    });

    if (res.status === 401) return { error: 'rejected' };
    if (res.status === 403) return { error: 'forbidden' };
    if (!res.ok) return { error: 'unavailable' };

    const body = await res.json().catch(() => null);
    const signInPath = body?.path;
    if (typeof signInPath !== 'string' || !signInPath.startsWith('/api/window/activate?')) {
      return { error: 'unavailable' };
    }
    return { url: `${config.serverUrl}${signInPath}` };
  } catch {
    return { error: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}
