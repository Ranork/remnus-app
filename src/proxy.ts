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
  // Expose the clean external pathname to server layouts as a REQUEST header so it is
  // readable via next/headers (e.g. to detect /share/* and skip the app shell). A header
  // set on the middleware *response* would only reach the browser — next-intl instead
  // clones the request headers onto its rewrite, so a header on the request we hand it
  // propagates to the rendered route.
  const headers = new Headers(req.headers);
  headers.set('x-pathname', req.nextUrl.pathname);
  return intlMiddleware(new NextRequest(req, { headers }));
}) as (req: NextRequest) => Response | Promise<Response>;

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|logo.*|.*\\.(?:png|ico|svg|jpg|jpeg|webp|woff2?)).*)',
  ],
};
