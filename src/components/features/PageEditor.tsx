'use client';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { updatePageContent, updatePageProperties, duplicatePage, deletePage, updatePageIcon } from '@/lib/actions/page';
import { ArrowLeft, X, Check, ChevronDown, MoreHorizontal, Trash2, Copy, Smile, ArrowLeftRight, Globe, CheckSquare, Square, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { tabKeys } from './tabs/keys';
import BlockEditor, { type BlockEditorHandle } from '@/components/features/editor/BlockEditor';
import PageIcon from './PageIcon';
import IconPicker from './IconPicker';
import AgentEditBadge from './AgentEditBadge';
import SaveStatus, { type SaveState } from './SaveStatus';
import { ConfirmDialog } from './ConfirmDialog';
import ShareModal from '@/components/share/ShareModal';
import type { WorkspaceItemRow } from '@/lib/actions/workspace';
import {
  type SelectOption,
  normalizeOption,
  getOptionColorByValue,
  getOptionColor,
  getStatusGroup,
  STATUS_GROUP_ORDER,
  formatDateValue,
} from '@/lib/types/properties';
import DateRangePicker from './DateRangePicker';
import { useMembers } from './MembersContext';
import { StatusChip, StatusIcon, UserAvatar, UserChip, UserTags } from './PropertyTags';

function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Textarea that grows with its content instead of scrolling sideways — used for
// the page title and free-text property values so long text wraps to new lines.
function AutoGrowTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useEffect(() => { resize(); }, [value, resize]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => { onChange(e); resize(); }}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={className}
    />
  );
}

