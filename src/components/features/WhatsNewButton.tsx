'use client';

import { useState } from 'react';
import { lazyComponent } from '@/lib/lazyComponent';
import { CHANGELOG_SEEN_COOKIE } from '@/lib/constants/cookies';

const WhatsNewModal = lazyComponent(() => import('./WhatsNewModal').then((m) => m.default));

/** The changelog module, loaded once, when the list is first opened. */
let changelogModule: Promise<typeof import('@/lib/changelog')> | null = null;
const loadChangelog = () => (changelogModule ??= import('@/lib/changelog'));

// "What's New": the unread count and the modal it opens, as a hook. The account menu
// (and the mobile user sheet) supply their own row and call `open()`; the caller must
// render `modal` somewhere that stays mounted while the menu closes. Self-contained
// on purpose — the sidebar is rendered twice (desktop shell + mobile drawer), so the
// seen-state lives here rather than being threaded through both layouts. The seen marker is a plain
// client-readable cookie (same `remnus_*` convention as the other UI
// preferences in `lib/actions/preferences.ts`, which are also per-device).

const YEAR_SECONDS = 60 * 60 * 24 * 365;

function readSeenCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CHANGELOG_SEEN_COOKIE}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function writeSeenCookie(id: string) {
  document.cookie =
    `${CHANGELOG_SEEN_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${YEAR_SECONDS}; samesite=lax`;
}

/**
 * `initialUnseen` is counted on the server (the `(app)` layout reads the seen cookie
 * and the changelog there), so the badge costs the page no code: the changelog —
 * ~200 KB, every entry in eight languages — loads only when the list is opened (V2 R9).
 */
export function useWhatsNew(initialUnseen = 0) {
  const [open, setOpen] = useState(false);
  // Frozen at open time: the highlight ring must not vanish out from under the
  // reader the moment the cookie is written.
  const [unseenIds, setUnseenIds] = useState<Set<string>>(new Set());
  const [unseenCount, setUnseenCount] = useState(initialUnseen);

  const handleOpen = () => {
    loadChangelog()
      .then((changelog) => {
        const count = changelog.countUnseenEntries(readSeenCookie());
        setUnseenIds(new Set(changelog.CHANGELOG.slice(0, count).map((e) => e.id)));
        setOpen(true);
        // Reading the list is what marks it read — clearing on close would leave the
        // badge up if the user navigates away from the modal instead of closing it.
        writeSeenCookie(changelog.newestEntryId());
        setUnseenCount(0);
      })
      .catch(() => {});
  };

  const modal = open ? <WhatsNewModal unseenIds={unseenIds} onClose={() => setOpen(false)} /> : null;

  return { unseenCount, open: handleOpen, modal };
}
