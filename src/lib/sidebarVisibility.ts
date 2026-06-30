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
    'hidden lg:flex absolute left-2 z-30 h-7 w-7 items-center justify-center',
    'text-neutral-500 hover:text-neutral-100 hover:bg-neutral-800/80 transition-colors',
    hasDemoBanner ? 'top-12' : 'top-2',
  ].join(' ');
}

export function getSidebarAnimationClasses(sidebarVisible: boolean, peeking = false): string {
  // Sidebar is ALWAYS absolute — it never participates in flex layout so the
  // main content never shifts when opening or closing.
  const shown = sidebarVisible || peeking;
  return [
    'hidden lg:flex flex-col',
    'absolute left-0 inset-y-0 w-72 z-50',
    'bg-neutral-900 border-r border-neutral-800',
    'transition-[transform,opacity] duration-200 ease-out',
    shown
      ? 'translate-x-0 opacity-100 shadow-xl'
      : '-translate-x-full opacity-0 pointer-events-none',
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
