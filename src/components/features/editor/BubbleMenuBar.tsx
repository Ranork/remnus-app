'use client';
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import {
  Bold, Italic, Strikethrough, Code, ChevronDown, Link2, ArrowLeft, Check, X,
  Pilcrow, Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useZoom } from '@/components/providers/ZoomProvider';
import { hasBlockSelection } from './BlockSelectionExtension';

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

// ── Color palettes ────────────────────────────────────────────────────────────

const TEXT_COLORS: Array<{ label: string; value: string | null }> = [
  { label: 'Default', value: null },
  { label: 'Red',    value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Green',  value: '#22c55e' },
  { label: 'Blue',   value: '#60a5fa' },
  { label: 'Purple', value: '#a78bfa' },
  { label: 'Pink',   value: '#f472b6' },
  { label: 'Gray',   value: '#9ca3af' },
];

// Semi-transparent so the highlight blends with whatever theme background sits
// behind it — soft/pastel on both dark and light themes (a fixed opaque hex
// looked garish on dark and far too dark on light). The color is baked into the
// content (inline style), so it can't be theme-swapped; rgba keeps it tasteful
// everywhere. `null` = remove highlight.
const HIGHLIGHT_COLORS: Array<{ label: string; value: string | null }> = [
  { label: 'None',   value: null },
  { label: 'Red',    value: 'rgba(248, 113, 113, 0.25)' },
  { label: 'Orange', value: 'rgba(251, 146, 60, 0.25)' },
  { label: 'Yellow', value: 'rgba(250, 204, 21, 0.28)' },
  { label: 'Green',  value: 'rgba(74, 222, 128, 0.25)' },
  { label: 'Blue',   value: 'rgba(96, 165, 250, 0.25)' },
  { label: 'Purple', value: 'rgba(192, 132, 252, 0.25)' },
  { label: 'Pink',   value: 'rgba(244, 114, 182, 0.25)' },
];

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
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`px-2 py-1.5 transition-colors text-xs font-medium ${
        active ? 'text-white bg-neutral-700' : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60'
      }`}
    >
      {children}
    </button>
  );
}

const TOOLBAR_H = 36;
const DROP_H = BLOCK_TYPES.length * 36 + 28;
const COLOR_PANEL_H = 160;
const MARGIN = 6;

