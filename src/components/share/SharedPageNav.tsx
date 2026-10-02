'use client';
import { useState } from 'react';
import Link from '@/components/ui/link';
import { useTranslations } from 'next-intl';
import { ChevronRight, ChevronDown, List } from 'lucide-react';
import PageIcon from '@/components/features/PageIcon';
import type { SharedNavItem } from '@/app/[locale]/share/[...slug]/page';
import { cn } from '@/lib/cn';

// The shared tree of a public page, drawn like the app's sidebar: rows on the desk, the
// open page lifted (sheet + lift shadow), hover a partial lift.

function NavNode({
  item,
  currentPageId,
  depth,
  untitled,
}: {
  item: SharedNavItem;
  currentPageId: string;
  depth: number;
  untitled: string;
}) {
  const isCurrent = item.id === currentPageId;
  const hasChildren = item.children.length > 0;

  // Auto-expand if current page is in this subtree
  const containsCurrent = (node: SharedNavItem): boolean =>
    node.id === currentPageId || node.children.some(containsCurrent);
  const [open, setOpen] = useState(() => containsCurrent(item));

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-control py-1 pr-2 text-ui transition-[background-color,box-shadow]',
          isCurrent ? 'bg-sheet font-medium text-fg shadow-lift' : 'text-fg-2 hover:bg-sheet/55 hover:text-fg',
        )}
        style={{ paddingLeft: `${4 + depth * 14}px` }}
      >
        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-expanded={hasChildren ? open : undefined}
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-sm text-fg-3 transition-colors',
            hasChildren ? 'cursor-pointer hover:bg-hover hover:text-fg' : 'pointer-events-none opacity-0',
          )}
          tabIndex={hasChildren ? 0 : -1}
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>

        {item.icon && (
          <span className="shrink-0">
            <PageIcon icon={item.icon} iconColor={item.iconColor} size={14} fallbackType="page" />
          </span>
        )}

        <Link
          href={`/share/${item.slug}`}
          aria-current={isCurrent ? 'page' : undefined}
          className="flex-1 truncate leading-6"
        >
          {item.title || untitled}
        </Link>
      </div>

      {hasChildren && open && (
        <div className="mt-px flex flex-col gap-px">
          {item.children.map(child => (
            <NavNode key={child.id} item={child} currentPageId={currentPageId} depth={depth + 1} untitled={untitled} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SharedPageNav({
  navTree,
  currentPageId,
  mobileOnly = false,
  desktopOnly = false,
}: {
  navTree: SharedNavItem[];
  currentPageId: string;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
}) {
  const t = useTranslations('Sharing');
  const tPage = useTranslations('Page');
  const [mobileOpen, setMobileOpen] = useState(false);

  const tree = (
    <nav aria-label={t('contents')} className="flex flex-col gap-px">
      {navTree.map(item => (
        <NavNode key={item.id} item={item} currentPageId={currentPageId} depth={0} untitled={tPage('untitled')} />
      ))}
    </nav>
  );

  if (desktopOnly) {
    return (
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-12 max-h-[calc(100dvh-3rem)] overflow-y-auto px-2 pt-1 pb-4">
          {tree}
        </div>
      </aside>
    );
  }

  if (mobileOnly) {
    return (
      <div className="border-b border-line lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(v => !v)}
          aria-expanded={mobileOpen}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-ui font-medium text-fg-2 transition-colors hover:text-fg"
        >
          <List className="size-4 text-fg-3" aria-hidden />
          <span>{t('contents')}</span>
          <ChevronDown
            aria-hidden
            className={cn('ml-auto size-4 text-fg-3 transition-transform', mobileOpen && 'rotate-180')}
          />
        </button>
        {mobileOpen && <div className="px-2 pb-3">{tree}</div>}
      </div>
    );
  }

  return null;
}
