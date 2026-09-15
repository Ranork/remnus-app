'use server';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import type { Session } from 'next-auth';
import { authWithWorkspaceLock } from '@/auth';
import { db } from '@/db';
import { agentTokens, workspaceMembers } from '@/db/schema';
import { lockClaimsOf, projectWindowDeniedError, type LockAwareSessionUser } from './workspaceLock';

export type SessionUser = {
  id: string;
  role: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

/**
 * A project-window session is only as good as the token that opened it. JWT sessions are
 * stateless, so without this a revoked or expired project token — or an account removed
 * from the workspace — would keep a window signed in until the cookie aged out.
 */
async function isWorkspaceLockStillValid(user: Session['user']): Promise<boolean> {
  const {
    workspaceLock: workspaceId,
    workspaceLockTokenId: tokenId,
    workspaceLockExpiresAt: expiresAt,
  } = lockClaimsOf(user);
  if (!workspaceId || !tokenId || typeof expiresAt !== 'number' || expiresAt < Date.now()) {
    return false;
  }

  const [token] = await db
    .select({ scope: agentTokens.scope, expiresAt: agentTokens.expiresAt })
    .from(agentTokens)
    .where(
      and(
        eq(agentTokens.id, tokenId),
        eq(agentTokens.workspaceId, workspaceId),
        eq(agentTokens.createdBy, user.id),
        isNull(agentTokens.revokedAt),
      ),
    )
    .limit(1);
  if (!token || token.scope !== 'write') return false;
  if (token.expiresAt && token.expiresAt.getTime() < Date.now()) return false;

  const [member] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id)))
    .limit(1);
  return Boolean(member);
}

// Memoized per-request: auth() and the lock check run at most once regardless of how many
// server actions run in the same render cycle.
const loadSession = cache(async (): Promise<Session | null> => {
  const session = await authWithWorkspaceLock();
  if (!session?.user?.id) return null;
  if (!lockClaimsOf(session.user).workspaceLock) return session;
  return (await isWorkspaceLockStillValid(session.user)) ? session : null;
});

/**
 * The signed-in user, for everything that has not opted in to project windows.
 * A workspace-locked session is refused here — deny by default, see workspaceLock.ts.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser> => {
  const session = await loadSession();
  if (!session?.user?.id) redirect('/login');
  if (lockClaimsOf(session.user).workspaceLock) throw await projectWindowDeniedError();
  return session.user as SessionUser;
});

/**
 * Like `getCurrentUser`, but also serves a project window. Callers MUST confine their work
 * with `assertWorkspaceLockAllows()` against the workspace they resolved, before any admin
 * shortcut.
 */
export const getCurrentUserAllowingWorkspaceLock = cache(async (): Promise<LockAwareSessionUser> => {
  const session = await loadSession();
  if (!session?.user?.id) redirect('/login');
  return {
    ...(session.user as SessionUser),
    workspaceLock: lockClaimsOf(session.user).workspaceLock ?? null,
  };
});

/**
 * The validated session, project windows included, or null — for server components and
 * route handlers that need the session object itself. Same obligations as above.
 */
export const getSessionAllowingWorkspaceLock = cache(async (): Promise<Session | null> => loadSession());
