'use client';
import Link from '@/components/ui/link';
import { FileText, Database as DatabaseIcon, LayoutDashboard } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RelatedPageRef } from '@/lib/actions/workspace';

const TYPE_ICON: Record<RelatedPageRef['type'], typeof FileText> = {
  page: FileText,
  database: DatabaseIcon,
  database_row: FileText,
  // A dashboard reaches this panel only as a page's parent or child, never as
  // a link — see editor/pageLinkData.ts.
  dashboard: LayoutDashboard,
};

function hrefFor(ref: RelatedPageRef): string {
  if (ref.type === 'database') return `/db/${ref.databaseId || ref.id}`;
  if (ref.type === 'database_row') return `/db/${ref.databaseId}/${ref.id}`;
  if (ref.type === 'dashboard') return `/dashboard/${ref.id}`;
  return `/page/${ref.id}`;
}

/**
 * The pages that link here ("linked mentions") — since U4 the body of the floating
 * group's backlinks panel, whose button shows only when there are any. The group read
 * them with the page's other panels (the page_links graph, get_related_pages' web-facing
 * wrapper), so nothing here waits on a request.
 */
export default function BacklinksList({ backlinks }: { backlinks: RelatedPageRef[] }) {
  const t = useTranslations('Page');
  return (
    // Rows, not cards: an icon and a title, lifted on hover.
    <ul className="-mx-2 flex flex-col">
      {backlinks.map((ref) => {
        const Icon = TYPE_ICON[ref.type];
        return (
          <li key={ref.id} className="min-w-0">
            <Link
              href={hrefFor(ref)}
              className="flex items-center gap-2 rounded-control px-2 py-1.5 text-sm text-fg-2 transition-colors hover:bg-hover hover:text-fg"
            >
              <Icon size={14} className="shrink-0 text-fg-3" aria-hidden />
              <span className="truncate">{ref.title || t('untitled')}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
