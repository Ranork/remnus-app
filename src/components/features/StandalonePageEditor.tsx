'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { updateStandalonePageContent, updateWorkspaceItemTitle } from '@/lib/actions/workspace';

type Item = { id: string; title: string };
type Page = { id: string; content: string };

export default function StandalonePageEditor({ item, page }: { item: Item; page: Page }) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(page.content);
  const savedTitle = useRef(item.title);
  const savedContent = useRef(page.content);

  useEffect(() => {
    if (title === savedTitle.current) return;
    const t = setTimeout(() => {
      updateWorkspaceItemTitle(item.id, title);
      savedTitle.current = title;
    }, 800);
    return () => clearTimeout(t);
  }, [title, item.id]);

  useEffect(() => {
    if (content === savedContent.current) return;
    const t = setTimeout(() => {
      updateStandalonePageContent(item.id, content);
      savedContent.current = content;
    }, 1000);
    return () => clearTimeout(t);
  }, [content, item.id]);

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
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Start writing..."
        className="w-full min-h-[500px] bg-transparent text-neutral-300 focus:outline-none resize-none text-base leading-loose placeholder:text-neutral-700"
      />
    </div>
  );
}
