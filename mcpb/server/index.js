#!/usr/bin/env node
/**
 * Remnus .mcpb launcher.
 *
 * Claude Desktop runs this with its bundled Node over stdio. We run the bundled
 * `mcp-remote` proxy IN-PROCESS (not as a spawned child) to bridge stdio <-> the
 * Remnus remote MCP server (Streamable HTTP) and run the OAuth 2.1 + PKCE browser
 * flow on the first 401 — dynamic client registration against /api/oauth/* (localhost
 * redirect is allowed by the register endpoint). No token to paste.
 *
 * Why in-process, not a spawned child (Windows-specific, found the hard way): on
 * Windows, `process.execPath` here can be Claude Desktop's own Electron binary
 * (Claude.exe) running in Node mode, not a standalone node.exe — confirmed via
 * diagnostic logging. `ELECTRON_RUN_AS_NODE` is cleared from `process.env` once
 * Electron consumes it, so it does not survive plain inheritance into a spawned
 * child; even re-adding it explicitly to the child's env did not help (this Claude
 * Desktop install is MSIX-packaged, under Program Files\WindowsApps, which adds its
 * own app-container/single-instance restrictions on top). The net effect: spawning
 * `process.execPath` as a grandchild reliably died within ~50ms with no output,
 * before any of the proxy's own code ever ran. mcp-remote's proxy.js is written to
 * run as the main process anyway — it reads `process.argv` directly and talks over
 * `process.stdin`/`process.stdout` — so there was never a real need for a second OS
 * process, only for a second module scope, which a dynamic `import()` gives us
 * without any of the above.
 *
 * Canonical host is www: the apex (remnus.com) 307-redirects to www.remnus.com,
 * so the OAuth protected-resource metadata reports www. mcp-remote requires the
 * resource indicator to match the URL it was given, so we must hand it www.
 *
 * Robustness: the URL may arrive via argv (from `${user_config.server_url}`) or
 * the REMNUS_MCP_URL env. If a host's manifest-variable substitution misfires
 * and leaves a non-URL (e.g. a literal "${user_config.server_url}"), we fall
 * back to the production www endpoint instead of handing mcp-remote garbage.
 *
 * Windows multi-instance sign-in coordination (the "Unable to connect to extension
 * server" bug): recent Claude Desktop builds start this server more than once at the
 * same moment — one for the desktop chat, one for the shared pool that Cowork and
 * Code sessions use, plus a short-lived "era probe". While no token is on disk, every
 * one of those instances 401s and then tries to open mcp-remote's OAuth callback
 * server on the SAME port: the port is derived from the server URL hash
 * (3335 + hash % 45816) and, once a client is registered, is pinned to the port baked
 * into the registered redirect_uri, so there is no fallback to a free port.
 * mcp-remote guards this with a lockfile — but explicitly skips that check on win32
 * (`process.platform === 'win32' ? null : await checkLockfile(...)`), so on Windows
 * the instances race, the losers die of an unhandled EADDRINUSE, and whichever window
 * lost is left showing a disconnected extension. We restore the missing coordination
 * here: the first instance to take our lock runs the browser flow, the others wait for
 * its token to land and then start without ever touching the port. Once a token
 * exists this is all skipped — mcp-remote only binds the port on a 401.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DEFAULT_URL = 'https://www.remnus.com/api/mcp';

function pickUrl() {
  const candidates = [process.env.REMNUS_MCP_URL, process.argv[2]];
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c.trim())) return c.trim();
  }
  return DEFAULT_URL;
}

// Diagnostics: mirror everything to a log file so failures inside Claude Desktop
// (whose own log doesn't always surface stderr in a debuggable way) are debuggable.
const LOG_PATH = path.join(os.homedir(), '.remnus-mcpb.log');
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}\n`;
  try { fs.appendFileSync(LOG_PATH, stamped); } catch { /* ignore */ }
  try { process.stderr.write(stamped); } catch { /* ignore */ }
}

const MCP_URL = pickUrl();
const proxyPath = require.resolve('mcp-remote/dist/proxy.js');

// Identify the dynamically-registered OAuth client as "Claude" so Remnus can show
// the Claude brand icon for this connection (mcp-remote otherwise registers under a
// generic "MCP CLI Proxy" name). mcp-remote merges this metadata into the RFC 7591
// registration body, overriding its default client_name.
const STATIC_OAUTH_CLIENT_METADATA = JSON.stringify({ client_name: 'Claude' });

// mcp-remote namespaces its OAuth state by getServerUrlHash(), which is md5 of the
// server URL alone when no extra headers and no authorize-resource are passed (we
// pass neither). The files live in
// <MCP_REMOTE_CONFIG_DIR|~/.mcp-auth>/mcp-remote-<version>/, so we scan every version
// directory instead of pinning the one this bundle happens to ship with.
const SERVER_URL_HASH = crypto.createHash('md5').update(MCP_URL).digest('hex');
const AUTH_BASE_DIR = process.env.MCP_REMOTE_CONFIG_DIR || path.join(os.homedir(), '.mcp-auth');
const LOCK_PATH = path.join(AUTH_BASE_DIR, `remnus-launch-${SERVER_URL_HASH}.lock`);

/** A lock this old, or one whose owner is gone, is treated as abandoned. */
const LOCK_STALE_MS = 3 * 60 * 1000;
/** Deliberately longer than the host's own initialize timeout: if someone takes that
 *  long in the browser we would rather the host cancel us cleanly than have us give
 *  up early and crash into the port the leader is still holding. */
