'use client';

import { useState, useEffect, useRef } from 'react';
import { LayoutList, KanbanSquare, Calendar as CalendarIcon, Plus, ChevronDown } from 'lucide-react';
import type { DatabaseView } from '@/lib/types/views';
import { useTranslations } from 'next-intl';

interface ViewsBarProps {
  views: DatabaseView[];
  activeViewId: string;
  onActivate: (id: string) => void;
  onAdd: (type: 'table' | 'kanban' | 'calendar') => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onReorder: (views: DatabaseView[]) => void;
}

export default function ViewsBar({
  views,
  activeViewId,
  onActivate,
  onAdd,
  onRename,
  onDelete,
  onReorder,
}: ViewsBarProps) {
  const t = useTranslations('Database');
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [mobileAddOpen, setMobileAddOpen] = useState(false);

  const [draggedViewId, setDraggedViewId] = useState<string | null>(null);
  const [dragOverViewId, setDragOverViewId] = useState<string | null>(null);

  const addRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileAddRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setAddOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null);
      if (mobileAddRef.current && !mobileAddRef.current.contains(e.target as Node)) setMobileAddOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const startRename = (view: DatabaseView) => {
    setRenamingId(view.id);
    setRenameValue(view.name);
    setMenuOpenId(null);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleDragStart = (e: React.DragEvent, viewId: string) => {
    setDraggedViewId(viewId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, viewId: string) => {
    e.preventDefault();
    if (draggedViewId !== viewId) setDragOverViewId(viewId);
  };

  const handleDragLeave = (viewId: string) => {
    if (dragOverViewId === viewId) setDragOverViewId(null);
  };

  const handleDrop = (e: React.DragEvent, targetViewId: string) => {
    e.preventDefault();
    if (!draggedViewId || draggedViewId === targetViewId) {
      setDraggedViewId(null);
      setDragOverViewId(null);
      return;
    }

    const fromIdx = views.findIndex((v) => v.id === draggedViewId);
    const toIdx = views.findIndex((v) => v.id === targetViewId);

    if (fromIdx !== -1 && toIdx !== -1) {
      const newViews = [...views];
      const [moved] = newViews.splice(fromIdx, 1);
      newViews.splice(toIdx, 0, moved);
      onReorder(newViews);
    }

    setDraggedViewId(null);
    setDragOverViewId(null);
  };

  const handleDragEnd = () => {
    setDraggedViewId(null);
    setDragOverViewId(null);
  };

  const activeView = views.find(v => v.id === activeViewId);
  const [mobileDropOpen, setMobileDropOpen] = useState(false);
  const mobileDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileDropOpen) return;
    function handleClick(e: MouseEvent) {
      if (mobileDropRef.current && !mobileDropRef.current.contains(e.target as Node)) {
        setMobileDropOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [mobileDropOpen]);

  const getIcon = (view: DatabaseView) => {
    if (view.config.type === 'kanban') return KanbanSquare;
    if (view.config.type === 'calendar') return CalendarIcon;
    return LayoutList;
  };

  return (
    <>
    {/* Mobile compact view selector */}
    {activeView && (
      <div className="sm:hidden flex items-center">
        <div className="relative" ref={mobileDropRef}>
          <button
            onClick={() => setMobileDropOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-neutral-100 border-b-2 border-neutral-300 -mb-px cursor-pointer"
          >
            {(() => { const Icon = getIcon(activeView); return <Icon size={14} />; })()}
            <span>{activeView.name}</span>
            <ChevronDown size={13} className={`text-neutral-400 transition-transform duration-150 ${mobileDropOpen ? 'rotate-180' : ''}`} />
          </button>
          {mobileDropOpen && (
            <div className="absolute top-full left-0 mt-1 min-w-40 bg-neutral-900 border border-neutral-800 rounded shadow-xl overflow-hidden z-50 py-1 animate-in fade-in duration-100">
              {views.map(view => {
                const isActive = view.id === activeViewId;
                const Icon = getIcon(view);
                return (
                  <button
                    key={view.id}
                    onClick={() => { onActivate(view.id); setMobileDropOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                      isActive ? 'text-neutral-100 bg-neutral-800/40' : 'text-neutral-400 hover:bg-neutral-800/20 hover:text-neutral-200'
                    }`}
                  >
                    <Icon size={13} />
                    <span>{view.name}</span>
                    {isActive && <span className="ml-auto text-blue-400 text-[10px]">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Mobile add view button */}
        <div className="relative" ref={mobileAddRef}>
          <button
            onClick={() => { setMobileAddOpen(o => !o); setMobileDropOpen(false); }}
            className="p-2 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
            title={t('addView')}
          >
            <Plus size={14} />
          </button>
          {mobileAddOpen && (
            <div className="absolute top-full left-0 mt-1 w-44 bg-neutral-900 border border-neutral-800 rounded shadow-xl overflow-hidden z-50 py-1 animate-in fade-in duration-100">
              <button onClick={() => { onAdd('table'); setMobileAddOpen(false); }} className="w-full text-left px-3 py-2.5 text-xs text-neutral-300 hover:bg-neutral-800/20 hover:text-white flex items-center gap-2 transition-colors border-b border-neutral-850/60">
                <LayoutList size={13} /> {t('tableView')}
              </button>
              <button onClick={() => { onAdd('kanban'); setMobileAddOpen(false); }} className="w-full text-left px-3 py-2.5 text-xs text-neutral-300 hover:bg-neutral-800/20 hover:text-white flex items-center gap-2 transition-colors border-b border-neutral-850/60">
                <KanbanSquare size={13} /> {t('kanbanView')}
              </button>
              <button onClick={() => { onAdd('calendar'); setMobileAddOpen(false); }} className="w-full text-left px-3 py-2.5 text-xs text-neutral-300 hover:bg-neutral-800/20 hover:text-white flex items-center gap-2 transition-colors">
                <CalendarIcon size={13} /> {t('calendarView')}
              </button>
            </div>
          )}
        </div>
      </div>
    )}

    {/* Desktop full tab list */}
    <div className="hidden sm:flex items-center gap-0">
    <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide min-w-0"
      style={{ scrollbarWidth: 'none' }}
    >
      {views.map((view) => {
        const isActive = view.id === activeViewId;
        let Icon = LayoutList;
        if (view.config.type === 'kanban') {
          Icon = KanbanSquare;
        } else if (view.config.type === 'calendar') {
          Icon = CalendarIcon;
        }
        const isRenaming = renamingId === view.id;

        return (
          <div
            key={view.id}
            className={`relative shrink-0 flex items-center group cursor-grab active:cursor-grabbing transition-all
              ${draggedViewId === view.id ? 'opacity-25' : ''}
              ${dragOverViewId === view.id ? 'border-l-2 border-l-blue-500/60' : ''}
            `}
            ref={menuOpenId === view.id ? menuRef : undefined}
            draggable={!isRenaming}
            onDragStart={(e) => handleDragStart(e, view.id)}
            onDragOver={(e) => handleDragOver(e, view.id)}
            onDragLeave={() => handleDragLeave(view.id)}
            onDrop={(e) => handleDrop(e, view.id)}
            onDragEnd={handleDragEnd}
          >
            <button
              onClick={() => {
                if (isActive) {
                  setMenuOpenId(menuOpenId === view.id ? null : view.id);
                } else {
                  onActivate(view.id);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px cursor-pointer ${
                isActive
                  ? 'border-neutral-300 text-neutral-100'
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Icon size={14} />
              {isRenaming ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent border-b border-neutral-400 outline-none text-neutral-100 text-sm w-24 cursor-text"
                />
              ) : (
                <span>{view.name}</span>
              )}
            </button>

            {isActive && !isRenaming && menuOpenId === view.id && (
              <div className="absolute top-full left-0 mt-1 w-36 bg-neutral-900 border border-neutral-800 rounded shadow-xl overflow-hidden z-50 py-0 animate-in fade-in duration-100">
                <button
                  onClick={() => startRename(view)}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800/20 transition-colors rounded-none border-b border-neutral-850/60 cursor-pointer"
                >
                  {t('renameView')}
                </button>
                {views.length > 1 && (
                  <button
                    onClick={() => {
                      onDelete(view.id);
                      setMenuOpenId(null);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:bg-neutral-800/20 transition-colors rounded-none cursor-pointer"
                  >
                    {t('deleteView')}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>

      <div className="relative ml-0.5 shrink-0" ref={addRef}>
        <button
          onClick={() => setAddOpen((o) => !o)}
          className="p-2 text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer"
          title={t('addView')}
        >
          <Plus size={14} />
        </button>

        {addOpen && (
          <div className="absolute top-full left-0 mt-1 w-44 bg-neutral-900 border border-neutral-800 rounded shadow-xl overflow-hidden z-50 py-0 animate-in fade-in duration-100">
            <button
              onClick={() => {
                onAdd('table');
                setAddOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800/20 flex items-center gap-2 transition-colors rounded-none border-b border-neutral-850/60 cursor-pointer"
            >
              <LayoutList size={13} /> {t('tableView')}
            </button>
            <button
              onClick={() => {
                onAdd('kanban');
                setAddOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800/20 flex items-center gap-2 transition-colors rounded-none border-b border-neutral-850/60 cursor-pointer"
            >
              <KanbanSquare size={13} /> {t('kanbanView')}
            </button>
            <button
              onClick={() => {
                onAdd('calendar');
                setAddOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800/20 flex items-center gap-2 transition-colors rounded-none cursor-pointer"
            >
              <CalendarIcon size={13} /> {t('calendarView')}
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
