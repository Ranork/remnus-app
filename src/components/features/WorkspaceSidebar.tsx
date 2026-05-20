'use client';
import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Check,
  Trash,
  Edit3,
  Briefcase,
  MoreHorizontal,
  Copy,
  LogOut,
  Shield,
  Settings,
  Layers,
} from 'lucide-react';
import PageIcon from './PageIcon';
import {
  createWorkspace,
  switchWorkspace,
  updateWorkspaceItemIcon,
  updateWorkspaceItemTitle,
  deleteWorkspaceItem,
  duplicateWorkspaceItem,
  updateWorkspacesOrder,
  updateWorkspaceItemsOrder,
  moveWorkspaceItemToWorkspace,
} from '@/lib/actions/workspace';
import { logout } from '@/lib/actions/auth';
import type { WorkspaceItemRow } from '@/lib/actions/workspace';
import IconPicker from './IconPicker';
import TemplatePickerModal from './TemplatePickerModal';
import WorkspaceSettingsModal from './WorkspaceSettingsModal';

type WorkspaceType = {
  id: string;
  name: string;
};

type CurrentUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
};

export default function WorkspaceSidebar({
  items,
  workspaces,
  activeWorkspace,
  currentUser,
}: {
  items: WorkspaceItemRow[];
  workspaces: WorkspaceType[];
  activeWorkspace: WorkspaceType;
  currentUser: CurrentUser;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();
  const [avatarError, setAvatarError] = useState(false);

  // Tree creation and editing states
  const [templatePickerWorkspaceId, setTemplatePickerWorkspaceId] = useState<string | null>(null);
  const [activeIconPickerId, setActiveIconPickerId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Item context menu
  const [openMenuItemId, setOpenMenuItemId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Item loading state (delete / duplicate)
  const [loadingItem, setLoadingItem] = useState<{ id: string; action: 'delete' | 'duplicate' } | null>(null);

  // Inline rename
  const [renamingItemId, setRenamingItemId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');
  const renamingInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!openMenuItemId) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setOpenMenuItemId(null);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [openMenuItemId]);

  useEffect(() => {
    if (renamingItemId) {
      renamingInputRef.current?.focus();
      renamingInputRef.current?.select();
    }
  }, [renamingItemId]);

  const handleSidebarIconSelect = async (itemId: string, newIcon: string | null, newColor: string | null) => {
    await updateWorkspaceItemIcon(itemId, newIcon, newColor);
    router.refresh();
  };

  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [settingsModalWorkspace, setSettingsModalWorkspace] = useState<{ id: string; name: string } | null>(null);

  // Expand / collapse states for workspaces (All expanded by default)
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Record<string, boolean>>(() => {
    return workspaces.reduce((acc, w) => {
      acc[w.id] = true;
      return acc;
    }, {} as Record<string, boolean>);
  });

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedWorkspaces(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Local state for optimistic UI during drag and drop
  const [localWorkspaces, setLocalWorkspaces] = useState<WorkspaceType[]>(workspaces);
  const [localItems, setLocalItems] = useState<WorkspaceItemRow[]>(items);

  // Find which workspace contains the active item based on the pathname
  const activeWorkspaceIdFromPath = (() => {
    // If the path is a database view: /db/[databaseId] or database subpage /db/[databaseId]/[pageId]
    const dbMatch = pathname.match(/^\/db\/([^\/]+)/);
    if (dbMatch) {
      const dbId = dbMatch[1];
      const matchingItem = localItems.find(i => i.type === 'database' && i.databaseId === dbId);
      if (matchingItem) return matchingItem.workspaceId;
    }

    // If the path is a standalone page: /page/[itemId]
    const pageMatch = pathname.match(/^\/page\/([^\/]+)/);
    if (pageMatch) {
      const itemId = pageMatch[1];
      const matchingItem = localItems.find(i => i.id === itemId);
      if (matchingItem) return matchingItem.workspaceId;
    }

    return activeWorkspace.id;
  })();

  // Auto-sync cookie in the background when active workspace changes from navigation
  useEffect(() => {
    if (activeWorkspaceIdFromPath && activeWorkspaceIdFromPath !== activeWorkspace.id) {
      switchWorkspace(activeWorkspaceIdFromPath);
    }
  }, [activeWorkspaceIdFromPath, activeWorkspace.id]);

  // Sync props to local state only when structural changes happen (like additions, deletions) or when not in transition
  useEffect(() => {
    if (isPending) return;
    
    const wsIds = workspaces.map(w => w.id).join(',');
    setLocalWorkspaces(prev => {
      const localWsIds = prev.map(w => w.id).join(',');
      if (wsIds !== localWsIds) {
        return workspaces;
      }
      
      let changed = false;
      const updated = prev.map(local => {
        const matching = workspaces.find(w => w.id === local.id);
        if (matching) {
          if (local.name !== matching.name) {
            changed = true;
            return {
              ...local,
              name: matching.name
            };
          }
        }
        return local;
      });
      return changed ? updated : prev;
    });
  }, [workspaces, isPending]);

  useEffect(() => {
    if (isPending) return;
    
    const itemIds = items.map(i => i.id).join(',');
    setLocalItems(prev => {
      const localItemIds = prev.map(i => i.id).join(',');
      if (itemIds !== localItemIds) {
        return items;
      }
      
      let changed = false;
      const updated = prev.map(local => {
        const matching = items.find(i => i.id === local.id);
        if (matching) {
          if (
            local.title !== matching.title ||
            local.icon !== matching.icon ||
            local.iconColor !== matching.iconColor ||
            local.workspaceId !== matching.workspaceId
          ) {
            changed = true;
            return {
              ...local,
              title: matching.title,
              icon: matching.icon,
              iconColor: matching.iconColor,
              workspaceId: matching.workspaceId
            };
          }
        }
        return local;
      });
      return changed ? updated : prev;
    });
  }, [items, isPending]);

  // Drag and drop states for workspaces
  const [draggedWorkspaceId, setDraggedWorkspaceId] = useState<string | null>(null);
  const [dragOverWorkspaceId, setDragOverWorkspaceId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('before');

  const handleWorkspaceDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedWorkspaceId(id);
  };

  const handleWorkspaceDragOver = (e: React.DragEvent, id: string) => {
    if (!draggedWorkspaceId || draggedWorkspaceId === id) return;
    
    e.preventDefault();
    setDragOverWorkspaceId(id);
    
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    if (relativeY > rect.height / 2) {
      setDropPosition('after');
    } else {
      setDropPosition('before');
    }
  };

  const handleWorkspaceDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverWorkspaceId(null);
    if (!draggedWorkspaceId || draggedWorkspaceId === targetId) return;

    const sourceIndex = localWorkspaces.findIndex(w => w.id === draggedWorkspaceId);
    const targetIndex = localWorkspaces.findIndex(w => w.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const reordered = [...localWorkspaces];
    const [dragged] = reordered.splice(sourceIndex, 1);
    
    let newTargetIndex = reordered.findIndex(w => w.id === targetId);
    if (dropPosition === 'after') {
      newTargetIndex += 1;
    }

    reordered.splice(newTargetIndex, 0, dragged);

    // Check if the order actually changed!
    const orderChanged = reordered.some((w, idx) => w.id !== localWorkspaces[idx].id);
    if (!orderChanged) {
      setDraggedWorkspaceId(null);
      return;
    }

    // Optimistic UI update
    setLocalWorkspaces(reordered);
    setDraggedWorkspaceId(null);

    // Persist to DB
    startSaveTransition(async () => {
      await updateWorkspacesOrder(reordered.map(w => w.id));
      router.refresh();
    });
  };

  const handleWorkspaceDragEnd = () => {
    setDraggedWorkspaceId(null);
    setDragOverWorkspaceId(null);
  };

  // Drag and drop states for workspace items
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [itemDropPosition, setItemDropPosition] = useState<'before' | 'after'>('before');
  const [dragOverWorkspaceForItemId, setDragOverWorkspaceForItemId] = useState<string | null>(null);

  const handleItemDragStart = (e: React.DragEvent, id: string) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItemId(id);
  };

  const handleItemDragOver = (e: React.DragEvent, id: string, workspaceId: string) => {
    if (!draggedItemId || draggedItemId === id) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setDragOverItemId(id);
    
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    if (relativeY > rect.height / 2) {
      setItemDropPosition('after');
    } else {
      setItemDropPosition('before');
    }
  };

  const handleItemDrop = async (e: React.DragEvent, targetId: string, workspaceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItemId(null);
    if (!draggedItemId || draggedItemId === targetId) return;

    const draggedItem = localItems.find(i => i.id === draggedItemId);
    const targetItem = localItems.find(i => i.id === targetId);
    if (!draggedItem || !targetItem) return;

    const sourceWorkspaceId = draggedItem.workspaceId;
    const targetWorkspaceId = workspaceId;

    if (sourceWorkspaceId === targetWorkspaceId) {
      // Same workspace reordering
      const wsItems = localItems.filter(i => i.workspaceId === targetWorkspaceId);
      const sourceIndex = wsItems.findIndex(i => i.id === draggedItemId);
      if (sourceIndex === -1) return;

      const reorderedWsItems = [...wsItems];
      const [dragged] = reorderedWsItems.splice(sourceIndex, 1);
      
      let newTargetIndex = reorderedWsItems.findIndex(i => i.id === targetId);
      if (itemDropPosition === 'after') {
        newTargetIndex += 1;
      }
      
      reorderedWsItems.splice(newTargetIndex, 0, dragged);

      // Check if order actually changed
      const orderChanged = reorderedWsItems.some((item, idx) => item.id !== wsItems[idx].id);
      if (!orderChanged) {
        setDraggedItemId(null);
        return;
      }

      const newItems = [
        ...localItems.filter(item => item.workspaceId !== targetWorkspaceId),
        ...reorderedWsItems
      ];

      setLocalItems(newItems);
      setDraggedItemId(null);

      startSaveTransition(async () => {
        await updateWorkspaceItemsOrder(reorderedWsItems.map(i => i.id));
        router.refresh();
      });
    } else {
      // Cross-workspace moving and reordering!
      const sourceWsItems = localItems.filter(i => i.workspaceId === sourceWorkspaceId && i.id !== draggedItemId);
      const targetWsItems = localItems.filter(i => i.workspaceId === targetWorkspaceId);
      
      const updatedDraggedItem = { ...draggedItem, workspaceId: targetWorkspaceId };
      const reorderedTargetWsItems = [...targetWsItems];
      
      let newTargetIndex = reorderedTargetWsItems.findIndex(i => i.id === targetId);
      if (itemDropPosition === 'after') {
        newTargetIndex += 1;
      }
      
      reorderedTargetWsItems.splice(newTargetIndex, 0, updatedDraggedItem);

      const cleanItems = [
        ...localItems.filter(i => i.workspaceId !== sourceWorkspaceId && i.workspaceId !== targetWorkspaceId),
        ...sourceWsItems,
        ...reorderedTargetWsItems
      ];

      setLocalItems(cleanItems);
      setDraggedItemId(null);

      startSaveTransition(async () => {
        await moveWorkspaceItemToWorkspace(draggedItemId, targetWorkspaceId, reorderedTargetWsItems.map(i => i.id));
        router.refresh();
      });
    }
  };

  const handleItemDragEnd = () => {
    setDraggedItemId(null);
    setDragOverItemId(null);
    setDragOverWorkspaceForItemId(null);
  };

  // Cross-workspace root node drop support
  const handleWorkspaceItemDragOverRoot = (e: React.DragEvent, workspaceId: string) => {
    if (draggedItemId) {
      e.preventDefault();
      e.stopPropagation();
      setDragOverWorkspaceForItemId(workspaceId);
    }
  };

  const handleWorkspaceItemDragLeaveRoot = () => {
    setDragOverWorkspaceForItemId(null);
  };

  const handleWorkspaceItemDropOnRoot = async (e: React.DragEvent, targetWorkspaceId: string) => {
    if (!draggedItemId) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverWorkspaceForItemId(null);

    const draggedItem = localItems.find(i => i.id === draggedItemId);
    if (!draggedItem) return;

    const sourceWorkspaceId = draggedItem.workspaceId;
    
    if (sourceWorkspaceId === targetWorkspaceId) {
      // Same workspace: move to end
      const wsItems = localItems.filter(i => i.workspaceId === targetWorkspaceId);
      const sourceIndex = wsItems.findIndex(i => i.id === draggedItemId);
      if (sourceIndex === -1) return;

      const reorderedWsItems = [...wsItems];
      const [dragged] = reorderedWsItems.splice(sourceIndex, 1);
      reorderedWsItems.push(dragged);

      // Check if order actually changed
      const orderChanged = reorderedWsItems.some((item, idx) => item.id !== wsItems[idx].id);
      if (!orderChanged) {
        setDraggedItemId(null);
        return;
      }

      const newItems = [
        ...localItems.filter(item => item.workspaceId !== targetWorkspaceId),
        ...reorderedWsItems
      ];

      setLocalItems(newItems);
      setDraggedItemId(null);

      startSaveTransition(async () => {
        await updateWorkspaceItemsOrder(reorderedWsItems.map(i => i.id));
        router.refresh();
      });
    } else {
      // Move to target workspace at the end of the list
      const sourceWsItems = localItems.filter(i => i.workspaceId === sourceWorkspaceId && i.id !== draggedItemId);
      const targetWsItems = localItems.filter(i => i.workspaceId === targetWorkspaceId);

      const updatedDraggedItem = { ...draggedItem, workspaceId: targetWorkspaceId };
      const reorderedTargetWsItems = [...targetWsItems, updatedDraggedItem];

      const cleanItems = [
        ...localItems.filter(i => i.workspaceId !== sourceWorkspaceId && i.workspaceId !== targetWorkspaceId),
        ...sourceWsItems,
        ...reorderedTargetWsItems
      ];

      setLocalItems(cleanItems);
      setDraggedItemId(null);

      startSaveTransition(async () => {
        await moveWorkspaceItemToWorkspace(draggedItemId, targetWorkspaceId, reorderedTargetWsItems.map(i => i.id));
        router.refresh();
      });
    }
  };

  // Group items by workspaceId using localItems and localWorkspaces
  const itemsByWorkspace = localWorkspaces.reduce((acc, w) => {
    acc[w.id] = localItems.filter(item => item.workspaceId === w.id);
    return acc;
  }, {} as Record<string, WorkspaceItemRow[]>);

  // Switch Workspace Handler
  const handleSwitchWorkspace = (id: string) => {
    if (id === activeWorkspaceIdFromPath) return;

    // Find first item in this workspace to navigate directly, ensuring an instant client-side transition
    const workspaceChildren = itemsByWorkspace[id] || [];
    if (workspaceChildren.length > 0) {
      const firstItem = workspaceChildren[0];
      const targetHref = hrefFor(firstItem);
      router.push(targetHref);
    } else {
      // No items, go to home page but switch workspace first in the background
      switchWorkspace(id).then(() => {
        router.push('/');
      });
    }
  };

  const handleCreateWorkspace = () => {
    const name = newWorkspaceName.trim();
    if (!name) return;

    startTransition(async () => {
      const { id } = await createWorkspace(name);
      setIsCreatingWorkspace(false);
      setNewWorkspaceName('');
      setExpandedWorkspaces(prev => ({ ...prev, [id]: true }));
      router.push('/');
    });
  };



  const handleRenameItem = (item: WorkspaceItemRow) => {
    const title = renamingTitle.trim();
    if (!title || title === item.title) {
      setRenamingItemId(null);
      return;
    }
    startTransition(async () => {
      await updateWorkspaceItemTitle(item.id, title);
      setRenamingItemId(null);
      router.refresh();
    });
  };

  const handleDuplicateItem = (item: WorkspaceItemRow) => {
    setOpenMenuItemId(null);
    setLoadingItem({ id: item.id, action: 'duplicate' });
    startTransition(async () => {
      const result = await duplicateWorkspaceItem(item.id);
      if (result?.type === 'page') router.push(`/page/${result.itemId}`);
      else if (result?.type === 'database') router.push(`/db/${result.dbId}`);
    });
  };

  const handleDeleteItem = (item: WorkspaceItemRow) => {
    setOpenMenuItemId(null);
    setLoadingItem({ id: item.id, action: 'delete' });
    startTransition(async () => {
      await deleteWorkspaceItem(item.id);
      const href = item.type === 'database' && item.databaseId
        ? `/db/${item.databaseId}`
        : `/page/${item.id}`;
      if (pathname.startsWith(href)) router.push('/');
      else router.refresh();
    });
  };

  const openMenuFor = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuAnchor({ x: rect.left, y: rect.bottom + 4 });
    setOpenMenuItemId(prev => (prev === itemId ? null : itemId));
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

  const activeMenuItem = openMenuItemId ? items.find(i => i.id === openMenuItemId) : null;

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      {/* Brand Header */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
        <Link href="/" className="font-semibold flex items-center gap-2.5 text-white hover:text-neutral-300 transition-colors">
          <img src="/logo-square-dark.png" alt="Remna Logo" className={`w-5 h-5 object-contain rounded-md shrink-0 shadow-sm ${isSaving ? 'animate-pulse' : ''}`} />
          <span className="font-bold tracking-tight text-white">Remna</span>
        </Link>
        {isSaving && (
          <div className="flex items-center gap-1.5 text-[11px] text-blue-400 font-medium bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 animate-pulse">
            <div className="w-2 h-2 rounded-full border border-blue-400 border-t-transparent animate-spin shrink-0" />
            <span>Saving...</span>
          </div>
        )}
      </div>

      {/* Tree view list */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-4">
        {localWorkspaces.map((w) => {
          const isExpanded = expandedWorkspaces[w.id] !== false;
          const workspaceChildren = itemsByWorkspace[w.id] || [];
          const isCurrentActive = w.id === activeWorkspaceIdFromPath;

          const isWorkspaceDragged = draggedWorkspaceId === w.id;
          const isWorkspaceDragOver = dragOverWorkspaceId === w.id;

          return (
            <div
              key={w.id}
              className={`space-y-1.5 transition-all duration-200 relative ${
                isWorkspaceDragged ? 'opacity-30 animate-pulse' : ''
              }`}
              draggable
              onDragStart={(e) => handleWorkspaceDragStart(e, w.id)}
              onDragOver={(e) => handleWorkspaceDragOver(e, w.id)}
              onDragEnd={handleWorkspaceDragEnd}
              onDrop={(e) => handleWorkspaceDrop(e, w.id)}
            >
              {isWorkspaceDragOver && (
                <div className={`absolute left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10 shadow-[0_1px_3px_rgba(0,0,0,0.4)] ${
                  dropPosition === 'after' ? '-bottom-1' : '-top-1'
                }`}>
                  <div className="absolute -left-1 -top-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_6px_#445c95]" />
                </div>
              )}
              {/* Workspace Root Node */}
              <div
                onClick={() => handleSwitchWorkspace(w.id)}
                onDragOver={(e) => handleWorkspaceItemDragOverRoot(e, w.id)}
                onDragLeave={handleWorkspaceItemDragLeaveRoot}
                onDrop={(e) => handleWorkspaceItemDropOnRoot(e, w.id)}
                className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-all group/root cursor-grab active:cursor-grabbing ${
                  isCurrentActive
                    ? 'bg-neutral-850 text-white font-medium shadow-sm'
                    : 'text-neutral-400 hover:bg-neutral-850/50 hover:text-neutral-200'
                } ${
                  dragOverWorkspaceForItemId === w.id
                    ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400 scale-[1.02]'
                    : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {/* Chevron Toggle */}
                  <button
                    onClick={(e) => toggleExpand(w.id, e)}
                    className="p-0.5 rounded hover:bg-neutral-700 text-neutral-500 hover:text-white transition-colors shrink-0"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  {/* Initials badge */}
                  <div
                    translate="no"
                    className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm transition-colors notranslate ${
                      isCurrentActive
                        ? 'bg-neutral-50 text-neutral-950'
                        : 'bg-neutral-700 group-hover/root:bg-neutral-600 text-neutral-200'
                    }`}
                  >
                    {(w.name || 'W').trim().charAt(0).toUpperCase()}
                  </div>

                  <span className="truncate flex-1 font-medium">{w.name}</span>
                </div>

                {/* Workspace actions on hover */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover/root:opacity-100 transition-opacity shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      setTemplatePickerWorkspaceId(w.id);
                      setExpandedWorkspaces(prev => ({ ...prev, [w.id]: true }));
                    }}
                    className="p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white"
                    title="New item"
                  >
                    <Plus size={12} />
                  </button>
                  <button
                    onClick={() => {
                      setSettingsModalWorkspace({ id: w.id, name: w.name });
                    }}
                    className="p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white"
                    title="Workspace settings"
                  >
                    <Settings size={12} />
                  </button>
                </div>
              </div>

              {/* Workspace Children Subtree */}
              {isExpanded && (
                <div className="pl-6 space-y-0.5 border-l border-neutral-800 ml-3.5 my-1">
                  {workspaceChildren.map((item) => {
                    const isLoading = loadingItem?.id === item.id;
                    const isDeleting = isLoading && loadingItem?.action === 'delete';
                    
                    const isItemDragged = draggedItemId === item.id;
                    const isItemDragOver = dragOverItemId === item.id;

                    return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-all duration-200 group/item cursor-grab active:cursor-grabbing relative ${
                        isActive(item)
                          ? 'bg-neutral-850 text-white font-medium'
                          : 'text-neutral-400 hover:bg-neutral-850/50 hover:text-neutral-200'
                      } ${isLoading ? 'opacity-40 pointer-events-none' : ''} ${
                        isItemDragged ? 'opacity-30 animate-pulse' : ''
                      }`}
                      draggable
                      onDragStart={(e) => handleItemDragStart(e, item.id)}
                      onDragOver={(e) => handleItemDragOver(e, item.id, w.id)}
                      onDragEnd={handleItemDragEnd}
                      onDrop={(e) => handleItemDrop(e, item.id, w.id)}
                    >
                      {isItemDragOver && (
                        <div className={`absolute left-6 right-0 h-0.5 bg-blue-500 rounded-full z-10 shadow-[0_1px_3px_rgba(0,0,0,0.4)] ${
                          itemDropPosition === 'after' ? '-bottom-0.5' : '-top-0.5'
                        }`}>
                          <div className="absolute -left-1 -top-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_6px_#445c95]" />
                        </div>
                      )}
                      {/* Icon picker trigger */}
                      <div className="relative shrink-0 select-none">
                        <button
                          ref={(el) => { itemRefs.current[item.id] = el; }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveIconPickerId(activeIconPickerId === item.id ? null : item.id);
                          }}
                          className="hover:bg-neutral-800 p-0.5 rounded transition-colors flex items-center justify-center cursor-pointer"
                          title="Change icon"
                        >
                          <PageIcon
                            icon={item.icon}
                            iconColor={item.iconColor}
                            size={16}
                            fallbackType={item.type}
                            className="shrink-0"
                          />
                        </button>
                        {activeIconPickerId === item.id && (
                          <IconPicker
                            currentIcon={item.icon}
                            currentIconColor={item.iconColor}
                            onSelect={(newIcon, newColor) => handleSidebarIconSelect(item.id, newIcon, newColor)}
                            onClose={() => setActiveIconPickerId(null)}
                            anchorRef={{ current: itemRefs.current[item.id] }}
                          />
                        )}
                      </div>

                      {/* Title / rename input */}
                      {renamingItemId === item.id ? (
                        <input
                          ref={renamingInputRef}
                          type="text"
                          value={renamingTitle}
                          onChange={e => setRenamingTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRenameItem(item);
                            if (e.key === 'Escape') setRenamingItemId(null);
                          }}
                          onBlur={() => handleRenameItem(item)}
                          onClick={e => e.stopPropagation()}
                          className="flex-1 min-w-0 bg-neutral-800 border border-neutral-600 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-blue-500/60"
                        />
                      ) : (
                        <Link
                          href={hrefFor(item)}
                          className="truncate flex-1 block py-0.5"
                        >
                          {item.title}
                        </Link>
                      )}

                      {/* Three-dot menu trigger / loading spinner */}
                      {renamingItemId !== item.id && (
                        isLoading ? (
                          <div className={`shrink-0 p-1 ${isDeleting ? 'text-red-400' : 'text-neutral-400'}`}>
                            <div className={`w-3 h-3 rounded-full border-2 animate-spin shrink-0 ${
                              isDeleting
                                ? 'border-red-900/50 border-t-red-400'
                                : 'border-neutral-800 border-t-neutral-500'
                            }`} />
                          </div>
                        ) : (
                          <button
                            onClick={(e) => openMenuFor(e, item.id)}
                            className={`shrink-0 p-1 rounded transition-colors text-neutral-500 hover:text-neutral-200 hover:bg-neutral-700 ${
                              openMenuItemId === item.id
                                ? 'opacity-100'
                                : 'opacity-0 group-hover/item:opacity-100'
                            }`}
                            title="More options"
                          >
                            <MoreHorizontal size={13} />
                          </button>
                        )
                      )}
                    </div>
                    );
                  })}

                  {/* Empty state */}
                  {workspaceChildren.length === 0 && (
                    <div className="text-xs text-neutral-600 py-1.5 px-2.5 italic">
                      Empty workspace. Click + to add.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Add Workspace Action Row */}
        <div className="pt-2">
          {isCreatingWorkspace ? (
            <div className="bg-neutral-850/40 border border-neutral-800/80 rounded-lg p-2.5 space-y-2">
              <input
                type="text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="Workspace name..."
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateWorkspace();
                  if (e.key === 'Escape') setIsCreatingWorkspace(false);
                }}
                autoFocus
              />
              <div className="flex gap-1.5">
                <button
                  onClick={handleCreateWorkspace}
                  disabled={!newWorkspaceName.trim() || isPending}
                  className="flex-1 bg-neutral-50 hover:bg-neutral-100 disabled:opacity-40 text-neutral-950 rounded text-[11px] font-semibold py-1 px-2 transition-colors"
                >
                  {isPending ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={() => setIsCreatingWorkspace(false)}
                  className="bg-neutral-800 hover:bg-neutral-750 text-neutral-400 rounded text-[11px] font-medium py-1 px-2 border border-neutral-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsCreatingWorkspace(true)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-neutral-500 hover:text-neutral-350 hover:bg-neutral-850/30 border border-dashed border-neutral-800 hover:border-neutral-700 rounded-lg transition-all"
            >
              <Plus size={12} /> Add Workspace
            </button>
          )}
        </div>
      </div>

      {/* Item context menu (fixed, outside overflow container) */}
      {activeMenuItem && menuAnchor && (
        <div
          ref={menuRef}
          style={{ top: menuAnchor.y, left: menuAnchor.x }}
          className="fixed z-200 bg-neutral-900 border border-neutral-800 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] py-1 min-w-40 animate-scale-in"
        >
          <button
            onClick={() => {
              setOpenMenuItemId(null);
              setRenamingItemId(activeMenuItem.id);
              setRenamingTitle(activeMenuItem.title);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <Edit3 size={12} className="text-neutral-500" />
            Rename
          </button>
          <button
            onClick={() => handleDuplicateItem(activeMenuItem)}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <Copy size={12} className="text-neutral-500" />
            Duplicate
          </button>
          <div className="border-t border-neutral-800 my-1" />
          <button
            onClick={() => handleDeleteItem(activeMenuItem)}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-red-400 hover:bg-neutral-800 hover:text-red-300 transition-colors"
          >
            <Trash size={12} />
            Delete
          </button>
        </div>
      )}

      {templatePickerWorkspaceId && (
        <TemplatePickerModal
          workspaceId={templatePickerWorkspaceId}
          activeWorkspaceId={activeWorkspace.id}
          onClose={() => setTemplatePickerWorkspaceId(null)}
          onCreated={(type, id) => {
            setTemplatePickerWorkspaceId(null);
            router.push(type === 'page' ? `/page/${id}` : `/db/${id}`);
          }}
        />
      )}

      {settingsModalWorkspace && (
        <WorkspaceSettingsModal
          workspaceId={settingsModalWorkspace.id}
          workspaceName={settingsModalWorkspace.name}
          currentUser={currentUser}
          onClose={() => setSettingsModalWorkspace(null)}
          onRenamed={(newName) => {
            setSettingsModalWorkspace(prev => prev ? { ...prev, name: newName } : null);
            router.refresh();
          }}
          onDeleted={() => {
            router.push('/');
            router.refresh();
          }}
        />
      )}

      {/* Admin panel link */}
      {currentUser.role === 'admin' && (
        <div className="shrink-0 border-t border-neutral-800">
          <Link
            href="/admin"
            className={`flex items-center gap-2.5 px-3 py-2 text-xs hover:text-neutral-200 hover:bg-neutral-800/30 transition-colors ${pathname.startsWith('/admin') ? 'text-neutral-200 bg-neutral-800/40' : 'text-neutral-400'}`}
          >
            <Shield size={13} className="shrink-0" />
            <span>Admin</span>
          </Link>
        </div>
      )}

      {/* User panel */}
      <div className="shrink-0 border-t border-neutral-800 px-3 py-2.5 flex items-center gap-2.5 group/user">
        {/* Avatar */}
        <div className="shrink-0">
          {currentUser.image && currentUser.image !== '' && currentUser.image !== 'null' && !avatarError ? (
            <img
              src={currentUser.image}
              alt={currentUser.name ?? 'User'}
              className="w-7 h-7 rounded-full object-cover"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <div
              translate="no"
              className="w-7 h-7 rounded-full bg-neutral-700 flex items-center justify-center text-xs font-semibold text-neutral-200 notranslate"
            >
              {(currentUser.name || currentUser.email || 'U').trim().charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Name + role */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-neutral-200 truncate">
              {currentUser.name ?? currentUser.email ?? 'User'}
            </span>
            {currentUser.role === 'admin' && (
              <span className="shrink-0 flex items-center gap-0.5 text-[9px] font-semibold text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded">
                <Shield size={8} />
                Admin
              </span>
            )}
          </div>
          {currentUser.name && currentUser.email && (
            <p className="text-[10px] text-neutral-500 truncate">{currentUser.email}</p>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={() => logout()}
          className="shrink-0 p-1.5 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors opacity-0 group-hover/user:opacity-100"
          title="Sign out"
        >
          <LogOut size={13} />
        </button>
      </div>
    </div>
  );
}
