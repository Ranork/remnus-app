import type { ReactNode } from 'react';
import MarketingShell from '@/components/marketing/MarketingShell';

// Shared chrome for /docs (index) and /docs/[slug] (article): MarketingShell +
// a subtle blue radial glow, matching the hero section's background treatment.
export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <MarketingShell>
      <div className="relative">
        {/* Clipped on its own isolated layer so overflow-hidden never sits on
            an ancestor of any sticky/positioned descendant. */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute -top-24 -right-40 w-160 h-160"
            style={{ background: 'radial-gradient(circle, rgba(68,92,149,0.16), transparent 60%)' }}
          />
          <div
            className="absolute top-130 -left-56 w-140 h-140"
            style={{ background: 'radial-gradient(circle, rgba(68,92,149,0.12), transparent 60%)' }}
          />
        </div>
        <div className="relative">{children}</div>
      </div>
    </MarketingShell>
  );
}
