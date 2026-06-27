'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import PageIcon from './PageIcon';
import { useTabs, type Tab } from '@/components/providers/TabsContext';

/**
 * Tab strip designed to live INSIDE the Tauri titlebar row (no own background/border).
 * Renders chevron scroll controls when the tabs overflow, then a trailing "+".
 */
export default function TabBar() {
  const tabs = useTabs();
  const router = useRouter();
  const t = useTranslations('Layout');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Dedupe router.prefetch — Next caches by route key, but the call still costs.
  const prefetchedRef = useRef<Set<string>>(new Set());
  const prefetch = useCallback((href: string) => {
    if (prefetchedRef.current.has(href)) return;
    prefetchedRef.current.add(href);
    try { router.prefetch(href); } catch { /* noop */ }
  }, [router]);

  const activeId = tabs?.activeId ?? null;
  const count = tabs?.tabs.length ?? 0;

  const updateOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setOverflow({
      left: el.scrollLeft > 1,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateOverflow();
    const onScroll = () => updateOverflow();
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(updateOverflow);
    ro.observe(el);
    window.addEventListener('resize', updateOverflow);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
      window.removeEventListener('resize', updateOverflow);
    };
  }, [updateOverflow, count]);

  // Keep the active tab visible.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !activeId) return;
    const node = el.querySelector(`[data-tab-id="${activeId}"]`) as HTMLElement | null;
    node?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [activeId]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  if (!tabs || tabs.tabs.length === 0) return null;

  const { tabs: list, suspendedIds, resolveMeta, activateTab, closeTab, closeOthers, closeAll, reorderTabs, openInNewTab } = tabs;

  const scrollByDir = (dir: 1 | -1) => scrollRef.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });

  const displayMeta = (tab: Tab) => {
    const live = resolveMeta(tab.href);
    const isDatabase = tab.href.startsWith('/db/') && tab.href.split('/').filter(Boolean).length === 2;
    return {
      title: (live?.title || tab.title || t('tabUntitled')),
      icon: live ? live.icon : tab.icon,
      iconColor: live ? live.iconColor : tab.iconColor,
      isDatabase,
    };
  };

  return (
    <div className="flex items-stretch min-w-0 max-w-[calc(100%-180px)] h-full">
      {overflow.left && (
        <button
          onClick={() => scrollByDir(-1)}
          className="shrink-0 px-1 flex items-center justify-center text-neutral-500 hover:text-neutral-100 hover:bg-neutral-800/50 transition-colors"
          tabIndex={-1}
        >
          <ChevronLeft size={14} />
        </button>
      )}

      <div
        ref={scrollRef}
        className="tabstrip-scroll flex items-stretch min-w-0 overflow-x-auto"
      >
        {list.map((tab) => {
          const meta = displayMeta(tab);
          const isActive = tab.id === activeId;
          // Suspended/not-yet-loaded tabs render dimmed ("passive"); clicking one
          // reactivates and re-loads it from scratch.
          const isSuspended = suspendedIds.has(tab.id);
          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              draggable
              onDragStart={() => setDragId(tab.id)}
              onDragOver={(e) => { e.preventDefault(); if (dragId && dragId !== tab.id) setOverId(tab.id); }}
              onDragLeave={() => setOverId((cur) => (cur === tab.id ? null : cur))}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId && dragId !== tab.id) reorderTabs(dragId, tab.id);
                setDragId(null);
                setOverId(null);
              }}
              onMouseEnter={() => prefetch(tab.href)}
              onFocus={() => prefetch(tab.href)}
              onClick={() => activateTab(tab.id)}
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); closeTab(tab.id); } }}
              onContextMenu={(e) => { e.preventDefault(); setMenu({ id: tab.id, x: e.clientX, y: e.clientY }); }}
              title={meta.title}
              className={`group/tab relative flex items-center gap-1.5 pl-3 pr-2 w-[170px] shrink-0 cursor-default border-r border-neutral-800 transition-colors ${
                isActive ? 'bg-neutral-850 text-neutral-50' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800/40'
              } ${!isActive && isSuspended ? 'opacity-50' : ''} ${overId === tab.id ? 'border-l-2 border-l-blue-500' : ''}`}
            >
              <PageIcon
                icon={meta.icon}
                iconColor={meta.iconColor}
                size={14}
                fallbackType={meta.isDatabase ? 'database' : 'page'}
              />
              <span className="truncate flex-1 min-w-0 text-xs">{meta.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                title={t('tabClose')}
                className="shrink-0 p-0.5 rounded text-neutral-500 hover:text-neutral-100 hover:bg-neutral-700 opacity-0 group-hover/tab:opacity-100 transition-opacity"
                tabIndex={-1}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {overflow.right && (
        <button
          onClick={() => scrollByDir(1)}
          className="shrink-0 px-1 flex items-center justify-center text-neutral-500 hover:text-neutral-100 hover:bg-neutral-800/50 transition-colors"
          tabIndex={-1}
        >
          <ChevronRight size={14} />
        </button>
      )}

      <button
        onClick={() => openInNewTab('/app')}
        title={t('tabNewTooltip')}
        className="shrink-0 px-2.5 flex items-center justify-center text-neutral-500 hover:text-neutral-100 hover:bg-neutral-800/40 border-r border-neutral-800 transition-colors"
        tabIndex={-1}
      >
        <Plus size={15} />
      </button>

      {menu && (
        <div
          ref={menuRef}
          className="fixed z-[120] min-w-[160px] bg-neutral-900 border border-neutral-800 rounded-md py-1 shadow-xl text-xs"
          style={{ top: menu.y, left: menu.x }}
        >
          <button onClick={() => { closeTab(menu.id); setMenu(null); }} className="w-full text-left px-3 py-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-50">
            {t('tabClose')}
          </button>
          <button onClick={() => { closeOthers(menu.id); setMenu(null); }} className="w-full text-left px-3 py-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-50">
            {t('tabCloseOthers')}
          </button>
          <button onClick={() => { closeAll(); setMenu(null); }} className="w-full text-left px-3 py-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-50">
            {t('tabCloseAll')}
          </button>
        </div>
      )}
    </div>
  );
}
