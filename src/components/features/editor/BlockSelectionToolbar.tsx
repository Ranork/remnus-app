'use client';
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import {
  Trash2, Copy, CopyPlus, Bold, Italic, Strikethrough, Code, ChevronDown,
  Pilcrow, Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code2, X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useZoom } from '@/components/providers/ZoomProvider';
import {
  blockSelectionKey,
  getBlockSelection,
  serializeBlockSelectionMarkdown,
  deleteBlockSelection,
  type BlockSelectionState,
} from './BlockSelectionExtension';

type Props = { editor: Editor };

const TOOLBAR_H = 36;
const MARGIN = 8;
const EMPTY: BlockSelectionState = { selected: [], anchor: null };

// ── Block-type "Turn into" options ──────────────────────────────────────────────
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
  paragraph: <Pilcrow size={14} />, h1: <Heading1 size={14} />, h2: <Heading2 size={14} />, h3: <Heading3 size={14} />,
  bullet: <List size={14} />, ordered: <ListOrdered size={14} />, quote: <Quote size={14} />, code: <Code2 size={14} />,
};

const BLOCK_TYPES: BlockType[] = ['paragraph', 'h1', 'h2', 'h3', 'bullet', 'ordered', 'quote', 'code'];

const Divider = () => <div className="w-px h-4 bg-neutral-700 self-center mx-0.5" />;

// ── Color palettes (mirror BubbleMenuBar) ───────────────────────────────────────
const TEXT_COLORS: Array<{ label: string; value: string }> = [
  { label: 'Red', value: '#ef4444' }, { label: 'Orange', value: '#f97316' }, { label: 'Yellow', value: '#eab308' },
  { label: 'Green', value: '#22c55e' }, { label: 'Blue', value: '#60a5fa' }, { label: 'Purple', value: '#a78bfa' },
  { label: 'Pink', value: '#f472b6' }, { label: 'Gray', value: '#9ca3af' },
];

// Semi-transparent so the highlight blends with the theme background — soft on
// both dark and light themes (see BubbleMenuBar for the rationale).
const HIGHLIGHT_COLORS: Array<{ label: string; value: string }> = [
  { label: 'Red', value: 'rgba(248, 113, 113, 0.25)' }, { label: 'Orange', value: 'rgba(251, 146, 60, 0.25)' }, { label: 'Yellow', value: 'rgba(250, 204, 21, 0.28)' },
  { label: 'Green', value: 'rgba(74, 222, 128, 0.25)' }, { label: 'Blue', value: 'rgba(96, 165, 250, 0.25)' }, { label: 'Purple', value: 'rgba(192, 132, 252, 0.25)' },
  { label: 'Pink', value: 'rgba(244, 114, 182, 0.25)' },
];

