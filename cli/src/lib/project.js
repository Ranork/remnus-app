import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** This CLI's own version, read from its package.json — used to pin `.mcp.json`'s
 *  `npx` invocation so a compromised or broken future release doesn't silently run
 *  in every already-connected project the next time an MCP client restarts. */
export const CLI_VERSION = JSON.parse(
  fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json'), 'utf8'),
).version;

export const DEFAULT_SERVER_URL = 'https://www.remnus.com';

export const REMNUS_DIR = '.remnus';
export const CONFIG_FILE = 'config.json';
export const CREDENTIALS_FILE = 'credentials.json';

/**
 * Where this project's Remnus files live.
 *
 * An agent's working directory is often a subdirectory of the project, so walk up:
 * an existing `.remnus/config.json` wins, then the repository root, then give up and
 * use the directory we were called from. `remnus init` always uses the cwd itself —
 * only the commands that *read* an existing install search upward.
 */
export function findProjectRoot(startDir = process.cwd()) {
  let dir = path.resolve(startDir);

  for (;;) {
    if (fs.existsSync(path.join(dir, REMNUS_DIR, CONFIG_FILE))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  dir = path.resolve(startDir);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return path.resolve(startDir);
}

/** Display name for the project — the directory name, cleaned up for a URL and a title. */
export function projectNameFor(dir) {
  const base = path.basename(path.resolve(dir)).trim();
  return base.slice(0, 60) || 'project';
}

export function configPath(root) {
  return path.join(root, REMNUS_DIR, CONFIG_FILE);
}

export function credentialsPath(root) {
  return path.join(root, REMNUS_DIR, CREDENTIALS_FILE);
}

export function readConfig(root) {
  const file = configPath(root);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${file} is not valid JSON (${err.message}). Fix or delete it, then run \`remnus init\` again.`);
  }
}

export function writeConfig(root, config) {
  const dir = path.join(root, REMNUS_DIR);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath(root), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

export function readCredentials(root) {
  const file = credentialsPath(root);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Writes the token with owner-only permissions. `mode` on the `writeFileSync` call
 * only applies when the file is *created*, so an existing file is chmod'ed too —
 * otherwise a re-install would silently keep whatever permissions were there before.
 * Both are no-ops on Windows, where ACL inheritance governs instead.
 */
export function writeCredentials(root, credentials) {
  const dir = path.join(root, REMNUS_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const file = credentialsPath(root);
  fs.writeFileSync(file, `${JSON.stringify(credentials, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Windows / unusual filesystems — nothing to enforce here.
  }
}

/** Trailing slashes make `${base}/api/...` produce a double slash; strip them once. */
export function normalizeServerUrl(url) {
  return String(url).trim().replace(/\/+$/, '');
}
