import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

// Edge-compatible auth config (no DB imports — safe for middleware)
export const authConfig: NextAuthConfig = {
  providers: [Google],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;

      // Strip locale prefix (e.g. /en/login → /login) so auth checks work
      // regardless of whether next-intl has already rewritten the path.
      const cleanPath = path.replace(/^\/[a-z]{2}(\/|$)/, '/');

      const isAuthRoute = cleanPath.startsWith('/login') || cleanPath.startsWith('/register');
      const isApiAuth = cleanPath.startsWith('/api/auth');
      const isPublicAsset = /\.(png|ico|svg|jpg|jpeg|webp|woff2?)$/.test(path);
      const isMarketingRoute =
        cleanPath === '/' ||
        cleanPath.startsWith('/pricing') ||
        cleanPath.startsWith('/contact');
      const isMcpRoute = cleanPath.startsWith('/api/mcp');
      if (isApiAuth || isMcpRoute || isPublicAsset) return true;

      if (isMarketingRoute) return true;

      if (isAuthRoute) {
        // Logged-in users visiting /login or /register are sent to home
        if (isLoggedIn) return Response.redirect(new URL('/', nextUrl));
        return true;
      }

      if (!isLoggedIn) return false; // triggers redirect to /login
      return true;
    },
  },
};
