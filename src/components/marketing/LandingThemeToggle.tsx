'use client';
import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { setTheme } from '@/lib/actions/preferences';

const LIGHT = 'catppuccin';
const DARK = 'remnus';

// Track the live <html data-theme> attribute via the DOM so the icon stays in
// sync with any other surface that changes the theme — no local state needed.
function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => obs.disconnect();
}
const getSnapshot = () => document.documentElement.dataset.theme === LIGHT;
const getServerSnapshot = () => false;

export default function LandingThemeToggle({ label }: { label: string }) {
  const isLight = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = isLight ? DARK : LIGHT;
    // CSS variables re-resolve instantly off the data-theme attribute (and the
    // MutationObserver above flips the icon). Persist for SSR on the next visit.
    document.documentElement.dataset.theme = next;
    void setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className="inline-flex items-center justify-center h-9 w-9 rounded-md text-neutral-50 hover:text-neutral-100 hover:bg-neutral-900 transition-colors duration-150 cursor-pointer shrink-0"
    >
      {isLight ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
