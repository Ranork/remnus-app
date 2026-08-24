'use server';
import { db } from '@/db';
import { users, workspaces, workspaceMembers, demoSessions } from '@/db/schema';
import { eq, ne, and, lt } from 'drizzle-orm';
import { encode } from '@auth/core/jwt';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { createDemoSeedData } from '@/lib/seed';

// Each "Try the demo" click provisions its OWN throwaway demo account
// (`demo+<uuid>@remnus.com`, role 'demo') with a freshly seeded workspace.
// Visitors never share data, so concurrent demos can't reset or overwrite each
// other. Stale demo accounts are reaped opportunistically on later logins.
const DEMO_EMAIL_DOMAIN = 'remnus.com';

// How long a demo account lives before it's eligible for cleanup.
const DEMO_USER_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
// Cap the work done per login so a flood of demos can't make one request slow.
const DEMO_CLEANUP_LIMIT = 25;

// Delete a demo user and everything they own. Workspaces have no FK to the user
// (ownership lives in workspace_members), so they must be removed explicitly via
// the membership rows; the user delete then cascades sessions/accounts/members.
async function purgeDemoUser(userId: string) {
  const memberships = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId));

  for (const { workspaceId } of memberships) {
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  }
  await db.delete(users).where(eq(users.id, userId));
}

// Best-effort reaper for expired demo accounts. Runs inline on demo login so we
// don't need any cron/background infra. Bounded + per-user guarded so one bad
// row never blocks a new visitor from starting their demo.
async function cleanupStaleDemoUsers(exceptUserId?: string) {
  const cutoff = new Date(Date.now() - DEMO_USER_TTL_MS);
  const stale = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, 'demo'), lt(users.createdAt, cutoff)))
    .limit(DEMO_CLEANUP_LIMIT);

  for (const { id } of stale) {
    if (id === exceptUserId) continue;
    try {
      await purgeDemoUser(id);
    } catch {
      // ignore — a single failed cleanup must not block the demo login
    }
  }
}

export async function loginAsDemo(_prevState: unknown, _formData: FormData): Promise<{ error: string } | null> {
  // If the visitor already holds a live demo session with a workspace, just send
  // them back into it — don't mint a new account or reseed on every click/refresh.
  // (Raw auth() instead of getCurrentUser() so an absent session doesn't redirect.)
  const session = await auth();
  if (session?.user?.id && session.user.role === 'demo') {
    const existing = await db
      .select({ id: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, session.user.id))
      .limit(1);
    if (existing.length > 0) redirect('/app');
  }

  // Require at least one real (non-demo) user to exist before enabling demo mode
  const realUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(ne(users.role, 'demo'))
    .limit(1);

  if (realUsers.length === 0) {
    return { error: 'Demo mode is not available yet. Please create an account first.' };
  }

  // Reap expired demo accounts so the table doesn't grow unbounded.
  await cleanupStaleDemoUsers(session?.user?.id);

  // Provision a fresh, isolated demo account for this visitor.
  const demoUserId = crypto.randomUUID();
  const demoName = 'Demo User';
  await db.insert(users).values({
    id: demoUserId,
    name: demoName,
    email: `demo+${demoUserId}@${DEMO_EMAIL_DOMAIN}`,
    role: 'demo',
    createdAt: new Date(),
  });

  // Seed this visitor's own workspace (pages + databases).
  await createDemoSeedData(demoUserId, demoName);

  // Durable usage log — this account gets reaped in 6h (and its user_sessions
  // rows with it), so the admin panel's demo history has to be written to a
  // table that survives the purge. Best-effort: a failed insert must never cost
  // the visitor their demo. The /api/activity/ping heartbeat takes it from here
  // and accumulates `activeSeconds` onto this row.
  try {
    const startedAt = new Date();
    await db.insert(demoSessions).values({
      userId: demoUserId,
      startedAt,
      lastSeenAt: startedAt,
      activeSeconds: 0,
    });
  } catch {
    // ignore — analytics must not block the demo
  }

  // Create a session JWT directly — bypasses Auth.js HTTP route and its CSRF check.
  // Calling signIn() from a server action makes an internal POST to /api/auth/signin
  // which requires a CSRF token that isn't present in server-side contexts.
  const isProd = process.env.NODE_ENV === 'production';
  const cookieName = isProd ? '__Secure-authjs.session-token' : 'authjs.session-token';
  const secret = process.env.AUTH_SECRET!;

  const sessionToken = await encode({
    token: {
      sub: demoUserId,
      name: demoName,
      email: `demo+${demoUserId}@${DEMO_EMAIL_DOMAIN}`,
      id: demoUserId,
      role: 'demo',
    },
    secret,
    salt: cookieName,
  });

  const cookieStore = await cookies();
  cookieStore.set(cookieName, sessionToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect('/app');
}
