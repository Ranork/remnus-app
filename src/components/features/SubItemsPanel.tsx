'use client';
import { useState, useEffect, useTransition, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, FileText, Database, Trash, MoreHorizontal, ChevronDown, ChevronRight } from 'lucide-react';
import { getSubItems, createStandalonePage, createWorkspaceDatabase, deleteWorkspaceItem, updateWorkspaceItemTitle } from '@/lib/actions/workspace';
import type { WorkspaceItemRow } from '@/lib/actions/workspace';
import PageIcon from './PageIcon';

interface SubItemsPanelProps {
  parentId: string;
  workspaceId: string;
}

export default function SubItemsPanel({ parentId, workspaceId }: SubItemsPanelProps) {
  const router = useRouter();
  const [items, setItems] = useState<WorkspaceItemRow[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(true);
  const [loading, setLoading] = useState(true);

  // Menu states
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Rename states
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const fetchItems = async () => {
    try {
      const data = await getSubItems(parentId);
      setItems(data);
    } catch (err) {
      console.error('Failed to load sub items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentId]);

  useEffect(() => {
    if (!activeMenuId) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [activeMenuId]);

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  const handleCreatePage = () => {
    startTransition(async () => {
      const { itemId } = await createStandalonePage(workspaceId, 'Untitled Page', parentId);
      router.push(`/page/${itemId}`);
    });
  };

  const handleCreateDatabase = () => {
    startTransition(async () => {
      const { dbId } = await createWorkspaceDatabase(workspaceId, 'Untitled Database', {
        parentId,
      });
      router.push(`/db/${dbId}`);
    });
  };

  const handleDelete = (itemId: string) => {
    setActiveMenuId(null);
    if (!confirm('Are you sure you want to delete this sub-item?')) return;
    startTransition(async () => {
      await deleteWorkspaceItem(itemId);
      await fetchItems();
      router.refresh();
    });
  };

  const handleStartRename = (item: WorkspaceItemRow) => {
    setActiveMenuId(null);
    setRenamingId(item.id);
    setRenamingTitle(item.title);
  };

  const handleRename = (item: WorkspaceItemRow) => {
    const title = renamingTitle.trim();
    if (!title || title === item.title) {
      setRenamingId(null);
      return;
    }
    startTransition(async () => {
      await updateWorkspaceItemTitle(item.id, title);
      setRenamingId(null);
      await fetchItems();
      router.refresh();
    });
  };

  const openMenuFor = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuAnchor({ x: rect.left, y: rect.bottom + 4 });
    setActiveMenuId(itemId);
  };

  const hrefFor = (item: WorkspaceItemRow) => {
    if (item.type === 'database' && item.databaseId) return `/db/${item.databaseId}`;
    return `/page/${item.id}`;
  };

  if (loading) {
    return (
      <div className="py-4 flex items-center gap-2 text-xs text-neutral-500">
        <div className="w-3 h-3 rounded-full border border-neutral-700 border-t-neutral-400 animate-spin" />
        <span>Loading sub-items...</span>
      </div>
    );
  }

  return (
    <div className="border-t border-b border-neutral-800/40 py-3.5 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between group/header mb-2.5">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-neutral-200 transition-colors uppercase tracking-wider cursor-pointer"
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>Sub-pages & Databases ({items.length})</span>
        </button>

        {isExpanded && (
          <div className="flex items-center gap-2 opacity-0 group-hover/header:opacity-100 transition-opacity">
            <button
              onClick={handleCreatePage}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-400 hover:text-neutral-200 bg-neutral-800/30 hover:bg-neutral-800/60 px-2 py-1 rounded transition-all cursor-pointer disabled:opacity-50"
            >
              <Plus size={11} />
              <span>Page</span>
            </button>
            <button
              onClick={handleCreateDatabase}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-400 hover:text-neutral-200 bg-neutral-800/30 hover:bg-neutral-800/60 px-2 py-1 rounded transition-all cursor-pointer disabled:opacity-50"
            >
              <Plus size={11} />
              <span>Database</span>
            </button>
          </div>
        )}
      </div>

      {/* Expanded Items List */}
      {isExpanded && (
        <div className="space-y-1">
          {items.length === 0 ? (
            <p className="text-xs text-neutral-600 italic pl-5 py-1">No nested items. Click + Page or + Database to add one.</p>
          ) : (
            items.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-neutral-800/20 group/item transition-colors text-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* Icon */}
                  <span className="shrink-0 flex items-center justify-center">
                    <PageIcon
                      icon={item.icon}
                      iconColor={item.iconColor}
                      size={16}
                      fallbackType={item.type}
                    />
                  </span>

                  {/* Title / Rename input */}
                  {renamingId === item.id ? (
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renamingTitle}
                      onChange={e => setRenamingTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(item);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      onBlur={() => handleRename(item)}
                      className="bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-blue-500/60 flex-1 max-w-sm"
                    />
                  ) : (
                    <Link
                      href={hrefFor(item)}
                      className="truncate font-medium text-neutral-200 hover:text-white transition-colors flex-1"
                    >
                      {item.title}
                    </Link>
                  )}
                </div>

                {/* Actions (Rename / Delete) */}
                {renamingId !== item.id && (
                  <div className="opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center gap-1">
                    <button
                      onClick={(e) => openMenuFor(e, item.id)}
                      className="p-1 rounded hover:bg-neutral-850 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                    >
                      <MoreHorizontal size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Floating Menu */}
      {activeMenuId && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            left: menuAnchor ? menuAnchor.x : 0,
            top: menuAnchor ? menuAnchor.y : 0,
            zIndex: 9999
          }}
          className="bg-neutral-900 border border-neutral-800 shadow-xl py-1 w-32 rounded overflow-hidden text-left animate-fade-in animate-duration-100"
        >
          <button
            onClick={() => {
              const matched = items.find(i => i.id === activeMenuId);
              if (matched) handleStartRename(matched);
            }}
            className="w-full px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800/80 flex items-center gap-2 cursor-pointer transition-colors border-b border-neutral-850"
          >
            <span>Rename</span>
          </button>
          <button
            onClick={() => handleDelete(activeMenuId)}
            className="w-full px-3 py-1.5 text-xs text-red-400 hover:bg-neutral-800/80 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
