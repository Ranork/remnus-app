'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronDown, Newspaper } from 'lucide-react';

interface Props {
  label: string;
  wikiTitle: string;
  wikiDesc: string;
  docsTitle: string;
  docsDesc: string;
}

// Nav "Resources" popup — combines /wiki and /docs behind one menu item.
// Opens on hover (desktop mega-menu convention) with a short close delay so
// the mouse can travel from the button into the panel, and toggles on click
// for keyboard/touch users. Closes on outside click and Escape.
export default function ResourcesNavDropdown({ label, wikiTitle, wikiDesc, docsTitle, docsDesc }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  function clearCloseTimer() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }

  const items = [
    { href: '/wiki', icon: BookOpen, title: wikiTitle, desc: wikiDesc },
    { href: '/docs', icon: Newspaper, title: docsTitle, desc: docsDesc },
  ];

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => {
        clearCloseTimer();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1 transition-colors duration-150 hover:text-neutral-100 cursor-pointer"
      >
        {label}
        <ChevronDown size={13} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 w-72 p-2 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl"
        >
          {items.map(({ href, icon: Icon, title, desc }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="group flex items-start gap-3 rounded-md p-2.5 hover:bg-neutral-800/60 transition-colors duration-150"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                <Icon size={16} />
              </span>
              <span className="flex flex-col">
                <span className="text-[13.5px] font-medium text-neutral-100">{title}</span>
                <span className="text-[12px] text-dim leading-snug">{desc}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
