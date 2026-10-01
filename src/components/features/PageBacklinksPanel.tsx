'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Link2, FileText, Database as DatabaseIcon, LayoutDashboard } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getPageRelations, type RelatedPageRef } from '@/lib/actions/workspace';
import PageSection from './PageSection';

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
    <PageSection
      icon={<Link2 />}
      title={t('backlinksTitle', { count: backlinks.length })}
      open={!collapsed}
      onToggle={() => setCollapsed((c) => !c)}
    >
      {/* Rows, not cards: an icon and a title, lifted on hover. */}
      <ul className="mt-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {backlinks.map((ref) => {
          const Icon = TYPE_ICON[ref.type];
          return (
            <li key={ref.id} className="min-w-0">
              <Link
                href={hrefFor(ref)}
                className="-mx-2 flex items-center gap-2 rounded-control px-2 py-1.5 text-sm text-fg-2 transition-colors hover:bg-hover hover:text-fg"
              >
                <Icon size={14} className="shrink-0 text-fg-3" aria-hidden />
                <span className="truncate">{ref.title || t('untitled')}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </PageSection>
  );
}
