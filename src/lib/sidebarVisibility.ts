type SidebarVisibilityStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const SIDEBAR_VISIBILITY_KEY = 'remnus_sidebar_visible';
const SIDEBAR_VISIBILITY_EVENT = 'remnus:sidebar-visibility';

function resolveStorage(storage?: Pick<Storage, 'getItem'> | null): Pick<Storage, 'getItem'> | null {
  if (storage !== undefined) return storage;
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function resolveWritableStorage(storage?: SidebarVisibilityStorage | null): SidebarVisibilityStorage | null {
  if (storage !== undefined) return storage;
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function readSidebarVisible(storage?: Pick<Storage, 'getItem'> | null): boolean {
  try {
    return resolveStorage(storage)?.getItem(SIDEBAR_VISIBILITY_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function writeSidebarVisible(visible: boolean, storage?: SidebarVisibilityStorage | null): void {
  try {
    resolveWritableStorage(storage)?.setItem(SIDEBAR_VISIBILITY_KEY, visible ? 'true' : 'false');
    if (storage === undefined && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(SIDEBAR_VISIBILITY_EVENT));
    }
  } catch {
    // Ignore storage failures; the caller's React state still updates.
  }
}

export function getSidebarVisibleServerSnapshot(): boolean {
  return true;
}

export function getSidebarVisibilityToggleHost(sidebarVisible: boolean): 'sidebar' | 'main' {
  return sidebarVisible ? 'sidebar' : 'main';
}

export function getSidebarRestoreButtonClassName(hasDemoBanner: boolean): string {
  return [
    'hidden lg:flex absolute left-3.5 z-30 h-7 w-7 items-center justify-center rounded-control',
    'text-fg-3 hover:text-fg hover:bg-hover transition-colors',
    hasDemoBanner ? 'top-12' : 'top-3.5',
  ].join(' ');
}

export function getSidebarAnimationClasses(sidebarVisible: boolean, peeking = false): string {
  // Sidebar is ALWAYS absolute — it never participates in flex layout so the
  // main content never shifts when opening or closing. Pinned, it is part of the
  // desk (no edge, no shadow); peeking over the content, it floats.
  const shown = sidebarVisible || peeking;
  return [
    'hidden lg:flex flex-col',
    'absolute left-0 inset-y-0 w-72 z-50',
    'bg-desk',
    'transition-[transform,opacity,box-shadow] duration-200 ease-out',
    shown
      ? 'translate-x-0 opacity-100'
      : '-translate-x-full opacity-0 pointer-events-none',
    peeking && !sidebarVisible ? 'shadow-float' : '',
  ].join(' ');
}

/**
 * Classes for the <main> content area — the desk the sheet sits on.
 * When the sidebar is pinned (sidebarVisible=true) the content is pushed right via
 * padding-left so it doesn't sit under the overlay sidebar. The transition duration
 * matches the sidebar's so both animate together on pin/unpin. Below `lg` there is no
 * desk: the sheet is the whole screen.
 */
export function getMainContentClasses(sidebarVisible: boolean): string {
  return [
    'relative flex-1 flex flex-col h-full overflow-hidden bg-sheet lg:bg-desk pb-14 lg:pb-0',
    'transition-[padding-left] duration-200 ease-out',
    sidebarVisible ? 'lg:pl-72' : '',
  ].join(' ');
}

/**
 * The sheet: the one lifted, rounded surface the content lives on (desktop). `onDesk`
 * routes (the project dashboard) skip the sheet's own fill so their cards sit on the
 * desk, each card a small sheet of its own. `underChrome`: something already sits
 * above it on the desk (the desktop titlebar, a banner), so no top gap.
 */
export function getSheetClasses({ onDesk = false, underChrome = false }: { onDesk?: boolean; underChrome?: boolean } = {}): string {
  return [
    'relative flex-1 min-h-0 flex flex-col overflow-hidden',
    onDesk ? 'bg-sheet lg:bg-transparent' : 'bg-sheet lg:rounded-surface lg:shadow-sheet',
    'lg:mx-2 lg:mb-2',
    underChrome ? '' : 'lg:mt-2',
  ].join(' ');
}

export function getSidebarOverlayContainer(doc?: { body: Element } | null): Element | null {
  if (doc !== undefined) return doc?.body ?? null;
  if (typeof document === 'undefined') return null;
  return document.body;
}

export function subscribeSidebarVisibility(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleChange = () => onStoreChange();
  window.addEventListener('storage', handleChange);
  window.addEventListener(SIDEBAR_VISIBILITY_EVENT, handleChange);

  return () => {
    window.removeEventListener('storage', handleChange);
    window.removeEventListener(SIDEBAR_VISIBILITY_EVENT, handleChange);
  };
}
