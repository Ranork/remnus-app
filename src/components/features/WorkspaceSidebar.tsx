'use client';
import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { FileText, Database, Plus, X } from 'lucide-react';
import { createStandalonePage, createWorkspaceDatabase } from '@/lib/actions/workspace';
import type { WorkspaceItemRow } from '@/lib/actions/workspace';

export default function WorkspaceSidebar({ items }: { items: WorkspaceItemRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [creatingType, setCreatingType] = useState<'page' | 'database' | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creatingType && inputRef.current) {
      inputRef.current.focus();
    }
  }, [creatingType]);

  const handleCreate = () => {
    const title = newTitle.trim();
    if (!title || !creatingType) return;

    startTransition(async () => {
      if (creatingType === 'page') {
        const { itemId } = await createStandalonePage(title);
        router.push(`/page/${itemId}`);
      } else {
        const { dbId } = await createWorkspaceDatabase(title);
        router.push(`/db/${dbId}`);
      }
      setCreatingType(null);
      setNewTitle('');
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') {
      setCreatingType(null);
      setNewTitle('');
    }
  };

  const isActive = (item: WorkspaceItemRow) => {
    if (item.type === 'database' && item.databaseId) {
      return pathname.startsWith(`/db/${item.databaseId}`);
    }
    return pathname === `/page/${item.id}`;
  };

  const hrefFor = (item: WorkspaceItemRow) => {
    if (item.type === 'database' && item.databaseId) return `/db/${item.databaseId}`;
    return `/page/${item.id}`;
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Workspace</span>
        <div className="relative group">
          <button
            className="p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
            title="New item"
            onClick={() => setCreatingType(creatingType ? null : 'page')}
          >
            <Plus size={14} />
          </button>
          {!creatingType && (
            <div className="absolute right-0 top-7 z-10 hidden group-focus-within:flex flex-col bg-neutral-800 border border-neutral-700 rounded-md shadow-lg overflow-hidden min-w-[140px]">
              <button
                className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 hover:text-white"
                onClick={() => setCreatingType('page')}
              >
                <FileText size={14} /> New Page
              </button>
              <button
                className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 hover:text-white"
                onClick={() => setCreatingType('database')}
              >
                <Database size={14} /> New Database
              </button>
            </div>
          )}
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto px-2 space-y-0.5 py-1">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={hrefFor(item)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                isActive(item)
                  ? 'bg-neutral-700 text-white'
                  : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              {item.type === 'database'
                ? <Database size={14} className="shrink-0 text-neutral-400" />
                : <FileText size={14} className="shrink-0 text-neutral-400" />
              }
              <span className="truncate">{item.title}</span>
            </Link>
          </li>
        ))}
      </ul>

      {creatingType && (
        <div className="px-2 pb-3 pt-1 border-t border-neutral-800">
          <div className="text-xs text-neutral-500 mb-1.5 px-1">
            {creatingType === 'page' ? 'New Page' : 'New Database'}
          </div>
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={creatingType === 'page' ? 'Page title...' : 'Database name...'}
              disabled={isPending}
              className="flex-1 bg-neutral-800 border border-neutral-600 rounded px-2 py-1 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-400"
            />
            <button
              onClick={() => { setCreatingType(null); setNewTitle(''); }}
              className="p-1 text-neutral-500 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex gap-1 mt-1.5">
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim() || isPending}
              className="flex-1 text-xs bg-neutral-700 hover:bg-neutral-600 disabled:opacity-40 text-white rounded px-2 py-1 transition-colors"
            >
              {isPending ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => setCreatingType(creatingType === 'page' ? 'database' : 'page')}
              className="text-xs text-neutral-500 hover:text-neutral-300 px-2 py-1"
            >
              Switch to {creatingType === 'page' ? 'Database' : 'Page'}
            </button>
          </div>
        </div>
      )}

      {!creatingType && (
        <div className="px-2 pb-3 pt-1 border-t border-neutral-800 flex gap-1">
          <button
            onClick={() => setCreatingType('page')}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded px-2 py-1.5 transition-colors"
          >
            <FileText size={12} /> Page
          </button>
          <button
            onClick={() => setCreatingType('database')}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded px-2 py-1.5 transition-colors"
          >
            <Database size={12} /> Database
          </button>
        </div>
      )}
    </div>
  );
}
