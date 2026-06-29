/**
 * Best-effort client-side crash reporter for React render errors caught by
 * `error.tsx` / `global-error.tsx` boundaries.
 *
 * The window `error` / `unhandledrejection` listeners in `DebugConsole` do NOT
 * catch React render errors — React swallows those and re-throws them only into
 * the nearest error boundary. So a render crash (e.g. a Rules-of-Hooks
 * violation → React #310) produced ZERO telemetry before this existed. Calling
 * this from a boundary's `useEffect` forwards the error (with its `digest`,
 * stack, message + the route it happened on) to PostHog so the next occurrence
 * is diagnosable instead of being a blank "couldn't load" screen.
 *
 * Mirrors `DebugConsole`'s reportError guards: never throw from the error path,
 * call `captureException` as a method (it reads `this.exceptions`).
 */
/**
 * Next.js control-flow "errors" are not crashes — `redirect()` and `notFound()`
 * work by throwing a special error the framework catches. When they fire inside
 * a boundary-wrapped tree (or bubble out of a server action as an
 * unhandledrejection), they'd otherwise be reported as crashes, spamming
 * Error Tracking with NEXT_REDIRECT / NEXT_HTTP_ERROR_FALLBACK;404 noise.
 * Returns true for any such control-flow signal so callers can skip reporting.
 */
export function isNextControlFlow(error: unknown): boolean {
  const digest = (error as { digest?: string } | null)?.digest;
  const message = error instanceof Error ? error.message : undefined;
  const signal = digest ?? message ?? '';
  return (
    typeof signal === 'string' &&
    (signal.startsWith('NEXT_REDIRECT') ||
      signal.startsWith('NEXT_HTTP_ERROR_FALLBACK') ||
      signal === 'NEXT_NOT_FOUND')
  );
}

export function reportClientError(
  error: unknown,
  extra?: Record<string, unknown>,
) {
  try {
    if (isNextControlFlow(error)) return;

    const err = error instanceof Error ? error : new Error(String(error));
    const digest = (error as { digest?: string } | null)?.digest;

    const props: Record<string, unknown> = {
      source: 'error-boundary',
      digest,
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
      ...extra,
    };

    void import('posthog-js')
      .then(({ default: posthog }) => {
        if (!posthog.__loaded) return;
        const ph = posthog as unknown as {
          captureException?: (e: Error, p?: Record<string, unknown>) => void;
          capture: (event: string, p?: Record<string, unknown>) => void;
        };
        if (typeof ph.captureException === 'function') {
          ph.captureException(err, props);
        } else {
          ph.capture('client_error', { message: err.message, stack: err.stack, ...props });
        }
      })
      .catch(() => {
        /* swallow — never re-throw from the error path */
      });
  } catch {
    /* swallow */
  }
}
