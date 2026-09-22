import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

import { findProjectRoot, readConfig, readCredentials } from '../lib/project.js';
import { refreshWorkspaceMap } from '../lib/map.js';
import { parseSseData } from '../lib/rpc.js';
import { detail, fail, warn } from '../lib/ui.js';

// The MCP server an agent actually talks to. It is a thin bridge: JSON-RPC arrives on
// stdin, goes to this project's workspace-pinned HTTPS endpoint, and the reply goes
// back out on stdout. Nothing but protocol bytes may ever touch stdout (see lib/ui.js).
//
// The bridge exists so the project's .mcp.json can be committed without a secret in
// it, so the token and OAuth modes look identical to the agent, and so there is one
// place that notices the connection is broken and says which command fixes it.
//
// Because every message passes through here, it is also where the local workspace
// map (`.remnus/workspace-map.md`, see lib/map.js) is kept fresh: once at start-up,
// and again after every write tool call that succeeds. Both happen off to the side
// — a separate HTTPS request whose result goes to the file, never to stdout.

const DEFAULT_PROTOCOL_VERSION = '2025-06-18';

// Writes are learned from the tools/list reply (`readOnlyHint: false`), so a tool
// added server-side later counts without a CLI release. This list only covers the
// window before that reply has been seen.
const KNOWN_WRITE_TOOLS = new Set([
  'create_page', 'update_page', 'bulk_create_pages', 'bulk_update_pages', 'delete_page',
  'bulk_delete_pages', 'move_item', 'bulk_move_items', 'create_database',
  'update_database_schema', 'create_database_view', 'update_database_view',
  'delete_database_view', 'add_comment',
]);
// A burst of writes (a bulk fill, an agent editing several pages) becomes one refresh.
const MAP_REFRESH_DEBOUNCE_MS = 1500;

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

/** Only a request (something with an id) may be answered; a notification must not be. */
function replyWithError(request, code, message) {
  if (request?.id === undefined || request?.id === null) return;
  writeMessage({ jsonrpc: '2.0', id: request.id, error: { code, message } });
}

function missingInstall(root) {
  return new Error(
    `No Remnus setup found in ${root}. Run \`npx remnus init\` in your project directory first (or \`npx remnus join\` if a teammate has already connected it).`,
  );
}

export async function mcpCommand() {
  const root = findProjectRoot(process.cwd());
  const config = readConfig(root);
  if (!config?.mcpUrl) throw missingInstall(root);

  if (config.authMode === 'oauth') return runOAuthBridge(config);

  const credentials = readCredentials(root);
  if (!credentials?.token) {
    // `init` would be the wrong advice here. The project *is* connected — its
    // committed config says so — and only this person's credentials file is
    // missing, which is exactly the state a fresh clone starts in. `join` writes
    // that one file; `init` would offer to replace the whole connection.
    throw new Error(
      `This project's Remnus token is missing (${root}/.remnus/credentials.json). Run \`npx remnus join\` to get your own.`,
    );
  }

  return runTokenBridge(root, config, credentials.token);
}

/**
 * Keeps `.remnus/workspace-map.md` current from inside the bridge. Best-effort by
 * design: the map is a cache, the agent is told so in its header, and a failed
 * refresh must never turn into a failed tool call. One warning per process at most.
 */
function createMapRefresher(root, config, token) {
  let timer = null;
  let inFlight = false;
  let dirty = false;
  let reported = false;

  const run = async () => {
    timer = null;
    if (inFlight) { dirty = true; return; }
    inFlight = true;
    try {
      await refreshWorkspaceMap(root, config, token);
    } catch (err) {
      if (!reported) {
        reported = true;
        warn(`Could not refresh .remnus/workspace-map.md: ${err?.message ?? err}`);
      }
    } finally {
      inFlight = false;
      if (dirty) { dirty = false; schedule(0); }
    }
  };

  const schedule = (delayMs) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, delayMs);
    // A pending refresh must not keep the process alive once the client has gone.
    timer.unref?.();
  };

  return { schedule, cancel: () => { if (timer) clearTimeout(timer); timer = null; } };
}

