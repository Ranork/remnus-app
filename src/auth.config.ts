import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';

// Edge-compatible auth config (no DB imports — safe for middleware)
export const authConfig: NextAuthConfig = {
  providers: [
    Google({ allowDangerousEmailAccountLinking: true }),
    GitHub({ allowDangerousEmailAccountLinking: true }),
  ],
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

      const isAuthRoute = cleanPath.startsWith('/login');
      const isClientLogin = cleanPath.startsWith('/client-login');
      const isApiAuth = cleanPath.startsWith('/api/auth');
      const isPublicAsset = /\.(png|ico|svg|jpg|jpeg|webp|woff2?)$/.test(path);
      const isRootRoute = cleanPath === '/';
      const isPublicMarketingRoute = cleanPath.startsWith('/pricing') || cleanPath.startsWith('/contact') || cleanPath.startsWith('/download');
      const isMcpRoute = cleanPath.startsWith('/api/mcp');
      const isTauriEntry = cleanPath.startsWith('/tauri-app');
      const isClientActivate = cleanPath.startsWith('/api/auth/client-activate');
      if (isApiAuth || isMcpRoute || isPublicAsset || isTauriEntry || isClientActivate) return true;

      // Public marketing pages (pricing, contact) are always accessible
      if (isPublicMarketingRoute) return true;

      // Root URL: logged-in users go to the app; guests see the landing page
      if (isRootRoute) {
        if (isLoggedIn) return Response.redirect(new URL('/app', nextUrl));
        return true;
      }

      // /client-login: if user is already logged in, skip the login UI and go straight to bridge
      if (isClientLogin) {
        if (isLoggedIn) {
          const deviceId = nextUrl.searchParams.get('device_id');
          if (deviceId) {
            return Response.redirect(new URL(`/api/auth/client-bridge?device_id=${encodeURIComponent(deviceId)}`, nextUrl));
          }
          return Response.redirect(new URL('/app', nextUrl));
        }
        return true;
      }

      if (isAuthRoute) {
        // Logged-in users visiting /login are sent to the app
        if (isLoggedIn) return Response.redirect(new URL('/app', nextUrl));
        return true;
      }

      if (!isLoggedIn) return false; // triggers redirect to /login
      return true;
    },
  },
};
