'use client';
import { useState, useEffect, useTransition, useRef } from 'react';
import Link from 'next/link';
import { Plus, MoreHorizontal } from 'lucide-react';
import {
  getSubItems,
  createStandalonePage,
  createWorkspaceDatabase,
  deleteWorkspaceItem,
  updateWorkspaceItemTitle,
  checkItemHasContent,
} from '@/lib/actions/workspace';
import type { WorkspaceItemRow } from '@/lib/actions/workspace';
import { useRouter } from 'next/navigation';
import PageIcon from './PageIcon';

interface SubItemsPanelProps {
  parentId: string;
  workspaceId: string;
}

export default function SubItemsPanel({ parentId, workspaceId }: SubItemsPanelProps) {
  const router = useRouter();
  const [items, setItems] = useState<WorkspaceItemRow[]>([]);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [confirmTarget, setConfirmTarget] = useState<WorkspaceItemRow | null>(null);

  useEffect(() => {
    getSubItems(parentId)
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [parentId]);

  useEffect(() => {
    if (!activeMenuId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setActiveMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activeMenuId]);

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  const handleCreatePage = () => {
    startTransition(async () => {
      const { itemId } = await createStandalonePage(workspaceId, 'Untitled', parentId);
      setItems(prev => [
        ...prev,
        {
          id: itemId, workspaceId, type: 'page', title: 'Untitled',
          parentId, sortOrder: prev.length, icon: null, iconColor: null,
          createdAt: new Date(), updatedAt: new Date(), databaseId: null,
        },
      ]);
      router.push(`/page/${itemId}`);
    });
  };

  const handleCreateDatabase = () => {
    startTransition(async () => {
      const result = await createWorkspaceDatabase(workspaceId, 'Untitled', { parentId });
      setItems(prev => [
        ...prev,
        {
          id: result.itemId!, workspaceId, type: 'database', title: 'Untitled',
          parentId, sortOrder: prev.length, icon: null, iconColor: null,
          createdAt: new Date(), updatedAt: new Date(), databaseId: result.dbId,
        },
      ]);
      router.push(`/db/${result.dbId}`);
    });
  };

  const handleDeleteClick = async (item: WorkspaceItemRow) => {
    setActiveMenuId(null);
    const hasContent = await checkItemHasContent(item.id);
    if (hasContent) {
      setConfirmTarget(item);
    } else {
      doDelete(item.id);
    }
  };

  const doDelete = (itemId: string) => {
    setConfirmTarget(null);
    setItems(prev => prev.filter(i => i.id !== itemId));
    startTransition(() => deleteWorkspaceItem(itemId));
  };

  const handleStartRename = (item: WorkspaceItemRow) => {
    setActiveMenuId(null);
    setRenamingId(item.id);
    setRenamingTitle(item.title);
  };

  const handleRename = (item: WorkspaceItemRow) => {
    const title = renamingTitle.trim();
    setRenamingId(null);
    if (!title || title === item.title) return;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, title } : i));
    startTransition(() => updateWorkspaceItemTitle(item.id, title));
  };

  const openMenuFor = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuAnchor({ x: rect.left, y: rect.bottom + 4 });
    setActiveMenuId(itemId);
  };

  const hrefFor = (item: WorkspaceItemRow) =>
    item.type === 'database' && item.databaseId
      ? `/db/${item.databaseId}`
      : item.type === 'dashboard'
        ? `/dashboard/${item.id}`
        : `/page/${item.id}`;

  if (loading) {
    return <div className="mb-6 h-5" />;
  }

  return (
    <div className="mb-6">
      {/* Item blocks */}
      {items.map(item => (
        <div
          key={item.id}
          className="group/item flex items-center gap-2.5 rounded py-1.25 px-1.5 hover:bg-neutral-800/25 transition-colors"
        >
          <span className="shrink-0 flex items-center">
            <PageIcon icon={item.icon} iconColor={item.iconColor} size={16} fallbackType={item.type} />
          </span>

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
              className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-blue-500/60 max-w-sm"
            />
          ) : (
            <Link
              href={hrefFor(item)}
              className="flex-1 text-sm text-neutral-300 hover:text-white truncate"
            >
              {item.title}
            </Link>
          )}

          {renamingId !== item.id && (
            <button
              onClick={e => openMenuFor(e, item.id)}
              className="opacity-0 group-hover/item:opacity-100 p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-all cursor-pointer shrink-0"
            >
              <MoreHorizontal size={13} />
            </button>
          )}
        </div>
      ))}

      {/* Add buttons */}
      <div className="flex items-center gap-3 px-1.5 mt-1">
        <button
          onClick={handleCreatePage}
          disabled={isPending}
          className="inline-flex items-center gap-1 text-[11px] text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer disabled:opacity-40"
        >
          <Plus size={11} />
          <span>Page</span>
        </button>
        <button
          onClick={handleCreateDatabase}
          disabled={isPending}
          className="inline-flex items-center gap-1 text-[11px] text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer disabled:opacity-40"
        >
          <Plus size={11} />
          <span>Database</span>
        </button>
      </div>

      {/* Floating context menu */}
      {activeMenuId && menuAnchor && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: menuAnchor.x, top: menuAnchor.y, zIndex: 9999 }}
          className="bg-neutral-850 border border-neutral-800 shadow-xl py-1 w-32 rounded overflow-hidden text-left animate-fade-in animate-duration-100"
        >
          <button
            onClick={() => {
              const matched = items.find(i => i.id === activeMenuId);
              if (matched) handleStartRename(matched);
            }}
            className="w-full px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800/80 flex items-center gap-2 cursor-pointer border-b border-neutral-850"
          >
            Rename
          </button>
          <button
            onClick={() => {
              const matched = items.find(i => i.id === activeMenuId);
              if (matched) handleDeleteClick(matched);
            }}
            className="w-full px-3 py-1.5 text-xs text-red-400 hover:bg-neutral-800/80 flex items-center gap-2 cursor-pointer"
          >
            Delete
          </button>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmTarget && (
        <div
          className="fixed inset-0 bg-black/60 z-200 flex items-center justify-center p-4"
          onClick={() => setConfirmTarget(null)}
        >
          <div
            className="bg-neutral-850 border border-neutral-800 rounded-lg p-5 max-w-sm w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-neutral-100 mb-2 truncate">
              Delete &ldquo;{confirmTarget.title}&rdquo;?
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed mb-5">
              This item has content that will be permanently deleted and cannot be recovered.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                className="text-xs text-neutral-400 hover:text-neutral-200 px-3 py-1.5 rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => doDelete(confirmTarget.id)}
                className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1.5 rounded font-medium transition-colors cursor-pointer border border-red-500/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
