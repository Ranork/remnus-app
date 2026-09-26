import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Opening a project in the Remnus desktop app, when one is installed.
//
// The desktop app runs the person's own, full session — not the workspace-locked one a
// project window gets — so it is where Remnus should open when it is there. It learns
// which workspace from `remnus://open?workspace=<id>` (src-tauri/src/lib.rs), a route the
// app understands only from DESKTOP_OPEN_MIN_VERSION on. An older app would take the
// link, find nothing it knows, and just come to the front on whatever it was showing —
// so the version is read before the link is sent, and an app whose version can't be read
// is treated as too old (unless the person asked for the desktop app by name).

export const DESKTOP_OPEN_MIN_VERSION = '0.1.19';

const WORKSPACE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** One string value from the Windows registry, or null. `name` omitted = the default value. */
function regValue(key, name) {
  const res = spawnSync('reg.exe', ['query', key, ...(name ? ['/v', name] : ['/ve'])], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 3000,
  });
  if (res.status !== 0 || !res.stdout) return null;
  // `    DisplayVersion    REG_SZ    0.1.18` — the value name is localized for the default
  // value ("(Default)", "(Varsayılan)"…), the type token is not.
  const line = res.stdout.split(/\r?\n/).find((l) => /\sREG_(?:EXPAND_)?SZ\s/.test(l));
  return line ? line.replace(/^.*?\sREG_(?:EXPAND_)?SZ\s+/, '').trim() || null : null;
}

/**
 * The Tauri NSIS installer registers the scheme per user under
 * `HKCU\Software\Classes\remnus` (`"<install dir>\remnus-app.exe" "%1"`) and its version as
 * `DisplayVersion` of the `Uninstall\Remnus` key; a per-machine install writes the same
 * under HKLM. The exe must still exist — an uninstall can leave the class key behind.
 */
function findWindows() {
  for (const hive of ['HKCU', 'HKLM']) {
    const command = regValue(`${hive}\\Software\\Classes\\remnus\\shell\\open\\command`);
    if (!command) continue;
    const exe = command.match(/^"([^"]+)"/)?.[1] ?? command.split(/\s+/)[0];
    if (!exe || !fs.existsSync(exe)) continue;
    const version = regValue(`${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Remnus`, 'DisplayVersion');
    return { exe, version };
  }
  return null;
}

/** macOS registers the scheme from the bundle's Info.plist, which also carries the version. */
function findMac() {
  for (const dir of ['/Applications', path.join(os.homedir(), 'Applications')]) {
    let plist;
    try {
      plist = fs.readFileSync(path.join(dir, 'Remnus.app', 'Contents', 'Info.plist'), 'utf8');
    } catch {
      continue;
    }
    if (!/<string>remnus<\/string>/.test(plist)) continue;
    const version = plist.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/)?.[1] ?? null;
    return { version };
  }
  return null;
}

/** Linux: whether anything handles the scheme. There is no reliable version to read. */
function findLinux() {
  const res = spawnSync('xdg-mime', ['query', 'default', 'x-scheme-handler/remnus'], { encoding: 'utf8', timeout: 3000 });
  return res.status === 0 && res.stdout.trim() ? { version: null } : null;
}

/** The installed desktop app as `{ version, exe? }`, or null when there is none. Never throws. */
export function findDesktopApp() {
  try {
    if (process.platform === 'win32') return findWindows();
    if (process.platform === 'darwin') return findMac();
    return findLinux();
  } catch {
    return null;
  }
}

function versionParts(version) {
  return String(version).split(/[.+-]/).slice(0, 3).map((n) => Number.parseInt(n, 10) || 0);
}

/** Whether this installed app knows the `remnus://open` route. */
export function desktopKnowsOpen(app) {
  if (!app?.version) return false;
  const have = versionParts(app.version);
  const need = versionParts(DESKTOP_OPEN_MIN_VERSION);
  for (let i = 0; i < 3; i += 1) {
    if (have[i] !== need[i]) return have[i] > need[i];
  }
  return true;
}

/**
 * Hands the workspace to the desktop app. On Windows the exe is started directly with the
 * link as its only argument — exactly what the protocol handler would run: a running app
 * receives it through its single-instance handoff, a closed one starts with it.
 */
export function openInDesktop(app, workspaceId) {
  if (!app || !WORKSPACE_ID_RE.test(workspaceId ?? '')) return false;
  const link = `remnus://open?workspace=${workspaceId}`;
  try {
    let child;
    if (process.platform === 'win32') {
      child = spawn(app.exe, [link], { detached: true, stdio: 'ignore' });
    } else {
      child = spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [link], { detached: true, stdio: 'ignore' });
    }
    // A failed spawn is reported as an event, not a throw; unhandled, it would crash.
    child.on('error', () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}
