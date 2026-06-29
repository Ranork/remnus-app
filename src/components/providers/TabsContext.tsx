"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { WorkspaceItemRow } from "@/lib/actions/workspace";
import { invalidateTabHref } from "@/components/features/tabs/keys";

export type TabMeta = {
  title: string;
  icon: string | null;
  iconColor: string | null;
};

export type Tab = TabMeta & {
  id: string;
  href: string;
};

type TabsContextValue = {
  tabs: Tab[];
  activeId: string | null;
  /**
   * Ids of tabs that are NOT live: never opened this session, or inactive longer
   * than the keep-alive window. `TabHost` does not mount their panes (lazy on
   * load, suspended after the window) and `TabBar` dims them; activating one
   * re-mounts it fresh. The active tab is never included.
   */
  suspendedIds: Set<string>;
  /** Resolve live meta from the workspace item list. Returns null for DB row pages. */
  resolveMeta: (href: string) => TabMeta | null;
  openInNewTab: (href: string, metaHint?: Partial<TabMeta>) => void;
  activateTab: (id: string) => void;
  closeTab: (id: string) => void;
  closeOthers: (id: string) => void;
  closeAll: () => void;
  reorderTabs: (fromId: string, toId: string) => void;
};

// A tab kept alive (mounted, just hidden) preserves its full in-memory state.
// Once it has been inactive this long it is suspended: its pane is unmounted to
// free memory, and re-mounted fresh when reactivated. Also gates lazy-mount —
// tabs restored from a previous session aren't live until first activated.
const SUSPEND_AFTER_MS = 30 * 60 * 1000;

const TabsContext = createContext<TabsContextValue | null>(null);

/** Safe to call outside the provider (web build): returns null. */
export function useTabs(): TabsContextValue | null {
  return useContext(TabsContext);
}

/**
 * Navigation/refresh shim for editors. On web it's just the Next router. In the
 * Tauri keep-alive shell, `refresh()` invalidates ONLY the active tab pane's
 * TanStack queries (the content is client-fetched, so `router.refresh()` — which
 * refetches the now-`null` server route — would do nothing), leaving every other
 * kept-alive pane's in-memory state untouched. Components keep calling their
 * normal `router.push` for navigation; keep-alive is handled by `TabHost`.
 */