function normalizeHref(raw: string): string {
  const h = raw.trim();
  if (!h) return '';
  if (/^(https?:\/\/|\/|#|mailto:)/.test(h)) return h;
  return `https://${h}`;
}

// Small "×" swatch for removing a color
function RemoveSwatch({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className="w-5 h-5 rounded-full border border-neutral-600 flex items-center justify-center text-neutral-500 hover:border-neutral-400 hover:text-neutral-300 transition-colors shrink-0"
    >
      <X size={9} />
    </button>
  );
}

function ColorSwatch({ color, active, onClick, title }: { color: string; active: boolean; onClick: () => void; title: string }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`w-5 h-5 rounded-full transition-all shrink-0 ${active ? 'ring-2 ring-offset-1 ring-offset-neutral-900 ring-white' : 'hover:scale-110'}`}
      style={{ backgroundColor: color }}
    />
  );
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

  const zoom = useZoom();
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

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

      // getBoundingClientRect() returns visual-viewport coordinates.
      // When ZoomProvider applies transform:scale(z), position:fixed is relative
      // to that scaled ancestor — divide by z to convert to local coords.
      const z = zoomRef.current;
      const toLocal = (v: number) => v / z;

      const bounds: Bounds = {
        minTop:    toLocal(vp.top    - anchorRect.top  + MARGIN),
        maxBottom: toLocal(vp.bottom - anchorRect.top  - MARGIN),
        minLeft:   toLocal(vp.left   - anchorRect.left + MARGIN),
        maxRight:  toLocal(vp.right  - anchorRect.left - MARGIN),
      };

      const menuWidth = menuRef.current?.offsetWidth ?? toLocal(Math.min(380, window.innerWidth - 32));
      const topAbove = toLocal(selRect.top    - anchorRect.top)  - TOOLBAR_H - 8;
      const topBelow = toLocal(selRect.bottom - anchorRect.top)  + 8;
      const top = topAbove >= bounds.minTop ? topAbove : topBelow;
      const idealLeft = toLocal(selRect.left + selRect.width / 2 - anchorRect.left) - menuWidth / 2;
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

  // ── Input class helpers ──────────────────────────────────────────────────────

  const inputCls = 'bg-transparent text-neutral-200 text-xs outline-none placeholder-neutral-600 py-1 px-1 min-w-0';
  const iconBtnCls = (active?: boolean) =>
    `flex items-center justify-center px-2 py-1.5 transition-colors ${
      active ? 'text-white bg-neutral-700' : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60'
    }`;

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
          className="flex items-center bg-neutral-850 border border-neutral-800 rounded-md shadow-xl overflow-hidden"
        >
          {modeState === 'format' ? (
            <>
              <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title={t('bubbleBold')}>
                <Bold size={13} />
              </Btn>
              <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title={t('bubbleItalic')}>
                <Italic size={13} />
              </Btn>
              <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title={t('bubbleStrike')}>
                <Strikethrough size={13} />
              </Btn>
              <Btn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title={t('bubbleCode')}>
                <Code size={13} />
              </Btn>

              <div className="w-px h-4 bg-neutral-700 self-center mx-0.5" />

              <Btn onClick={openLinkEditor} active={editor.isActive('link')} title={t('bubbleLinkEdit')}>
                <Link2 size={13} />
              </Btn>

              <div className="w-px h-4 bg-neutral-700 self-center mx-0.5" />

              {/* Combined color button */}
              <button
                onMouseDown={(e) => { e.preventDefault(); setColorPanel((v) => v ? null : 'both'); setBlockMenuOpen(false); }}
                title={t('bubbleTextColor')}
                className={`flex flex-col items-center justify-center px-2 py-1 transition-colors ${
                  colorPanel ? 'text-white bg-neutral-700' : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60'
                }`}
              >
                <span
                  className="text-xs font-bold leading-none px-0.5 rounded-sm"
                  style={{
                    color: activeTextColor ?? undefined,
                    backgroundColor: activeHighlight ?? 'transparent',
                  }}
                >
                  A
                </span>
                <span
                  className="mt-0.5 rounded-sm"
                  style={{
                    width: 14,
                    height: 3,
                    backgroundColor: activeTextColor ?? '#cccccc',
                  }}
                />
              </button>

              <div className="w-px h-4 bg-neutral-700 self-center mx-0.5" />

              {/* Block-type picker */}
              <button
                onMouseDown={(e) => { e.preventDefault(); setBlockMenuOpen((v) => !v); setColorPanel(null); }}
                className={`flex items-center gap-1 px-2 py-1.5 transition-colors ${
                  blockMenuOpen ? 'text-neutral-100 bg-neutral-800' : 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/60'
                }`}
                title={t('bubbleTurnInto')}
              >
                {currentOpt?.icon}
                <ChevronDown size={10} />
              </button>
            </>
          ) : (
            <>
              {/* Link editor */}
              <button
                onMouseDown={(e) => { e.preventDefault(); cancelLink(); }}
                className={iconBtnCls()}
                title="Back"
              >
                <ArrowLeft size={13} />
              </button>

              <div className="w-px h-4 bg-neutral-700 self-center" />

              <span className="text-xs text-neutral-600 px-1.5 select-none whitespace-nowrap">{t('bubbleLinkText')}</span>
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
              />

              <div className="w-px h-4 bg-neutral-700 self-center" />

              <span className="text-xs text-neutral-600 px-1.5 select-none whitespace-nowrap">{t('bubbleLinkUrl')}</span>
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
              />

              <div className="w-px h-4 bg-neutral-700 self-center mx-0.5" />

              <button
                onMouseDown={(e) => { e.preventDefault(); applyLink(); }}
                className={iconBtnCls()}
                title="Apply"
              >
                <Check size={13} />
              </button>

              {linkWasActive.current && (
                <button
                  onMouseDown={(e) => { e.preventDefault(); removeLink(); }}
                  className={`${iconBtnCls()} hover:text-red-400`}
                  title={t('removeLink')}
                >
                  <X size={13} />
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
          className="min-w-49 bg-neutral-900 border border-neutral-800 shadow-xl py-1 rounded-md overflow-hidden"
        >
          <div className="px-3 py-1.5 text-xs text-neutral-600 font-medium">{t('bubbleTurnInto')}</div>
          {BLOCK_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              onMouseDown={(e) => { e.preventDefault(); opt.apply(editor); setBlockMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                opt.type === activeType ? 'text-neutral-100 bg-neutral-800' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
              }`}
            >
              <span className={opt.type === activeType ? 'text-neutral-300' : 'text-neutral-600'}>{opt.icon}</span>
              <span className="text-sm">{opt.label}</span>
              {opt.type === activeType && <Check size={12} className="ml-auto text-neutral-400" />}
            </button>
          ))}
        </div>
      )}

      {layout && colorPanel && (
        <div
          ref={colorPanelRef}
          style={{ position: 'fixed', top: colorPanelTop, left: layout.left, zIndex: 10000 }}
          onMouseDown={(e) => e.preventDefault()}
          className="bg-neutral-900 border border-neutral-800 shadow-xl rounded-md overflow-hidden p-3 min-w-50"
        >
          <div className="text-xs text-neutral-600 font-medium mb-2">{t('bubbleTextColor')}</div>
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <RemoveSwatch
              title={t('bubbleColorDefault')}
              onClick={() => { editor.chain().focus().unsetColor().run(); }}
            />
            {TEXT_COLORS.filter((c) => c.value !== null).map((c) => (
              <ColorSwatch
                key={c.value}
                color={c.value!}
                active={activeTextColor === c.value}
                title={c.label}
                onClick={() => { editor.chain().focus().setColor(c.value!).run(); }}
              />
            ))}
          </div>

          <div className="w-full h-px bg-neutral-800 mb-3" />

          <div className="text-xs text-neutral-600 font-medium mb-2">{t('bubbleHighlight')}</div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <RemoveSwatch
              title={t('bubbleColorNone')}
              onClick={() => { editor.chain().focus().unsetHighlight().run(); }}
            />
            {HIGHLIGHT_COLORS.filter((c) => c.value !== null).map((c) => (
              <ColorSwatch
                key={c.value}
                color={c.value!}
                active={activeHighlight === c.value}
                title={c.label}
                onClick={() => { editor.chain().focus().setHighlight({ color: c.value! }).run(); }}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