export default function BlockSelectionToolbar({ editor }: Props) {
  const t = useTranslations('Editor');
  const zoom = useZoom();
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const anchorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const colorPanelRef = useRef<HTMLDivElement>(null);
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ top: number; left: number } | null>(null);
  const [selState, setSelState] = useState<BlockSelectionState>(EMPTY);
  const [colorOpen, setColorOpen] = useState(false);
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);

  const BLOCK_LABELS: Record<BlockType, string> = {
    paragraph: t('slashParagraph'), h1: t('slashHeading1'), h2: t('slashHeading2'), h3: t('slashHeading3'),
    bullet: t('slashBulletList'), ordered: t('slashNumberedList'), quote: t('slashQuote'), code: t('slashCodeBlock'),
  };

  useEffect(() => {
    const update = () => {
      const s = getBlockSelection(editor.state);
      setSelState(s);

      if (!s.selected.length) {
        setLayout(null);
        setColorOpen(false);
        setBlockMenuOpen(false);
        return;
      }

      const sorted = [...s.selected].sort((a, b) => a - b);
      const firstPos = sorted[0];

      try {
        const view = editor.view;
        const firstCoords = view.coordsAtPos(firstPos + 1);

        const anchor = anchorRef.current;
        if (!anchor) return;
        const anchorRect = anchor.getBoundingClientRect();

        const z = zoomRef.current;
        const toLocal = (v: number) => v / z;

        const toolbarW = toolbarRef.current?.offsetWidth ?? 320;
        const topAbove = toLocal(firstCoords.top - anchorRect.top) - TOOLBAR_H - MARGIN;

        const editorRect = view.dom.getBoundingClientRect();
        const midX = toLocal((editorRect.left + editorRect.right) / 2 - anchorRect.left);
        let left = midX - toolbarW / 2;
        // Clamp into viewport
        const maxLeft = toLocal(window.innerWidth - anchorRect.left) - toolbarW - 8;
        const minLeft = toLocal(0 - anchorRect.left) + 8;
        left = Math.max(minLeft, Math.min(left, maxLeft));

        setLayout({ top: Math.max(0, topAbove), left });
      } catch {
        setLayout(null);
      }
    };

    editor.on('transaction', update);
    return () => { editor.off('transaction', update as any); };
  }, [editor]);

  // Close popovers on outside click
  useEffect(() => {
    if (!colorOpen && !blockMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const inBar = toolbarRef.current?.contains(e.target as Node);
      const inColor = colorPanelRef.current?.contains(e.target as Node);
      const inBlock = blockMenuRef.current?.contains(e.target as Node);
      if (!inBar && !inColor && !inBlock) { setColorOpen(false); setBlockMenuOpen(false); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colorOpen, blockMenuOpen]);

  // ── Range helpers ──────────────────────────────────────────────────────────────

  /** Text range spanning all selected blocks (from inside first → end of last). */
  const blockRange = (): { from: number; to: number; state: BlockSelectionState } | null => {
    const s = getBlockSelection(editor.state);
    if (!s.selected.length) return null;
    const sorted = [...s.selected].sort((a, b) => a - b);
    const firstPos = sorted[0];
    const lastPos = sorted[sorted.length - 1];
    const lastNode = editor.state.doc.nodeAt(lastPos);
    if (!lastNode) return null;
    return { from: firstPos, to: lastPos + lastNode.nodeSize, state: s };
  };

  /**
   * Apply text marks (bold/italic/color/…) to every selected block, then collapse
   * the text selection (so no native highlight lingers) while preserving the block
   * selection — all in one transaction so the block decorations survive.
   */
  const applyMarks = (mutate: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => {
    const r = blockRange();
    if (!r) return;
    const from = Math.min(r.from + 1, r.to - 1);
    const to = Math.max(r.to - 1, r.from + 1);
    let chain = editor.chain().setTextSelection({ from, to });
    chain = mutate(chain);
    chain
      .setTextSelection({ from, to: from })
      .command(({ tr }) => { tr.setMeta(blockSelectionKey, r.state); return true; })
      .run();
  };

  const markActive = (markName: string): boolean => {
    const r = blockRange();
    if (!r) return false;
    const markType = editor.schema.marks[markName];
    if (!markType) return false;
    try {
      return editor.state.doc.rangeHasMark(r.from, r.to, markType);
    } catch {
      return false;
    }
  };

  const applyBlockType = (type: BlockType) => {
    const r = blockRange();
    if (!r) return;
    const from = Math.min(r.from + 1, r.to - 1);
    const to = Math.max(r.to - 1, r.from + 1);
    editor.chain().setTextSelection({ from, to }).run();
    BLOCK_APPLIES[type](editor);
    // Block type changes shift positions → clear the (now stale) block selection.
    editor.view.dispatch(editor.state.tr.setMeta(blockSelectionKey, EMPTY));
    setBlockMenuOpen(false);
  };

  // ── Actions ──────────────────────────────────────────────────────────────────

  const deleteSelected = () => {
    if (deleteBlockSelection(editor.view)) editor.view.focus();
  };

  const duplicateSelected = () => {
    const s = getBlockSelection(editor.state);
    if (!s.selected.length) return;
    // High → low so inserting after one node doesn't shift the positions we
    // haven't processed yet. Each copy lands immediately after its own original,
    // so it always stays in a valid parent (a duplicated listItem remains inside
    // its list; a paragraph stays at doc level). Inserting every node after the
    // LAST selected node instead could drop e.g. a paragraph into a bulletList —
    // invalid content that crashes the next normalization transaction.
    const sorted = [...s.selected].sort((a, b) => b - a);
    let tr = editor.state.tr;
    for (const pos of sorted) {
      const node = editor.state.doc.nodeAt(pos);
      if (!node) continue;
      tr = tr.insert(pos + node.nodeSize, node);
    }
    tr.setMeta(blockSelectionKey, EMPTY);
    editor.view.dispatch(tr);
  };

  const copySelected = async () => {
    // Same markdown as Ctrl/Cmd+C (shared serializer). The toolbar button isn't a
    // native copy event, so it writes via the async clipboard API.
    const markdown = serializeBlockSelectionMarkdown(editor);
    if (markdown == null) return;
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      /* best-effort */
    } finally {
      // Close the block selection after copying (mirrors duplicate/delete).
      editor.view.dispatch(editor.state.tr.setMeta(blockSelectionKey, EMPTY));
    }
  };

  const count = selState.selected.length;

  const btnCls = (active?: boolean) =>
    `flex items-center justify-center px-2 py-1.5 transition-colors ${
      active ? 'text-white bg-neutral-700' : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60'
    }`;

  return (
    <>
      <div ref={anchorRef} className="absolute inset-0 pointer-events-none" />
      {layout && count > 0 && (
        <>
          <div
            ref={toolbarRef}
            className="absolute z-50 flex items-center bg-neutral-850 border border-neutral-800 rounded-md shadow-xl overflow-hidden text-xs select-none"
            style={{ top: layout.top, left: layout.left }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <span className="text-neutral-500 px-2 whitespace-nowrap">
              {t('blockSelectionCount', { count })}
            </span>
            <Divider />

            {/* Inline text formatting (applies to all selected blocks) */}
            <button onMouseDown={(e) => { e.preventDefault(); applyMarks(c => c.toggleBold()); }} className={btnCls(markActive('bold'))} title={t('bubbleBold')}>
              <Bold size={13} />
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); applyMarks(c => c.toggleItalic()); }} className={btnCls(markActive('italic'))} title={t('bubbleItalic')}>
              <Italic size={13} />
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); applyMarks(c => c.toggleStrike()); }} className={btnCls(markActive('strike'))} title={t('bubbleStrike')}>
              <Strikethrough size={13} />
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); applyMarks(c => c.toggleCode()); }} className={btnCls(markActive('code'))} title={t('bubbleCode')}>
              <Code size={13} />
            </button>

            <Divider />

            {/* Color / highlight */}
            <button
              onMouseDown={(e) => { e.preventDefault(); setColorOpen(v => !v); setBlockMenuOpen(false); }}
              className={`flex flex-col items-center justify-center px-2 py-1 transition-colors ${colorOpen ? 'text-white bg-neutral-700' : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60'}`}
              title={t('bubbleTextColor')}
            >
              <span className="text-xs font-bold leading-none px-0.5">A</span>
              <span className="mt-0.5 rounded-sm" style={{ width: 14, height: 3, backgroundColor: '#cccccc' }} />
            </button>

            <Divider />

            {/* Turn into */}
            <button
              onMouseDown={(e) => { e.preventDefault(); setBlockMenuOpen(v => !v); setColorOpen(false); }}
              className={`flex items-center gap-1 px-2 py-1.5 transition-colors ${blockMenuOpen ? 'text-neutral-100 bg-neutral-800' : 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/60'}`}
              title={t('bubbleTurnInto')}
            >
              <Pilcrow size={13} />
              <ChevronDown size={10} />
            </button>

            <Divider />

            {/* Block actions */}
            <button onMouseDown={(e) => { e.preventDefault(); copySelected(); }} className={btnCls()} title={t('blockCopy')}>
              <Copy size={13} />
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); duplicateSelected(); }} className={btnCls()} title={t('blockDuplicate')}>
              <CopyPlus size={13} />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); deleteSelected(); }}
              className="flex items-center justify-center px-2 py-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title={t('blockDelete')}
            >
              <Trash2 size={13} />
            </button>
          </div>

          {/* Color panel */}
          {colorOpen && (
            <div
              ref={colorPanelRef}
              className="absolute z-50 bg-neutral-900 border border-neutral-800 shadow-xl rounded-md p-3 min-w-50"
              style={{ top: layout.top + TOOLBAR_H + 4, left: layout.left }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="text-xs text-neutral-600 font-medium uppercase tracking-wider mb-2">{t('bubbleTextColor')}</div>
              <div className="flex items-center gap-1.5 flex-wrap mb-3">
                <button
                  title={t('bubbleColorDefault')}
                  onMouseDown={(e) => { e.preventDefault(); applyMarks(c => c.unsetColor()); }}
                  className="w-5 h-5 rounded-full border border-neutral-600 flex items-center justify-center text-neutral-500 hover:border-neutral-400 hover:text-neutral-300 transition-colors shrink-0"
                >
                  <X size={9} />
                </button>
                {TEXT_COLORS.map(c => (
                  <button
                    key={c.value}
                    title={c.label}
                    onMouseDown={(e) => { e.preventDefault(); applyMarks(ch => ch.setColor(c.value)); }}
                    className="w-5 h-5 rounded-full transition-all shrink-0 hover:scale-110"
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>

              <div className="w-full h-px bg-neutral-800 mb-3" />

              <div className="text-xs text-neutral-600 font-medium uppercase tracking-wider mb-2">{t('bubbleHighlight')}</div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  title={t('bubbleColorNone')}
                  onMouseDown={(e) => { e.preventDefault(); applyMarks(c => c.unsetHighlight()); }}
                  className="w-5 h-5 rounded-full border border-neutral-600 flex items-center justify-center text-neutral-500 hover:border-neutral-400 hover:text-neutral-300 transition-colors shrink-0"
                >
                  <X size={9} />
                </button>
                {HIGHLIGHT_COLORS.map(c => (
                  <button
                    key={c.value}
                    title={c.label}
                    onMouseDown={(e) => { e.preventDefault(); applyMarks(ch => ch.setHighlight({ color: c.value })); }}
                    className="w-5 h-5 rounded-full transition-all shrink-0 hover:scale-110"
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Turn-into menu */}
          {blockMenuOpen && (
            <div
              ref={blockMenuRef}
              className="absolute z-50 min-w-49 bg-neutral-900 border border-neutral-800 shadow-xl py-1 rounded-md overflow-hidden"
              style={{ top: layout.top + TOOLBAR_H + 4, left: layout.left }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="px-3 py-1.5 text-xs text-neutral-600 font-medium uppercase tracking-wider">{t('bubbleTurnInto')}</div>
              {BLOCK_TYPES.map(type => (
                <button
                  key={type}
                  onMouseDown={(e) => { e.preventDefault(); applyBlockType(type); }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 transition-colors"
                >
                  <span className="text-neutral-600">{BLOCK_ICONS[type]}</span>
                  <span className="text-sm">{BLOCK_LABELS[type]}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
