'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, Waypoints } from 'lucide-react';

// Nothing heavy is imported until the section is opened: the view (and with it
// sigma, graphology and the layout worker) is a dynamic chunk, so a page load
// costs one collapsed header, not a WebGL context.
const LocalGraphView = dynamic(() => import('./LocalGraphView'), {
  ssr: false,
  loading: () => <div className="mt-3 h-72 border border-neutral-800 bg-neutral-900" />,
});

/**
 * "Local map": the page's one- or two-step neighbourhood, under the backlinks.
 * Always starts closed — per page, per visit.
 */
export default function LocalGraphPanel({ workspaceId, pageId }: { workspaceId: string; pageId: string }) {
  const t = useTranslations('Graph');
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6 border-t border-neutral-800 pt-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-300"
      >
        <ChevronRight size={12} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        <Waypoints size={12} />
        {t('localTitle')}
      </button>
      {open && <LocalGraphView workspaceId={workspaceId} pageId={pageId} />}
    </div>
  );
}
