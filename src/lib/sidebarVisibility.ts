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
