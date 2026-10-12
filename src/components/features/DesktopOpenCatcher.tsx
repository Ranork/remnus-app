'use client';

import { useEffect } from 'react';
import { DESKTOP_OPEN_EVENT, holdOpenLink, isShellListening, workspaceIdOf } from '@/lib/desktop/openLink';

/**
 * Desktop only, on every page (root layout). A `remnus://open` link that arrives while the
 * app shell is not listening — the sign-in screen after signing out, above all — is kept for
 * the shell's `DesktopOpenListener`, which opens it once it mounts (after signing in). While
 * the shell listens it handles the link itself and this stands aside. See lib/desktop/openLink.
 */
export default function DesktopOpenCatcher() {
  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const off = await listen(DESKTOP_OPEN_EVENT, (event) => {
          if (isShellListening()) return;
          const id = workspaceIdOf(event.payload);
          if (id) holdOpenLink(id);
        });
        if (cancelled) {
          off();
          return;
        }
        unlisten = off;
      } catch {
        // An older desktop shell without the event bridge: nothing to listen to.
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return null;
}
