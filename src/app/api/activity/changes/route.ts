import { NextResponse } from 'next/server';
import { getSessionAllowingWorkspaceLock } from '@/lib/auth/session';
import { lockClaimsOf } from '@/lib/auth/workspaceLock';
import { changeVersionForUser } from '@/lib/services/changeVersion';

// The change signal, split out from the activity heartbeat.
//
// `/api/activity/ping` carries the same number, but every ping also writes a
// `user_sessions` row — fine at its 30s engagement cadence, wrong at the 2-3s
// cadence a project window needs to show an agent's writes as they land. This
// endpoint is the fast half: read-only, no session bookkeeping, and a response
// body of about twenty bytes.
//
// Deliberately tiny on the wire. The predecessor of this whole mechanism was an
// unconditional 10s `router.refresh()` poll that re-fetched the full RSC payload
// (~100 KB) every tick and became the dominant Vercel Fast Origin Transfer cost.
// Clients compare `v` for a monotonic increase and only then refresh; a tick
// where nothing changed must stay a few bytes. Don't grow this response.
//
// Project windows are served too — watching an agent work is the point of the
// window — scoped by `changeVersionForUser` to the one workspace their lock
// allows.
export async function GET() {
  const session = await getSessionAllowingWorkspaceLock();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ v: 0 }, { status: 401 });

  let v = 0;
  try {
    v = await changeVersionForUser(userId, lockClaimsOf(session.user).workspaceLock ?? null);
  } catch {
    // Best-effort: a failed tick means "no refresh this time", never an error
    // the user sees. `v: 0` can only ever compare as "no advance".
  }

  return NextResponse.json({ v }, { headers: { 'Cache-Control': 'no-store' } });
}
