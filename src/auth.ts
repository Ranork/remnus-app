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

// ── Type augmentation ─────────────────────────────────────────────────────────

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession['user'];
  }
  interface User {
    role?: string;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id?: string;
    role?: string;
  }
}

// ── Auth config ───────────────────────────────────────────────────────────────

export const { handlers, auth, signIn, signOut } = NextAuth({
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
    async jwt({ token, user }) {
      if (user?.id) {
        // Fetch fresh from DB so we get the role set by createUser event
        const [dbUser] = await db
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(eq(users.id, user.id));
        token.id = user.id;
        token.role = dbUser?.role ?? 'user';
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
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
      if (allRealUsers.length !== 1) return;

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
        }
      }
    },
  },
});
