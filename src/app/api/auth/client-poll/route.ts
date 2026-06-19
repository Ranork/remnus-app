import { consumeClientToken } from '@/lib/client-auth-store';

// Polled by the desktop client every 2 s after opening the browser login page.
// Returns { ready: true, token } once the user completes login, then clears the entry.
//
// `Cache-Control: no-store` is critical: without it, browsers / webviews can
// memo-cache the first `{ready: false}` GET response and keep returning it
// indefinitely — making the desktop login appear to "hang" even after the
// browser side finished.
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get('device_id');
  if (!deviceId) return Response.json({ ready: false }, { headers: NO_STORE });

  const token = await consumeClientToken(deviceId);
  if (!token) return Response.json({ ready: false }, { headers: NO_STORE });

  return Response.json({ ready: true, token }, { headers: NO_STORE });
}
