import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SIDEBAR_VISIBILITY_KEY,
  getSidebarVisibleServerSnapshot,
  readSidebarVisible,
  subscribeSidebarVisibility,
  writeSidebarVisible,
} from './sidebarVisibility';

function memoryStorage(initial?: string) {
  const store = new Map<string, string>();
  if (initial !== undefined) store.set(SIDEBAR_VISIBILITY_KEY, initial);

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    value: () => store.get(SIDEBAR_VISIBILITY_KEY),
  };
}

describe('sidebar visibility persistence', () => {
  it('defaults to visible when no preference exists', () => {
    assert.equal(readSidebarVisible(memoryStorage()), true);
  });

  it('reads a hidden preference', () => {
    assert.equal(readSidebarVisible(memoryStorage('false')), false);
  });

  it('persists visible and hidden preferences', () => {
    const storage = memoryStorage();

    writeSidebarVisible(false, storage);
    assert.equal(storage.value(), 'false');
    assert.equal(readSidebarVisible(storage), false);

    writeSidebarVisible(true, storage);
    assert.equal(storage.value(), 'true');
    assert.equal(readSidebarVisible(storage), true);
  });

  it('falls back to visible when storage is unavailable', () => {
    assert.equal(readSidebarVisible(null), true);
  });

  it('uses a visible server snapshot for hydration', () => {
    assert.equal(getSidebarVisibleServerSnapshot(), true);
  });

  it('does not subscribe when no window exists', () => {
    const unsubscribe = subscribeSidebarVisibility(() => {
      throw new Error('listener should not run without a browser window');
    });

    assert.doesNotThrow(unsubscribe);
  });
});
