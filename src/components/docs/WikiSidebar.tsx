'use client';

import { useState } from 'react';
import Link from '@/components/ui/link';
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
            className={`group flex h-8 items-center gap-2.5 rounded-control px-2.5 text-ui transition-colors duration-150 ${
              active
                ? 'bg-sheet font-medium text-fg shadow-lift'
                : 'text-fg-2 hover:bg-sheet/55 hover:text-fg'
            }`}
          >
            {Icon && (
              <Icon size={15} className={`shrink-0 ${active ? 'text-fg' : 'text-fg-3'}`} />
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
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
          <p className="m-0 mb-2 px-2.5 text-ui font-medium text-fg-3">
            {heading}
          </p>
          <NavList items={items} pathname={pathname} />
        </div>
      </aside>

      {/* Mobile: collapsible menu */}
      <div className="mb-4 rounded-[14px] bg-sheet shadow-sheet lg:hidden">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-3 text-ui text-fg-2 transition-colors hover:text-fg"
        >
          {mobileOpen ? <X size={14} /> : <List size={14} />}
          <span className="font-medium">{menuLabel}</span>
          <ChevronDown
            size={13}
            className={`ml-auto transition-transform duration-200 ${mobileOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {mobileOpen && (
          <div className="border-t border-line p-2">
            <NavList items={items} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </div>
        )}
      </div>
    </>
  );
}
