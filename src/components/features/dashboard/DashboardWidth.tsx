'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import type { PageWidthMode } from '../PageActionsMenu';

/**
 * A dashboard's width (U4): the same three choices as a page — narrow, wide, full — kept
 * per dashboard in this browser (`dashboard-width-<id>`, like `page-width-<id>` and
 * `db-width-<id>`). A dashboard is a board of tiles, not a reading column, so its steps
 * are wider than a page's: wide is the width it always had, and stays the default.
 */
const WIDTH_CLASS: Record<PageWidthMode, string> = {
  narrow: 'max-w-4xl px-5 sm:px-10',
  wide: 'max-w-6xl px-5 sm:px-10',
  full: 'max-w-none px-5 sm:px-10 lg:px-16',
};

const ORDER: PageWidthMode[] = ['narrow', 'wide', 'full'];
const DEFAULT_MODE: PageWidthMode = 'wide';

const WidthContext = createContext<{ mode: PageWidthMode; cycle: () => void } | null>(null);

const storageKey = (itemId: string) => `dashboard-width-${itemId}`;

/** The dashboard's column. Wraps the server-rendered dashboard; the header's button sets it. */
export function DashboardWidthFrame({ itemId, children }: { itemId: string; children: React.ReactNode }) {
  const [mode, setMode] = useState<PageWidthMode>(DEFAULT_MODE);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(itemId));
      if (saved === 'narrow' || saved === 'wide' || saved === 'full') setMode(saved);
    } catch { /* storage blocked: the default width */ }
  }, [itemId]);

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
    setMode(next);
    try { localStorage.setItem(storageKey(itemId), next); } catch { /* not kept */ }
  };

  return (
    <WidthContext.Provider value={{ mode, cycle }}>
      <div className={`mx-auto w-full py-8 sm:py-10 ${WIDTH_CLASS[mode]}`}>{children}</div>
    </WidthContext.Provider>
  );
}

/** "⇆ Wide" in the dashboard header — one click steps to the next width, like a database view's. */
export function DashboardWidthButton({ compact = false }: { compact?: boolean }) {
  const tPage = useTranslations('Page');
  const ctx = useContext(WidthContext);
  if (!ctx) return null;
  const label = tPage(ctx.mode);
  return (
    <Tooltip content={tPage('widthLabel')}>
      <Button
        variant="ghost"
        size={compact ? 'xs' : 'sm'}
        onClick={ctx.cycle}
        aria-label={`${tPage('widthLabel')}: ${label}`}
        // Widths only differ where the screen is wider than a dashboard's column.
        className="hidden shrink-0 lg:inline-flex"
      >
        <ArrowLeftRight />
        {label}
      </Button>
    </Tooltip>
  );
}
