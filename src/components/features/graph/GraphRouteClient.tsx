'use client';

import dynamic from 'next/dynamic';

// `ssr: false` must live in a client component (Next 16, guides/lazy-loading):
// the map is browser-only (WebGL, localStorage view prefs), and keeping it a
// dynamic chunk is what keeps its libraries out of every other route.
const GraphScreen = dynamic(() => import('./GraphScreen'), { ssr: false });

export default function GraphRouteClient({ workspace }: { workspace: { id: string; name: string } }) {
  return <GraphScreen workspace={workspace} />;
}