export default function PageEditor({
  database,
  initialPage,
  isPeek = false,
  onClose,
  onPageUpdated,
  subItems,
  isAdmin = false,
}: {
  database: any;
  initialPage: any;
  isPeek?: boolean;
  onClose?: () => void;
  onPageUpdated?: (updatedPage: any) => void;
  subItems?: WorkspaceItemRow[];
  isAdmin?: boolean;
}) {
  const t = useTranslations('Page');
  const tDb = useTranslations('Database');
  const tEditor = useTranslations('Editor');
  const tSharing = useTranslations('Sharing');
  const members = useMembers();
  const statusGroupLabel = {
    todo: tDb('statusGroupTodo'),
    in_progress: tDb('statusGroupInProgress'),
    complete: tDb('statusGroupComplete'),
  } as const;
  const [properties, setProperties] = useState<Record<string, any>>(initialPage.properties || {});
  const [icon, setIcon] = useState<string | null>(initialPage.icon);
  const [iconColor, setIconColor] = useState<string | null>(initialPage.iconColor);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [openSelectId, setOpenSelectId] = useState<string | null>(null);
  const [openDateColId, setOpenDateColId] = useState<string | null>(null);
  const [dateAnchorRect, setDateAnchorRect] = useState<DOMRect | null>(null);
  const selectDropdownRef = useRef<HTMLDivElement>(null);
  const iconButtonRef = useRef<HTMLButtonElement>(null);
  const [showShareModal, setShowShareModal] = useState(false);

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

  const widthLabels: Record<WidthMode, string> = { narrow: t('narrow'), wide: t('wide'), full: t('full') };

  const router = useRouter();
  const [openMenu, setOpenMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuDropdownRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<BlockEditorHandle>(null);

  // Keep the Tauri keep-alive query cache (TabPane) in sync with each save, so
  // leaving and re-entering this tab within the staleTime window doesn't reload
  // the pre-edit content/properties from the cache. No-op on web (never read).
  const queryClient = useQueryClient();
  const patchPageCache = useCallback(
    (patch: Record<string, any>) => {
      queryClient.setQueryData(tabKeys.dbPage(initialPage.id), (old: any) =>
        old ? { ...old, ...patch } : old
      );
    },
    [queryClient, initialPage.id]
  );

  // Keep the latest edited values in refs so debounced / id-memoized savers
  // (which capture state from their creation render) always emit the CURRENT
  // properties/icon back to the parent list. Without this, a content save ships
  // the original `properties` and clobbers a more recent inline property edit —
  // the page reverts in the table/kanban/calendar a moment after editing.
  const propertiesRef = useRef(properties);
  const iconRef = useRef(icon);
  const iconColorRef = useRef(iconColor);
  useEffect(() => {
    propertiesRef.current = properties;
    iconRef.current = icon;
    iconColorRef.current = iconColor;
  }, [properties, icon, iconColor]);

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
      document.title = `${pageTitle} | Remnus`;
    }
  }, [pageTitle, isPeek]);

  const saveContent = useCallback(async (md: string) => {
    setSaveState('saving');
    try {
      await updatePageContent(initialPage.id, md);
      patchPageCache({ content: md });
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
    if (onPageUpdated) {
      onPageUpdated({ ...initialPage, icon: iconRef.current, iconColor: iconColorRef.current, properties: propertiesRef.current, content: md });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPage.id]);

  const handleContentChange = useMemo(
    () => debounce(saveContent, 1000),
    [saveContent]
  );

  // Debounced save for free-text and number fields
  const debouncedSaveProps = useMemo(
    () =>
      debounce((props: Record<string, any>) => {
        updatePageProperties(initialPage.id, props);
        patchPageCache({ properties: props });
        onPageUpdated?.({ ...initialPage, icon: iconRef.current, iconColor: iconColorRef.current, properties: props });
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
    patchPageCache({ properties: newProps });
    if (onPageUpdated) {
      onPageUpdated({ ...initialPage, icon, iconColor, properties: newProps });
    }
  };

  const handleIconSelect = (newIcon: string | null, newColor: string | null) => {
    setIcon(newIcon);
    setIconColor(newColor);
    updatePageIcon(initialPage.id, newIcon, newColor);
    patchPageCache({ icon: newIcon, iconColor: newColor });
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
    ? 'p-6 md:p-10 lg:py-16 lg:px-24'
    : widthMode === 'full'
    ? 'px-4 sm:px-8 md:px-16 py-6 sm:py-10'
    : widthMode === 'wide'
    ? 'max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-10'
    : 'max-w-4xl mx-auto px-4 sm:px-8 lg:px-16 py-6 sm:py-10';

  return (
    <div className={containerClass}>
      {!isPeek && (
        <div className="flex items-center justify-between mb-10">
          <Link href={`/db/${database.id}`} className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-medium">
            <ArrowLeft size={16} /> {t('back')} — {database.name}
          </Link>
          <div className="flex items-center gap-3">
            <SaveStatus state={saveState} />
            <div className="relative" ref={menuDropdownRef}>
              <button
                onClick={() => setOpenMenu(!openMenu)}
                className="flex items-center justify-center p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 border border-neutral-800 cursor-pointer rounded transition-colors"
              >
                <MoreHorizontal size={14} />
              </button>
              {openMenu && (
                <div className="absolute right-0 top-full mt-1.5 z-50 bg-neutral-850 border border-neutral-800 shadow-xl py-1.5 w-44 rounded overflow-hidden text-left animate-fade-in animate-duration-100">
                  {/* Width — desktop only; mobile rows are always full-bleed. */}
                  <div className="hidden lg:block">
                    <p className="px-3 pt-0.5 pb-1 text-[9px] font-semibold text-neutral-600 uppercase tracking-widest">
                      {widthLabels[widthMode]}
                    </p>
                    {(['narrow', 'wide', 'full'] as WidthMode[]).map(w => (
                      <button
                        key={w}
                        onClick={() => { setWidthMode(w); localStorage.setItem(`page-width-${initialPage.id}`, w); setOpenMenu(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                          widthMode === w ? 'text-blue-400 bg-blue-500/8' : 'text-neutral-300 hover:bg-neutral-800'
                        }`}
                      >
                        <ArrowLeftRight size={12} className={widthMode === w ? 'text-blue-400' : 'text-neutral-600'} />
                        {widthLabels[w]}
                        {widthMode === w && <span className="ml-auto text-[9px] text-blue-400">✓</span>}
                      </button>
                    ))}

                    <div className="border-t border-neutral-800 my-1" />
                  </div>

                  {/* Share */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenu(false); setShowShareModal(true); }}
                    className="w-full px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Globe size={12} className="text-neutral-500" />
                    {tSharing('shareButton')}
                  </button>

                  <div className="border-t border-neutral-800 my-1" />

                  {/* Duplicate / Delete */}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      setOpenMenu(false);
                      const newId = await duplicatePage(initialPage.id, database.id);
                      if (newId) router.push(`/db/${database.id}/${newId}`);
                    }}
                    className="w-full px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Copy size={12} className="text-neutral-500" />
                    <span>Duplicate</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenu(false); setShowDeleteConfirm(true); }}
                    className="w-full px-3 py-1.5 text-xs text-red-400 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Trash2 size={12} />
                    <span>{t('deletePage')}</span>
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
              title={icon ? t('changeIcon') : t('addIcon')}
            >
              <PageIcon icon={icon} iconColor={iconColor} size={40} fallbackType="page" />
            </button>
            {icon && (
              <button
                onClick={() => handleIconSelect(null, null)}
                className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover/icon-wrapper:opacity-100 px-1.5 py-0.5 text-[9px] bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white rounded transition-all cursor-pointer font-medium whitespace-nowrap shadow-xl z-20"
              >
                {t('changeIcon')}
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
          <AutoGrowTextarea
            value={properties['title'] || ''}
            onChange={(e) => handleTextPropertyChange('title', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                editorRef.current?.insertLineAtStart();
              } else if (e.key === 'ArrowDown') {
                // Only fall through to the body when the caret is at the very
                // end, so navigating a wrapped multi-line title still works.
                const el = e.currentTarget;
                if (el.selectionStart === el.value.length) {
                  e.preventDefault();
                  editorRef.current?.focusStart();
                }
              }
            }}
            placeholder={t('untitled')}
            className="w-full bg-transparent text-white font-bold text-2xl sm:text-4xl focus:outline-none placeholder:text-neutral-700 tracking-tight py-1 resize-none overflow-hidden block leading-tight"
          />
        </div>
      </div>

      {/* Agent edit stamp */}
      {initialPage.agentEditedAt && (
        <div className="flex items-center gap-2 mb-4 -mt-2">
          <AgentEditBadge
            agentName={initialPage.agentName ?? null}
            tokenName={initialPage.agentTokenName ?? null}
            editedAt={initialPage.agentEditedAt}
            className="p-1 rounded-md"
          />
          <span className="text-[10px] text-neutral-600 select-none">{t('agentEditedLabel')}</span>
        </div>
      )}

      {/* Properties Section */}
      <div className={isPeek ? 'mb-6 space-y-1' : 'mb-12 space-y-4'}>
        {schema.filter((col) => col.id !== 'title').map((col) => {
          const val = properties[col.id];

          return (
            <div key={col.id} className={`flex items-start gap-2 border-b border-neutral-800/60 group ${isPeek ? 'flex-row gap-3 pb-1.5' : 'flex-col sm:flex-row sm:gap-8 pb-3'}`}>
              <div className={`text-neutral-500 shrink-0 font-medium group-hover:text-neutral-400 transition-colors pt-1 ${isPeek ? 'w-24 text-xs' : 'w-32 text-sm'}`}>{col.name}</div>
 
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
                      <span className="text-neutral-600 text-sm">{tDb('empty')}</span>
                    )}
                    <ChevronDown size={12} className="text-neutral-600" />
                  </button>
                  {openSelectId === col.id && (
                    <div className="absolute z-50 top-full left-0 mt-1 bg-neutral-900 border border-neutral-700 min-w-32 py-1 rounded shadow-xl overflow-hidden" style={{ minWidth: 140 }}>
                      <button
                        onClick={() => { handlePropertyChange(col.id, ''); setOpenSelectId(null); }}
                        className="w-full text-left px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-800 transition-colors cursor-pointer"
                      >
                        {tDb('empty')}
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
                          <span key={optVal} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: c.bg, color: c.text }}>
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
                              className="text-xs px-2 py-0.5 rounded-full font-medium border border-neutral-700/40 opacity-50 hover:opacity-80 transition-opacity cursor-pointer"
                              style={{ backgroundColor: c.bg, color: c.text }}
                            >
                              + {opt.value}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              ) : col.type === 'status' ? (
                <div className="relative flex-1 max-w-xs pt-0.5" ref={openSelectId === col.id ? selectDropdownRef : undefined}>
                  <button
                    onClick={() => setOpenSelectId(openSelectId === col.id ? null : col.id)}
                    className="flex items-center gap-1.5 text-sm focus:outline-none cursor-pointer"
                  >
                    {val ? <StatusChip value={String(val)} options={col.options} /> : <span className="text-neutral-600 text-sm">{tDb('empty')}</span>}
                    <ChevronDown size={12} className="text-neutral-600" />
                  </button>
                  {openSelectId === col.id && (
                    <div className="absolute z-50 top-full left-0 mt-1 bg-neutral-900 border border-neutral-700 py-1 rounded shadow-xl overflow-hidden max-h-72 overflow-y-auto" style={{ minWidth: 192 }}>
                      <button
                        onClick={() => { handlePropertyChange(col.id, ''); setOpenSelectId(null); }}
                        className="w-full text-left px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-800 transition-colors cursor-pointer"
                      >
                        {tDb('empty')}
                      </button>
                      {STATUS_GROUP_ORDER.map((g) => {
                        const groupOpts = (col.options || []).map(normalizeOption).filter((o: SelectOption) => getStatusGroup(o) === g);
                        if (groupOpts.length === 0) return null;
                        return (
                          <div key={g}>
                            <div className="px-3 pt-1.5 pb-0.5 text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">{statusGroupLabel[g]}</div>
                            {groupOpts.map((opt: SelectOption) => {
                              const c = getOptionColor(opt);
                              return (
                                <button
                                  key={opt.value}
                                  onClick={() => { handlePropertyChange(col.id, opt.value); setOpenSelectId(null); }}
                                  className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-800 transition-colors cursor-pointer"
                                >
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-full font-medium" style={{ backgroundColor: c.bg, color: c.text }}>
                                    <StatusIcon group={g} color={c.dot} size={12} />
                                    {opt.value}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (col.type === 'user' || col.type === 'multi_user') ? (
                (() => {
                  const isMulti = col.type === 'multi_user';
                  const ids: string[] = isMulti ? (Array.isArray(val) ? val : []) : (val ? [String(val)] : []);
                  const toggle = (id: string) => {
                    if (isMulti) {
                      handlePropertyChange(col.id, ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
                    } else {
                      handlePropertyChange(col.id, ids[0] === id ? '' : id);
                      setOpenSelectId(null);
                    }
                  };
                  return (
                    <div className="relative flex-1 max-w-xs pt-0.5" ref={openSelectId === col.id ? selectDropdownRef : undefined}>
                      <button
                        onClick={() => setOpenSelectId(openSelectId === col.id ? null : col.id)}
                        className="flex items-center gap-1.5 text-sm focus:outline-none cursor-pointer min-h-6"
                      >
                        {ids.length > 0
                          ? (isMulti ? <UserTags value={ids} /> : <UserChip userId={ids[0]} />)
                          : <span className="text-neutral-600 text-sm">{tDb('unassigned')}</span>}
                        <ChevronDown size={12} className="text-neutral-600 shrink-0" />
                      </button>
                      {openSelectId === col.id && (
                        <div className="absolute z-50 top-full left-0 mt-1 bg-neutral-900 border border-neutral-700 py-1 rounded shadow-xl overflow-hidden max-h-72 overflow-y-auto" style={{ minWidth: 208 }}>
                          {!isMulti && (
                            <button
                              onClick={() => { handlePropertyChange(col.id, ''); setOpenSelectId(null); }}
                              className="w-full text-left px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-800 transition-colors cursor-pointer"
                            >
                              {tDb('unassigned')}
                            </button>
                          )}
                          {members.length === 0 && (
                            <div className="px-3 py-2 text-xs text-neutral-600">{tDb('noMembers')}</div>
                          )}
                          {members.map((m) => {
                            const sel = ids.includes(m.id);
                            return (
                              <button
                                key={m.id}
                                onClick={() => toggle(m.id)}
                                className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 hover:bg-neutral-800 transition-colors cursor-pointer ${sel ? 'bg-neutral-850' : ''}`}
                              >
                                <span className="inline-flex items-center gap-2 min-w-0">
                                  <UserAvatar member={m} size={18} />
                                  <span className="text-xs text-neutral-200 truncate">{m.name || m.email}</span>
                                </span>
                                {sel && <Check size={12} className="text-neutral-400 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (col.type === 'date' || col.type === 'datetime') ? (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      setDateAnchorRect((e.currentTarget as HTMLElement).getBoundingClientRect());
                      setOpenDateColId(openDateColId === col.id ? null : col.id);
                    }}
                    className="flex items-center gap-1.5 text-sm text-neutral-200 hover:text-white cursor-pointer p-1 -ml-1 hover:bg-neutral-800/40 rounded transition-colors"
                  >
                    <span className={val ? 'text-neutral-200' : 'text-neutral-600'}>
                      {val ? formatDateValue(String(val), col.type as 'date' | 'datetime', col.dateFormat) : tDb('empty')}
                    </span>
                  </button>
                  {openDateColId === col.id && (
                    <DateRangePicker
                      value={String(val || '')}
                      showTime={col.type === 'datetime'}
                      anchorRect={dateAnchorRect}
                      onChange={(v) => handlePropertyChange(col.id, v)}
                      onClose={() => setOpenDateColId(null)}
                    />
                  )}
                </div>
              ) : col.type === 'checkbox' ? (
                <button
                  onClick={() => handlePropertyChange(col.id, val === true || val === 'true' ? 'false' : 'true')}
                  className="flex items-center gap-1.5 text-sm cursor-pointer pt-1"
                >
                  {val === true || val === 'true'
                    ? <CheckSquare size={16} className="text-blue-400" />
                    : <Square size={16} className="text-neutral-500" />
                  }
                </button>
              ) : col.type === 'url' ? (
                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    type="url"
                    value={val || ''}
                    onChange={(e) => handleTextPropertyChange(col.id, e.target.value)}
                    placeholder={tDb('empty')}
                    className="bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-neutral-700 rounded p-1 -ml-1 flex-1 text-sm placeholder:text-neutral-700 transition-shadow"
                  />
                  {typeof val === 'string' && /^https?:\/\//i.test(val) && (
                    <a href={val} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 shrink-0">
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              ) : col.type === 'email' ? (
                <input
                  type="email"
                  value={val || ''}
                  onChange={(e) => handleTextPropertyChange(col.id, e.target.value)}
                  placeholder={tDb('empty')}
                  className="bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-neutral-700 rounded p-1 -ml-1 flex-1 text-sm placeholder:text-neutral-700 transition-shadow"
                />
              ) : col.type === 'phone' ? (
                <input
                  type="tel"
                  value={val || ''}
                  onChange={(e) => handleTextPropertyChange(col.id, e.target.value)}
                  placeholder={tDb('empty')}
                  className="bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-neutral-700 rounded p-1 -ml-1 flex-1 text-sm placeholder:text-neutral-700 transition-shadow"
                />
              ) : col.type === 'number' ? (
                <input
                  type="number"
                  value={val || ''}
                  onChange={(e) => handleTextPropertyChange(col.id, e.target.value)}
                  placeholder={tDb('empty')}
                  className="bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-neutral-700 rounded p-1 -ml-1 flex-1 text-sm placeholder:text-neutral-700 transition-shadow"
                />
              ) : (
                <AutoGrowTextarea
                  value={val || ''}
                  onChange={(e) => handleTextPropertyChange(col.id, e.target.value)}
                  placeholder={tDb('empty')}
                  className="bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-neutral-700 rounded p-1 -ml-1 flex-1 text-sm placeholder:text-neutral-700 transition-shadow resize-none overflow-hidden block w-full leading-snug"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Content Editor */}
      <BlockEditor
        ref={editorRef}
        key={initialPage.id}
        initialContent={initialPage.content || ''}
        onChange={handleContentChange}
        placeholder={tEditor('placeholder')}
        workspaceId={database.workspaceId}
        parentId={initialPage.id}
        initialSubItems={subItems}
        onImmediateSave={saveContent}
      />
      {showShareModal && (
        <ShareModal
          pageId={initialPage.id}
          workspaceId={database.workspaceId}
          isAdmin={isAdmin}
          onClose={() => setShowShareModal(false)}
        />
      )}
      {showDeleteConfirm && (
        <ConfirmDialog
          title={t('deleteConfirm', { title: properties['title'] || t('untitled') })}
          confirmLabel={t('delete')}
          cancelLabel={t('deleteCancel')}
          onConfirm={async () => {
            setShowDeleteConfirm(false);
            await deletePage(initialPage.id, database.id);
            router.push(`/db/${database.id}`);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
