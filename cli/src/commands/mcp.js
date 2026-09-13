import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

import { findProjectRoot, readConfig, readCredentials } from '../lib/project.js';
import { detail, fail, warn } from '../lib/ui.js';

// The MCP server an agent actually talks to. It is a thin bridge: JSON-RPC arrives on
// stdin, goes to this project's workspace-pinned HTTPS endpoint, and the reply goes
// back out on stdout. Nothing but protocol bytes may ever touch stdout (see lib/ui.js).
//
// The bridge exists so the project's .mcp.json can be committed without a secret in
// it, so the token and OAuth modes look identical to the agent, and so there is one
// place that notices the connection is broken and says which command fixes it.

const DEFAULT_PROTOCOL_VERSION = '2025-06-18';

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

/** Only a request (something with an id) may be answered; a notification must not be. */
function replyWithError(request, code, message) {
  if (request?.id === undefined || request?.id === null) return;
  writeMessage({ jsonrpc: '2.0', id: request.id, error: { code, message } });
}

/** Server-Sent Events fallback: the server normally answers with plain JSON, but the
 *  transport is allowed to stream, and a streamed reply must not be dropped. */
function* parseSseData(text) {
  for (const block of text.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('');
    if (data) yield data;
  }
}

function missingInstall(root) {
  return new Error(
    `No Remnus setup found in ${root}. Run \`npx remnus init\` in your project directory first.`,
  );
}

export async function mcpCommand() {
  const root = findProjectRoot(process.cwd());
  const config = readConfig(root);
  if (!config?.mcpUrl) throw missingInstall(root);

  if (config.authMode === 'oauth') return runOAuthBridge(config);

  const credentials = readCredentials(root);
  if (!credentials?.token) {
    throw new Error(
      `This project's Remnus token is missing (${root}/.remnus/credentials.json). Run \`npx remnus init\` to reconnect.`,
    );
  }

  return runTokenBridge(config, credentials.token);
}

function runTokenBridge(config, token) {
  let protocolVersion = null;
  // One 401/403 is worth shouting about; repeating it once per call would bury the
  // agent's own output in noise.
  let reportedAuthFailure = false;

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
          detail('Run `npx remnus init` in this project to reconnect.');
        }
        replyWithError(
          message,
          -32001,
          res.status === 401
            ? 'Remnus rejected this project\'s token. Run `npx remnus init` to reconnect.'
            : 'This token belongs to a different workspace. Run `npx remnus init` to reconnect.',
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
    } catch (err) {
      // Leaving a request unanswered hangs the agent, so a transport failure is
      // reported back through the protocol as well as to the terminal.
      fail(`Could not reach Remnus: ${err?.message ?? err}`);
      replyWithError(message, -32003, `Could not reach Remnus: ${err?.message ?? err}`);
    }
  });

  return new Promise((resolve) => {
    rl.on('close', resolve);
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
