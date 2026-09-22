// One JSON-RPC call to this project's workspace-pinned endpoint, for the CLI's own
// requests (the map refresh, `doctor`). The bridge in commands/mcp.js does not use
// this: it forwards the agent's messages verbatim and has its own error contract.
//
// The endpoint is stateless (no session id), so a single request needs no
// `initialize` before it — every POST is complete on its own.

const DEFAULT_TIMEOUT_MS = 15000;

/** Server-Sent Events fallback: the server answers plain JSON, but the transport is
 *  allowed to stream, and a streamed reply must not be dropped. */
export function* parseSseData(text) {
  for (const block of text.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('');
    if (data) yield data;
  }
}

export class RpcError extends Error {
  constructor(message, { status = null, code = null } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Sends `method` with `params` and returns the JSON-RPC `result`. Throws an
 * `RpcError` carrying the HTTP status (401/403 are the ones callers look at) or
 * the JSON-RPC error code.
 */
export async function callRpc(mcpUrl, token, method, params, { timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const res = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });

    if (!res.ok) throw new RpcError(`Remnus returned HTTP ${res.status}.`, { status: res.status });

    const contentType = res.headers.get('content-type') ?? '';
    const body = await res.text();
    const raw = contentType.includes('text/event-stream') ? [...parseSseData(body)].pop() : body;
    if (!raw) throw new RpcError('Remnus returned an empty reply.');

    const parsed = JSON.parse(raw);
    if (parsed.error) {
      throw new RpcError(parsed.error.message ?? 'Remnus returned an error.', { code: parsed.error.code ?? null });
    }
    return parsed.result;
  } catch (err) {
    if (err instanceof RpcError) throw err;
    throw new RpcError(err?.name === 'AbortError' ? 'timed out' : (err?.message ?? String(err)));
  } finally {
    clearTimeout(timer);
  }
}
