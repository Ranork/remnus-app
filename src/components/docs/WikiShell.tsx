import type { ReactNode } from 'react';
import WikiSidebar from './WikiSidebar';
import type { WikiNavItem } from '@/lib/content';

// Two-column wiki chrome, the app's layout: the nav tree on the desk, the page on a sheet
// (WikiArticle). The per-page "On this page" TOC lives inside the content slot (right rail).
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
    <div className="px-4 py-8 sm:px-8 lg:py-10">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-0 lg:flex-row lg:gap-8">
        <WikiSidebar items={items} heading={heading} menuLabel={menuLabel} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
