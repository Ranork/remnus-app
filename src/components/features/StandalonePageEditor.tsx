'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, ArrowLeftRight, Smile } from 'lucide-react';
import { updateStandalonePageContent, updateWorkspaceItemTitle, updateWorkspaceItemIcon } from '@/lib/actions/workspace';
import BlockEditor from '@/components/features/editor/BlockEditor';
import PageIcon from './PageIcon';
import IconPicker from './IconPicker';

function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

type Item = { id: string; title: string; icon?: string | null; iconColor?: string | null };
type Page = { id: string; content: string };

export default function StandalonePageEditor({ item, page }: { item: Item; page: Page }) {
  const [title, setTitle] = useState(item.title);
  const savedTitle = useRef(item.title);
  const [icon, setIcon] = useState(item.icon);
  const [iconColor, setIconColor] = useState(item.iconColor);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const iconButtonRef = useRef<HTMLButtonElement>(null);
  type WidthMode = 'narrow' | 'wide' | 'full';
  const [widthMode, setWidthMode] = useState<WidthMode>('narrow');

  useEffect(() => {
    const saved = localStorage.getItem(`page-width-${item.id}`) as WidthMode | null;
    if (saved === 'narrow' || saved === 'wide' || saved === 'full') setWidthMode(saved);
    else if (saved === 'true') setWidthMode('full'); // migrate old boolean
  }, [item.id]);

  const cycleWidth = () => {
    const next: WidthMode = widthMode === 'narrow' ? 'wide' : widthMode === 'wide' ? 'full' : 'narrow';
    setWidthMode(next);
    localStorage.setItem(`page-width-${item.id}`, next);
  };

  const handleIconSelect = async (newIcon: string | null, newColor: string | null) => {
    setIcon(newIcon);
    setIconColor(newColor);
    await updateWorkspaceItemIcon(item.id, newIcon, newColor);
  };

  const widthLabels: Record<WidthMode, string> = { narrow: 'Narrow', wide: 'Wide', full: 'Full width' };

  useEffect(() => {
    if (title === savedTitle.current) return;
    const t = setTimeout(() => {
      updateWorkspaceItemTitle(item.id, title);
      savedTitle.current = title;
    }, 800);
    return () => clearTimeout(t);
  }, [title, item.id]);

  useEffect(() => {
    document.title = `${title || 'Untitled'} | Remna`;
  }, [title]);

  const handleContentChange = useMemo(
    () => debounce((md: string) => updateStandalonePageContent(item.id, md), 1000),
    [item.id]
  );

  const containerClass =
    widthMode === 'full' ? 'px-16 py-10' :
    widthMode === 'wide' ? 'max-w-7xl mx-auto px-8 lg:px-12 py-10' :
    'max-w-4xl mx-auto px-8 lg:px-16 py-10';

  return (
    <div className={containerClass}>
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
          <ChevronLeft size={14} />
          Workspace
        </Link>
        <button
          onClick={cycleWidth}
          className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors p-1 cursor-pointer"
        >
          <ArrowLeftRight size={14} />
          {widthLabels[widthMode]}
        </button>
      </div>

      {/* Unified Page Header: Icon + Title Input */}
      <div className="flex items-center gap-3 mb-8 group/page-header relative select-none">
        <div className="relative shrink-0 flex items-center group/icon-wrapper">
          <div className="relative flex items-center">
            <button
              ref={iconButtonRef}
              onClick={() => setShowIconPicker(!showIconPicker)}
              className="p-1 hover:bg-neutral-800 rounded transition-colors duration-150 cursor-pointer flex items-center justify-center shrink-0"
              title={icon ? "Change icon" : "Add icon"}
            >
              <PageIcon icon={icon} iconColor={iconColor} size={40} fallbackType="page" />
            </button>
            {icon && (
              <button
                onClick={() => handleIconSelect(null, null)}
                className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover/icon-wrapper:opacity-100 px-1.5 py-0.5 text-[9px] bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white rounded transition-all cursor-pointer font-medium whitespace-nowrap shadow-xl z-20"
              >
                Remove
              </button>
            )}
          </div>

          {showIconPicker && (
            <IconPicker
              currentIcon={icon}
              currentIconColor={iconColor}
              onSelect={handleIconSelect}
              onClose={() => setShowIconPicker(false)}
              anchorRef={iconButtonRef}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            className="w-full bg-transparent text-white font-bold text-4xl focus:outline-none placeholder:text-neutral-700 tracking-tight py-1"
          />
        </div>
      </div>
      <BlockEditor
        key={page.id}
        initialContent={page.content}
        onChange={handleContentChange}
        placeholder="Start writing..."
      />
    </div>
  );
}
