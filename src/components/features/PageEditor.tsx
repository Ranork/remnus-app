'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { updatePageContent, updatePageProperties, duplicatePage, deletePage, updatePageIcon } from '@/lib/actions/page';
import { ArrowLeft, X, ChevronDown, MoreHorizontal, Trash2, Copy, Smile, ArrowLeftRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BlockEditor from '@/components/features/editor/BlockEditor';
import PageIcon from './PageIcon';
import IconPicker from './IconPicker';
import SubItemsPanel from './SubItemsPanel';
import {
  type SelectOption,
  normalizeOption,
  getOptionColorByValue,
  getOptionColor,
} from '@/lib/types/properties';

function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export default function PageEditor({
  database,
  initialPage,
  isPeek = false,
  onClose,
  onPageUpdated,
}: {
  database: any;
  initialPage: any;
  isPeek?: boolean;
  onClose?: () => void;
  onPageUpdated?: (updatedPage: any) => void;
}) {
  const [properties, setProperties] = useState<Record<string, any>>(initialPage.properties || {});
  const [icon, setIcon] = useState<string | null>(initialPage.icon);
  const [iconColor, setIconColor] = useState<string | null>(initialPage.iconColor);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [openSelectId, setOpenSelectId] = useState<string | null>(null);
  const selectDropdownRef = useRef<HTMLDivElement>(null);
  const iconButtonRef = useRef<HTMLButtonElement>(null);

  type WidthMode = 'narrow' | 'wide' | 'full';
  const [widthMode, setWidthMode] = useState<WidthMode>('full');

  useEffect(() => {
    const saved = localStorage.getItem(`page-width-${initialPage.id}`) as WidthMode | null;
    if (saved === 'narrow' || saved === 'wide' || saved === 'full') setWidthMode(saved);
    else if (saved === 'true') setWidthMode('full'); // migrate old boolean
  }, [initialPage.id]);

  const cycleWidth = () => {
    const next: WidthMode = widthMode === 'narrow' ? 'wide' : widthMode === 'wide' ? 'full' : 'narrow';
    setWidthMode(next);
    localStorage.setItem(`page-width-${initialPage.id}`, next);
  };

  const widthLabels: Record<WidthMode, string> = { narrow: 'Narrow', wide: 'Wide', full: 'Full width' };

  const router = useRouter();
  const [openMenu, setOpenMenu] = useState(false);
  const menuDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuDropdownRef.current && !menuDropdownRef.current.contains(e.target as Node)) {
        setOpenMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenu]);

  useEffect(() => {
    if (!openSelectId) return;
    const handler = (e: MouseEvent) => {
      if (selectDropdownRef.current && !selectDropdownRef.current.contains(e.target as Node)) {
        setOpenSelectId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openSelectId]);

  useEffect(() => {
    setIcon(initialPage.icon);
    setIconColor(initialPage.iconColor);
    setProperties(initialPage.properties || {});
  }, [initialPage.id, initialPage.icon, initialPage.iconColor]);

  const schema = database.schema as any[];
  const pageTitle = properties['title'] || 'Untitled';

  useEffect(() => {
    if (!isPeek) {
      document.title = `${pageTitle} | Remna`;
    }
  }, [pageTitle, isPeek]);

  const handleContentChange = useMemo(
    () =>
      debounce((md: string) => {
        updatePageContent(initialPage.id, md);
        if (onPageUpdated) {
          onPageUpdated({ ...initialPage, properties, content: md });
        }
      }, 1000),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialPage.id]
  );

  // Debounced save for free-text and number fields
  const debouncedSaveProps = useMemo(
    () =>
      debounce((props: Record<string, any>) => {
        updatePageProperties(initialPage.id, props);
        onPageUpdated?.({ ...initialPage, properties: props });
      }, 600),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialPage.id]
  );

  // For text/number inputs: update state immediately, persist after pause
  const handleTextPropertyChange = (colId: string, value: any) => {
    const newProps = { ...properties, [colId]: value };
    setProperties(newProps);
    debouncedSaveProps(newProps);
  };

  // For discrete controls (select, date, multi_select): save immediately
  const handlePropertyChange = async (colId: string, value: any) => {
    const newProps = { ...properties, [colId]: value };
    setProperties(newProps);
    await updatePageProperties(initialPage.id, newProps);
    if (onPageUpdated) {
      onPageUpdated({ ...initialPage, icon, iconColor, properties: newProps });
    }
  };

  const handleIconSelect = async (newIcon: string | null, newColor: string | null) => {
    setIcon(newIcon);
    setIconColor(newColor);
    await updatePageIcon(initialPage.id, newIcon, newColor);
    if (onPageUpdated) {
      onPageUpdated({ ...initialPage, icon: newIcon, iconColor: newColor, properties });
    }
  };

  const handleMultiSelectToggle = async (colId: string, option: string) => {
    const current: string[] = Array.isArray(properties[colId]) ? properties[colId] : [];
    const newVal = current.includes(option)
      ? current.filter(v => v !== option)
      : [...current, option];
    await handlePropertyChange(colId, newVal);
  };

  const containerClass = isPeek
    ? 'p-6 md:p-8 lg:p-10'
    : widthMode === 'full'
    ? 'px-16 py-10'
    : widthMode === 'wide'
    ? 'max-w-7xl mx-auto px-8 lg:px-12 py-10'
    : 'max-w-4xl mx-auto px-8 lg:px-16 py-10';

  return (
    <div className={containerClass}>
      {!isPeek && (
        <div className="flex items-center justify-between mb-10">
          <Link href={`/db/${database.id}`} className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-medium">
            <ArrowLeft size={16} /> Back to {database.name}
          </Link>
          <div className="flex items-center gap-4">
            <button
              onClick={cycleWidth}
              className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors p-1 cursor-pointer"
            >
              <ArrowLeftRight size={14} />
              {widthLabels[widthMode]}
            </button>
            <div className="relative" ref={menuDropdownRef}>
              <button
                onClick={() => setOpenMenu(!openMenu)}
                className="flex items-center justify-center p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 border border-neutral-800 cursor-pointer rounded transition-colors"
              >
                <MoreHorizontal size={14} />
              </button>
              {openMenu && (
                <div className="absolute right-0 top-full mt-1.5 z-50 bg-neutral-900 border border-neutral-800 shadow-xl py-1 w-36 rounded overflow-hidden text-left animate-fade-in animate-duration-100">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      setOpenMenu(false);
                      const newId = await duplicatePage(initialPage.id, database.id);
                      if (newId) {
                        router.push(`/db/${database.id}/${newId}`);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer transition-colors border-b border-neutral-850"
                  >
                    <Copy size={13} />
                    <span>Duplicate page</span>
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      setOpenMenu(false);
                      if (confirm('Are you sure you want to delete this page?')) {
                        await deletePage(initialPage.id, database.id);
                        router.push(`/db/${database.id}`);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs text-red-400 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Trash2 size={13} />
                    <span>Delete page</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
            value={properties['title'] || ''}
            onChange={(e) => handleTextPropertyChange('title', e.target.value)}
            placeholder="Untitled"
            className="w-full bg-transparent text-white font-bold text-4xl focus:outline-none placeholder:text-neutral-700 tracking-tight py-1"
          />
        </div>
      </div>

      {/* Properties Section */}
      <div className="mb-12 space-y-4">
        {schema.filter((col) => col.id !== 'title').map((col) => {
          const val = properties[col.id];
 
          return (
            <div key={col.id} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-8 border-b border-neutral-800/60 pb-3 group">
              <div className="text-neutral-500 w-32 shrink-0 text-sm font-medium group-hover:text-neutral-400 transition-colors pt-1">{col.name}</div>
 
              {col.type === 'select' ? (
                <div className="relative flex-1 max-w-xs pt-0.5" ref={openSelectId === col.id ? selectDropdownRef : undefined}>
                  <button
                    onClick={() => setOpenSelectId(openSelectId === col.id ? null : col.id)}
                    className="flex items-center gap-1.5 text-sm focus:outline-none cursor-pointer"
                  >
                    {val ? (() => {
                      const c = getOptionColorByValue(col.options || [], val);
                      return (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs rounded" style={{ backgroundColor: c.bg, color: c.text }}>
                          {val}
                        </span>
                      );
                    })() : (
                      <span className="text-neutral-600 text-sm">Empty</span>
                    )}
                    <ChevronDown size={12} className="text-neutral-600" />
                  </button>
                  {openSelectId === col.id && (
                    <div className="absolute z-50 top-full left-0 mt-1 bg-neutral-900 border border-neutral-700 min-w-32 py-1 rounded shadow-xl overflow-hidden" style={{ minWidth: 140 }}>
                      <button
                        onClick={() => { handlePropertyChange(col.id, ''); setOpenSelectId(null); }}
                        className="w-full text-left px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-800 transition-colors cursor-pointer"
                      >
                        Empty
                      </button>
                      {(col.options || []).map((rawOpt: string | SelectOption) => {
                        const opt = normalizeOption(rawOpt);
                        const c = getOptionColor(opt);
                        return (
                          <button
                            key={opt.value}
                            onClick={() => { handlePropertyChange(col.id, opt.value); setOpenSelectId(null); }}
                            className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-800 transition-colors cursor-pointer"
                          >
                            <span className="inline-flex items-center px-2 py-0.5 text-xs rounded" style={{ backgroundColor: c.bg, color: c.text }}>
                              {opt.value}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : col.type === 'multi_select' ? (
                <div className="flex-1 flex flex-col gap-2 pt-0.5">
                  {Array.isArray(val) && val.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {val.map((optVal: string) => {
                        const c = getOptionColorByValue(col.options || [], optVal);
                        return (
                          <span key={optVal} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded" style={{ backgroundColor: c.bg, color: c.text }}>
                            {optVal}
                            <button
                              onClick={() => handleMultiSelectToggle(col.id, optVal)}
                              className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {col.options && (col.options as (string | SelectOption)[])
                    .filter((o) => !(Array.isArray(val) && val.includes(normalizeOption(o).value))).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(col.options as (string | SelectOption)[])
                        .filter((o) => !(Array.isArray(val) && val.includes(normalizeOption(o).value)))
                        .map((rawOpt) => {
                          const opt = normalizeOption(rawOpt);
                          const c = getOptionColor(opt);
                          return (
                            <button
                              key={opt.value}
                              onClick={() => handleMultiSelectToggle(col.id, opt.value)}
                              className="text-xs px-2 py-0.5 rounded border border-neutral-700/40 opacity-50 hover:opacity-80 transition-opacity cursor-pointer"
                              style={{ backgroundColor: c.bg, color: c.text }}
                            >
                              + {opt.value}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              ) : col.type === 'date' ? (
                <input
                  type="date"
                  value={val || ''}
                  onChange={(e) => handlePropertyChange(col.id, e.target.value)}
                  className="bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-neutral-700 rounded p-1 -ml-1 text-sm transition-shadow scheme-dark"
                />
              ) : col.type === 'datetime' ? (
                <input
                  type="datetime-local"
                  value={val || ''}
                  onChange={(e) => handlePropertyChange(col.id, e.target.value)}
                  className="bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-neutral-700 rounded p-1 -ml-1 text-sm transition-shadow scheme-dark"
                />
              ) : (
                <input
                  type={col.type === 'number' ? 'number' : 'text'}
                  value={val || ''}
                  onChange={(e) => handleTextPropertyChange(col.id, e.target.value)}
                  placeholder="Empty"
                  className="bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-neutral-700 rounded p-1 -ml-1 flex-1 text-sm placeholder:text-neutral-700 transition-shadow"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Sub-items Panel */}
      <SubItemsPanel parentId={initialPage.id} workspaceId={database.workspaceId} />

      {/* Content Editor */}
      <BlockEditor
        key={initialPage.id}
        initialContent={initialPage.content || ''}
        onChange={handleContentChange}
        placeholder="Press '/' for commands or start writing..."
      />
    </div>
  );
}
