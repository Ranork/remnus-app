'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { LAST_PATH_COOKIE } from '@/lib/constants/cookies';

const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// Only content routes are worth restoring when the user relaunches the app.
function isRestorable(path: string): boolean {
  return path.startsWith('/page/') || path.startsWith('/db/');
}

/**
 * Remembers the last content page (page / database / row) the user was on by
 * writing it to a cookie on every navigation. The `/app` gateway reads this
 * cookie and redirects the user back to where they left off when they reopen
 * the app. Mounted for authenticated users in [locale]/layout.tsx.
 */
export default function LastPathTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || !isRestorable(pathname)) return;
    document.cookie = `${LAST_PATH_COOKIE}=${encodeURIComponent(pathname)}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
  }, [pathname]);

  return null;
}
