'use client';
import { useState, useMemo, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { updatePageContent, updatePageProperties, duplicatePage, deletePage, updatePageIcon } from '@/lib/actions/page';
import { updateDatabaseSchema } from '@/lib/actions/database';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from '@/components/ui/link';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { tabKeys } from './tabs/keys';
import BlockEditor, { type BlockEditorHandle } from '@/components/features/editor/BlockEditor';
import PageIcon from './PageIcon';
import PageProvenanceLine from './PageProvenance';
import SaveStatus, { type SaveState } from './SaveStatus';
import PageActionsMenu from './PageActionsMenu';
import { ConfirmDialog } from './ConfirmDialog';
import { IconPicker, PageHistoryModal, PageMarkdownDialog, ShareModal } from './lazyDialogs';
import PageBacklinksPanel from './PageBacklinksPanel';
import LocalGraphPanel from './graph/LocalGraphPanel';
import KnowledgeContextPanel from './KnowledgeContextPanel';
import PageCommentsPanel, { CommentsJumpLink } from './PageCommentsPanel';
import { pageContainerClass, scrollToSection } from './pageLayout';
import SeriesPanel from './recurrence/SeriesPanel';
import type { WorkspaceItemRow } from '@/lib/actions/workspace';
import { type SelectOption, normalizeOption, formatDateValue } from '@/lib/types/properties';
import { Checkbox } from '@/components/ui/checkbox';
import DateRangePicker from './DateRangePicker';
import { OptionChip, PropertyTypeIcon, StatusChip, UserChip, UserTags } from './PropertyTags';
import { PropertyValuePicker } from './PropertyValuePicker';

/** Value kinds edited by picking rather than typing (the shared PropertyValuePicker). */
const PICKED_TYPES = new Set(['select', 'multi_select', 'status', 'user', 'multi_user']);

/** A property value that edits in place: no chrome until hover, a focus edge when active. */
const PROP_FIELD =
  'rounded-control px-1.5 -mx-1.5 outline-none transition-colors hover:bg-hover/60 focus-visible:bg-transparent focus-visible:shadow-[inset_0_0_0_1px_var(--color-focus)]';
const PROP_INPUT =
  'h-8 w-full min-w-0 bg-transparent text-ui text-fg placeholder:text-fg-4 focus:bg-transparent focus:shadow-[inset_0_0_0_1px_var(--color-focus)]';

function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Longer than the property/content save debounces plus a round-trip (see BlockEditor). */
const LOCAL_SAVE_QUIET_MS = 2500;

/** Order-independent identity of a properties object: the server merges an agent's
 *  properties into the row, so the same values can come back in a different key order. */
function stableKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort()
      .map((k) => `${JSON.stringify(k)}:${stableKey((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
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

export type PageEditorHandle = {
  /** Current document serialized to the same storage-markdown format used for persistence. */
  getMarkdown: () => string;
  /** Replace the whole document from a storage-markdown string and persist it immediately. */
  replaceContent: (markdown: string) => void;
};

type PageEditorProps = {
  database: any;
  onSchemaChange?: (schema: any[]) => void;
  initialPage: any;
  isPeek?: boolean;
  onClose?: () => void;
  onPageUpdated?: (updatedPage: any) => void;
  subItems?: WorkspaceItemRow[];
  isAdmin?: boolean;
};

const PageEditor = forwardRef<PageEditorHandle, PageEditorProps>(function PageEditor({
  database,
  onSchemaChange,
  initialPage,
  isPeek = false,
  onClose,
  onPageUpdated,
  subItems,
  isAdmin = false,
}, ref) {
  const t = useTranslations('Page');
  const tDb = useTranslations('Database');
  const tEditor = useTranslations('Editor');
  const locale = useLocale();
  const [properties, setProperties] = useState<Record<string, any>>(initialPage.properties || {});
  const [icon, setIcon] = useState<string | null>(initialPage.icon);
  const [iconColor, setIconColor] = useState<string | null>(initialPage.iconColor);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [openDateColId, setOpenDateColId] = useState<string | null>(null);
  const [dateAnchorRect, setDateAnchorRect] = useState<DOMRect | null>(null);
  const iconButtonRef = useRef<HTMLButtonElement>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [markdownDraft, setMarkdownDraft] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  type WidthMode = 'narrow' | 'wide' | 'full';
  const [widthMode, setWidthMode] = useState<WidthMode>('full');

  useEffect(() => {
    const saved = localStorage.getItem(`page-width-${initialPage.id}`) as WidthMode | null;
    if (saved === 'narrow' || saved === 'wide' || saved === 'full') setWidthMode(saved);
    else if (saved === 'true') setWidthMode('full'); // migrate old boolean
  }, [initialPage.id]);

  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const commentsRef = useRef<HTMLElement>(null);
  // Bumped by a review in either place (provenance line, knowledge panel) so the other follows.
  const [reviewSignal, setReviewSignal] = useState(0);
  const bumpReview = useCallback(() => setReviewSignal((n) => n + 1), []);
  const editorRef = useRef<BlockEditorHandle>(null);

  useImperativeHandle(ref, () => ({
    getMarkdown: () => editorRef.current?.getMarkdown() ?? '',
    replaceContent: (markdown: string) => editorRef.current?.replaceContent(markdown),
  }), []);

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
    setIcon(initialPage.icon);
    setIconColor(initialPage.iconColor);
  }, [initialPage.id, initialPage.icon, initialPage.iconColor]);

  // Live properties (2026-09-25). A refresh brings the row's current properties (an
  // agent's `update_page`, another tab), but they were only read on a page switch, so the
  // title and fields of an open row stayed stale. Same rule as the body in BlockEditor:
  // adopt the server's properties unless this editor holds an unsaved edit of its own,
  // and not within LOCAL_SAVE_QUIET_MS of a local edit (a debounced save may still land).
  const syncedPropsRef = useRef({ id: initialPage.id, key: stableKey(initialPage.properties || {}) });
  const lastLocalPropEditRef = useRef(0);
  // Handlers only flag the edit; the time is taken here, outside render.
  const localPropEditRef = useRef(false);
  useEffect(() => {
    if (!localPropEditRef.current) return;
    localPropEditRef.current = false;
    lastLocalPropEditRef.current = Date.now();
  }, [properties]);
  useEffect(() => {
    const incoming = initialPage.properties || {};
    const incomingKey = stableKey(incoming);
    if (syncedPropsRef.current.id !== initialPage.id) {
      syncedPropsRef.current = { id: initialPage.id, key: incomingKey };
      setProperties(incoming);
      return;
    }
    let retry: ReturnType<typeof setTimeout> | undefined;
    const adopt = () => {
      const synced = syncedPropsRef.current;
      if (incomingKey === synced.key) return;
      const localKey = stableKey(propertiesRef.current);
      if (localKey === incomingKey) {
        syncedPropsRef.current = { id: initialPage.id, key: incomingKey };
        return;
      }
      if (localKey !== synced.key) return;
      const quietFor = Date.now() - lastLocalPropEditRef.current;
      if (quietFor < LOCAL_SAVE_QUIET_MS) {
        retry = setTimeout(adopt, LOCAL_SAVE_QUIET_MS - quietFor);
        return;
      }
      syncedPropsRef.current = { id: initialPage.id, key: incomingKey };
      setProperties(incoming);
    };
    adopt();
    return () => { if (retry) clearTimeout(retry); };
  }, [initialPage.id, initialPage.properties]);

  const schema = database.schema as any[];

  // Which date column a repeat rule would hang off. Prefer whatever a Calendar
  // view of this database is already bound to (that is the column the user
  // thinks of as "the date"), and fall back to the first date/datetime column —
  // the same heuristic DatabaseView's header "New" button uses.
  const recurrenceDateColId = useMemo<string | null>(() => {
    const calendarView = (database.views as any[] | undefined)?.find((v) => v?.type === 'calendar' && v?.dateCol);
    if (calendarView?.dateCol) return calendarView.dateCol as string;
    return schema.find((c: any) => c.type === 'date' || c.type === 'datetime')?.id ?? null;
  }, [database.views, schema]);
  const pageTitle = properties['title'] || t('untitled');

  // Re-applied after every server refresh too (`initialPage` is a new object then): the
  // refresh re-renders the layout's default "Remnus" <title>, which would otherwise stay.
  useEffect(() => {
    if (!isPeek) {
      document.title = `${pageTitle} | Remnus`;
    }
  }, [pageTitle, isPeek, initialPage]);

  const saveContent = useCallback(async (md: string) => {
    setSaveState('saving');
    try {
      await updatePageContent(initialPage.id, md);
      patchPageCache({ content: md });
      editorRef.current?.markSaved(md);
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
        // Once saved, the server holds these: later server versions compare against them.
        updatePageProperties(initialPage.id, props).then(() => {
          syncedPropsRef.current = { id: initialPage.id, key: stableKey(props) };
        });
        patchPageCache({ properties: props });
        onPageUpdated?.({ ...initialPage, icon: iconRef.current, iconColor: iconColorRef.current, properties: props });
      }, 600),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialPage.id]
  );

  // For text/number inputs: update state immediately, persist after pause
  const handleTextPropertyChange = (colId: string, value: any) => {
    const newProps = { ...properties, [colId]: value };
    localPropEditRef.current = true;
    setProperties(newProps);
    debouncedSaveProps(newProps);
  };

  // For discrete controls (select, date, multi_select): save immediately
  const handlePropertyChange = async (colId: string, value: any) => {
    const newProps = { ...properties, [colId]: value };
    localPropEditRef.current = true;
    setProperties(newProps);
    await updatePageProperties(initialPage.id, newProps);
    syncedPropsRef.current = { id: initialPage.id, key: stableKey(newProps) };
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

  // Persists a newly-typed select/multi_select option onto the column's schema.
  const handleCreateOption = (colId: string, value: string) => {
    const col = schema.find((c: any) => c.id === colId);
    if (!col) return;
    const existing = (col.options || []).map((o: string | SelectOption) => normalizeOption(o).value);
    if (existing.includes(value)) return;
    const nextSchema = schema.map((c: any) =>
      c.id === colId ? { ...c, options: [...(c.options || []), { value, color: 'default' }] } : c
    );
    onSchemaChange?.(nextSchema);
    updateDatabaseSchema(database.id, nextSchema);
  };

  const containerClass = isPeek ? 'p-6 md:p-10 lg:py-16 lg:px-24' : pageContainerClass(widthMode);

  return (
    <div className={containerClass}>
      {!isPeek && (
        <div className="mb-8 flex min-h-8 items-center justify-between gap-3">
          <Link
            href={`/db/${database.id}`}
            className="-ml-2 inline-flex h-8 min-w-0 items-center gap-1.5 rounded-control px-2 text-ui text-fg-3 transition-colors hover:bg-hover hover:text-fg"
          >
            <ArrowLeft size={16} className="shrink-0" />
            <span className="truncate">{database.name}</span>
          </Link>
          <div className="flex items-center gap-1">
            <SaveStatus state={saveState} className="mr-1" />
            <PageActionsMenu
              widthMode={widthMode}
              onWidthChange={(w) => { setWidthMode(w); localStorage.setItem(`page-width-${initialPage.id}`, w); }}
              onShare={() => setShowShareModal(true)}
              onMarkdown={() => setMarkdownDraft(editorRef.current?.getMarkdown() ?? initialPage.content ?? '')}
              onHistory={() => setShowHistory(true)}
              onDuplicate={async () => {
                const newId = await duplicatePage(initialPage.id, database.id);
                if (newId) router.push(`/db/${database.id}/${newId}`);
              }}
              onDelete={() => setShowDeleteConfirm(true)}
            />
          </div>
        </div>
      )}

      {/* Unified Page Header: Icon + Title Input */}
      <div className="flex items-center gap-3 mb-6 group/page-header relative select-none">
        <div className="relative shrink-0 flex items-center group/icon-wrapper">
          <div className="relative flex items-center">
            <button
              ref={iconButtonRef}
              onClick={() => setShowIconPicker(!showIconPicker)}
              className="p-1 hover:bg-hover rounded-surface transition-colors duration-150 cursor-pointer flex items-center justify-center shrink-0"
              title={icon ? t('changeIcon') : t('addIcon')}
            >
              <PageIcon icon={icon} iconColor={iconColor} size={36} fallbackType="page" />
            </button>
            {icon && (
              <button
                onClick={() => handleIconSelect(null, null)}
                className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover/icon-wrapper:opacity-100 focus-visible:opacity-100 h-6 px-2 text-2xs bg-fg text-desk rounded-control transition-opacity cursor-pointer font-medium whitespace-nowrap shadow-float z-20"
              >
                {t('removeIcon')}
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
            className="w-full bg-transparent text-fg font-semibold text-[28px] sm:text-[34px] leading-tight tracking-[-0.025em] outline-none placeholder:text-fg-4 py-1 resize-none overflow-hidden block"
          />
        </div>
      </div>

      {/* Provenance (R8.8): which agent edited it, the last human edit, review state.
          Replaces the bare "agent edited" stamp; the row's own stamp still feeds it. */}
      {initialPage.provenance && (
        <PageProvenanceLine
          provenance={initialPage.provenance}
          workspaceId={database.workspaceId}
          itemId={initialPage.id}
          reviewSignal={reviewSignal}
          onReviewed={bumpReview}
          className="-mt-2 mb-5"
        />
      )}

      {/* Properties Section — a quiet two-column list: name (with its type glyph)
          on the left, the value on the right; every value edits in place. */}
      <div className={`flex flex-col ${isPeek ? 'mb-6 gap-0.5' : 'mb-10 gap-1'}`}>
        {schema.filter((col) => col.id !== 'title').map((col) => {
          const val = properties[col.id];
          const isEmptyVal = val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0);

          let editor: React.ReactNode;
          if (PICKED_TYPES.has(col.type)) {
            const list: string[] = Array.isArray(val) ? val : val ? [String(val)] : [];
            let display: React.ReactNode;
            if (list.length === 0) {
              display = <span className="text-fg-4">{col.type === 'user' || col.type === 'multi_user' ? tDb('unassigned') : tDb('empty')}</span>;
            } else if (col.type === 'select') {
              display = <OptionChip value={list[0]} options={col.options} />;
            } else if (col.type === 'status') {
              display = <StatusChip value={list[0]} options={col.options} />;
            } else if (col.type === 'user') {
              display = <UserChip userId={list[0]} />;
            } else if (col.type === 'multi_user') {
              display = <UserTags value={list} />;
            } else {
              display = (
                <span className="flex flex-wrap gap-1">
                  {list.map((v) => <OptionChip key={v} value={v} options={col.options} />)}
                </span>
              );
            }
            editor = (
              <PropertyValuePicker
                column={col}
                value={val}
                onChange={(next) => handlePropertyChange(col.id, next)}
                onCreateOption={col.type === 'select' || col.type === 'multi_select' ? (v) => handleCreateOption(col.id, v) : undefined}
                triggerClassName={`${PROP_FIELD} flex min-h-8 w-full flex-wrap items-center gap-1 py-1 text-left cursor-pointer`}
                triggerLabel={col.name}
              >
                {display}
              </PropertyValuePicker>
            );
          } else if (col.type === 'date' || col.type === 'datetime') {
            editor = (
              <div className="relative w-full">
                <button
                  type="button"
                  onClick={(e) => {
                    setDateAnchorRect((e.currentTarget as HTMLElement).getBoundingClientRect());
                    setOpenDateColId(openDateColId === col.id ? null : col.id);
                  }}
                  className={`${PROP_FIELD} flex h-8 w-full items-center text-left cursor-pointer`}
                >
                  <span className={val ? 'text-fg' : 'text-fg-4'}>
                    {val ? formatDateValue(String(val), col.type as 'date' | 'datetime', col.dateFormat, locale) : tDb('empty')}
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
            );
          } else if (col.type === 'checkbox') {
            editor = (
              <div className="flex h-8 items-center">
                <Checkbox
                  checked={val === true || val === 'true'}
                  onCheckedChange={(next) => handlePropertyChange(col.id, next ? 'true' : 'false')}
                  aria-label={col.name}
                />
              </div>
            );
          } else if (col.type === 'url') {
            editor = (
              <div className="flex w-full items-center gap-1">
                <input
                  type="url"
                  value={val || ''}
                  onChange={(e) => handleTextPropertyChange(col.id, e.target.value)}
                  placeholder={tDb('empty')}
                  aria-label={col.name}
                  className={`${PROP_FIELD} ${PROP_INPUT}`}
                />
                {typeof val === 'string' && /^https?:\/\//i.test(val) && (
                  <a
                    href={val}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex size-7 shrink-0 items-center justify-center rounded-control text-fg-3 transition-colors hover:bg-hover hover:text-fg"
                    aria-label={tDb('openLink')}
                    title={tDb('openLink')}
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            );
          } else if (col.type === 'email' || col.type === 'phone' || col.type === 'number') {
            editor = (
              <input
                type={col.type === 'email' ? 'email' : col.type === 'phone' ? 'tel' : 'number'}
                value={val || ''}
                onChange={(e) => handleTextPropertyChange(col.id, e.target.value)}
                placeholder={tDb('empty')}
                aria-label={col.name}
                className={`${PROP_FIELD} ${PROP_INPUT}`}
              />
            );
          } else if (col.type === 'id') {
            editor = <span className="flex h-8 items-center truncate font-mono text-xs text-fg-3 select-text">{initialPage.id}</span>;
          } else {
            editor = (
              <AutoGrowTextarea
                value={val || ''}
                onChange={(e) => handleTextPropertyChange(col.id, e.target.value)}
                placeholder={tDb('empty')}
                className={`${PROP_FIELD} ${PROP_INPUT} resize-none overflow-hidden block py-1.5 leading-snug`}
              />
            );
          }

          return (
            <div key={col.id} className="flex items-start gap-3 sm:gap-4">
              <div
                className={`flex h-8 shrink-0 items-center gap-2 text-fg-3 select-none ${isPeek ? 'w-28 text-xs' : 'w-28 sm:w-40 text-ui'}`}
                title={col.name}
              >
                <PropertyTypeIcon type={col.type} />
                <span className="truncate">{col.name}</span>
              </div>
              <div className={`flex min-w-0 flex-1 items-center text-ui ${isEmptyVal ? '' : 'text-fg'}`}>{editor}</div>
            </div>
          );
        })}
      </div>

      {/* The comment thread lives under the body (R8.1). Right under the attributes
          only its count stays, as a way down — in peek too, since a peeked card is
          often exactly where an agent's running comments need to be found. */}
      {commentCount > 0 && (
        <div className={isPeek ? '-mt-2 mb-5' : '-mt-8 mb-8'}>
          <CommentsJumpLink count={commentCount} onJump={() => scrollToSection(commentsRef.current)} />
        </div>
      )}

      {/* Recurrence — sits between the properties and the body because that is
          the order the question gets asked: what is this card, then is it one
          of many, then what am I writing in it. */}
      <SeriesPanel
        page={{
          id: initialPage.id,
          properties,
          seriesId: (initialPage as any).seriesId,
          seriesDetached: (initialPage as any).seriesDetached,
        }}
        databaseId={database.id}
        dateColId={recurrenceDateColId}
        isPeek={isPeek}
        onChanged={() => router.refresh()}
      />

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

      <PageCommentsPanel
        workspaceId={database.workspaceId}
        pageId={initialPage.id}
        isPeek={isPeek}
        onCountChange={setCommentCount}
        sectionRef={commentsRef}
      />
      {!isPeek && <KnowledgeContextPanel workspaceId={database.workspaceId} pageId={initialPage.id} refreshKey={reviewSignal} onReviewed={bumpReview} />}
      {!isPeek && <PageBacklinksPanel workspaceId={database.workspaceId} pageId={initialPage.id} />}
      {!isPeek && <LocalGraphPanel workspaceId={database.workspaceId} pageId={initialPage.id} />}

      {showShareModal && (
        <ShareModal
          pageId={initialPage.id}
          workspaceId={database.workspaceId}
          isAdmin={isAdmin}
          onClose={() => setShowShareModal(false)}
        />
      )}
      {markdownDraft !== null && (
        <PageMarkdownDialog
          initialMarkdown={markdownDraft}
          onApply={(md) => editorRef.current?.replaceContent(md)}
          onClose={() => setMarkdownDraft(null)}
        />
      )}
      {showHistory && (
        <PageHistoryModal
          workspaceId={database.workspaceId}
          pageId={initialPage.id}
          currentContent={editorRef.current?.getMarkdown() ?? initialPage.content ?? ''}
          onRestored={(content) => editorRef.current?.replaceContent(content)}
          onClose={() => setShowHistory(false)}
        />
      )}
      {showDeleteConfirm && (
        <ConfirmDialog
          title={t('deleteConfirm', { title: properties['title'] || t('untitled') })}
          confirmLabel={t('delete')}
          cancelLabel={t('deleteCancel')}
          onConfirm={async () => {
            // Stays open and busy until the page has actually gone and we have left it.
            await deletePage(initialPage.id, database.id);
            router.push(`/db/${database.id}`);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
});

export default PageEditor;
