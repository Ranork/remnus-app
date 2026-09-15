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

  let base;
  if (process.platform === 'win32') {
    base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  } else if (process.platform === 'darwin') {
    base = path.join(os.homedir(), 'Library', 'Application Support');
  } else {
    base = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  }

  const dir = path.join(base, 'remnus', 'windows', workspaceId);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    return null;
  }
  return dir;
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