const FOLLOWER_WAIT_MS = 90 * 1000;
const POLL_MS = 400;

function hasTokens() {
  try {
    for (const entry of fs.readdirSync(AUTH_BASE_DIR)) {
      if (!entry.startsWith('mcp-remote-')) continue;
      if (fs.existsSync(path.join(AUTH_BASE_DIR, entry, `${SERVER_URL_HASH}_tokens.json`))) return true;
    }
  } catch { /* no auth dir yet — same thing as no token */ }
  return false;
}

function ownerAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means the pid does exist, we just may not signal it.
    return Boolean(err) && err.code === 'EPERM';
  }
}

function lockIsStale() {
  try {
    const raw = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
    if (!raw || typeof raw.pid !== 'number' || typeof raw.at !== 'number') return true;
    return Date.now() - raw.at > LOCK_STALE_MS || !ownerAlive(raw.pid);
  } catch {
    // Missing, unreadable or half-written: treat as abandoned rather than deadlock.
    return true;
  }
}

let holdsLock = false;

function acquireLock(allowStaleTakeover = true) {
  try { fs.mkdirSync(AUTH_BASE_DIR, { recursive: true }); } catch { /* ignore */ }
  try {
    // 'wx' is an atomic create-if-absent, which is what makes this an actual lock.
    fs.writeFileSync(LOCK_PATH, JSON.stringify({ pid: process.pid, at: Date.now() }), { flag: 'wx' });
    holdsLock = true;
    return true;
  } catch (err) {
    if (!err || err.code !== 'EEXIST') {
      // Read-only or otherwise unusable lock location: never block sign-in over it.
      log(`lock: could not be created (${err && err.code}), proceeding without coordination`);
      return true;
    }
    if (allowStaleTakeover && lockIsStale()) {
      log('lock: found an abandoned lock, taking it over');
      try { fs.unlinkSync(LOCK_PATH); } catch { /* raced with the owner's own cleanup */ }
      return acquireLock(false);
    }
    return false;
  }
}

function releaseLock() {
  if (!holdsLock) return;
  holdsLock = false;
  try { fs.unlinkSync(LOCK_PATH); } catch { /* already gone */ }
}

/** Resolves 'promoted' if we ended up taking the lock ourselves, true if the leader's
 *  token landed, false if we ran out of patience. */
function waitForTokens(timeoutMs) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      if (hasTokens()) return resolve(true);
      // Leader died without ever authenticating: take over instead of waiting it out.
      if (lockIsStale()) return resolve(acquireLock() ? 'promoted' : false);
      if (Date.now() >= deadline) return resolve(false);
      // Deliberately NOT unref'd: nothing else holds the event loop open while we
      // wait (the proxy has not started and nothing reads stdin yet), so an unref'd
      // timer would let the process exit 0 — which the host reads as a crashed
      // server, the exact symptom this coordination exists to prevent.
      setTimeout(tick, POLL_MS);
    };
    tick();
  });
}

log(`launcher start: node=${process.version} platform=${process.platform} execPath=${process.execPath} url=${MCP_URL} proxy=${proxyPath}`);

process.on('uncaughtException', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    log(`fatal: OAuth callback port ${err.port} is held by another Remnus instance, so this one cannot run the sign-in flow. Restart Claude once the other instance has finished signing in.`);
  } else {
    log(`uncaught exception: ${err && err.stack ? err.stack : err}`);
  }
  releaseLock();
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  log(`unhandled rejection: ${err && err.stack ? err.stack : err}`);
  releaseLock();
  process.exit(1);
});
process.once('exit', releaseLock);
process.once('SIGINT', () => { releaseLock(); process.exit(0); });
process.once('SIGTERM', () => { releaseLock(); process.exit(0); });

async function coordinateSignIn() {
  // Steady state: a token is on disk, mcp-remote never 401s, no port is ever bound.
  if (hasTokens()) return;

  if (acquireLock()) {
    log('sign-in: this instance runs the browser flow (holds the lock)');
    // Drop the lock as soon as the token lands, so a later instance is never blocked
    // behind our still-running process and a failed flow cannot pin the lock either.
    const watcher = setInterval(() => {
      if (!hasTokens()) return;
      clearInterval(watcher);
      releaseLock();
    }, POLL_MS);
    watcher.unref();
    return;
  }

  log('sign-in: another instance holds the lock, waiting for its token before starting');
  const outcome = await waitForTokens(FOLLOWER_WAIT_MS);
  if (outcome === 'promoted') log('sign-in: the other instance gave up, running the browser flow here instead');
  else if (outcome) log('sign-in: token arrived from the other instance, starting');
  else log('sign-in: timed out waiting for the other instance, starting anyway');
}

// proxy.js is an ESM module whose top-level code parses process.argv and runs
// immediately on import — so we set argv to what it expects (as if it had been
// invoked directly as `node proxy.js <url> --static-oauth-client-metadata <json>`)
// before importing it. It installs its own signal handlers and talks over our real
// process.stdin/process.stdout — nothing further to wire up on our end. Nothing has
// attached a stdin listener yet, so the host's buffered `initialize` survives the
// coordination wait in the pipe and is read once the proxy starts.
coordinateSignIn()
  .then(() => {
    process.argv = [process.execPath, proxyPath, MCP_URL, '--static-oauth-client-metadata', STATIC_OAUTH_CLIENT_METADATA];
    return import(pathToFileURL(proxyPath).href);
  })
  .catch((err) => {
    log(`proxy import/run failed: ${err && err.stack ? err.stack : err}`);
    releaseLock();
    process.exit(1);
  });
