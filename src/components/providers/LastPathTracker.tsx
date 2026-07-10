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
 * the app. Mounted for authenticated users in (app)/layout.tsx.
 *
 * `ownerTag` identifies the writer (see lib/server/lastPath.ts). Without it the
 * cookie outlives the session and the next user to sign in on this browser
 * resumes the previous user's page.
 */
export default function LastPathTracker({ ownerTag }: { ownerTag: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || !isRestorable(pathname) || !ownerTag) return;
    const value = `${ownerTag}:${encodeURIComponent(pathname)}`;
    document.cookie = `${LAST_PATH_COOKIE}=${value}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
  }, [pathname, ownerTag]);

  return null;
}
