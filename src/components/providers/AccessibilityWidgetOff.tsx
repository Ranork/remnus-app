'use client';

import { useEffect } from 'react';

type WidgetApi = { configure(options: { disabled: boolean }): unknown };

const MOUNTED_EVENT = 'accessibility-preference-widget:mounted';

function widget(): WidgetApi | undefined {
  return (window as unknown as { AccessibilityPreferenceWidget?: WidgetApi }).AccessibilityPreferenceWidget;
}

/**
 * Keeps the public site's accessibility widget off while the app shell is mounted
 * (rendered by the `(app)` layout). The route list in `lib/accessibilityWidget.ts`
 * covers first load; this covers every in-app route, including ones added later.
 *
 * The widget script loads after hydration, so it may not exist yet when this
 * mounts: it is turned off again whenever it announces that it mounted itself.
 * Leaving the app shell hands it back, and the widget then decides by path.
 */
export default function AccessibilityWidgetOff() {
  useEffect(() => {
    const off = () => {
      widget()?.configure({ disabled: true });
    };
    off();
    document.addEventListener(MOUNTED_EVENT, off);
    return () => {
      document.removeEventListener(MOUNTED_EVENT, off);
      widget()?.configure({ disabled: false });
    };
  }, []);

  return null;
}
