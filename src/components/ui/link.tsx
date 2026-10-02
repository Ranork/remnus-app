'use client';

import NextLink from 'next/link';
import { useState, type ComponentProps } from 'react';

/**
 * `next/link` that prefetches on intent instead of on sight (V2 R9.4). Next prefetches
 * every link that scrolls into view; an app page shows dozens (the sidebar tree, tabs,
 * backlinks, the site nav), and each prefetch response made React commit hundreds of
 * times — measured on `/page`: 64 prefetch requests and ~12k commits in the first
 * seconds, ~2.4 s of main-thread React work (365 commits, 0.15 s with them blocked).
 * Here a link prefetches when the pointer reaches it, it takes focus or a touch begins —
 * still ahead of the click, so navigation keeps its head start.
 *
 * An explicit `prefetch` (`true` or `false`) is passed through unchanged. ESLint keeps
 * `next/link` imports to this file.
 */
export default function Link({ prefetch, onMouseEnter, onFocus, onTouchStart, ...props }: ComponentProps<typeof NextLink>) {
  const [intent, setIntent] = useState(false);
  if (prefetch === true || prefetch === false) {
    return <NextLink prefetch={prefetch} onMouseEnter={onMouseEnter} onFocus={onFocus} onTouchStart={onTouchStart} {...props} />;
  }
  return (
    <NextLink
      {...props}
      prefetch={intent ? prefetch : false}
      onMouseEnter={(e) => {
        setIntent(true);
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        setIntent(true);
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        setIntent(true);
        onTouchStart?.(e);
      }}
    />
  );
}
