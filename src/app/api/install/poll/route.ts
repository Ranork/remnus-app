// Polled by `remnus init` every couple of seconds while the user completes the
// browser step. Returns `{ ready: false }` until the install page's approval lands,
// then the workspace token exactly once.
//
// `Cache-Control: no-store` is not optional here: without it a proxy or the CLI's own
// fetch layer can memo-cache the first `{ ready: false }` and keep replaying it, which
// makes the install look like it hangs forever after the user already approved it —
// the same failure the desktop sign-in poll documents.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { consumeInstallResult } from '@/lib/services/installSession';

const NO_STORE = {
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
  'Content-Type': 'application/json; charset=utf-8',
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get('device_id');

  const result = deviceId ? await consumeInstallResult(deviceId) : null;
  if (!result) {
    return new Response(JSON.stringify({ ready: false }), { headers: NO_STORE });
  }

  // Rebuilt field by field rather than spread, so the internal `kind` discriminator
  // never leaks into the CLI's contract.
  return new Response(
    JSON.stringify({
      ready: true,
      // Defaulted rather than passed through: a CLI old enough to predate `join`
      // only ever receives `connected` results anyway, and a new CLI should not
      // have to distinguish "absent" from "connected".
      status: result.status ?? 'connected',
      token: result.token,
      workspaceId: result.workspaceId,
      workspaceName: result.workspaceName,
      scope: result.scope,
      mcpUrl: result.mcpUrl,
      replacedPrevious: result.replacedPrevious ?? false,
      role: result.role ?? null,
      retryAt: result.retryAt ?? null,
    }),
    { headers: NO_STORE },
  );
}
