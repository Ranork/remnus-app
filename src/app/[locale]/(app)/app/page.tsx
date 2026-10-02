import { redirect } from 'next/navigation';
import { getSessionAllowingWorkspaceLock } from '@/lib/auth/session';
import { resolveAppEntry } from '@/lib/server/appEntry';

// `/app` — the gateway every app open passes through (`/` and `/login` send a signed-in
// visitor here; so do sign-in callbacks, the desktop app and checkout).
//
// A redirecting SERVER-COMPONENT PAGE, not a route handler. V2 R9 made this a route
// handler to skip the `(app)` shell render on the redirect hop, but a route handler is
// only a correct redirect target for a HARD navigation: on a SOFT navigation (a server
// action's `redirect('/app')` — e.g. `loginAsDemo` — or `router.push('/app')` /
// `<Link href="/app">`) Next left the browser URL on `/app` while rendering the
// destination's RSC, so every server action on that screen then POSTed to `/app` (GET-only)
// and got 405. A page's server-side `redirect()` resolves the URL correctly on both hard
// and soft navigation. It reads cookies only (never writes), so unlike `/w/[id]` it does
// not need a route handler. The small shell-render cost on the redirect hop is the
// deliberate trade for that correctness.
export default async function AppEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const session = await getSessionAllowingWorkspaceLock();
  if (!session?.user) redirect('/login');

  // Preserve the post-checkout flag through the redirect so the success modal can show.
  const { billing } = await searchParams;
  redirect(await resolveAppEntry(session.user.id, { suffix: billing === 'success' ? '?billing=success' : '' }));
}
