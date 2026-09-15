import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import type { DefaultSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { users, accounts, sessions, verificationTokens, workspaces, workspaceMembers } from '@/db/schema';
import { eq, ne } from 'drizzle-orm';
import { authConfig } from './auth.config';
import { createSeedWorkspace } from '@/lib/seed';
import { cookies } from 'next/headers';
import { captureServer, isCaptureAllowedFromRequest } from '@/lib/analytics/server';
import { sendWelcomeEmailTo } from '@/lib/email/lifecycle';
import { consumeWindowTicket } from '@/lib/services/windowTicket';
import { WINDOW_SESSION_TTL_MS } from '@/lib/auth/workspaceLock';

// ── Type augmentation ─────────────────────────────────────────────────────────

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      /** Set only on a project-window session — see src/lib/auth/workspaceLock.ts. */
      workspaceLock?: string | null;
      workspaceLockTokenId?: string | null;
      workspaceLockExpiresAt?: number | null;
    } & DefaultSession['user'];
  }
  interface User {
    role?: string;
    // Nullable to match Session.user: Auth.js intersects the two for the session callback.
    workspaceLock?: string | null;
    workspaceLockTokenId?: string | null;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id?: string;
    role?: string;
    workspaceLock?: string;
    workspaceLockTokenId?: string;
    workspaceLockExpiresAt?: number;
  }
}

// ── Auth config ───────────────────────────────────────────────────────────────

