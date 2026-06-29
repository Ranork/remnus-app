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

export function getSidebarAnimationClasses(sidebarVisible: boolean): string {
  return [
    'hidden lg:flex shrink-0 overflow-hidden bg-neutral-900 border-r border-neutral-800 flex-col',
    'transition-[width,opacity,transform] duration-200 ease-out',
    sidebarVisible
      ? 'w-72 opacity-100 translate-x-0'
      : 'w-0 opacity-0 -translate-x-2 pointer-events-none border-r-0',
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
