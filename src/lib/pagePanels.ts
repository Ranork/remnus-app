import { getPagePanels, type PagePanels } from '@/lib/actions/pagePanels';

type Shared = { at: number; promise: Promise<PagePanels> };

const inFlight = new Map<string, Shared>();
/** A page opening asks once; a second ask this soon (a remount, Strict Mode) shares it. */
const SHARE_WINDOW_MS = 3_000;

/**
 * The page's floating panels (comments, knowledge, backlinks) read in ONE
 * `getPagePanels` action (V2 R9) — server actions run one at a time, so three separate
 * first reads queued behind each other. Since U4 the floating group (`PageFloat`) owns
 * the result and hands each panel its part; a panel's own refetch after an edit keeps
 * calling its own action.
 */
export function loadPagePanels(workspaceId: string, pageId: string): Promise<PagePanels> {
  const now = Date.now();
  for (const [key, entry] of inFlight) if (now - entry.at > SHARE_WINDOW_MS) inFlight.delete(key);

  const key = `${workspaceId}/${pageId}`;
  const existing = inFlight.get(key);
  if (existing) return existing.promise;

  const promise = getPagePanels(workspaceId, pageId);
  inFlight.set(key, { at: now, promise });
  promise.catch(() => inFlight.delete(key));
  return promise;
}
