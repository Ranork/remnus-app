import type { ReactNode } from 'react';
import WikiSidebar from './WikiSidebar';
import type { WikiNavItem } from '@/lib/content';

// Two-column wiki chrome: persistent left sidebar (nav tree) + content slot.
// The per-page "On this page" TOC lives inside the content slot (right rail).
export default function WikiShell({
  items,
  heading,
  menuLabel,
  children,
}: {
  items: WikiNavItem[];
  heading: string;
  menuLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="relative px-4 sm:px-8 lg:px-14 py-10 lg:py-14">
      {/* Subtle blue glow, matching the hero section's background treatment.
          Clipped on its own isolated layer (not the section itself) so the
          sticky sidebar below never sits under an `overflow-hidden` ancestor
          — that can break `position: sticky` in some browsers. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-16 -right-40 w-150 h-150"
          style={{ background: 'radial-gradient(circle, rgba(68,92,149,0.16), transparent 60%)' }}
        />
        <div
          className="absolute top-120 -left-56 w-130 h-130"
          style={{ background: 'radial-gradient(circle, rgba(68,92,149,0.11), transparent 60%)' }}
        />
      </div>
      <div className="relative max-w-7xl mx-auto flex gap-10 lg:gap-12">
        <WikiSidebar items={items} heading={heading} menuLabel={menuLabel} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
