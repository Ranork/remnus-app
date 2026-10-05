'use client';

import LocalGraphView from './LocalGraphView';

/**
 * "Local map": the page's one- or two-step neighbourhood — since U4 the body of the
 * floating group's map panel. The group loads this module (and with it sigma, graphology
 * and the layout worker) only when the panel is first opened, so a page load costs a
 * button, not a WebGL context.
 */
export default function LocalGraphPanel({ workspaceId, pageId }: { workspaceId: string; pageId: string }) {
  return <LocalGraphView workspaceId={workspaceId} pageId={pageId} className="" />;
}
