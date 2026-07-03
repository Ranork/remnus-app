import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware(routing);
const { auth: authMiddleware } = NextAuth(authConfig);

// Auth.js proxy wraps the intl middleware:
// 1. Auth checks run on the original (un-rewritten) request path
// 2. API routes bypass intl middleware — next-intl must not rewrite /api/* paths
// 3. If authorized page request, intl middleware handles locale detection and internal rewrite
export default authMiddleware(function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/api/') || req.nextUrl.pathname.startsWith('/.well-known/')) {
    return NextResponse.next();
  }
  return intlMiddleware(req);
}) as (req: NextRequest) => Response | Promise<Response>;

export const config = {
  matcher: [
    // manifest.json + sw.js/workbox-* (next-pwa service worker) must bypass the
    // middleware entirely — the browser fetches them cookie-less, so the auth
    // check would bounce them to /login and break PWA install/offline. Same
    // reasoning for llms.txt — AI crawlers fetch it cookie-less, and it's
    // rewritten (afterFiles, i.e. after this middleware decision) to /api/llms.
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|llms.txt|manifest.json|sw.js|workbox-.*|logo.*|.*\\.(?:png|ico|svg|jpg|jpeg|webp|woff2?)).*)',
  ],
};