export const { handlers, auth: authWithWorkspaceLock, signIn, signOut, unstable_update: update } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: 'jwt' },
  providers: [
    ...authConfig.providers,
    // Desktop OAuth flow: system browser authenticates, server issues a short-lived JWT,
    // Tauri deep-link callback exchanges it here for a full session.
    Credentials({
      id: 'client-token',
      credentials: { token: { type: 'text' } },
      async authorize({ token }) {
        if (!token || typeof token !== 'string') return null;
        try {
          const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
          const { payload } = await jwtVerify(token, secret, { audience: 'client-auth' });
          if (!payload.sub) return null;
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, payload.sub))
            .limit(1);
          if (!user) return null;
          return { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role };
        } catch {
          return null;
        }
      },
    }),
    // Project window (`npx remnus open`): the CLI trades the project's write token for a
    // single-use ticket, and the window redeems it here for a session LOCKED to that project's
    // workspace. See src/lib/auth/workspaceLock.ts for what the lock allows.
    Credentials({
      id: 'workspace-window',
      credentials: { ticket: { type: 'text' } },
      async authorize({ ticket }) {
        if (!ticket || typeof ticket !== 'string') return null;
        const pending = await consumeWindowTicket(ticket);
        if (!pending) return null;
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, pending.userId))
          .limit(1);
        if (!user) return null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          workspaceLock: pending.workspaceId,
          workspaceLockTokenId: pending.tokenId,
        };
      },
    }),
  ],
  callbacks: {
    // Gate OAuth sign-ins so that automatic account-linking (enabled via
    // `allowDangerousEmailAccountLinking`) only ever happens for a VERIFIED
    // email. This runs BEFORE @auth/core links/creates the account, so an
    // unverified or spoofable email can never be linked to an existing user.
    async signIn({ account, profile, user }) {
      // Non-OAuth flows (e.g. the `client-token` credentials provider) pass through.
      if (!account || (account.type !== 'oauth' && account.type !== 'oidc')) return true;

      if (account.provider === 'google') {
        // Google is OIDC; the ID token carries a trustworthy email_verified claim.
        return (profile as { email_verified?: boolean })?.email_verified === true;
      }

      if (account.provider === 'github') {
        // GitHub's basic profile omits verification status, so confirm the
        // signing-in email is a *verified* address on the account.
        const email = user.email?.toLowerCase();
        if (!email || !account.access_token) return false;
        try {
          const res = await fetch('https://api.github.com/user/emails', {
            headers: {
              Authorization: `Bearer ${account.access_token}`,
              Accept: 'application/vnd.github+json',
              'User-Agent': 'remnus-app',
            },
          });
          if (!res.ok) return false;
          const emails = (await res.json()) as Array<{ email: string; verified: boolean }>;
          const match = emails.find((e) => e.email.toLowerCase() === email);
          return match?.verified === true;
        } catch {
          return false;
        }
      }

      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      if (user?.id) {
        // Fetch fresh from DB so we get the role set by createUser event
        const [dbUser] = await db
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(eq(users.id, user.id));
        token.id = user.id;
        token.role = dbUser?.role ?? 'user';

        // Written on EVERY sign-in, not only a project-window one: a normal login in a browser
        // profile that previously held a project-window session must come out unlocked instead
        // of inheriting the old lock. Never read from `session` below — a client-sent session
        // update must not be able to set or clear it.
        const lockedTo = user.workspaceLock;
        if (account?.provider === 'workspace-window' && (!lockedTo || !user.workspaceLockTokenId)) {
          // Fail closed: a project-window sign-in that lost its lock on the way here must never
          // become a full account session.
          throw new Error('Project window sign-in is missing its workspace lock');
        }
        token.workspaceLock = lockedTo ?? undefined;
        token.workspaceLockTokenId = lockedTo ? (user.workspaceLockTokenId ?? undefined) : undefined;
        token.workspaceLockExpiresAt = lockedTo ? Date.now() + WINDOW_SESSION_TTL_MS : undefined;
      }
      // Profile self-edit (updateMyProfile → update({ user })): reflect the new
      // display name / avatar in the session without forcing a re-login.
      if (trigger === 'update' && session) {
        const next = ((session as { user?: Record<string, unknown> }).user ?? session) as {
          name?: string | null; image?: string | null; picture?: string | null;
        };
        if (next.name !== undefined) token.name = next.name;
        const nextImage = next.image !== undefined ? next.image : next.picture;
        if (nextImage !== undefined) token.picture = nextImage;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.workspaceLock = token.workspaceLock ?? null;
      session.user.workspaceLockTokenId = token.workspaceLockTokenId ?? null;
      session.user.workspaceLockExpiresAt = token.workspaceLockExpiresAt ?? null;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;

      // DrizzleAdapter uses CURRENT_TIMESTAMP SQL default which stores as text; fix to integer timestamp
      await db.update(users).set({ createdAt: new Date() }).where(eq(users.id, user.id));

      // Seed default workspace with tasks database and welcome page
      await createSeedWorkspace(user.id, user.name);

      // Count real (non-demo) users; if this is the first one, promote to admin and claim orphaned workspaces
      const allRealUsers = await db.select({ id: users.id }).from(users).where(ne(users.role, 'demo'));
      const isFirstUser = allRealUsers.length === 1;

      // Funnel: 'signup' (entry into activation). The first user becomes admin and
      // is skipped by captureServer. Attach the provider + first-touch attribution
      // (set once) so the funnel breaks down by channel.
      try {
        const [acc] = await db
          .select({ provider: accounts.provider })
          .from(accounts)
          .where(eq(accounts.userId, user.id))
          .limit(1);

        let setOnce: Record<string, unknown> | undefined;
        const firstTouchRaw = (await cookies()).get('remnus_first_touch')?.value;
        if (firstTouchRaw) {
          try {
            const ft = JSON.parse(decodeURIComponent(firstTouchRaw));
            setOnce = {
              initial_ref: ft.ref ?? null,
              initial_utm_source: ft.utm_source ?? null,
              initial_utm_medium: ft.utm_medium ?? null,
              initial_utm_campaign: ft.utm_campaign ?? null,
              initial_referrer: ft.referrer ?? null,
            };
            // Persist onto the user row too so the admin dashboard can report
            // acquisition channels without PostHog. Best-effort.
            await db
              .update(users)
              .set({
                signupRef: ft.ref ?? null,
                signupUtmSource: ft.utm_source ?? null,
                signupUtmMedium: ft.utm_medium ?? null,
                signupUtmCampaign: ft.utm_campaign ?? null,
                signupReferrer: ft.referrer ?? null,
              })
              .where(eq(users.id, user.id));
          } catch {
            // malformed cookie — skip attribution
          }
        }

        await captureServer({
          event: 'signup',
          userId: user.id,
          allowed: await isCaptureAllowedFromRequest(),
          role: isFirstUser ? 'admin' : 'user',
          properties: { provider: acc?.provider ?? null },
          setOnce,
        });
      } catch {
        // analytics is best-effort — never block account creation
      }

      // Welcome email (transactional). Awaited so the serverless invocation
      // doesn't freeze before SES accepts it; sendWelcomeEmailTo never throws.
      await sendWelcomeEmailTo(user.id);

      if (!isFirstUser) return;

      await db.update(users).set({ role: 'admin' }).where(eq(users.id, user.id));

      // Claim every workspace that has no members yet
      const allWorkspaces = await db.select({ id: workspaces.id }).from(workspaces);
      for (const ws of allWorkspaces) {
        const existing = await db
          .select({ id: workspaceMembers.id })
          .from(workspaceMembers)
          .where(eq(workspaceMembers.workspaceId, ws.id));
        if (existing.length === 0) {
          await db.insert(workspaceMembers).values({
            workspaceId: ws.id,
            userId: user.id,
            role: 'owner',
            createdAt: new Date(),
          });
          // Claim billing ownership too so the workspace is governed by this user's plan.
          await db.update(workspaces).set({ billingOwnerId: user.id }).where(eq(workspaces.id, ws.id));
        }
      }
    },
  },
});

// ── Session for everything that does not handle project windows ──────────────────────
//
// Deny by default: a workspace-locked project-window session reads as signed out here, so
// every direct `auth()` caller — API routes, admin pages, account actions, the Tauri sign-in
// bridge — refuses it without having to know project windows exist. The places that serve a
// project window use `getSessionAllowingWorkspaceLock()` from src/lib/auth/session.ts
// instead, which also re-validates the lock. Only that module calls `authWithWorkspaceLock`.
export async function auth() {
  const session = await authWithWorkspaceLock();
  if (session?.user?.workspaceLock) return null;
  return session;
}