function runTokenBridge(root, config, token) {
  let protocolVersion = null;
  // One 401/403 is worth shouting about; repeating it once per call would bury the
  // agent's own output in noise.
  let reportedAuthFailure = false;

  const map = createMapRefresher(root, config, token);
  const writeTools = new Set(KNOWN_WRITE_TOOLS);
  // tools/call requests by id, so the reply can be matched back to a tool name.
  const pendingCalls = new Map();
  let learnedTools = false;

  // A fresh map for the first turn of this session; the agent may already be reading it.
  map.schedule(0);

  const rl = createInterface({ input: process.stdin });

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let message;
    try {
      message = JSON.parse(trimmed);
    } catch {
      warn('Ignored a line from the client that was not valid JSON.');
      return;
    }

    if (message?.method === 'tools/call' && message.id !== undefined && message.id !== null) {
      pendingCalls.set(message.id, message.params?.name);
    }

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${token}`,
    };
    if (protocolVersion) headers['MCP-Protocol-Version'] = protocolVersion;

    try {
      const res = await fetch(config.mcpUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
      });

      if (res.status === 401 || res.status === 403) {
        if (!reportedAuthFailure) {
          reportedAuthFailure = true;
          fail(
            res.status === 401
              ? 'Remnus rejected this project\'s token — it was revoked or has expired.'
              : 'This project\'s token does not belong to the workspace it is configured for.',
          );
          // `join`, not `init`: the project's connection is fine, this person's
          // credential is not. `init` on an already-connected project now hands
          // over to `join` anyway, but saying the right command saves a detour.
          detail('Run `npx remnus join` in this project to get a fresh token.');
        }
        replyWithError(
          message,
          -32001,
          res.status === 401
            ? 'Remnus rejected this project\'s token. Run `npx remnus join` to get a fresh one.'
            : 'This token belongs to a different workspace. Run `npx remnus join` to get a fresh one.',
        );
        return;
      }

      // 202/204: an accepted notification. There is nothing to hand back.
      if (res.status === 202 || res.status === 204) return;

      const contentType = res.headers.get('content-type') ?? '';
      const body = await res.text();
      if (!body) return;

      if (contentType.includes('text/event-stream')) {
        for (const data of parseSseData(body)) process.stdout.write(`${data}\n`);
        return;
      }

      if (!res.ok) {
        replyWithError(message, -32000, `Remnus returned HTTP ${res.status}.`);
        return;
      }

      const parsed = JSON.parse(body);
      if (message?.method === 'initialize' && parsed?.result?.protocolVersion) {
        protocolVersion = parsed.result.protocolVersion || DEFAULT_PROTOCOL_VERSION;
      }
      writeMessage(parsed);
      reportedAuthFailure = false;

      // Learn which tools write from the server's own annotations, then refresh the
      // map after each write that the server reports as having succeeded.
      if (message?.method === 'tools/list' && Array.isArray(parsed?.result?.tools)) {
        if (!learnedTools) { writeTools.clear(); learnedTools = true; }
        for (const tool of parsed.result.tools) {
          if (tool?.annotations?.readOnlyHint === false) writeTools.add(tool.name);
        }
      }
      const calledTool = pendingCalls.get(message?.id);
      if (calledTool !== undefined) {
        pendingCalls.delete(message.id);
        if (writeTools.has(calledTool) && !parsed?.error && !parsed?.result?.isError) {
          map.schedule(MAP_REFRESH_DEBOUNCE_MS);
        }
      }
    } catch (err) {
      // Leaving a request unanswered hangs the agent, so a transport failure is
      // reported back through the protocol as well as to the terminal.
      fail(`Could not reach Remnus: ${err?.message ?? err}`);
      replyWithError(message, -32003, `Could not reach Remnus: ${err?.message ?? err}`);
    }
  });

  return new Promise((resolve) => {
    rl.on('close', () => { map.cancel(); resolve(); });
  });
}

/**
 * OAuth mode: the credential belongs to the MCP client, not to this project, so the
 * bridging is handed to `mcp-remote`, which runs the browser flow on the first 401 and
 * stores its own tokens — keyed by our workspace-pinned URL, so two projects never
 * share one.
 */
function runOAuthBridge(config) {
  const child = spawn('npx', ['-y', 'mcp-remote', config.mcpUrl], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  return new Promise((resolve, reject) => {
    child.on('error', (err) => reject(new Error(`Could not start mcp-remote: ${err.message}`)));
    child.on('exit', (code) => (code === 0 || code === null ? resolve() : reject(new Error(`mcp-remote exited with code ${code}.`))));
  });
}
