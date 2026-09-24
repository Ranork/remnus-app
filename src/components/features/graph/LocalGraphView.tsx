'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getLocalGraphData } from '@/lib/actions/graph';
import { graphNodeHref, type GraphPayload } from '@/lib/graph/types';
import GraphCanvas, { type GraphLayers } from './GraphCanvas';

const ALL_LAYERS: GraphLayers = { hierarchy: true, membership: true, link: true, mention: true, tag: true, code: true };

/** The opened half of `LocalGraphPanel` — loaded on demand, never with the page. */
export default function LocalGraphView({ workspaceId, pageId }: { workspaceId: string; pageId: string }) {
  const t = useTranslations('Graph');
  const router = useRouter();
  const [depth, setDepth] = useState<1 | 2>(1);
  const [result, setResult] = useState<{ key: string; payload: GraphPayload | null; failed: boolean } | null>(null);
  const key = `${pageId}:${depth}`;

  useEffect(() => {
    let cancelled = false;
    getLocalGraphData(workspaceId, pageId, depth)
      .then((payload) => { if (!cancelled) setResult({ key, payload, failed: false }); })
      .catch(() => { if (!cancelled) setResult({ key, payload: null, failed: true }); });
    return () => { cancelled = true; };
  }, [workspaceId, pageId, depth, key]);

  const current = result?.key === key ? result : null;
  const payload = current?.payload ?? null;
  const connected = !!payload && payload.nodes.length > 1;

  const open = (id: string) => {
    if (!payload) return;
    const node = payload.nodes.find((n) => n[0] === id);
    const href = node ? graphNodeHref(node, payload.nodes) : null;
    if (href && id !== pageId) router.push(href);
  };

  return (
    <div className="mt-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <div className="flex border border-neutral-800" role="group">
          {([1, 2] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={depth === d}
              onClick={() => setDepth(d)}
              className={`px-2 py-0.5 transition-colors ${depth === d ? 'bg-neutral-800 text-neutral-50' : 'text-neutral-400 hover:text-neutral-200'}`}
            >
              {d === 1 ? t('localDepth1') : t('localDepth2')}
            </button>
          ))}
        </div>
        {payload?.truncated && <span className="text-neutral-500">{t('localTruncated', { count: payload.nodes.length })}</span>}
        <Link href={`/graph/${workspaceId}`} className="ml-auto text-neutral-400 hover:text-neutral-100">
          {t('localOpenFull')}
        </Link>
      </div>
      <div className="relative h-72 border border-neutral-800 bg-neutral-900">
        {!current ? null : current.failed ? (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500">{t('loadFailed')}</p>
        ) : !connected ? (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-neutral-500">{t('localEmpty')}</p>
        ) : (
          <GraphCanvas
            key={key}
            payload={payload!}
            layout="network"
            colorMode="type"
            layers={ALL_LAYERS}
            clickBehavior="open"
            onOpen={open}
          />
        )}
      </div>
    </div>
  );
}
