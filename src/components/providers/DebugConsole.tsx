'use client';

import { useEffect } from 'react';
import { isNextControlFlow } from '@/lib/reportClientError';

/**
 * In-app debug console + global error reporting.
 *
 * Works on EVERY platform (web, Tauri desktop, Capacitor mobile) — unlike native
 * WebView DevTools which only exist on desktop. Lets us debug the *installed*
 * production app (the "Reload" crash screen) without a dev build.
 *
 * Enabling (any of):
 *   - URL param `?debug=1`  (and `?debug=0` to turn it off) — survives reloads
 *   - localStorage `remnus-debug` = '1'
 *   - keyboard toggle Ctrl/Cmd + Shift + D (desktop/web)
 *
 * When on, it lazy-loads `eruda` (a floating console overlay — console / network /
 * elements / resources). The import is dynamic so normal users never download it.
 *
 * Independently of the overlay, it always installs lightweight global
 * `error` / `unhandledrejection` listeners that forward uncaught errors to
 * PostHog (best-effort) so remote crashes are still recorded.
 */

const STORAGE_KEY = 'remnus-debug';

function readDebugFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const param = new URL(window.location.href).searchParams.get('debug');
    if (param === '1' || param === 'true') {
      localStorage.setItem(STORAGE_KEY, '1');
      return true;
    }
    if (param === '0' || param === 'false') {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function reportError(error: unknown, source: string) {
  // Never throw from inside an error handler.
  try {
    // Skip Next.js control-flow signals (redirect()/notFound() throw special
    // errors that can surface here as unhandledrejection) — same guard the
    // error boundaries use, so window-level reporting stays consistent.
    if (isNextControlFlow(error)) return;
    void import('posthog-js')
      .then(({ default: posthog }) => {
        // posthog is only initialized under the locale layout; guard for safety.
        if (!posthog.__loaded) return;
        const err = error instanceof Error ? error : new Error(String(error));
        // Call as a method (NOT a detached `const capture = posthog.captureException`)
        // — captureException reads `this.exceptions` internally, so detaching it
        // makes the call throw `this is undefined`. That throw lands in this
        // promise, becomes an unhandledrejection, and re-enters reportError →
        // infinite loop. Keep the binding and `.catch` the promise so a failure
        // here can never feed itself back through the error listeners.
        const ph = posthog as unknown as {
          captureException?: (e: Error, props?: Record<string, unknown>) => void;
          capture: (event: string, props?: Record<string, unknown>) => void;
        };
        if (typeof ph.captureException === 'function') {
          ph.captureException(err, { source });
        } else {
          posthog.capture('client_error', { message: err.message, stack: err.stack, source });
        }
      })
      .catch(() => {
        /* swallow — must never re-throw from the error path */
      });
  } catch {
    /* swallow */
  }
}

export default function DebugConsole() {
  useEffect(() => {
    let active = false;

    async function showEruda() {
      if (active) return;
      active = true;
      try {
        const eruda = (await import('eruda')).default;
        if (!eruda.get()) eruda.init();
      } catch {
        active = false;
      }
    }

    async function hideEruda() {
      active = false;
      try {
        const eruda = (await import('eruda')).default;
        if (eruda.get()) eruda.destroy();
      } catch {
        /* swallow */
      }
    }

    const onError = (e: ErrorEvent) => reportError(e.error ?? e.message, 'window.onerror');
    const onRejection = (e: PromiseRejectionEvent) => reportError(e.reason, 'unhandledrejection');

    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        if (localStorage.getItem(STORAGE_KEY) === '1') {
          localStorage.removeItem(STORAGE_KEY);
          void hideEruda();
        } else {
          localStorage.setItem(STORAGE_KEY, '1');
          void showEruda();
        }
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('keydown', onKey);

    if (readDebugFlag()) void showEruda();

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return null;
}
