/**
 * Run `task` once the page has settled: after `delayMs`, at the browser's next idle
 * moment. For work a page will want soon but must not pay for while it loads — fetching
 * the code of dialogs before anyone opens one (V2 R9). Returns a cancel function.
 */
export function whenIdle(task: () => void, delayMs = 3000): () => void {
  if (typeof window === 'undefined') return () => {};
  let idleId: number | undefined;
  const timer = window.setTimeout(() => {
    if (typeof window.requestIdleCallback === 'function') idleId = window.requestIdleCallback(task, { timeout: 5000 });
    else task();
  }, delayMs);
  return () => {
    window.clearTimeout(timer);
    if (idleId !== undefined) window.cancelIdleCallback(idleId);
  };
}
