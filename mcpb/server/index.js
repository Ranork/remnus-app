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
 */
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

log(`launcher start: node=${process.version} platform=${process.platform} execPath=${process.execPath} url=${MCP_URL} proxy=${proxyPath}`);

process.on('uncaughtException', (err) => {
  log(`uncaught exception: ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  log(`unhandled rejection: ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});

// proxy.js is an ESM module whose top-level code parses process.argv and runs
// immediately on import — so we set argv to what it expects (as if it had been
// invoked directly as `node proxy.js <url> --static-oauth-client-metadata <json>`)
// before importing it. It installs its own signal handlers and talks over our real
// process.stdin/process.stdout — nothing further to wire up on our end.
process.argv = [process.execPath, proxyPath, MCP_URL, '--static-oauth-client-metadata', STATIC_OAUTH_CLIENT_METADATA];

import(pathToFileURL(proxyPath).href).catch((err) => {
  log(`proxy import/run failed: ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
