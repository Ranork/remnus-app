'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Waypoints } from 'lucide-react';
import PageSection from '../PageSection';

// Nothing heavy is imported until the section is opened: the view (and with it
// sigma, graphology and the layout worker) is a dynamic chunk, so a page load
// costs one collapsed header, not a WebGL context.
const LocalGraphView = dynamic(() => import('./LocalGraphView'), {
  ssr: false,
  loading: () => <div className="mt-3 h-72 rounded-control border border-line bg-raised" />,
});

/**
 * "Local map": the page's one- or two-step neighbourhood, under the backlinks.
 * Always starts closed — per page, per visit.
 */
export default function LocalGraphPanel({ workspaceId, pageId }: { workspaceId: string; pageId: string }) {
  const t = useTranslations('Graph');
  const [open, setOpen] = useState(false);

  return (
    <PageSection icon={<Waypoints />} title={t('localTitle')} open={open} onToggle={() => setOpen((v) => !v)}>
      <LocalGraphView workspaceId={workspaceId} pageId={pageId} />
    </PageSection>
  );
}
