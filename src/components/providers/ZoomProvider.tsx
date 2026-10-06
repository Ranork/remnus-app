'use client';
import { useEffect } from 'react';
import { initDesktopZoom } from '@/lib/desktop/zoom';

/**
 * The app shell's full-screen frame, and the place the desktop zoom is applied
 * when the shell mounts. The zoom is the WebView's own (see `lib/desktop/zoom`),
 * so nothing here is scaled and every coordinate — `getBoundingClientRect()`,
 * pointer events, `position: fixed` — is already the one to use.
 *
 * The frame never changes shape between renders: the children moving between
 * DOM depths after mount remounted the entire app and crashed Next's client
 * Router on Tauri's first open ("Rendered more hooks than during the previous
 * render").
 */
export default function ZoomProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initDesktopZoom();
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden">
      <div className="h-full w-full overflow-hidden">{children}</div>
    </div>
  );
}
