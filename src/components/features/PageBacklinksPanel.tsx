'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Link2, FileText, Database as DatabaseIcon, LayoutDashboard } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getPageRelations, type RelatedPageRef } from '@/lib/actions/workspace';

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

// Notion-style "Linked mentions" panel — shown at the bottom of a page only
// when other pages actually reference it. Self-fetches via the page_links
// graph (get_related_pages' web-facing wrapper) so it never blocks the
// editor's own load.
export default function PageBacklinksPanel({ workspaceId, pageId }: { workspaceId: string; pageId: string }) {
  const t = useTranslations('Page');
  const [backlinks, setBacklinks] = useState<RelatedPageRef[] | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBacklinks(null);
    getPageRelations(workspaceId, pageId)
      .then((rel) => { if (!cancelled) setBacklinks(rel.backlinks); })
      .catch(() => { if (!cancelled) setBacklinks([]); });
    return () => { cancelled = true; };
  }, [workspaceId, pageId]);

  if (!backlinks || backlinks.length === 0) return null;

  return (
    <div className="mt-10 pt-6 border-t border-neutral-800">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
      >
        <ChevronRight size={12} className={`transition-transform ${collapsed ? '' : 'rotate-90'}`} />
        <Link2 size={12} />
        {t('backlinksTitle', { count: backlinks.length })}
      </button>

      {!collapsed && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {backlinks.map((ref) => {
            const Icon = TYPE_ICON[ref.type];
            return (
              <Link
                key={ref.id}
                href={hrefFor(ref)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:text-white rounded transition-colors truncate"
              >
                <Icon size={13} className="text-neutral-500 shrink-0" />
                <span className="truncate">{ref.title || t('untitled')}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