export function useTabNav(): {
  refresh: () => void;
  navigate: (href: string) => void;
} {
  const router = useRouter();
  const ctx = useContext(TabsContext); // null on web / inert provider
  const queryClient = useQueryClient();

  const refresh = useCallback(() => {
    if (ctx) {
      const active = ctx.tabs.find((t) => t.id === ctx.activeId);
      if (active) {
        invalidateTabHref(queryClient, active.href);
        return;
      }
    }
    router.refresh();
  }, [ctx, queryClient, router]);

  const navigate = useCallback((href: string) => router.push(href), [router]);

  return { refresh, navigate };
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** Strip query/hash; usePathname already omits them, but be defensive. */
function normalizePath(p: string): string {
  let s = (p || "").split("?")[0].split("#")[0];
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

/** A path that should live in a tab (content routes only). */
function isTabbable(norm: string): boolean {
  return /^\/(page|db)\//.test(norm);
}

function isRowPath(norm: string): boolean {
  return /^\/db\/[^/]+\/[^/]+$/.test(norm);
}

/** Internal link that should be hijacked into a tab (ctrl/middle-click). */
function isInternalTabbable(href: string | null | undefined): href is string {
  if (!href) return false;
  if (!href.startsWith("/") || href.startsWith("//") || href.startsWith("/\\"))
    return false;
  return isTabbable(normalizePath(href));
}

function cleanDocTitle(): string {
  const raw = typeof document !== "undefined" ? document.title : "";
  return raw.replace(/\s*\|\s*Remnus\s*$/, "").trim();
}

// Temporary diagnostic logger — gated on `localStorage.remnus_tabs_debug === '1'`
// or the global `__remnus_tabs_debug` flag. Set either to '1' in DevTools to enable.
// REMOVE once the disappearing-tabs bug is fully diagnosed.
function tlog(...args: any[]) {
  if (typeof window === "undefined") return;
  const enabled =
    (window as any).__remnus_tabs_debug === "1" ||
    (() => {
      try {
        return localStorage.getItem("remnus_tabs_debug") === "1";
      } catch {
        return false;
      }
    })();
  if (enabled) console.log("[tabs]", ...args);
}

// Single GLOBAL storage key — the tab strip is not per-workspace. Navigating
// to a page in another workspace causes the server to flip `remnus_workspace_id`,
// which would otherwise rebuild a per-workspace key and load a different bucket
// of tabs (root cause of the "tabs replaced by other tabs" bug).
const TABS_STORAGE_KEY = "remnus_tabs";
const LEGACY_KEY_PREFIX = "remnus_tabs_";

/**
 * One-shot migration: previous versions kept tabs in `remnus_tabs_<workspaceId>`
 * buckets. On first mount we merge any leftover per-workspace entries into the
 * global key (preserving order, de-duped by href so opening multiple workspaces
 * doesn't show the same page twice) and delete the old keys.
 */
function migrateLegacyTabs(globalKey: string): Tab[] {
  if (typeof window === "undefined") return [];
  try {
    const merged: Tab[] = [];
    const seenHrefs = new Set<string>();
    // Start with whatever is already in the global key.
    const existingRaw = localStorage.getItem(globalKey);
    if (existingRaw) {
      try {
        const parsed = JSON.parse(existingRaw) as { tabs?: Tab[] };
        for (const t of parsed.tabs ?? []) {
          if (
            t &&
            typeof t.href === "string" &&
            typeof t.id === "string" &&
            !seenHrefs.has(t.href)
          ) {
            merged.push(t);
            seenHrefs.add(t.href);
          }
        }
      } catch {
        /* ignore */
      }
    }
    // Then pull in every legacy per-workspace bucket.
    const legacyKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LEGACY_KEY_PREFIX) && k !== globalKey)
        legacyKeys.push(k);
    }
    for (const k of legacyKeys) {
      try {
        const parsed = JSON.parse(localStorage.getItem(k) ?? "") as {
          tabs?: Tab[];
        };
        for (const t of parsed.tabs ?? []) {
          if (
            t &&
            typeof t.href === "string" &&
            typeof t.id === "string" &&
            !seenHrefs.has(t.href)
          ) {
            merged.push(t);
            seenHrefs.add(t.href);
          }
        }
      } catch {
        /* ignore corrupt entry */
      }
      localStorage.removeItem(k);
    }
    return merged;
  } catch {
    return [];
  }
}

