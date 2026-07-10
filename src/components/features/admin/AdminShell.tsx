'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeftRight } from 'lucide-react';

type WidthMode = 'narrow' | 'wide' | 'full';
const STORAGE_KEY = 'remnus_admin_width';

export default function AdminShell({
  icon,
  title,
  subtitle,
  headerActions,
  widthLabels,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  headerActions?: ReactNode;
  widthLabels: Record<WidthMode, string>;
  children: ReactNode;
}) {
  const [widthMode, setWidthMode] = useState<WidthMode>('wide');
  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as WidthMode | null;
    if (saved === 'narrow' || saved === 'wide' || saved === 'full') setWidthMode(saved);
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpenMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenu]);

  const setWidth = (w: WidthMode) => {
    setWidthMode(w);
    localStorage.setItem(STORAGE_KEY, w);
    setOpenMenu(false);
  };

  const containerClass =
    widthMode === 'full'
      ? 'w-full px-4 sm:px-8 md:px-16'
      : widthMode === 'narrow'
        ? 'mx-auto w-full max-w-4xl px-4 sm:px-8 lg:px-16'
        : 'mx-auto w-full max-w-7xl px-8';

  return (
    <div className="flex h-full flex-1 flex-col overflow-auto bg-neutral-850">
      <div className="shrink-0 border-b border-neutral-800 px-8 py-6">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <h1 className="text-lg font-semibold text-neutral-100">{title}</h1>
            <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {headerActions}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setOpenMenu((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-800 px-3 py-2 text-xs font-medium text-neutral-300 transition-colors hover:border-neutral-700 hover:bg-neutral-800/40 cursor-pointer"
              >
                <ArrowLeftRight size={13} className="text-neutral-500" />
                {widthLabels[widthMode]}
              </button>
              {openMenu && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-36 overflow-hidden rounded border border-neutral-800 bg-neutral-850 py-1.5 shadow-xl animate-fade-in animate-duration-100">
                  {(['narrow', 'wide', 'full'] as WidthMode[]).map((w) => (
                    <button
                      key={w}
                      onClick={() => setWidth(w)}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                        widthMode === w ? 'bg-blue-500/8 text-blue-400' : 'text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      {widthLabels[w]}
                      {widthMode === w && <span className="ml-auto text-[9px] text-blue-400">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={`flex flex-1 flex-col gap-9 py-7 ${containerClass}`}>{children}</div>
    </div>
  );
}
