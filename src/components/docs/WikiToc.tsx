'use client';

import { useEffect, useState } from 'react';
import type { DocHeading } from '@/lib/content';

export default function WikiToc({ headings, label }: { headings: DocHeading[]; label: string }) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    if (headings.length === 0) return;
    const elements = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <aside className="hidden xl:block w-56 shrink-0">
      <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-neutral-500 mb-2.5">
          {label}
        </p>
        <nav className="flex flex-col gap-1 border-l border-neutral-800">
          {headings.map((h) => {
            const active = activeId === h.id;
            return (
              <a
                key={h.id}
                href={`#${h.id}`}
                className={`-ml-px border-l pl-3 py-0.5 text-[12.5px] leading-snug transition-colors duration-150 ${
                  h.depth === 3 ? 'pl-6' : ''
                } ${
                  active
                    ? 'border-blue-500 text-neutral-100'
                    : 'border-transparent text-neutral-500 hover:text-neutral-200'
                }`}
              >
                {h.text}
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
