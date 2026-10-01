'use client';
import { useState, useTransition, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import ShareModal from '@/components/share/ShareModal';
import { reportClientError } from '@/lib/reportClientError';
import { useTabNav } from '@/components/providers/TabsContext';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Trash,
  Edit3,
  MoreHorizontal,
  Copy,
  Settings,
  ArrowLeft,
  Bot,
  Globe,
  Eye,
  EyeOff,
  ArrowUpRight,
  Link2,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import PageIcon from './PageIcon';
import { useContextMenu, type MenuItem } from './ContextMenu';
import {
  createWorkspace,
  switchWorkspace,
  updateWorkspaceItemIcon,
  updateWorkspaceIcon,
  setWorkspaceHidden,
  updateWorkspaceItemTitle,
  deleteWorkspaceItem,
  duplicateWorkspaceItem,
  updateWorkspacesOrder,
  updateWorkspaceItemsOrder,
  moveWorkspaceItemToWorkspace,
  reparentWorkspaceItem,
} from '@/lib/actions/workspace';
import { logout } from '@/lib/actions/auth';
import type { WorkspaceItemRow } from '@/lib/actions/workspace';
import IconPicker from './IconPicker';
import TemplatePickerModal from './TemplatePickerModal';
import WorkspaceSettingsModal from './WorkspaceSettingsModal';
import { initDesktopZoom } from '@/lib/desktop/zoom';
import AgentsModal from './AgentsModal';
import AgentSavingsCard from './AgentSavingsCard';
import { AgentPresenceRows, AgentTouchMark, useServerNow, useWorkingWorkspaces } from './AgentPresence';
import { EMPTY_PRESENCE, type AgentPresence, type PresenceTouch } from '@/lib/agentPresence';
import TrashModal from './TrashModal';
import OnboardingGuide from './onboarding/OnboardingGuide';
import AgentDetectGuide from './agent-detect/AgentDetectGuide';
import AccountMenu from './AccountMenu';
import WorkspaceQuickLinks from './WorkspaceQuickLinks';
import { usePwaInstall } from './PwaInstallButton';
import { useWhatsNew } from './WhatsNewButton';
import BillingModal from './BillingModal';
import UserSettingsModal from './UserSettingsModal';
import { getUserAgentTokenCount } from '@/lib/actions/agentToken';
import { getUserTrashCount } from '@/lib/actions/trash';
import { getMyTier } from '@/lib/actions/billing';
import type { PlanTier } from '@/lib/billing/plans';
import { getSidebarOverlayContainer, writeSidebarVisible } from '@/lib/sidebarVisibility';
import { useSidebarPeek } from '@/lib/sidebarPeekContext';
import { RemnusMark } from '@/components/ui/remnus-mark';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from './ConfirmDialog';
import { toast } from '@/components/ui/toast';

// Plan pill in the account menu: neutral for free, the accent for the paid tiers.
const TIER_BADGE: Record<PlanTier, 'neutral' | 'outline' | 'signal' | 'solid'> = {
  free: 'neutral',
  startup: 'outline',
  professional: 'signal',
  enterprise: 'solid',
};
import { useWorkspaceEvents } from '@/hooks/useWorkspaceEvents';

function isDescendant(items: WorkspaceItemRow[], targetId: string, ancestorId: string): boolean {
  const target = items.find(i => i.id === targetId);
  if (!target?.parentId) return false;
  if (target.parentId === ancestorId) return true;
  return isDescendant(items, target.parentId, ancestorId);
}

type WorkspaceType = {
  id: string;
  name: string;
  icon?: string | null;
  iconColor?: string | null;
  hidden?: boolean | null;
  /** The pinned Pano (already validated server-side). Left out of the tree below. */
  homeDashboardItemId?: string | null;
  /** Access requests waiting on this user — non-zero only for owners, counted server-side. */
  pendingAccessRequests?: number | null;
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
  hideBrandHeader = false,
  density = 'comfortable',
  showOnboarding = false,
  isProjectWindow = false,
  renderedAt = 0,
  presence = EMPTY_PRESENCE,
}: {
  items: WorkspaceItemRow[];
  workspaces: WorkspaceType[];
  activeWorkspace: WorkspaceType;
  currentUser: CurrentUser;
  hideBrandHeader?: boolean;
  density?: 'compact' | 'comfortable';
  /** Render the new-user onboarding surface here. Set only on the always-mounted
   *  desktop sidebar so the welcome modal/checklist don't double up with the mobile drawer. */
  showOnboarding?: boolean;
  /** This is a project window: a session locked to one workspace (`npx remnus open`).
   *  Everything that isn't content inside that workspace is left out of the tree — not
   *  hidden with CSS, so the modals' state and their extra server calls
   *  (`getUserAgentTokenCount`, `getMyTier`) never run here either. Both of those call
   *  `getCurrentUser()`, which throws for a locked session, so in a window they were
   *  round-trips that could only fail. The flag comes from the server's lock claim
   *  (see the `(app)` layout) — never guessed on the client. */
  isProjectWindow?: boolean;
  /** Server clock (epoch ms) of the layout render. Passed only to the desktop sidebar,
   *  which makes it the one copy that drives live refresh (see `useWorkspaceEvents`). */
  renderedAt?: number;
  /** Agent presence read with this render (`services/agentPresence.ts`): who worked here
   *  lately for the agents card, and which items an agent changed for the tree marks. */
  presence?: AgentPresence;
}) {
  const t = useTranslations('Workspace');
  const tLayout = useTranslations('Layout');
  const tSharing = useTranslations('Sharing');
  const tBilling = useTranslations('Billing');
  const tPage = useTranslations('Page');
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  // After a structural change (rename/delete/reparent) refresh the open content
  // pane so its embedded child-block list reflects the change without a manual
  // reload. On web this is a router.refresh() (redundant with the action's own
  // revalidatePath, but harmless); in the Tauri keep-alive tabs it invalidates
  // the active pane's queries, which the server route's revalidatePath cannot.
  const { refresh: refreshActivePane } = useTabNav();
  const [isSaving, startSaveTransition] = useTransition();
  const [isTauri, setIsTauri] = useState(false);
  const { isPeeking, pin } = useSidebarPeek();

  useEffect(() => {
    const isTauriNow = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
    setIsTauri(isTauriNow);
    if (isTauriNow) initDesktopZoom();
  }, []);

  // Tree creation and editing states
  const [templatePickerWorkspaceId, setTemplatePickerWorkspaceId] = useState<string | null>(null);
  const [templatePickerParentId, setTemplatePickerParentId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [activeIconPickerId, setActiveIconPickerId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // Workspace icon picker
  const [activeWorkspaceIconPickerId, setActiveWorkspaceIconPickerId] = useState<string | null>(null);
  const workspaceIconRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Item context menu
  const [openMenuItemId, setOpenMenuItemId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Item loading state (delete / duplicate)
  const [loadingItem, setLoadingItem] = useState<{ id: string; action: 'delete' | 'duplicate' } | null>(null);

  // Confirm delete state
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<string | null>(null);

  // Inline rename
  const [renamingItemId, setRenamingItemId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');
  const renamingInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!openMenuItemId) return;
    const handleMouseDown = (e: MouseEvent) => {
      const inDesktop = menuRef.current?.contains(e.target as Node);
      const inMobile = mobileMenuRef.current?.contains(e.target as Node);
      if (!inDesktop && !inMobile) {
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

  const handleSidebarIconSelect = (itemId: string, newIcon: string | null, newColor: string | null) => {
    // Optimistic update — no router.refresh() needed
    setLocalItems(prev => prev.map(i => i.id === itemId ? { ...i, icon: newIcon, iconColor: newColor } : i));
    updateWorkspaceItemIcon(itemId, newIcon, newColor);
  };

  const handleWorkspaceIconSelect = (workspaceId: string, newIcon: string | null, newColor: string | null) => {
    setLocalWorkspaces(prev => prev.map(w => w.id === workspaceId ? { ...w, icon: newIcon, iconColor: newColor } : w));
    setActiveWorkspaceIconPickerId(null);
    updateWorkspaceIcon(workspaceId, newIcon, newColor);
  };

  const handleToggleWorkspaceHidden = (workspaceId: string, hidden: boolean) => {
    // Optimistic update — server revalidates in the background
    setLocalWorkspaces(prev => prev.map(w => w.id === workspaceId ? { ...w, hidden } : w));
    setWorkspaceHidden(workspaceId, hidden);
  };

  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [workspaceCreateError, setWorkspaceCreateError] = useState<string | null>(null);
  const [settingsModalWorkspace, setSettingsModalWorkspace] = useState<{ id: string; name: string; icon?: string | null; iconColor?: string | null } | null>(null);
  const [agentsModalOpen, setAgentsModalOpen] = useState(false);
  const [trashModalOpen, setTrashModalOpen] = useState(false);
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [userSettingsOpen, setUserSettingsOpen] = useState(false);
  const whatsNew = useWhatsNew();
  const pwa = usePwaInstall();
  // null = not yet loaded (avoids a false "no agents" warning flash on first render)
  const [agentTokenCount, setAgentTokenCount] = useState<number | null>(null);
  const [trashCount, setTrashCount] = useState<number | null>(null);
  const [planTier, setPlanTier] = useState<PlanTier | null>(null);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'general' | 'members' | 'tokens' | 'sharing'>('general');
  const [shareModalItemId, setShareModalItemId] = useState<string | null>(null);

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

  // Load expanded states from localStorage on mount
  useEffect(() => {
    try {
      const savedWorkspaces = localStorage.getItem('remnus_expanded_workspaces');
      if (savedWorkspaces) {
        setExpandedWorkspaces(JSON.parse(savedWorkspaces));
      }
      const savedItems = localStorage.getItem('remnus_expanded_items');
      if (savedItems) {
        setExpandedItems(JSON.parse(savedItems));
      }
    } catch (e) {
      console.error('Error loading expanded states from localStorage:', e);
    }
  }, []);

  // Save expanded states to localStorage when they change
  useEffect(() => {
    if (Object.keys(expandedWorkspaces).length > 0) {
      localStorage.setItem('remnus_expanded_workspaces', JSON.stringify(expandedWorkspaces));
    }
  }, [expandedWorkspaces]);

  useEffect(() => {
    if (Object.keys(expandedItems).length > 0) {
      localStorage.setItem('remnus_expanded_items', JSON.stringify(expandedItems));
    }
  }, [expandedItems]);

  // Whether hidden workspaces are currently revealed (persisted in localStorage)
  const [showHidden, setShowHidden] = useState(false);
  useEffect(() => {
    try {
      setShowHidden(localStorage.getItem('remnus_show_hidden_workspaces') === '1');
    } catch { /* ignore */ }
  }, []);
  const toggleShowHidden = () => {
    setShowHidden(prev => {
      const next = !prev;
      try { localStorage.setItem('remnus_show_hidden_workspaces', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  // Local state for optimistic UI during drag and drop
  const [localWorkspaces, setLocalWorkspaces] = useState<WorkspaceType[]>(workspaces);
  const [localItems, setLocalItems] = useState<WorkspaceItemRow[]>(items);

  // Keep a ref so the sync effect can read latest localItems without depending on it
  const localItemsRef = useRef(localItems);
  localItemsRef.current = localItems;

  // When router.refresh() delivers new server props, sync them into local state.
  // Skip while an optimistic (temp-*) item is still in flight to avoid flickering.
  useEffect(() => {
    if (!localItemsRef.current.some((i) => i.id.startsWith('temp-'))) {
      setLocalItems(items);
    }
  }, [items]);  

  useEffect(() => {
    setLocalWorkspaces(workspaces);
  }, [workspaces]);

  // Agent presence: one server-clock "now" for every mark, aged on a 30s tick.
  const presenceNow = useServerNow(presence.at);
  const workingWorkspaces = useWorkingWorkspaces(presence);
  const hiddenWorkspaceIds = useMemo(
    () => new Set(showHidden ? [] : localWorkspaces.filter((w) => w.hidden).map((w) => w.id)),
    [localWorkspaces, showHidden],
  );
  // A collapsed parent shows the newest agent change anywhere beneath it.
  const subtreeTouch = useMemo(() => {
    const byId = new Map(localItems.map((i) => [i.id, i]));
    const out: Record<string, PresenceTouch> = {};
    for (const [id, touch] of Object.entries(presence.touched)) {
      const seen = new Set<string>();
      for (let node = byId.get(id); node && !seen.has(node.id); node = node.parentId ? byId.get(node.parentId) : undefined) {
        seen.add(node.id);
        if (!out[node.id] || touch.at > out[node.id].at) out[node.id] = touch;
      }
    }
    return out;
  }, [localItems, presence.touched]);

  const isAnyModalOrPickerOpen = !!(
    settingsModalWorkspace ||
    templatePickerWorkspaceId ||
    activeIconPickerId ||
    activeWorkspaceIconPickerId ||
    renamingItemId ||
    openMenuItemId ||
    confirmDeleteItemId
  );

  // Subscribe to real-time events from other users / MCP agents
  useWorkspaceEvents(currentUser.id, isAnyModalOrPickerOpen, renderedAt);

  // Load agent token count + current plan tier for the sidebar badges. Trash is the
  // only one a project window asks for — the other two are account-level and their
  // buttons aren't rendered there.
  useEffect(() => {
    getUserTrashCount().then(setTrashCount).catch(() => {});
    if (isProjectWindow) return;
    getUserAgentTokenCount().then(setAgentTokenCount).catch(() => {});
    getMyTier().then(setPlanTier).catch(() => {});
  }, [isProjectWindow]);

  // Remnus logo → first root-level item of the active workspace
  const logoHref = useMemo(() => {
    const first = localItems.find(
      (i) => i.workspaceId === activeWorkspace.id && !i.parentId,
    );
    if (!first) return undefined;
    if (first.type === 'database' && first.databaseId) return `/db/${first.databaseId}`;
    if (first.type === 'dashboard') return `/dashboard/${first.id}`;
    return `/page/${first.id}`;
  }, [localItems, activeWorkspace.id]);

  // Find which workspace contains the active item based on the pathname
  const activeWorkspaceIdFromPath = (() => {
    // If the path is a database view: /db/[databaseId] or database subpage /db/[databaseId]/[pageId]
    const dbMatch = pathname.match(/^\/db\/([^\/]+)/);
    if (dbMatch) {
      const dbId = dbMatch[1];
      const matchingItem = localItems.find(i => i.type === 'database' && i.databaseId === dbId);
      if (matchingItem) return matchingItem.workspaceId;
    }

    // If the path is a standalone page or a dashboard, both address the
    // workspace item directly: /page/[itemId] · /dashboard/[itemId]
    const itemMatch = pathname.match(/^\/(?:page|dashboard)\/([^\/]+)/);
    if (itemMatch) {
      const itemId = itemMatch[1];
      const matchingItem = localItems.find(i => i.id === itemId);
      if (matchingItem) return matchingItem.workspaceId;
    }

    // The knowledge map names its workspace directly: /graph/[workspaceId]
    const graphMatch = pathname.match(/^\/graph\/([^\/]+)/);
    if (graphMatch && localWorkspaces.some(w => w.id === graphMatch[1])) return graphMatch[1];

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
    });
  };

  const handleWorkspaceDragEnd = () => {
    setDraggedWorkspaceId(null);
    setDragOverWorkspaceId(null);
  };

  // Drag and drop states for workspace items
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [itemDropPosition, setItemDropPosition] = useState<'before' | 'inside' | 'after'>('before');
  const [dragOverWorkspaceForItemId, setDragOverWorkspaceForItemId] = useState<string | null>(null);

  const handleItemDragStart = (e: React.DragEvent, id: string) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItemId(id);
  };

  const handleItemDragOver = (e: React.DragEvent, id: string, workspaceId: string) => {
    if (!draggedItemId || draggedItemId === id) return;
    if (isDescendant(localItems, id, draggedItemId)) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setDragOverItemId(id);

    // Only pages can hold children — databases get plain before/after reordering.
    const targetItem = localItems.find(i => i.id === id);
    const canNest = targetItem?.type === 'page';

    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const ratio = relativeY / rect.height;

    if (canNest) {
      // Three zones: top ~30% before · middle nest inside · bottom ~30% after.
      if (ratio < 0.3) setItemDropPosition('before');
      else if (ratio > 0.7) setItemDropPosition('after');
      else setItemDropPosition('inside');
    } else {
      setItemDropPosition(ratio > 0.5 ? 'after' : 'before');
    }
  };

  const handleItemDrop = async (e: React.DragEvent, targetId: string, workspaceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItemId(null);
    if (!draggedItemId || draggedItemId === targetId) return;
    if (isDescendant(localItems, targetId, draggedItemId)) return;

    const draggedItem = localItems.find(i => i.id === draggedItemId);
    const targetItem = localItems.find(i => i.id === targetId);
    if (!draggedItem || !targetItem) return;

    const sourceWorkspaceId = draggedItem.workspaceId;
    const targetWorkspaceId = workspaceId;

    // ── Nest inside (drag-into) ──────────────────────────────────────────────
    if (itemDropPosition === 'inside' && targetItem.type === 'page') {
      // Move the dragged item to be the last child of the target.
      const updatedDragged = { ...draggedItem, parentId: targetId, workspaceId: targetWorkspaceId };
      const newItems = localItems.map(i => i.id === draggedItemId ? updatedDragged : i);

      // New sibling order = existing children of target + the dragged item at the end.
      const siblings = newItems.filter(i => i.parentId === targetId && i.workspaceId === targetWorkspaceId);

      setLocalItems(newItems);
      setExpandedItems(prev => ({ ...prev, [targetId]: true }));
      setDraggedItemId(null);

      startSaveTransition(async () => {
        await reparentWorkspaceItem(draggedItemId, targetId, targetWorkspaceId, siblings.map(i => i.id));
        refreshActivePane(); // parent gained a child — refresh the open pane's child list
      });
      return;
    }

    if (sourceWorkspaceId === targetWorkspaceId) {
      // Same workspace reordering. A before/after drop adopts the target's parent
      // level, so dropping next to a nested item joins that branch and dropping
      // next to a root item un-nests.
      const newParentId = targetItem.parentId;
      const parentChanged = draggedItem.parentId !== newParentId;

      const wsItems = localItems.filter(i => i.workspaceId === targetWorkspaceId);
      const sourceIndex = wsItems.findIndex(i => i.id === draggedItemId);
      if (sourceIndex === -1) return;

      const reorderedWsItems = [...wsItems];
      const [dragged] = reorderedWsItems.splice(sourceIndex, 1);
      const movedDragged = parentChanged ? { ...dragged, parentId: newParentId } : dragged;

      let newTargetIndex = reorderedWsItems.findIndex(i => i.id === targetId);
      if (itemDropPosition === 'after') {
        newTargetIndex += 1;
      }

      reorderedWsItems.splice(newTargetIndex, 0, movedDragged);

      // Check if anything actually changed
      const orderChanged = reorderedWsItems.some((item, idx) => item.id !== wsItems[idx].id);
      if (!orderChanged && !parentChanged) {
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
        if (parentChanged) {
          // Persist the new parent + the sibling order within that parent.
          const siblingOrder = reorderedWsItems
            .filter(i => i.parentId === newParentId)
            .map(i => i.id);
          await reparentWorkspaceItem(draggedItemId, newParentId, targetWorkspaceId, siblingOrder);
          refreshActivePane(); // parent membership changed — refresh the open pane's child list
        } else {
          await updateWorkspaceItemsOrder(reorderedWsItems.map(i => i.id));
        }
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

    // Navigate to the TOP of the hierarchy (first root item), not merely the
    // oldest item in the flat list — ensuring an instant client-side transition.
    const workspaceChildren = itemsByWorkspace[id] || [];
    const firstItem = workspaceChildren.find((i) => i.parentId === null) ?? workspaceChildren[0];
    if (firstItem) {
      router.push(hrefFor(firstItem));
    } else {
      // No items — switch workspace then show the empty state
      switchWorkspace(id).then(() => {
        router.push('/app');
      });
    }
  };

  const handleCreateWorkspace = () => {
    const name = newWorkspaceName.trim();
    if (!name) return;

    setWorkspaceCreateError(null);
    startTransition(async () => {
      const res = await createWorkspace(name);
      if ('error' in res && res.error) {
        setWorkspaceCreateError(res.error);
        return;
      }
      setIsCreatingWorkspace(false);
      setNewWorkspaceName('');
      if (res.id) setExpandedWorkspaces(prev => ({ ...prev, [res.id!]: true }));
      router.push('/app');
    });
  };



  const handleRenameItem = (item: WorkspaceItemRow) => {
    const title = renamingTitle.trim();
    if (!title || title === item.title) {
      setRenamingItemId(null);
      return;
    }
    // Optimistic update
    setLocalItems(prev => prev.map(i => i.id === item.id ? { ...i, title } : i));
    setRenamingItemId(null);
    startTransition(async () => {
      await updateWorkspaceItemTitle(item.id, title);
      refreshActivePane();
    });
  };

  const handleDuplicateItem = (item: WorkspaceItemRow) => {
    setOpenMenuItemId(null);
    setLoadingItem({ id: item.id, action: 'duplicate' });
    startTransition(async () => {
      const result = await duplicateWorkspaceItem(item.id);
      if (result?.type === 'page') router.push(`/page/${result.itemId}`);
      else if (result?.type === 'dashboard') router.push(`/dashboard/${result.itemId}`);
      else if (result?.type === 'database') router.push(`/db/${result.dbId}`);
    });
  };

  const handleDeleteItem = (item: WorkspaceItemRow) => {
    setOpenMenuItemId(null);
    setConfirmDeleteItemId(item.id);
  };

  const confirmDelete = (item: WorkspaceItemRow) => {
    setConfirmDeleteItemId(null);
    setLoadingItem({ id: item.id, action: 'delete' });

    // Optimistic: remove item (and all descendants) from local state immediately
    const collectDescendantIds = (id: string, allItems: WorkspaceItemRow[]): string[] => {
      const children = allItems.filter(i => i.parentId === id);
      return [id, ...children.flatMap(c => collectDescendantIds(c.id, allItems))];
    };
    const idsToRemove = new Set(collectDescendantIds(item.id, localItems));
    const snapshot = localItems;
    setLocalItems(prev => prev.filter(i => !idsToRemove.has(i.id)));

    const href = item.type === 'database' && item.databaseId
      ? `/db/${item.databaseId}`
      : item.type === 'dashboard'
        ? `/dashboard/${item.id}`
        : `/page/${item.id}`;

    startTransition(async () => {
      try {
        await deleteWorkspaceItem(item.id);
        // Navigate away only once the item is really gone; otherwise a failed
        // delete would strand the user on /app with the page still alive.
        if (pathname.startsWith(href)) router.push('/app');
        // Deleting a CHILD while viewing its parent: refresh the parent pane so
        // its embedded child-block link to the deleted page disappears.
        else refreshActivePane();
      } catch (err) {
        // The optimistic removal above already hid the item. Swallowing the
        // error here left the sidebar asserting a deletion that never happened
        // — the page stayed in the database, kept rendering inside its parent,
        // and was still openable. Put it back and say so.
        setLocalItems(snapshot);
        toast({ title: t('deleteFailed', { title: item.title }), tone: 'error' });
        reportClientError(err, { source: 'sidebar-delete', itemId: item.id, itemType: item.type });
      } finally {
        setLoadingItem(null);
      }
    });
  };

  // Notion-style right-click menu for sidebar items (desktop). On touch we keep
  // the bottom-sheet (openMenuItemId) since coarse pointers have no right-click.
  const itemMenu = useContextMenu(() => setOpenMenuItemId(null));

  const buildItemMenu = (item: WorkspaceItemRow, workspaceId: string): MenuItem[] => [
    { id: 'open', label: t('open'), icon: ArrowUpRight, onSelect: () => router.push(hrefFor(item)) },
    { id: 'rename', label: t('rename'), icon: Edit3, onSelect: () => { setRenamingItemId(item.id); setRenamingTitle(item.title); } },
    { id: 'duplicate', label: t('duplicate'), icon: Copy, onSelect: () => handleDuplicateItem(item) },
    { id: 'copy-link', label: t('copyLink'), icon: Link2, onSelect: () => { navigator.clipboard?.writeText(window.location.origin + hrefFor(item)); } },
    { kind: 'separator' },
    ...(item.type === 'page'
      ? [{
          id: 'add-inside',
          label: t('addSubPage'),
          icon: Plus,
          onSelect: () => {
            setTemplatePickerParentId(item.id);
            setTemplatePickerWorkspaceId(workspaceId);
            setExpandedItems(prev => ({ ...prev, [item.id]: true }));
          },
        } as MenuItem]
      : []),
    // Dashboards are not publishable in v1 (AGENTS.md -> Dashboards). Offering
    // Share here would publish a page whose body is the raw JSON spec.
    ...(item.type !== 'dashboard'
      ? [{ id: 'share', label: tSharing('shareButton'), icon: Globe, onSelect: () => setShareModalItemId(item.id) } as MenuItem]
      : []),
    { kind: 'separator' },
    { id: 'delete', label: t('delete'), icon: Trash, danger: true, onSelect: () => handleDeleteItem(item) },
  ];

  const openMenuFor = (e: React.MouseEvent, item: WorkspaceItemRow, workspaceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches;
    if (isDesktop) {
      setOpenMenuItemId(item.id); // keep the row highlighted while the menu is open
      itemMenu.open(e, buildItemMenu(item, workspaceId));
    } else {
      setOpenMenuItemId(prev => (prev === item.id ? null : item.id)); // mobile bottom sheet
    }
  };

  const isActive = (item: WorkspaceItemRow) => {
    if (item.type === 'database' && item.databaseId) {
      return pathname.startsWith(`/db/${item.databaseId}`);
    }
    if (item.type === 'dashboard') return pathname === `/dashboard/${item.id}`;
    return pathname === `/page/${item.id}`;
  };

  const hrefFor = (item: WorkspaceItemRow) => {
    if (item.type === 'database' && item.databaseId) return `/db/${item.databaseId}`;
    if (item.type === 'dashboard') return `/dashboard/${item.id}`;
    return `/page/${item.id}`;
  };

  const activeMenuItem = openMenuItemId ? items.find(i => i.id === openMenuItemId) : null;
  const sidebarOverlayContainer = getSidebarOverlayContainer();

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      {/* Brand Header — hidden in mobile sheet */}
      <div className={`pl-3 pr-2 h-12 flex items-center justify-between shrink-0 ${hideBrandHeader ? 'hidden' : ''}`} {...(isTauri ? { 'data-tauri-drag-region': '' } : {})}>
        <div className="flex items-center group/brand">
          {!isTauri && (
            <div className="w-0 overflow-hidden group-hover/brand:w-6 transition-[width] duration-200 shrink-0">
              <Link
                href="/"
                className="flex items-center justify-center w-6 h-6 rounded-sm text-fg-3 hover:text-fg hover:bg-hover"
                title={t('backToHome')}
              >
                <ArrowLeft size={13} />
              </Link>
            </div>
          )}

          <Link href={logoHref ?? '#'} className="flex items-center gap-2.5 rounded-sm text-fg transition-opacity hover:opacity-80">
            <RemnusMark className="h-4 w-[18px]" />
            <span className="font-semibold tracking-tight">Remnus</span>
            <Badge variant="outline" size="sm">{t('earlyAccess')}</Badge>
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          {isSaving && (
            <div className="flex items-center gap-1.5 text-2xs text-fg-3 font-medium px-1.5" role="status">
              <div className="w-2.5 h-2.5 rounded-full border-[1.5px] border-fg-3 border-t-transparent animate-spin shrink-0" />
              <span>{t('saving')}</span>
            </div>
          )}
          {isPeeking ? (
            /* Peek mode: clicking pins the sidebar and adjusts the content layout */
            <button
              type="button"
              onClick={pin}
              aria-label={tLayout('pinSidebar')}
              title={tLayout('pinSidebar')}
              className="hidden lg:flex h-7 w-7 items-center justify-center rounded-control text-fg-3 hover:text-fg hover:bg-hover transition-colors"
            >
              <PanelLeft size={16} />
            </button>
          ) : (
            /* Pinned mode: clicking hides the sidebar and content fills the space */
            <button
              type="button"
              onClick={() => writeSidebarVisible(false)}
              aria-label={tLayout('hideSidebar')}
              title={tLayout('hideSidebar')}
              className="hidden lg:flex h-7 w-7 items-center justify-center rounded-control text-fg-3 hover:text-fg hover:bg-hover transition-colors"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Tree view list */}
      <div className="flex-1 overflow-y-auto px-2 pt-1 pb-4 space-y-3 group/wslist">
        {localWorkspaces
          .filter((w) => showHidden || !w.hidden || w.id === activeWorkspaceIdFromPath)
          .map((w) => {
          const isExpanded = expandedWorkspaces[w.id] !== false;
          // The pinned Pano is represented by its button, not by a second tree row.
          const workspaceChildren = (itemsByWorkspace[w.id] || []).filter((i) => i.id !== w.homeDashboardItemId);
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
                <div className={`absolute left-0 right-0 h-0.5 bg-signal rounded-full z-10 ${
                  dropPosition === 'after' ? '-bottom-1' : '-top-1'
                }`}>
                  <div className="absolute -left-1 -top-0.5 w-1.5 h-1.5 bg-signal rounded-full" />
                </div>
              )}
              {/* Workspace Root Node */}
              <div
                onClick={() => handleSwitchWorkspace(w.id)}
                onDragOver={(e) => handleWorkspaceItemDragOverRoot(e, w.id)}
                onDragLeave={handleWorkspaceItemDragLeaveRoot}
                onDrop={(e) => handleWorkspaceItemDropOnRoot(e, w.id)}
                className={`flex items-center justify-between h-8 px-1.5 rounded-control text-sm transition-colors group/root cursor-pointer ${
                  isCurrentActive
                    ? 'text-fg font-semibold'
                    : 'text-fg-2 hover:bg-sheet/55 hover:text-fg'
                } ${
                  dragOverWorkspaceForItemId === w.id
                    ? 'bg-signal-soft ring-1 ring-signal/50 text-fg'
                    : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {/* Chevron Toggle */}
                  <button
                    onClick={(e) => toggleExpand(w.id, e)}
                    className="p-0.5 rounded-sm hover:bg-hover text-fg-4 hover:text-fg transition-colors shrink-0"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  {/* Workspace icon / initials badge. Changing it is workspace management
                      (`assertWorkspaceManagementAccess`), which a project window is denied,
                      so there it's a plain badge. */}
                  <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      ref={(el) => { workspaceIconRefs.current[w.id] = el; }}
                      onClick={() => { if (!isProjectWindow) setActiveWorkspaceIconPickerId(activeWorkspaceIconPickerId === w.id ? null : w.id); }}
                      className="flex items-center justify-center"
                      title={isProjectWindow ? undefined : t('changeIcon')}
                      disabled={isProjectWindow}
                    >
                      {w.icon ? (
                        <PageIcon icon={w.icon} iconColor={w.iconColor} size={20} hideFallback={false} className="rounded" />
                      ) : (
                        <div
                          translate="no"
                          className={`w-5 h-5 rounded-[5px] flex items-center justify-center text-2xs font-bold shrink-0 transition-colors notranslate ${
                            isCurrentActive
                              ? 'bg-ink text-ink-fg'
                              : 'bg-hover text-fg-2 group-hover/root:bg-line-strong'
                          }`}
                        >
                          {(w.name || 'W').trim().charAt(0).toUpperCase()}
                        </div>
                      )}
                    </button>
                    {activeWorkspaceIconPickerId === w.id && sidebarOverlayContainer && createPortal(
                      <IconPicker
                        currentIcon={w.icon}
                        currentIconColor={w.iconColor}
                        onSelect={(newIcon, newColor) => handleWorkspaceIconSelect(w.id, newIcon, newColor)}
                        onClose={() => setActiveWorkspaceIconPickerId(null)}
                        anchorRef={{ current: workspaceIconRefs.current[w.id] }}
                      />,
                      sidebarOverlayContainer,
                    )}
                  </div>

                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="truncate font-medium">{w.name}</span>
                    {/* An agent is working in this workspace now: a steady signal dot. */}
                    {workingWorkspaces.has(w.id) && (
                      <span
                        role="img"
                        aria-label={t('presenceWorkspaceLive')}
                        title={t('presenceWorkspaceLive')}
                        className="size-1.5 shrink-0 rounded-full bg-signal"
                      />
                    )}
                  </span>

                  {/* Someone asked to join. The count only ever reaches an owner (see
                      getWorkspaces) and a project window gets 0, so no role check here. */}
                  {!isProjectWindow && (w.pendingAccessRequests ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSettingsInitialTab('members');
                        setSettingsModalWorkspace({ id: w.id, name: w.name, icon: w.icon, iconColor: w.iconColor });
                      }}
                      className="min-w-4 h-4 shrink-0 rounded-full bg-red-500 px-1 text-center text-2xs leading-4 font-semibold text-white hover:bg-red-500/85 transition-colors"
                      title={t('accessRequestsPending', { count: w.pendingAccessRequests ?? 0 })}
                      aria-label={t('accessRequestsPending', { count: w.pendingAccessRequests ?? 0 })}
                    >
                      {(w.pendingAccessRequests ?? 0) > 9 ? '9+' : w.pendingAccessRequests}
                    </button>
                  )}
                </div>

                {/* Workspace actions on hover */}
                <div className="flex items-center gap-0.5 shrink-0 ml-1 sm:hidden sm:group-hover/root:flex" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      setTemplatePickerWorkspaceId(w.id);
                      setExpandedWorkspaces(prev => ({ ...prev, [w.id]: true }));
                    }}
                    className="p-1 rounded-sm hover:bg-hover text-fg-3 hover:text-fg"
                    title={t('newItem')}
                  >
                    <Plus size={14} />
                  </button>
                  {/* Hiding and workspace settings are management, denied to a locked
                      session — only the "new item" button above is content. */}
                  {!isProjectWindow && (
                    <>
                      <button
                        onClick={() => handleToggleWorkspaceHidden(w.id, !w.hidden)}
                        className="p-1 rounded-sm hover:bg-hover text-fg-3 hover:text-fg"
                        title={w.hidden ? t('unhideWorkspace') : t('hideWorkspace')}
                      >
                        {w.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => {
                          setSettingsInitialTab('general');
                          setSettingsModalWorkspace({ id: w.id, name: w.name, icon: w.icon, iconColor: w.iconColor });
                        }}
                        className="p-1 rounded-sm hover:bg-hover text-fg-3 hover:text-fg"
                        title={t('workspaceSettings')}
                      >
                        <Settings size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Workspace Children Subtree */}
              {isExpanded && (
                <div className="pl-2.5 ml-2 space-y-px mt-0.5 mb-1">
                  <WorkspaceQuickLinks
                    workspaceId={w.id}
                    homeDashboardId={w.homeDashboardItemId ?? null}
                    onHomeCreated={(itemId) =>
                      setLocalWorkspaces((prev) => prev.map((x) => (x.id === w.id ? { ...x, homeDashboardItemId: itemId } : x)))
                    }
                  />
                  {(() => {
                    const topLevelChildren = workspaceChildren.filter(item => !item.parentId);

                    const renderItem = (item: WorkspaceItemRow, depth: number = 0) => {
                      const isLoading = loadingItem?.id === item.id;
                      const isDeleting = isLoading && loadingItem?.action === 'delete';
                      const isItemDragged = draggedItemId === item.id;
                      const isItemDragOver = dragOverItemId === item.id;
                      // Gray out items that can't receive a drop while dragging:
                      // databases and dashboards (neither holds children) and
                      // descendants of the dragged item.
                      const isInvalidDropTarget = !!draggedItemId && !isItemDragged && (
                        item.type !== 'page' ||
                        isDescendant(localItems, item.id, draggedItemId)
                      );

                      const itemChildren = workspaceChildren.filter(child => child.parentId === item.id);
                      const hasChildren = itemChildren.length > 0;

                      // Smart expanded logic:
                      // Explicit expand/collapse takes priority.
                      // If undefined, expand if active or if any descendant is active.
                      const hasActiveDescendant = (node: WorkspaceItemRow): boolean => {
                        const children = workspaceChildren.filter(c => c.parentId === node.id);
                        return children.some(c => isActive(c) || hasActiveDescendant(c));
                      };
                      const isItemExpanded =
                        expandedItems[item.id] === true ||
                        (expandedItems[item.id] !== false && (isActive(item) || hasActiveDescendant(item)));

                      return (
                        <div key={item.id} className="space-y-0.5">
                          <div
                            className={`flex items-center gap-1.5 min-w-0 px-1.5 ${density === 'compact' ? 'h-7' : 'h-8'} rounded-control text-sm transition-[background-color,color,box-shadow] duration-150 group/item cursor-pointer relative ${
                              isActive(item)
                                ? 'bg-sheet text-fg font-medium shadow-lift'
                                : 'text-fg-2 hover:bg-sheet/55 hover:text-fg'
                            } ${isLoading ? 'opacity-40 pointer-events-none' : ''} ${
                              isItemDragged ? 'opacity-30 animate-pulse' : ''
                            } ${isInvalidDropTarget ? 'opacity-35' : ''}`}
                            draggable
                            onDragStart={(e) => handleItemDragStart(e, item.id)}
                            onDragOver={(e) => handleItemDragOver(e, item.id, w.id)}
                            onDragEnd={handleItemDragEnd}
                            onDrop={(e) => handleItemDrop(e, item.id, w.id)}
                            onContextMenu={(e) => openMenuFor(e, item, w.id)}
                          >
                            {/* Drop INSIDE: highlight the whole row */}
                            {isItemDragOver && itemDropPosition === 'inside' && (
                              <div className="absolute inset-0 rounded-control ring-2 ring-signal/70 bg-signal-soft z-10 pointer-events-none" />
                            )}
                            {/* Drop BEFORE / AFTER: a reorder line at the matching edge */}
                            {isItemDragOver && itemDropPosition !== 'inside' && (
                              <div className={`absolute left-6 right-0 h-0.5 bg-signal rounded-full z-10 ${
                                itemDropPosition === 'after' ? '-bottom-0.5' : '-top-0.5'
                              }`}>
                                <div className="absolute -left-1 -top-0.5 w-1.5 h-1.5 bg-signal rounded-full" />
                              </div>
                            )}
                            
                            {/* Toggle Chevron for nested structure */}
                            {hasChildren ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setExpandedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                                }}
                                className="p-0.5 rounded-sm hover:bg-hover text-fg-4 hover:text-fg transition-colors shrink-0"
                              >
                                {isItemExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            ) : (
                              <div className="w-[18px] h-4 shrink-0" />
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
                                className="hover:bg-hover p-0.5 rounded-sm transition-colors flex items-center justify-center cursor-pointer"
                                title={t('changeIcon')}
                              >
                                <PageIcon
                                  icon={item.icon}
                                  iconColor={item.iconColor}
                                  size={16}
                                  fallbackType={item.type}
                                  className="shrink-0"
                                />
                              </button>
                              {activeIconPickerId === item.id && sidebarOverlayContainer && createPortal(
                                <IconPicker
                                  currentIcon={item.icon}
                                  currentIconColor={item.iconColor}
                                  onSelect={(newIcon, newColor) => handleSidebarIconSelect(item.id, newIcon, newColor)}
                                  onClose={() => setActiveIconPickerId(null)}
                                  anchorRef={{ current: itemRefs.current[item.id] }}
                                />,
                                sidebarOverlayContainer,
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
                                className="flex-1 min-w-0 h-6 bg-sheet border border-focus rounded-sm px-1.5 text-ui text-fg outline-none"
                              />
                            ) : (
                              <Link
                                href={hrefFor(item)}
                                className="truncate flex-1 min-w-0 block py-0.5"
                              >
                                {item.title || tPage('untitled')}
                              </Link>
                            )}

                            {/* An agent changed it lately (a collapsed parent: anything beneath it). */}
                            {renamingItemId !== item.id && !isLoading && (
                              <AgentTouchMark
                                touch={hasChildren && !isItemExpanded ? subtreeTouch[item.id] : presence.touched[item.id]}
                                presence={presence}
                                now={presenceNow}
                              />
                            )}

                            {/* Hover actions & spinner */}
                            {renamingItemId !== item.id && (
                              isLoading ? (
                                <div className={`shrink-0 p-1 ${isDeleting ? 'text-red-400' : 'text-fg-3'}`}>
                                  <div className={`w-3 h-3 rounded-full border-2 animate-spin shrink-0 ${
                                    isDeleting
                                      ? 'border-red-500/25 border-t-red-400'
                                      : 'border-line border-t-fg-3'
                                  }`} />
                                </div>
                              ) : (
                                <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
                                  {item.type === 'page' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setTemplatePickerParentId(item.id);
                                        setTemplatePickerWorkspaceId(w.id);
                                        setExpandedItems(prev => ({ ...prev, [item.id]: true }));
                                      }}
                                      className="p-1 rounded-sm hover:bg-hover text-fg-3 hover:text-fg"
                                      title={t('addSubPage')}
                                    >
                                      <Plus size={14} />
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => openMenuFor(e, item, w.id)}
                                    className={`p-1 rounded-sm transition-colors text-fg-3 hover:text-fg hover:bg-hover ${
                                      openMenuItemId === item.id ? 'bg-hover text-fg' : ''
                                    }`}
                                    title={t('moreOptions')}
                                  >
                                    <MoreHorizontal size={14} />
                                  </button>
                                </div>
                              )
                            )}
                          </div>

                          {/* Children: indented under the parent's chevron, a faint guide line for depth */}
                          {isItemExpanded && hasChildren && (
                            <div className="pl-2 space-y-px border-l border-line/70 ml-[15px] my-px">
                              {itemChildren.map(child => renderItem(child, depth + 1))}
                            </div>
                          )}
                        </div>
                      );
                    };

                    return topLevelChildren.map(item => renderItem(item));
                  })()}

                  {/* Empty state */}
                  {workspaceChildren.length === 0 && (
                    <div className="text-xs text-fg-4 py-1.5 px-2">
                      {t('emptyWorkspace')}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Show / hide hidden workspaces toggle — workspace management, so not in a project window */}
        {!isProjectWindow && localWorkspaces.some((w) => w.hidden) && (
          <button
            onClick={toggleShowHidden}
            className="flex items-center gap-1.5 px-2 py-1 text-2xs text-fg-3 hover:text-fg transition-colors"
          >
            {showHidden ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>
              {showHidden
                ? t('hideHiddenWorkspaces')
                : t('showHiddenWorkspaces', { count: localWorkspaces.filter((w) => w.hidden).length })}
            </span>
          </button>
        )}

        {/* Add Workspace Action Row — a locked session can't create or switch workspaces */}
        {!isProjectWindow && (
        <div className="pt-2">
          {isCreatingWorkspace ? (
            <div className="bg-sheet rounded-surface p-2.5 space-y-2 shadow-lift">
              <input
                type="text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder={t('workspaceNamePlaceholder')}
                className="w-full h-8 bg-raised border border-line rounded-control px-2.5 text-ui text-fg placeholder:text-fg-4 outline-none hover:border-line-strong focus-visible:border-focus"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateWorkspace();
                  if (e.key === 'Escape') { setIsCreatingWorkspace(false); setWorkspaceCreateError(null); }
                }}
                autoFocus
              />
              {workspaceCreateError && (
                <p className="m-0 text-2xs text-red-400 leading-snug">{workspaceCreateError}</p>
              )}
              <div className="flex gap-1.5">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreateWorkspace}
                  disabled={!newWorkspaceName.trim()}
                  loading={isPending}
                  className="flex-1"
                >
                  {t('create')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setIsCreatingWorkspace(false)}>
                  {t('cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsCreatingWorkspace(true)}
              className="w-full flex items-center justify-center gap-1.5 h-8 text-xs text-fg-3 hover:text-fg hover:bg-sheet/55 border border-dashed border-line hover:border-line-strong rounded-control transition-[color,background-color,border-color,opacity] opacity-0 group-hover/wslist:opacity-100 focus-visible:opacity-100"
            >
              <Plus size={14} /> {t('addWorkspace')}
            </button>
          )}
        </div>
        )}
      </div>

      {/* Item context menu — mobile: bottom sheet, desktop: floating dropdown */}
      {activeMenuItem && sidebarOverlayContainer && createPortal(
        <>
          {/* Mobile bottom sheet menu */}
          <div
            className={`fixed inset-0 z-250 sm:hidden transition-opacity duration-200 ${openMenuItemId ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setOpenMenuItemId(null)}
          />
          <div ref={mobileMenuRef} className={`fixed inset-x-0 bottom-14 z-250 sm:hidden bg-float rounded-t-2xl shadow-modal transition-transform duration-200 ease-in-out ${openMenuItemId ? 'translate-y-0' : 'translate-y-full'}`}>
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-8 h-1 rounded-full bg-line-strong" />
            </div>
            <div className="px-4 py-2 text-xs text-fg-3 font-medium truncate border-b border-line mb-1">
              {activeMenuItem.title || tPage('untitled')}
            </div>
            <button
              onClick={() => {
                setOpenMenuItemId(null);
                setRenamingItemId(activeMenuItem.id);
                setRenamingTitle(activeMenuItem.title);
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-fg-2 active:bg-hover transition-colors"
            >
              <Edit3 size={16} className="text-fg-3 shrink-0" />
              {t('rename')}
            </button>
            <button
              onClick={() => handleDuplicateItem(activeMenuItem)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-fg-2 active:bg-hover transition-colors"
            >
              <Copy size={16} className="text-fg-3 shrink-0" />
              {t('duplicate')}
            </button>
            {/* Same reason as the desktop menu above: dashboards aren't publishable in v1. */}
            {activeMenuItem.type !== 'dashboard' && (
              <button
                onClick={() => {
                  setOpenMenuItemId(null);
                  setShareModalItemId(activeMenuItem.id);
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-fg-2 active:bg-hover transition-colors"
              >
                <Globe size={16} className="text-fg-3 shrink-0" />
                {tSharing('shareButton')}
              </button>
            )}
            <div className="border-t border-line mx-4 my-1" />
            <button
              onClick={() => handleDeleteItem(activeMenuItem)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-red-400 active:bg-hover transition-colors mb-2"
            >
              <Trash size={16} className="shrink-0" />
              {t('delete')}
            </button>
          </div>
        </>,
        sidebarOverlayContainer,
      )}

      {/* Desktop: right-click / ⋯ menu (rendered via portal) */}
      {itemMenu.node}

      {shareModalItemId && sidebarOverlayContainer && createPortal(
        <ShareModal
          pageId={shareModalItemId}
          workspaceId={activeWorkspace.id}
          isAdmin={currentUser.role === 'admin'}
          onClose={() => setShareModalItemId(null)}
        />,
        sidebarOverlayContainer,
      )}

      {templatePickerWorkspaceId && sidebarOverlayContainer && createPortal(
        <TemplatePickerModal
          workspaceId={templatePickerWorkspaceId}
          activeWorkspaceId={activeWorkspace.id}
          parentId={templatePickerParentId || undefined}
          onClose={() => {
            setTemplatePickerWorkspaceId(null);
            setTemplatePickerParentId(null);
          }}
          onOptimisticCreate={(type, tempId, title, icon, iconColor) => {
            // Add temp item to sidebar instantly
            const newItem: WorkspaceItemRow = {
              id: tempId,
              workspaceId: templatePickerWorkspaceId,
              type,
              title,
              parentId: templatePickerParentId ?? null,
              sortOrder: 0,
              icon,
              iconColor,
              createdAt: new Date(),
              updatedAt: new Date(),
              databaseId: null,
            };
            setLocalItems(prev => [newItem, ...prev]);
            if (templatePickerParentId) {
              setExpandedItems(prev => ({ ...prev, [templatePickerParentId]: true }));
            }
            setTemplatePickerWorkspaceId(null);
            setTemplatePickerParentId(null);
          }}
          onCreated={(type, navId, tempId, sidebarItemId) => {
            // Replace temp item with real item and navigate
            const realSidebarId = type === 'database' ? (sidebarItemId ?? navId) : navId;
            setLocalItems(prev => prev.map(i => {
              if (i.id !== tempId) return i;
              return { ...i, id: realSidebarId, databaseId: type === 'database' ? navId : null };
            }));
            router.push(
              type === 'database' ? `/db/${navId}` : type === 'dashboard' ? `/dashboard/${navId}` : `/page/${navId}`,
            );
          }}
        />,
        sidebarOverlayContainer,
      )}

      {settingsModalWorkspace && sidebarOverlayContainer && createPortal(
        <WorkspaceSettingsModal
          workspaceId={settingsModalWorkspace.id}
          workspaceName={settingsModalWorkspace.name}
          workspaceIcon={settingsModalWorkspace.icon}
          workspaceIconColor={settingsModalWorkspace.iconColor}
          currentUser={currentUser}
          initialTab={settingsInitialTab}
          onClose={() => { setSettingsModalWorkspace(null); setSettingsInitialTab('general'); }}
          onRenamed={(newName) => {
            setSettingsModalWorkspace(prev => prev ? { ...prev, name: newName } : null);
            setLocalWorkspaces(prev => prev.map(w => w.id === settingsModalWorkspace.id ? { ...w, name: newName } : w));
          }}
          onIconChanged={(newIcon, newColor) => {
            setSettingsModalWorkspace(prev => prev ? { ...prev, icon: newIcon, iconColor: newColor } : null);
            setLocalWorkspaces(prev => prev.map(w => w.id === settingsModalWorkspace.id ? { ...w, icon: newIcon, iconColor: newColor } : w));
          }}
          onDeleted={() => {
            setLocalWorkspaces(prev => prev.filter(w => w.id !== settingsModalWorkspace.id));
            setSettingsModalWorkspace(null);
            router.push('/app');
          }}
          onOpenAgents={() => {
            setSettingsModalWorkspace(null);
            setSettingsInitialTab('general');
            setAgentsModalOpen(true);
          }}
          onOpenBilling={() => {
            setSettingsModalWorkspace(null);
            setSettingsInitialTab('general');
            setBillingModalOpen(true);
          }}
        />,
        sidebarOverlayContainer,
      )}

      {userSettingsOpen && sidebarOverlayContainer && createPortal(
        <UserSettingsModal
          currentUser={currentUser}
          onClose={() => setUserSettingsOpen(false)}
        />,
        sidebarOverlayContainer,
      )}

      {agentsModalOpen && sidebarOverlayContainer && createPortal(
        <AgentsModal
          onClose={() => {
            setAgentsModalOpen(false);
            getUserAgentTokenCount().then(setAgentTokenCount).catch(() => {});
          }}
        />,
        sidebarOverlayContainer,
      )}

      {trashModalOpen && sidebarOverlayContainer && createPortal(
        <TrashModal
          onClose={() => {
            setTrashModalOpen(false);
            getUserTrashCount().then(setTrashCount).catch(() => {});
          }}
        />,
        sidebarOverlayContainer,
      )}

      {billingModalOpen && sidebarOverlayContainer && createPortal(
        <BillingModal isDemo={currentUser.role === 'demo'} onClose={() => {
          setBillingModalOpen(false);
          getMyTier().then(setPlanTier).catch(() => {});
        }} />,
        sidebarOverlayContainer,
      )}

      {/* Delete confirmation — the shared dialog; the delete itself is optimistic
          (confirmDelete closes it and runs in a transition). */}
      {confirmDeleteItemId && (() => {
        const item = localItems.find(i => i.id === confirmDeleteItemId);
        if (!item) return null;
        return (
          <ConfirmDialog
            title={item.title || t('delete')}
            description={t('deleteConfirm', { title: item.title })}
            confirmLabel={t('delete')}
            cancelLabel={t('deleteCancel')}
            onConfirm={() => confirmDelete(item)}
            onCancel={() => setConfirmDeleteItemId(null)}
          />
        );
      })()}

      {/* New-user onboarding: welcome modal + getting-started checklist.
          Only the always-mounted desktop sidebar renders it (showOnboarding),
          so it never doubles up with the mobile drawer's sidebar instance. Not in a
          project window: it is account-level, and getOnboardingProgress calls
          getCurrentUser(), which throws for a locked session (a 500 per page load). */}
      {showOnboarding && !isProjectWindow && (
        <div className="shrink-0">
          <OnboardingGuide userRole={currentUser.role} />
          <AgentDetectGuide userRole={currentUser.role} />
        </div>
      )}

      {/* The agents card: a small sheet on the desk holding what the agents saved (the
          number that says what Remnus is for should not be a footnote) and the AI Agents
          entry — the one account-level row kept outside the account menu, because it is
          what the product is for. Both led to the same modal, so they are ONE button now
          (Hakan, 2026-09-30): one hover, one click target. Savings are workspace-scoped in
          a project window (content data the lock allows); the AI Agents row is
          account-level (tokens span every workspace) and not rendered there, so the card is
          just the figure, not clickable. `empty:hidden` drops it when a project window has
          nothing measured yet. */}
      {/* Presence rides at the top of the same card (V2 R8.8): who is working, their
          last call, who worked here lately — spans only, so the card stays one button. */}
      {isProjectWindow ? (
        <div className="shrink-0 mx-2 mb-1 rounded-surface bg-sheet/70 p-1 shadow-lift empty:hidden">
          <AgentPresenceRows presence={presence} />
          <AgentSavingsCard variant="sidebar" workspaceId={activeWorkspace.id} />
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            // A mouse click must not leave the card focused: the agents modal closes
            // on Escape, and a key press on a focused element turns on its
            // :focus-visible ring — a gold outline round the card nobody asked for.
            // A keyboard activation (detail 0) keeps focus, so Tab users keep their place.
            if (e.detail > 0) e.currentTarget.blur();
            setAgentsModalOpen(true);
          }}
          className="group/agents shrink-0 mx-2 mb-1 block cursor-pointer rounded-surface bg-sheet/70 p-1 text-left shadow-lift transition-colors hover:bg-sheet"
        >
          <AgentPresenceRows presence={presence} hiddenWorkspaceIds={hiddenWorkspaceIds} />
          <AgentSavingsCard variant="sidebar" />
          <span className="flex h-8 min-w-0 items-center gap-2 rounded-control px-2 text-sm text-fg-2 transition-colors group-hover/agents:text-fg">
            <span className="relative shrink-0">
              <Bot size={16} className="text-fg-3" />
              {agentTokenCount === 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-signal ring-2 ring-sheet" />
              )}
            </span>
            <span className="truncate">{t('myAgents')}</span>
            {agentTokenCount !== null && agentTokenCount > 0 ? (
              <Badge variant="neutral" size="sm" className="ml-auto">{agentTokenCount}</Badge>
            ) : agentTokenCount === 0 ? (
              <Badge variant="solid" size="sm" className="ml-auto">{t('agentsConnectNudge')}</Badge>
            ) : null}
          </span>
        </button>
      )}

      {/* Everything else lives behind the account row: settings, plan, trash, app install,
          what's new, admin, sign-out. A project window renders only trash and what's new
          (workspace content / product news) — the rest is account-level and denied by the
          lock, so it is not rendered at all rather than hidden. */}
      <div className="shrink-0 px-2 pb-2 pt-0.5">
        <AccountMenu
          user={currentUser}
          isProjectWindow={isProjectWindow}
          planBadge={
            planTier ? (
              <Badge variant={TIER_BADGE[planTier]} size="sm">
                {tBilling(`tier_${planTier}` as 'tier_free')}
              </Badge>
            ) : undefined
          }
          trashCount={trashCount}
          whatsNewUnseen={whatsNew.unseenCount}
          canInstall={pwa.available}
          onOpenSettings={() => setUserSettingsOpen(true)}
          onOpenBilling={() => setBillingModalOpen(true)}
          onOpenTrash={() => setTrashModalOpen(true)}
          onOpenWhatsNew={whatsNew.open}
          onInstall={pwa.open}
          onSignOut={() => logout()}
        />
      </div>
      {whatsNew.modal}
      {pwa.modal}
    </div>
  );
}
