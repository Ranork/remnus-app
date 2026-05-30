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
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  const response = intlMiddleware(req);
  // Expose the clean external pathname to server layouts via header
  if (response instanceof NextResponse) {
    response.headers.set('x-pathname', req.nextUrl.pathname);
  }
  return response;
}) as (req: NextRequest) => Response | Promise<Response>;

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|logo.*|.*\\.(?:png|ico|svg|jpg|jpeg|webp|woff2?)).*)',
  ],
};
