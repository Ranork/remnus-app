'use client';
import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  FileText, 
  Database, 
  Plus, 
  X, 
  ChevronDown, 
  ChevronRight,
  Check, 
  Trash, 
  Edit3, 
  Briefcase
} from 'lucide-react';
import PageIcon from './PageIcon';
import { 
  createStandalonePage, 
  createWorkspaceDatabase, 
  createWorkspace, 
  deleteWorkspace, 
  renameWorkspace, 
  switchWorkspace,
  updateWorkspaceItemIcon
} from '@/lib/actions/workspace';
import type { WorkspaceItemRow } from '@/lib/actions/workspace';
import IconPicker from './IconPicker';

type WorkspaceType = {
  id: string;
  name: string;
};

export default function WorkspaceSidebar({ 
  items,
  workspaces,
  activeWorkspace,
}: { 
  items: WorkspaceItemRow[];
  workspaces: WorkspaceType[];
  activeWorkspace: WorkspaceType;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  
  // Tree creation and editing states
  const [creatingType, setCreatingType] = useState<'page' | 'database' | 'choose' | null>(null);
  const [activeIconPickerId, setActiveIconPickerId] = useState<string | null>(null);
  const [creatingInWorkspaceId, setCreatingInWorkspaceId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleSidebarIconSelect = async (itemId: string, newIcon: string | null, newColor: string | null) => {
    await updateWorkspaceItemIcon(itemId, newIcon, newColor);
    router.refresh();
  };

  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editingWorkspaceName, setEditingWorkspaceName] = useState('');

  // Expand / collapse states for workspaces (All expanded by default)
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Record<string, boolean>>(() => {
    return workspaces.reduce((acc, w) => {
      acc[w.id] = true;
      return acc;
    }, {} as Record<string, boolean>);
  });

  useEffect(() => {
    if (creatingType && inputRef.current) {
      inputRef.current.focus();
    }
  }, [creatingType, creatingInWorkspaceId]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedWorkspaces(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Group items by workspaceId
  const itemsByWorkspace = workspaces.reduce((acc, w) => {
    acc[w.id] = items.filter(item => item.workspaceId === w.id);
    return acc;
  }, {} as Record<string, WorkspaceItemRow[]>);

  // Handlers for item creation
  const handleCreateItem = (workspaceId: string) => {
    const title = newTitle.trim();
    if (!title || !creatingType) return;

    startTransition(async () => {
      // Automatically switch workspace cookie to target workspace
      if (workspaceId !== activeWorkspace.id) {
        await switchWorkspace(workspaceId);
      }

      if (creatingType === 'page') {
        const { itemId } = await createStandalonePage(workspaceId, title);
        router.push(`/page/${itemId}`);
      } else {
        const { dbId } = await createWorkspaceDatabase(workspaceId, title);
        router.push(`/db/${dbId}`);
      }
      setCreatingType(null);
      setCreatingInWorkspaceId(null);
      setNewTitle('');
    });
  };

  const handleKeyDownItem = (e: React.KeyboardEvent, workspaceId: string) => {
    if (e.key === 'Enter') handleCreateItem(workspaceId);
    if (e.key === 'Escape') {
      setCreatingType(null);
      setCreatingInWorkspaceId(null);
      setNewTitle('');
    }
  };

  // Switch Workspace Handler
  const handleSwitchWorkspace = (id: string) => {
    if (id === activeWorkspace.id) return;
    startTransition(async () => {
      await switchWorkspace(id);
      router.push('/');
    });
  };

  const handleCreateWorkspace = () => {
    const name = newWorkspaceName.trim();
    if (!name) return;

    startTransition(async () => {
      const { id } = await createWorkspace(name);
      setIsCreatingWorkspace(false);
      setNewWorkspaceName('');
      // Make sure the new workspace is expanded
      setExpandedWorkspaces(prev => ({ ...prev, [id]: true }));
      router.push('/');
    });
  };

  const handleRenameWorkspace = (id: string) => {
    const name = editingWorkspaceName.trim();
    if (!name) return;

    startTransition(async () => {
      await renameWorkspace(id, name);
      setEditingWorkspaceId(null);
    });
  };

  const handleDeleteWorkspace = (id: string) => {
    if (confirm('Are you sure you want to delete this workspace and all its contents?')) {
      startTransition(async () => {
        const res = await deleteWorkspace(id);
        if (res && 'error' in res) {
          alert(res.error);
        } else {
          router.push('/');
        }
      });
    }
  };

  const handleItemClick = (item: WorkspaceItemRow) => {
    if (item.workspaceId !== activeWorkspace.id) {
      startTransition(async () => {
        await switchWorkspace(item.workspaceId);
      });
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
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      {/* Brand Header */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
        <Link href="/" className="font-semibold flex items-center gap-2.5 text-white hover:text-neutral-300 transition-colors">
          <img src="/logo-square-dark.png" alt="Remna Logo" className="w-5 h-5 object-contain rounded-md shrink-0 shadow-sm" />
          <span className="font-bold tracking-tight text-white">Remna</span>
        </Link>
      </div>

      {/* Tree view list */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-4">
        {workspaces.map((w) => {
          const isExpanded = expandedWorkspaces[w.id] !== false;
          const workspaceChildren = itemsByWorkspace[w.id] || [];
          const isCurrentActive = w.id === activeWorkspace.id;

          return (
            <div key={w.id} className="space-y-1.5">
              {/* Workspace Root Node */}
              <div 
                onClick={() => handleSwitchWorkspace(w.id)}
                className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-all group/root cursor-pointer ${
                  isCurrentActive 
                    ? 'bg-neutral-850 text-white font-medium shadow-sm'
                    : 'text-neutral-400 hover:bg-neutral-850/50 hover:text-neutral-200'
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
                  <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm transition-colors ${
                    isCurrentActive 
                      ? 'bg-neutral-50 text-neutral-950'
                      : 'bg-neutral-700 group-hover/root:bg-neutral-600 text-neutral-200'
                  }`}>
                    {w.name[0]?.toUpperCase() || 'W'}
                  </div>

                  {editingWorkspaceId === w.id ? (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingWorkspaceName}
                        onChange={(e) => setEditingWorkspaceName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameWorkspace(w.id);
                          if (e.key === 'Escape') setEditingWorkspaceId(null);
                        }}
                        className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-1 py-0.5 text-xs text-white focus:outline-none focus:border-neutral-500"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRenameWorkspace(w.id)}
                        className="p-1 rounded hover:bg-neutral-700 text-green-400"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        onClick={() => setEditingWorkspaceId(null)}
                        className="p-1 rounded hover:bg-neutral-700 text-neutral-400"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <span className="truncate flex-1 font-medium">{w.name}</span>
                  )}
                </div>

                {/* Workspace actions on hover */}
                {editingWorkspaceId !== w.id && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/root:opacity-100 transition-opacity shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setCreatingInWorkspaceId(w.id);
                        setCreatingType('choose');
                        setExpandedWorkspaces(prev => ({ ...prev, [w.id]: true }));
                      }}
                      className="p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white"
                      title="New item"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingWorkspaceId(w.id);
                        setEditingWorkspaceName(w.name);
                      }}
                      className="p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white"
                      title="Rename workspace"
                    >
                      <Edit3 size={12} />
                    </button>
                    {workspaces.length > 1 && (
                      <button
                        onClick={() => handleDeleteWorkspace(w.id)}
                        className="p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-red-400"
                        title="Delete workspace"
                      >
                        <Trash size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Workspace Children Subtree */}
              {isExpanded && (
                <div className="pl-6 space-y-0.5 border-l border-neutral-800 ml-3.5 my-1">
                  {workspaceChildren.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors group/item ${
                        isActive(item)
                          ? 'bg-neutral-850 text-white font-medium'
                          : 'text-neutral-400 hover:bg-neutral-850/50 hover:text-neutral-200'
                      }`}
                    >
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
                      <Link
                        href={hrefFor(item)}
                        onClick={() => handleItemClick(item)}
                        className="truncate flex-1 block py-0.5"
                      >
                        {item.title}
                      </Link>
                    </div>
                  ))}

                  {/* Inline creation input under specific workspace subtree */}
                  {creatingInWorkspaceId === w.id && creatingType && (
                    creatingType === 'choose' ? (
                      <div className="px-2.5 py-2 bg-neutral-850/50 rounded-md border border-neutral-800 space-y-2 mr-2">
                        <div className="text-[10px] text-neutral-500 font-medium px-0.5 uppercase tracking-wider flex items-center justify-between">
                          <span>What would you like to create?</span>
                          <button
                            onClick={() => { setCreatingType(null); setCreatingInWorkspaceId(null); }}
                            className="p-0.5 rounded text-neutral-500 hover:text-white transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => setCreatingType('page')}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-xs text-white rounded border border-neutral-700 transition-colors font-medium text-left justify-start"
                          >
                            <FileText size={13} className="text-neutral-400" />
                            <span>Page</span>
                          </button>
                          <button
                            onClick={() => setCreatingType('database')}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-xs text-white rounded border border-neutral-700 transition-colors font-medium text-left justify-start"
                          >
                            <Database size={13} className="text-neutral-400" />
                            <span>Database</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="px-2.5 py-1.5 bg-neutral-850/50 rounded-md border border-neutral-800 space-y-1.5 mr-2">
                        <div className="text-[10px] text-neutral-500 font-medium px-0.5 uppercase tracking-wider">
                          {creatingType === 'page' ? 'New Page' : 'New Database'}
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            ref={inputRef}
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            onKeyDown={(e) => handleKeyDownItem(e, w.id)}
                            placeholder={creatingType === 'page' ? 'Page title...' : 'Database name...'}
                            disabled={isPending}
                            className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500 min-w-0"
                          />
                          <button
                            onClick={() => { setCreatingType(null); setCreatingInWorkspaceId(null); setNewTitle(''); }}
                            className="p-1 text-neutral-500 hover:text-white shrink-0"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleCreateItem(w.id)}
                            disabled={!newTitle.trim() || isPending}
                            className="flex-1 text-[10px] bg-neutral-750 hover:bg-neutral-700 disabled:opacity-40 text-white rounded py-0.5 transition-colors font-medium"
                          >
                            {isPending ? '...' : 'Create'}
                          </button>
                          <button
                            onClick={() => setCreatingType('choose')}
                            className="text-[10px] text-neutral-400 hover:text-neutral-200 px-1 py-0.5 shrink-0 transition-colors"
                          >
                            Back
                          </button>
                        </div>
                      </div>
                    )
                  )}

                  {/* Empty state item helper if workspace has no pages and is not creating */}
                  {workspaceChildren.length === 0 && creatingInWorkspaceId !== w.id && (
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
    </div>
  );
}
