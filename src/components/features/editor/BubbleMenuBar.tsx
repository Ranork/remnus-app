'use client';
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import {
  Bold, Italic, Strikethrough, Code, ChevronDown, Link2, ArrowLeft, Check, X,
  Pilcrow, Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { hasBlockSelection } from './BlockSelectionExtension';
import EditorColorPanel from './EditorColorPanel';
import {
  MENU_ICON, MENU_LABEL, MENU_SURFACE, TOOLBAR_DIVIDER, TOOLBAR_HEIGHT, TOOLBAR_SURFACE, menuItem, toolbarButton,
} from './menuStyles';

type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'bullet' | 'ordered' | 'quote' | 'code';

const BLOCK_APPLIES: Record<BlockType, (e: Editor) => void> = {
  paragraph: (e) => e.chain().focus().clearNodes().run(),
  h1: (e) => e.chain().focus().clearNodes().setNode('heading', { level: 1 }).run(),
  h2: (e) => e.chain().focus().clearNodes().setNode('heading', { level: 2 }).run(),
  h3: (e) => e.chain().focus().clearNodes().setNode('heading', { level: 3 }).run(),
  bullet: (e) => { if (e.isActive('bulletList')) return; if (e.isActive('orderedList')) e.chain().focus().toggleOrderedList().run(); e.chain().focus().toggleBulletList().run(); },
  ordered: (e) => { if (e.isActive('orderedList')) return; if (e.isActive('bulletList')) e.chain().focus().toggleBulletList().run(); e.chain().focus().toggleOrderedList().run(); },
  quote: (e) => e.chain().focus().clearNodes().toggleBlockquote().run(),
  code: (e) => e.chain().focus().clearNodes().toggleCodeBlock().run(),
};

const BLOCK_ICONS: Record<BlockType, React.ReactNode> = {
  paragraph: <Pilcrow size={14} />,
  h1: <Heading1 size={14} />,
  h2: <Heading2 size={14} />,
  h3: <Heading3 size={14} />,
  bullet: <List size={14} />,
  ordered: <ListOrdered size={14} />,
  quote: <Quote size={14} />,
  code: <Code2 size={14} />,
};

const BLOCK_TYPES: BlockType[] = ['paragraph', 'h1', 'h2', 'h3', 'bullet', 'ordered', 'quote', 'code'];

function getActiveType(editor: Editor): BlockType {
  if (editor.isActive('heading', { level: 1 })) return 'h1';
  if (editor.isActive('heading', { level: 2 })) return 'h2';
  if (editor.isActive('heading', { level: 3 })) return 'h3';
  if (editor.isActive('bulletList')) return 'bullet';
  if (editor.isActive('orderedList')) return 'ordered';
  if (editor.isActive('blockquote')) return 'quote';
  if (editor.isActive('codeBlock')) return 'code';
  return 'paragraph';
}

type Bounds = { minTop: number; maxBottom: number; minLeft: number; maxRight: number };
type Layout = { top: number; left: number; bounds: Bounds };
type Mode = 'format' | 'link';

function findScrollableAncestor(el: HTMLElement): HTMLElement | null {
  let cur = el.parentElement;
  while (cur && cur !== document.documentElement) {
    const ov = window.getComputedStyle(cur).overflowY;
    if (ov === 'auto' || ov === 'scroll') return cur;
    cur = cur.parentElement;
  }
  return null;
}

type Props = { editor: Editor };

function Btn({ onClick, active, children, title }: { onClick: () => void; active: boolean; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={toolbarButton(active)}
    >
      {children}
    </button>
  );
}

const TOOLBAR_H = TOOLBAR_HEIGHT;
const DROP_H = BLOCK_TYPES.length * 32 + 40;
const COLOR_PANEL_H = 120;
const MARGIN = 6;

function normalizeHref(raw: string): string {
  const h = raw.trim();
  if (!h) return '';
  if (/^(https?:\/\/|\/|#|mailto:)/.test(h)) return h;
  return `https://${h}`;
}

export default function BubbleMenuBar({ editor }: Props) {
  const t = useTranslations('Editor');

  const BLOCK_LABELS: Record<BlockType, string> = {
    paragraph: t('slashParagraph'),
    h1: t('slashHeading1'),
    h2: t('slashHeading2'),
    h3: t('slashHeading3'),
    bullet: t('slashBulletList'),
    ordered: t('slashNumberedList'),
    quote: t('slashQuote'),
    code: t('slashCodeBlock'),
  };

  const BLOCK_OPTIONS = BLOCK_TYPES.map((type) => ({
    type,
    label: BLOCK_LABELS[type],
    icon: BLOCK_ICONS[type],
    apply: BLOCK_APPLIES[type],
  }));

  const [layout, setLayout] = useState<Layout | null>(null);
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [colorPanel, setColorPanel] = useState<'both' | null>(null);
  const [modeState, setModeState] = useState<Mode>('format');
  const [linkText, setLinkText] = useState('');
  const [linkHref, setLinkHref] = useState('');
  const modeRef = useRef<Mode>('format');
  const linkWasActive = useRef(false);
  const linkInitialText = useRef('');
  const menuRef = useRef<HTMLDivElement>(null);
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const colorPanelRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const linkHrefInputRef = useRef<HTMLInputElement>(null);
  const linkTextInputRef = useRef<HTMLInputElement>(null);

  const setMode = (m: Mode) => { modeRef.current = m; setModeState(m); };

  // ── Link editor logic ────────────────────────────────────────────────────────

  const openLinkEditor = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().extendMarkRange('link').run();
    }
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, '');
    const href = editor.getAttributes('link').href ?? '';
    linkWasActive.current = editor.isActive('link');
    linkInitialText.current = text;
    setLinkText(text);
    setLinkHref(href);
    setMode('link');
    setColorPanel(null);
  };

  const cancelLink = () => {
    setMode('format');
    editor.chain().focus().run();
  };

  const applyLink = () => {
    const href = normalizeHref(linkHref);
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setMode('format');
      return;
    }

    const textChanged = linkWasActive.current && linkText !== linkInitialText.current && linkText.length > 0;

    if (textChanged) {
      editor.chain()
        .focus()
        .extendMarkRange('link')
        .command(({ tr, state, dispatch }) => {
          if (!dispatch) return true;
          const { from, to } = state.selection;
          const mark = state.schema.marks.link?.create({ href });
          const node = mark
            ? state.schema.text(linkText, [mark])
            : state.schema.text(linkText);
          tr.replaceWith(from, to, node);
          return true;
        })
        .run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    setMode('format');
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setMode('format');
  };

  useEffect(() => {
    if (modeState !== 'link') return;
    const target = linkWasActive.current && linkHref ? linkTextInputRef : linkHrefInputRef;
    setTimeout(() => target.current?.focus(), 30);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeState]);

  // ── Position tracking ────────────────────────────────────────────────────────

  useEffect(() => {
    const update = () => {
      const { empty } = editor.state.selection;
      if (empty || hasBlockSelection(editor.state) || (!editor.isFocused && modeRef.current !== 'link')) {
        setLayout(null);
        return;
      }

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) { setLayout(null); return; }
      const selRect = sel.getRangeAt(0).getBoundingClientRect();
      if (selRect.width === 0) { setLayout(null); return; }

      const anchor = anchorRef.current;
      if (!anchor) { setLayout(null); return; }
      const anchorRect = anchor.getBoundingClientRect();

      const scrollable = findScrollableAncestor(editor.view.dom);
      const vp = scrollable
        ? scrollable.getBoundingClientRect()
        : { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };

      const bounds: Bounds = {
        minTop:    vp.top    - anchorRect.top  + MARGIN,
        maxBottom: vp.bottom - anchorRect.top  - MARGIN,
        minLeft:   vp.left   - anchorRect.left + MARGIN,
        maxRight:  vp.right  - anchorRect.left - MARGIN,
      };

      const menuWidth = menuRef.current?.offsetWidth ?? Math.min(380, window.innerWidth - 32);
      const topAbove = selRect.top    - anchorRect.top  - TOOLBAR_H - 8;
      const topBelow = selRect.bottom - anchorRect.top  + 8;
      const top = topAbove >= bounds.minTop ? topAbove : topBelow;
      const idealLeft = selRect.left + selRect.width / 2 - anchorRect.left - menuWidth / 2;
      const left = Math.max(bounds.minLeft, Math.min(idealLeft, bounds.maxRight - menuWidth));

      setLayout({ top, left, bounds });
    };

    const hide = () => {
      setTimeout(() => {
        const active = document.activeElement;
        const inMenu = menuRef.current?.contains(active);
        const inDrop = blockMenuRef.current?.contains(active);
        const inColor = colorPanelRef.current?.contains(active);
        if (!inMenu && !inDrop && !inColor) {
          setLayout(null);
          setMode('format');
          setColorPanel(null);
        }
      }, 0);
    };

    editor.on('selectionUpdate', update);
    editor.on('blur', hide);
    return () => { editor.off('selectionUpdate', update); editor.off('blur', hide); };
  }, [editor]);

  useEffect(() => { if (!layout) { setBlockMenuOpen(false); setColorPanel(null); } }, [layout]);

  useEffect(() => {
    if (!blockMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const inBar = menuRef.current?.contains(e.target as Node);
      const inDrop = blockMenuRef.current?.contains(e.target as Node);
      if (!inBar && !inDrop) setBlockMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [blockMenuOpen]);

  useEffect(() => {
    if (!colorPanel) return;
    const handler = (e: MouseEvent) => {
      const inBar = menuRef.current?.contains(e.target as Node);
      const inPanel = colorPanelRef.current?.contains(e.target as Node);
      if (!inBar && !inPanel) setColorPanel(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colorPanel]);

  const activeType = getActiveType(editor);
  const currentOpt = BLOCK_OPTIONS.find((o) => o.type === activeType);

  const dropTop = layout
    ? (layout.top + TOOLBAR_H + DROP_H <= layout.bounds.maxBottom
        ? layout.top + TOOLBAR_H + 2
        : layout.top - DROP_H - 2)
    : 0;

  const colorPanelTop = layout
    ? (layout.top + TOOLBAR_H + COLOR_PANEL_H <= layout.bounds.maxBottom
        ? layout.top + TOOLBAR_H + 2
        : layout.top - COLOR_PANEL_H - 2)
    : 0;

  // Active color values
  const activeTextColor: string | null = editor.getAttributes('textStyle').color ?? null;
  const activeHighlight: string | null = editor.getAttributes('highlight').color ?? null;

  // The link editor's two fields: a quiet well inside the toolbar; focus turns the edge
  // to the focus colour, like the shared Input.
  const inputCls = 'h-7 min-w-0 rounded-control border border-line bg-transparent px-2 text-xs text-fg outline-none placeholder:text-fg-4 focus-visible:border-focus';
  const linkLabelCls = 'shrink-0 select-none whitespace-nowrap px-1 text-2xs text-fg-3';

  return (
    <>
      {/* Coordinate-system probe */}
      <div
        ref={anchorRef}
        style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0, pointerEvents: 'none', visibility: 'hidden', zIndex: -1 }}
      />

      {layout && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: layout.top, left: layout.left, zIndex: 9999 }}
          onMouseDown={(e) => e.preventDefault()}
          className={TOOLBAR_SURFACE}
        >
          {modeState === 'format' ? (
            <>
              <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title={t('bubbleBold')}>
                <Bold size={14} />
              </Btn>
              <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title={t('bubbleItalic')}>
                <Italic size={14} />
              </Btn>
              <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title={t('bubbleStrike')}>
                <Strikethrough size={14} />
              </Btn>
              <Btn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title={t('bubbleCode')}>
                <Code size={14} />
              </Btn>

              <div className={TOOLBAR_DIVIDER} />

              <Btn onClick={openLinkEditor} active={editor.isActive('link')} title={t('bubbleLinkEdit')}>
                <Link2 size={14} />
              </Btn>

              <div className={TOOLBAR_DIVIDER} />

              {/* Combined color button: the letter shows the current text colour and
                  highlight, the bar under it the text colour. */}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); setColorPanel((v) => v ? null : 'both'); setBlockMenuOpen(false); }}
                title={t('bubbleTextColor')}
                aria-label={t('bubbleTextColor')}
                aria-expanded={!!colorPanel}
                className={cn(toolbarButton(!!colorPanel), 'flex-col gap-0')}
              >
                <span
                  className="rounded-sm px-0.5 text-xs leading-none font-bold"
                  style={{
                    color: activeTextColor ?? undefined,
                    backgroundColor: activeHighlight ?? 'transparent',
                  }}
                >
                  A
                </span>
                <span
                  className="mt-0.5 h-0.75 w-3.5 rounded-full"
                  style={{ backgroundColor: activeTextColor ?? 'currentColor' }}
                />
              </button>

              <div className={TOOLBAR_DIVIDER} />

              {/* Block-type picker */}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); setBlockMenuOpen((v) => !v); setColorPanel(null); }}
                className={toolbarButton(blockMenuOpen)}
                title={t('bubbleTurnInto')}
                aria-label={t('bubbleTurnInto')}
                aria-expanded={blockMenuOpen}
              >
                {currentOpt?.icon}
                <ChevronDown size={12} />
              </button>
            </>
          ) : (
            <>
              {/* Link editor */}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); cancelLink(); }}
                className={toolbarButton()}
                title={t('linkBack')}
                aria-label={t('linkBack')}
              >
                <ArrowLeft size={14} />
              </button>

              <div className={TOOLBAR_DIVIDER} />

              <span className={linkLabelCls}>{t('bubbleLinkText')}</span>
              <input
                ref={linkTextInputRef}
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
                  if (e.key === 'Escape') { e.preventDefault(); cancelLink(); }
                }}
                className={`${inputCls} w-28`}
                placeholder={t('bubbleLinkText')}
                aria-label={t('bubbleLinkText')}
              />

              <span className={cn(linkLabelCls, 'pl-2')}>{t('bubbleLinkUrl')}</span>
              <input
                ref={linkHrefInputRef}
                value={linkHref}
                onChange={(e) => setLinkHref(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
                  if (e.key === 'Escape') { e.preventDefault(); cancelLink(); }
                }}
                className={`${inputCls} w-44`}
                placeholder="https://"
                aria-label={t('bubbleLinkUrl')}
              />

              <div className={TOOLBAR_DIVIDER} />

              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); applyLink(); }}
                className={toolbarButton()}
                title={t('linkApply')}
                aria-label={t('linkApply')}
              >
                <Check size={14} />
              </button>

              {linkWasActive.current && (
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); removeLink(); }}
                  className={cn(toolbarButton(), 'hover:text-red-400')}
                  title={t('removeLink')}
                  aria-label={t('removeLink')}
                >
                  <X size={14} />
                </button>
              )}
            </>
          )}
        </div>
      )}

      {layout && blockMenuOpen && (
        <div
          ref={blockMenuRef}
          style={{ position: 'fixed', top: dropTop, left: layout.left, zIndex: 10000 }}
          onMouseDown={(e) => e.preventDefault()}
          className={cn(MENU_SURFACE, 'min-w-52')}
        >
          <div className={MENU_LABEL}>{t('bubbleTurnInto')}</div>
          {BLOCK_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt.type}
              onMouseDown={(e) => { e.preventDefault(); opt.apply(editor); setBlockMenuOpen(false); }}
              className={menuItem(opt.type === activeType)}
            >
              <span className={MENU_ICON}>{opt.icon}</span>
              <span className="flex-1">{opt.label}</span>
              {opt.type === activeType && <Check size={14} className="text-fg" aria-hidden />}
            </button>
          ))}
        </div>
      )}

      {layout && colorPanel && (
        <EditorColorPanel
          ref={colorPanelRef}
          style={{ position: 'fixed', top: colorPanelTop, left: layout.left, zIndex: 10000 }}
          activeText={activeTextColor}
          activeHighlight={activeHighlight}
          onText={(value) => {
            if (value) editor.chain().focus().setColor(value).run();
            else editor.chain().focus().unsetColor().run();
          }}
          onHighlight={(value) => {
            if (value) editor.chain().focus().setHighlight({ color: value }).run();
            else editor.chain().focus().unsetHighlight().run();
          }}
        />
      )}
    </>
  );
}
