import { getPagePanels, type PagePanels } from '@/lib/actions/pagePanels';

type Kind = keyof PagePanels;

/** A first read shared by the panels of one page opening. */
type Shared = { at: number; promise: Promise<PagePanels>; taken: Set<Kind> };

const shared = new Map<string, Shared>();
/** Panels of one page mount within moments of each other; older entries are stale. */
const SHARE_WINDOW_MS = 10_000;

/**
 * A page panel's first read (comments, knowledge or backlinks), through ONE
 * `getPagePanels` action for all three (V2 R9) — server actions run one at a time, so
 * three separate first reads queued behind each other.
 *
 * Each kind takes the shared result once: a second read of the same kind (a remount, a
 * re-open of the same page) starts a fresh call, so nothing older than this page
 * opening is ever served. Refetches after an edit keep calling their own action.
 */
export async function loadPagePanel<K extends Kind>(
  workspaceId: string,
  pageId: string,
  kind: K,
): Promise<NonNullable<PagePanels[K]>> {
  const now = Date.now();
  for (const [key, entry] of shared) if (now - entry.at > SHARE_WINDOW_MS) shared.delete(key);

  const key = `${workspaceId}/${pageId}`;
  let entry = shared.get(key);
  if (!entry || entry.taken.has(kind)) {
    entry = { at: now, promise: getPagePanels(workspaceId, pageId), taken: new Set() };
    shared.set(key, entry);
  }
  entry.taken.add(kind);
  if (entry.taken.size === 3) shared.delete(key);

  const value = (await entry.promise)[kind];
  if (value == null) throw new Error(`${kind} could not be loaded`);
  return value as NonNullable<PagePanels[K]>;
}
