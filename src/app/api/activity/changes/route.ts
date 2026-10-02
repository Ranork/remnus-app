import { NextResponse } from 'next/server';
import { getSessionAllowingWorkspaceLock } from '@/lib/auth/session';
import { lockClaimsOf } from '@/lib/auth/workspaceLock';
import { changeSignalForUser, signalExtras } from '@/lib/services/changeVersion';

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
// window — scoped to the one workspace their lock allows (`changeSignalForUser`).
// Besides `v`: `n` (visible workspace count) and, only while `v`'s second is still
// open, `h: 1` — see `signalExtras`.
export async function GET() {
  const session = await getSessionAllowingWorkspaceLock();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ v: 0 }, { status: 401 });

  let body: { v: number; n?: number; h?: 1 } = { v: 0 };
  try {
    // One statement: membership, every branch's maximum and the workspace count.
    const { version: v, count } = await changeSignalForUser(userId, lockClaimsOf(session.user).workspaceLock ?? null);
    body = { v, ...signalExtras(v, count) };
  } catch {
    // Best-effort: a failed tick means "no refresh this time", never an error
    // the user sees. `v: 0` (and no `n`) can only ever compare as "no advance".
  }

  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
