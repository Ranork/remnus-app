'use client';

import { useEffect } from 'react';

// The vendored accessibility widget (see src/app/layout.tsx) renders its trigger
// button inside an open shadow root with a hardcoded teal glass-morphism look —
// its official `--a11y-*` custom properties only theme the settings panel, not
// the floating trigger. Since the shadow root is `mode: "open"`, we can reach in
// and inject our own override style so the button matches Remnus's flat neutral
// palette instead. The widget fully destroys and recreates its host element (and
// therefore its shadow root) every time it mounts/unmounts across route changes,
// so we re-apply on its "mounted" event rather than injecting once.
const STYLE_ID = 'a11y-widget-theme-override';
const HOST_SELECTOR = '[data-accessibility-preference-widget]';

function applyThemeOverride(host: Element) {
  const shadow = (host as HTMLElement).shadowRoot;
  if (!shadow || shadow.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #a11y-widget-trigger {
      background: var(--color-neutral-900) !important;
      border: 1px solid var(--color-neutral-800) !important;
      border-bottom: 1px solid var(--color-neutral-800) !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35) !important;
      animation: none !important;
    }
    #a11y-widget-trigger:hover {
      background: var(--color-neutral-800) !important;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4) !important;
    }
    #a11y-widget-trigger svg {
      fill: var(--foreground) !important;
      filter: none !important;
    }
  `;
  shadow.appendChild(style);
}

export default function AccessibilityWidgetTheme() {
  useEffect(() => {
    const existing = document.querySelector(HOST_SELECTOR);
    if (existing) applyThemeOverride(existing);

    const onMounted = () => {
      const host = document.querySelector(HOST_SELECTOR);
      if (host) applyThemeOverride(host);
    };
    document.addEventListener('accessibility-preference-widget:mounted', onMounted);
    return () => document.removeEventListener('accessibility-preference-widget:mounted', onMounted);
  }, []);

  return null;
}
