'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, List, X } from 'lucide-react';
import type { WikiNavItem } from '@/lib/content';
// Imported directly (not passed as a prop) — Lucide icon components are
// functions and can't cross the server→client RSC boundary as prop data.
import { WIKI_PAGES } from '@/lib/content/manifest';

const WIKI_ICONS = new Map(WIKI_PAGES.map((p) => [p.slug, p.icon]));

function hrefFor(slug: string): string {
  return slug ? `/wiki/${slug}` : '/wiki';
}

// Strip a possible /xx locale prefix (defensive — localePrefix is 'never').
function normalize(pathname: string): string {
  return pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/';
}

function NavList({
  items,
  pathname,
  onNavigate,
}: {
  items: WikiNavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const current = normalize(pathname);
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const href = hrefFor(item.slug);
        const active = current === href;
        const Icon = WIKI_ICONS.get(item.slug);
        return (
          <Link
            key={item.slug || 'overview'}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] transition-colors duration-150 ${
              active
                ? 'bg-blue-500/10 text-neutral-100 font-medium'
                : 'text-neutral-50 hover:text-neutral-100 hover:bg-white/5'
            }`}
          >
            {Icon && (
              <Icon size={14} className={`shrink-0 ${active ? 'text-blue-500' : 'text-neutral-500'}`} />
            )}
            <span className="truncate">{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function WikiSidebar({
  items,
  heading,
  menuLabel,
}: {
  items: WikiNavItem[];
  heading: string;
  menuLabel: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop: sticky left rail */}
      <aside className="hidden lg:block w-60 shrink-0">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-neutral-500 px-2.5 mb-2.5">
            {heading}
          </p>
          <NavList items={items} pathname={pathname} />
        </div>
      </aside>

      {/* Mobile: collapsible menu */}
      <div className="lg:hidden mb-6 rounded-lg border border-neutral-800 bg-neutral-900/40">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 text-[13px] text-neutral-50 hover:text-neutral-100 transition-colors"
        >
          {mobileOpen ? <X size={14} /> : <List size={14} />}
          <span className="font-medium">{menuLabel}</span>
          <ChevronDown
            size={13}
            className={`ml-auto transition-transform duration-200 ${mobileOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {mobileOpen && (
          <div className="border-t border-neutral-800 p-2">
            <NavList items={items} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </div>
        )}
      </div>
    </>
  );
}
