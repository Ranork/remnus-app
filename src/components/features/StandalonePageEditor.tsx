'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { updateStandalonePageContent, updateWorkspaceItemTitle } from '@/lib/actions/workspace';
import BlockEditor from '@/components/features/editor/BlockEditor';

function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

type Item = { id: string; title: string };
type Page = { id: string; content: string };

export default function StandalonePageEditor({ item, page }: { item: Item; page: Page }) {
  const [title, setTitle] = useState(item.title);
  const savedTitle = useRef(item.title);

  useEffect(() => {
    if (title === savedTitle.current) return;
    const t = setTimeout(() => {
      updateWorkspaceItemTitle(item.id, title);
      savedTitle.current = title;
    }, 800);
    return () => clearTimeout(t);
  }, [title, item.id]);

  const handleContentChange = useMemo(
    () => debounce((md: string) => updateStandalonePageContent(item.id, md), 1000),
    [item.id]
  );

  return (
    <div className="max-w-4xl mx-auto px-8 lg:px-16 py-10">
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
          <ChevronLeft size={14} />
          Workspace
        </Link>
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Untitled"
        className="w-full bg-transparent text-white font-bold text-4xl focus:outline-none placeholder:text-neutral-700 mb-8 tracking-tight"
      />
      <BlockEditor
        key={page.id}
        initialContent={page.content}
        onChange={handleContentChange}
        placeholder="Start writing..."
      />
    </div>
  );
}
