import 'server-only';
import { cookies } from 'next/headers';
import { PLATFORM_COOKIE } from '@/lib/constants/cookies';

/**
 * True when the current request comes from the Tauri desktop shell, detected via
 * the `remnus_platform` cookie set by `/tauri-app`. In Tauri the in-app
 * keep-alive tabs (`TabHost`) own the content area, so the (app) content route
 * pages render `null` and let the client render each tab's pane — this avoids
 * rendering (and double-fetching) the same page both server-side and in TabHost.
 * Web requests never have the cookie (Tauri's WebView cookie jar is isolated),
 * so they render normally.
 */
export async function isTauriRequest(): Promise<boolean> {
  const store = await cookies();
  return store.get(PLATFORM_COOKIE)?.value === 'tauri';
}