export function TabsProvider({
  items,
  children,
  enabled = true,
}: {
  items: WorkspaceItemRow[];
  children: React.ReactNode;
  /**
   * When false (web build), the provider is inert: it renders a `null` context
   * (so `useTabs()` returns null, exactly like no provider) and skips every
   * effect/global listener. It is still ALWAYS mounted so the surrounding tree
   * shape never changes when `isTauri` resolves from false→true after mount —
   * otherwise adding/removing this wrapper remounts the whole app subtree, which
   * raced the first navigation and crashed Next's Router with a hooks mismatch.
   */
  enabled?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const storageKey = TABS_STORAGE_KEY;

  // Diagnostic: track provider mount/unmount cycles to catch unexpected remounts.
  useEffect(() => {
    tlog("PROVIDER mount", { storageKey });
    return () => tlog("PROVIDER unmount", { storageKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeIdState, setActiveIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // Suspend / keep-alive bookkeeping: last time each tab was the active (visible)
  // tab. A tab stays "live" (mounted) for SUSPEND_AFTER_MS after going inactive.
  const [lastActiveAt, setLastActiveAt] = useState<Record<string, number>>({});
  // Advanced on an interval so `suspendedIds` re-evaluates as time passes
  // (kept as state — reading the clock in render/useMemo is impure).
  const [now, setNow] = useState(() => Date.now());
  const prevActiveRef = useRef<string | null>(null);

  // Latest-value refs for event handlers / effects (assigned during render → always current).
  const tabsRef = useRef(tabs);
  const activeIdRef = useRef(activeIdState);
  const pathnameRef = useRef(pathname);
   
  tabsRef.current = tabs;
   
  activeIdRef.current = activeIdState;
   
  pathnameRef.current = pathname;

  const resolveMeta = useCallback(
    (href: string): TabMeta | null => {
      const norm = normalizePath(href);
      const parts = norm.split("/").filter(Boolean); // e.g. ['db','id','pageId']
      if (parts[0] === "page" && parts[1]) {
        const item = items.find((i) => i.id === parts[1]);
        if (item)
          return {
            title: item.title,
            icon: item.icon,
            iconColor: item.iconColor,
          };
      } else if (parts[0] === "db" && parts[1] && !parts[2]) {
        const item = items.find((i) => i.databaseId === parts[1]);
        if (item)
          return {
            title: item.title,
            icon: item.icon,
            iconColor: item.iconColor,
          };
      }
      // DB row pages (/db/x/y) have no workspace item — caller falls back to the tab snapshot.
      return null;
    },
    [items],
  );

  // Effective active id: the explicit state when it still points at a live tab,
  // otherwise fall back to the first tab matching the current path (robust to drift).
  const activeId = useMemo(() => {
    if (activeIdState && tabs.some((t) => t.id === activeIdState))
      return activeIdState;
    const norm = normalizePath(pathname);
    return tabs.find((t) => normalizePath(t.href) === norm)?.id ?? null;
  }, [activeIdState, tabs, pathname]);

  // Stamp the active tab's last-active time. On switch, the tab being left is
  // marked "now" (it was visible until this moment), so its keep-alive window
  // counts from the switch, not from when it first opened.
  useEffect(() => {
    const prev = prevActiveRef.current;
    if (prev === activeId) return;
    const now = Date.now();
    setLastActiveAt((m) => {
      const next = { ...m };
      if (prev && prev !== activeId) next[prev] = now;
      if (activeId) next[activeId] = now;
      return next;
    });
    prevActiveRef.current = activeId;
  }, [activeId]);

  // Re-evaluate suspension roughly once a minute.
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(i);
  }, []);

  // Tabs that are not live: never opened this session (no stamp) or inactive past
  // the keep-alive window. Never includes the active tab. Only considers existing
  // tabs (so stale `lastActiveAt` entries for closed tabs are ignored).
  const suspendedIds = useMemo(() => {
    const s = new Set<string>();
    for (const t of tabs) {
      if (t.id === activeId) continue;
      const last = lastActiveAt[t.id];
      if (last == null || now - last > SUSPEND_AFTER_MS) s.add(t.id);
    }
    return s;
  }, [tabs, activeId, lastActiveAt, now]);

  const makeTab = useCallback(
    (norm: string, id: string, metaHint?: Partial<TabMeta>): Tab => {
      const meta = isTabbable(norm) ? resolveMeta(norm) : null;
      // Only DB rows fall back to document.title; non-tabbable placeholders (e.g. /app
      // before its redirect resolves) get an empty title to avoid showing a stale one.
      const title =
        meta?.title ??
        metaHint?.title ??
        (isRowPath(norm) ? cleanDocTitle() : "");
      return {
        id,
        href: norm,
        title,
        icon: meta?.icon ?? metaHint?.icon ?? null,
        iconColor: meta?.iconColor ?? metaHint?.iconColor ?? null,
      };
    },
    [resolveMeta],
  );

  // ── Hydrate from localStorage on mount (single GLOBAL key) ──────────────
  // Gated on `enabled` so the web build (inert provider) never touches storage,
  // and so hydration runs once `isTauri` flips on (deps include `enabled`).
  useEffect(() => {
    if (!enabled) return;
    // Pulls in any old per-workspace buckets the first time we run, then drops
    // them — afterwards this is just reading the global key.
    const merged = migrateLegacyTabs(storageKey);

    // Also re-read the stored activeId from the global bucket (migration
    // doesn't preserve it; we'll prefer the URL anyway below).
    let storedActiveId: string | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { activeId?: string | null };
        if (parsed.activeId && typeof parsed.activeId === "string") {
          storedActiveId = parsed.activeId;
        }
      }
    } catch {
      /* ignore */
    }

    tlog("HYDRATE", {
      storageKey,
      acceptedLen: merged.length,
      pathname,
      storedActive: storedActiveId,
    });
    // Legitimate one-time init from an external store (localStorage) on mount —
    // can't be a useState initializer because it's gated on `enabled` flipping on.
    setTabs(merged);
    const norm = normalizePath(pathname);
    const match = merged.find((t) => normalizePath(t.href) === norm);
    if (match) setActiveIdState(match.id);
    else if (storedActiveId && merged.some((t) => t.id === storedActiveId))
      setActiveIdState(storedActiveId);

    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // ── Prune tabs whose backing workspace item was deleted ───────────────────
  // Empty `items` is treated as "still loading", never as "everything is gone",
  // so a transient render with an unfilled prop can't wipe the strip. Row paths
  // (/db/x/y) aren't represented in `items` and are left untouched.
  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    // Legitimate sync: drop tabs whose backing item was deleted when `items`
    // changes. Uses a functional updater and only commits when something is
    // actually removed (returns `prev` otherwise), so it can't cascade.
     
    setTabs((prev) => {
      const dropIds = new Set<string>();
      tlog("PRUNE check", { itemsLen: items.length, tabsLen: prev.length });
      for (const t of prev) {
        const norm = normalizePath(t.href);
        if (isRowPath(norm)) continue;
        const parts = norm.split("/").filter(Boolean);
        if (parts[0] === "page" && parts[1]) {
          if (!items.some((i) => i.id === parts[1])) dropIds.add(t.id);
        } else if (parts[0] === "db" && parts[1]) {
          if (!items.some((i) => i.databaseId === parts[1])) dropIds.add(t.id);
        }
      }
      if (dropIds.size === 0) return prev;
      tlog("PRUNE drop", {
        droppedIds: Array.from(dropIds),
        keptLen: prev.length - dropIds.size,
      });
      return prev.filter((t) => !dropIds.has(t.id));
    });
  }, [items, hydrated]);

  // ── Persist to localStorage on change ────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ tabs, activeId: activeIdState }),
      );
      tlog("PERSIST", { storageKey, tabsLen: tabs.length, activeIdState });
    } catch {
      /* ignore quota errors */
    }
  }, [tabs, activeIdState, hydrated, storageKey]);

  // ── Reconcile the tab list with the current pathname ──────────────────────
  // The active tab follows navigation in place (the chosen "open in active tab"
  // model). New/duplicate tabs are created only by explicit user actions
  // (openInNewTab) — never here. All writes use functional updaters + a
  // deterministic auto-id so React Strict Mode's double-invoke can't duplicate.
  useEffect(() => {
    if (!hydrated) return;
    const norm = normalizePath(pathname);
    if (!isTabbable(norm)) {
      tlog("RECONCILE skip (not tabbable)", { pathname });
      return;
    }

    const cur = tabsRef.current;
    const activeTab = cur.find((t) => t.id === activeIdRef.current);
    tlog("RECONCILE", {
      pathname,
      activeIdRef: activeIdRef.current,
      activeTabFound: !!activeTab,
      tabsLen: cur.length,
    });

    if (activeTab) {
      if (normalizePath(activeTab.href) === norm) return; // already showing this path
      // Navigate the active tab in place.
      const meta = resolveMeta(norm);
      const id = activeTab.id;
      tlog("RECONCILE navigate-in-place", {
        from: activeTab.href,
        to: norm,
        id,
      });
      setTabs((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                href: norm,
                title: meta?.title ?? cleanDocTitle() ?? t.title,
                icon: meta?.icon ?? null,
                iconColor: meta?.iconColor ?? null,
              }
            : t,
        ),
      );
      return;
    }

    // No valid active tab → switch to an existing match, or auto-create one.
    const match = cur.find((t) => normalizePath(t.href) === norm);
    if (match) {
      tlog("RECONCILE activate match", { matchId: match.id });
      setActiveIdState(match.id);
      return;
    }
    const autoId = `auto:${norm}`;
    const tab = makeTab(norm, autoId);
    tlog("RECONCILE auto-create", { autoId, href: norm });
    setTabs((prev) =>
      prev.some((t) => normalizePath(t.href) === norm) ? prev : [...prev, tab],
    );
    setActiveIdState(autoId);
  }, [pathname, hydrated, resolveMeta, makeTab]);

  // ── Keep DB-row tab titles in sync with document.title ────────────────────
  useEffect(() => {
    if (!hydrated) return;
    const titleEl = document.querySelector("title");
    if (!titleEl) return;

    const sync = () => {
      const norm = normalizePath(pathnameRef.current);
      if (!isRowPath(norm)) return; // only rows rely on document.title
      const fresh = cleanDocTitle();
      if (!fresh) return;
      setTabs((prev) =>
        prev.map((t) =>
          normalizePath(t.href) === norm && t.title !== fresh
            ? { ...t, title: fresh }
            : t,
        ),
      );
    };

    sync();
    const obs = new MutationObserver(sync);
    obs.observe(titleEl, { childList: true });
    return () => obs.disconnect();
  }, [hydrated, pathname]);

  // ── Actions ───────────────────────────────────────────────────────────────
  // Always appends a fresh tab — duplicates of the same page are allowed (browser model).
  const openInNewTab = useCallback(
    (href: string, metaHint?: Partial<TabMeta>) => {
      const norm = normalizePath(href);
      const tab = makeTab(norm, newId(), metaHint);
      tlog("ACTION openInNewTab", { href: norm, newId: tab.id });
      setTabs((prev) => [...prev, tab]);
      setActiveIdState(tab.id);
      router.push(href);
    },
    [makeTab, router],
  );

  const activateTab = useCallback(
    (id: string) => {
      const tab = tabsRef.current.find((t) => t.id === id);
      if (!tab) return;
      tlog("ACTION activateTab", { id, href: tab.href });
      setActiveIdState(id);
      router.push(tab.href);
    },
    [router],
  );

  const closeTab = useCallback(
    (id: string) => {
      const cur = tabsRef.current;
      const idx = cur.findIndex((t) => t.id === id);
      if (idx === -1) return;
      tlog("ACTION closeTab", { id, idx, tabsLenBefore: cur.length });

      const rawActive = activeIdRef.current;
      const effActive =
        rawActive && cur.some((t) => t.id === rawActive)
          ? rawActive
          : (cur.find(
              (t) =>
                normalizePath(t.href) === normalizePath(pathnameRef.current),
            )?.id ?? null);

      const next = cur.filter((t) => t.id !== id);
      setTabs(next);

      if (id === effActive) {
        const neighbor = next[idx] ?? next[idx - 1] ?? null;
        if (neighbor) {
          setActiveIdState(neighbor.id);
          router.push(neighbor.href);
        } else {
          setActiveIdState(null);
          router.push("/app");
        }
      }
    },
    [router],
  );

  const closeOthers = useCallback(
    (id: string) => {
      const keep = tabsRef.current.find((t) => t.id === id);
      if (!keep) return;
      tlog("ACTION closeOthers", {
        keepId: id,
        droppedLen: tabsRef.current.length - 1,
        stack: new Error().stack?.split("\n").slice(1, 5),
      });
      setTabs([keep]);
      setActiveIdState(keep.id);
      if (normalizePath(keep.href) !== normalizePath(pathnameRef.current))
        router.push(keep.href);
    },
    [router],
  );

  const closeAll = useCallback(() => {
    tlog("ACTION closeAll", {
      stack: new Error().stack?.split("\n").slice(1, 5),
    });
    setTabs([]);
    setActiveIdState(null);
    router.push("/app");
  }, [router]);

  const reorderTabs = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    setTabs((prev) => {
      const from = prev.findIndex((t) => t.id === fromId);
      const to = prev.findIndex((t) => t.id === toId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  // ── Global ctrl/middle-click on internal links → open in a new tab ─────────
  // Covers the sidebar, in-editor page links, and links inside modals.
  useEffect(() => {
    if (!enabled) return;
    const onAux = (e: MouseEvent) => {
      if (e.button !== 1) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      const href = a?.getAttribute("href");
      if (isInternalTabbable(href)) {
        e.preventDefault();
        e.stopPropagation();
        openInNewTab(href);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || !(e.metaKey || e.ctrlKey)) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      const href = a?.getAttribute("href");
      if (isInternalTabbable(href)) {
        e.preventDefault();
        e.stopPropagation();
        openInNewTab(href);
      }
    };
    document.addEventListener("auxclick", onAux, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("auxclick", onAux, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [openInNewTab, enabled]);

  const value = useMemo<TabsContextValue>(
    () => ({
      tabs,
      activeId,
      suspendedIds,
      resolveMeta,
      openInNewTab,
      activateTab,
      closeTab,
      closeOthers,
      closeAll,
      reorderTabs,
    }),
    [
      tabs,
      activeId,
      suspendedIds,
      resolveMeta,
      openInNewTab,
      activateTab,
      closeTab,
      closeOthers,
      closeAll,
      reorderTabs,
    ],
  );

  // Inert on web: provide `null` so `useTabs()` behaves exactly as if there were
  // no provider (web keeps native browser-tab / ctrl-click semantics).
  return (
    <TabsContext.Provider value={enabled ? value : null}>
      {children}
    </TabsContext.Provider>
  );
}
