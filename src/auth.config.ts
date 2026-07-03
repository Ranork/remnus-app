import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';

// Edge-compatible auth config (no DB imports — safe for middleware)
export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      allowDangerousEmailAccountLinking: true,
      // Force the Google account chooser on every sign-in. Without this, Google
      // can silently re-authenticate the last active account — so a user who
      // logs out and tries to switch accounts gets signed back in as the old one.
      authorization: { params: { prompt: 'select_account' } },
    }),
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
      const isPublicAsset =
        /\.(png|ico|svg|jpg|jpeg|webp|woff2?)$/.test(path) ||
        // PWA files fetched cookie-less by the browser — must never redirect to /login.
        path === '/manifest.json' || path === '/sw.js' || path.startsWith('/workbox-') ||
        // llms.txt — fetched cookie-less by AI crawlers/agents (rewritten to /api/llms).
        path === '/llms.txt';
      const isRootRoute = cleanPath === '/' || cleanPath === '/share';
      const isPublicMarketingRoute = cleanPath.startsWith('/pricing') || cleanPath.startsWith('/contact') || cleanPath.startsWith('/download') || cleanPath.startsWith('/share/') || cleanPath.startsWith('/security') || cleanPath.startsWith('/brand') || cleanPath.startsWith('/wiki') || cleanPath.startsWith('/docs');
      const isMcpRoute = cleanPath.startsWith('/api/mcp');
      const isTauriEntry = cleanPath.startsWith('/tauri-app');
      const isClientActivate = cleanPath.startsWith('/api/auth/client-activate');
      const isOAuthApi = cleanPath.startsWith('/api/oauth');
      const isWellKnown = cleanPath.startsWith('/.well-known');
      const isOAuthPage = cleanPath.startsWith('/oauth/');
      const isStripeWebhook = cleanPath.startsWith('/api/webhooks/stripe');
      const isInvite = cleanPath.startsWith('/invite/');
      const isHealthCheck = cleanPath.startsWith('/api/health');
      // Mailing: unsubscribe links arrive cookie-less from email clients; the
      // cron + SES/SNS webhook authenticate via their own secrets/signatures.
      const isMailingPublic =
        cleanPath.startsWith('/unsubscribe') ||
        cleanPath.startsWith('/api/unsubscribe') ||
        cleanPath.startsWith('/api/cron') ||
        cleanPath.startsWith('/api/webhooks/ses');
      if (isApiAuth || isMcpRoute || isPublicAsset || isTauriEntry || isClientActivate || isOAuthApi || isWellKnown || isOAuthPage || isStripeWebhook || isInvite || isHealthCheck || isMailingPublic) return true;

      // Public marketing pages (pricing, contact) are always accessible
      if (isPublicMarketingRoute) return true;

      // Root URL: always public — logged-in users can visit the landing page
      if (isRootRoute) return true;

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
