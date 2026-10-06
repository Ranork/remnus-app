// Desktop (Tauri) zoom helpers. Plain module — the `window`/`localStorage`
// access lives inside the functions, so it is import-safe from any context
// (only executed on the client when the function is actually called).
//
// The factor is applied to the WebView itself (`Webview.setZoom`, the WebView2
// ZoomFactor), the same thing a browser's own zoom does: layout, pointer
// coordinates, `position: fixed`, portalled dialogs and canvas libraries such as
// the knowledge map all stay in one coordinate space. The previous approach —
// `transform: scale()` on an app wrapper — broke each of those under zoom
// (floating buttons and popovers drifted, map clicks missed), so nothing in the
// React tree is scaled any more.

export const ZOOM_KEY = 'remnus_desktop_zoom_native';
// Read by the initialization script baked into desktop builds up to 0.1.19, which
// applies it as CSS `zoom` before the page loads. A host-set WebView zoom carries
// across navigations, so leaving this key in place would zoom every hard
// navigation twice until React mounts: it is migrated to ZOOM_KEY and removed.
const LEGACY_ZOOM_KEY = 'remnus_desktop_zoom';

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.0;
export const ZOOM_STEP = 0.1;
export const ZOOM_DEFAULT = 1.0;

function isTauri() {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

function parseZoom(raw: string | null): number | null {
  const f = parseFloat(raw ?? '');
  return !isNaN(f) && f >= ZOOM_MIN && f <= ZOOM_MAX ? f : null;
}

async function setNativeZoom(factor: number) {
  try {
    const { getCurrentWebview } = await import('@tauri-apps/api/webview');
    await getCurrentWebview().setZoom(factor);
  } catch {
    /* not in the desktop shell, or the shell refused — stay at 100% */
  }
}

export function applyDesktopZoom(factor: number) {
  try { localStorage.setItem(ZOOM_KEY, String(factor)); } catch {}
  void setNativeZoom(factor);
}

/**
 * Applies the saved zoom to the desktop WebView. Called on the desktop entry page
 * and when the app shell mounts; a no-op outside the desktop shell.
 */
export function initDesktopZoom() {
  if (!isTauri()) return;
  try {
    const legacy = localStorage.getItem(LEGACY_ZOOM_KEY);
    if (legacy !== null) {
      if (localStorage.getItem(ZOOM_KEY) === null && parseZoom(legacy) !== null) localStorage.setItem(ZOOM_KEY, legacy);
      localStorage.removeItem(LEGACY_ZOOM_KEY);
    }
  } catch {}
  // Undo the CSS zoom that the older initialization script may have applied to this document.
  const root = document.documentElement.style;
  root.zoom = '';
  root.width = '';
  root.height = '';
  root.overflow = '';
  void setNativeZoom(getSavedZoom());
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function getSavedZoom(): number {
  try {
    return parseZoom(localStorage.getItem(ZOOM_KEY)) ?? parseZoom(localStorage.getItem(LEGACY_ZOOM_KEY)) ?? ZOOM_DEFAULT;
  } catch {
    return ZOOM_DEFAULT;
  }
}
