'use client';

import dynamic from 'next/dynamic';
import type { GraphWorkspace } from '@/lib/actions/graph';

// `ssr: false` must live in a client component (Next 16, guides/lazy-loading):
// the map is browser-only (WebGL, localStorage view prefs), and keeping it a
// dynamic chunk is what keeps its libraries out of every other route.
const GraphScreen = dynamic(() => import('./GraphScreen'), { ssr: false });

export default function GraphRouteClient({
  workspace,
  switchable,
}: {
  workspace: GraphWorkspace & { homeDashboardItemId: string | null };
  switchable: GraphWorkspace[] | null;
}) {
  // Keyed by workspace: switching projects starts a fresh map (layout, selection,
  // expanded databases) instead of merging the next workspace into this one as if
  // it were a live refresh. View prefs live in localStorage, so they carry over.
  return <GraphScreen key={workspace.id} workspace={workspace} switchable={switchable} />;
}
