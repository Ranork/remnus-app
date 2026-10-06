'use client';
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import {
  Trash2, Copy, CopyPlus, Bold, Italic, Strikethrough, Code, ChevronDown,
  Pilcrow, Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import {
  blockSelectionKey,
  getBlockSelection,
  serializeBlockSelectionMarkdown,
  deleteBlockSelection,
  type BlockSelectionState,
} from './BlockSelectionExtension';
import EditorColorPanel from './EditorColorPanel';
import {
  MENU_ICON, MENU_LABEL, MENU_SURFACE, TOOLBAR_DIVIDER, TOOLBAR_HEIGHT, TOOLBAR_SURFACE, menuItem, toolbarButton,
} from './menuStyles';

type Props = { editor: Editor };

const TOOLBAR_H = TOOLBAR_HEIGHT;
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

const Divider = () => <div className={TOOLBAR_DIVIDER} />;

// A toolbar button that acts on mousedown, so the block selection survives the click.
function ActionButton({ onPress, active, label, danger, children }: {
  onPress: () => void; active?: boolean; label: string; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onPress(); }}
      className={cn(toolbarButton(active), danger && 'hover:bg-red-500/12 hover:text-red-400')}
      title={label}
      aria-label={label}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

export default function BlockSelectionToolbar({ editor }: Props) {
  const t = useTranslations('Editor');
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

        const toolbarW = toolbarRef.current?.offsetWidth ?? 320;
        const topAbove = firstCoords.top - anchorRect.top - TOOLBAR_H - MARGIN;

        const editorRect = view.dom.getBoundingClientRect();
        const midX = (editorRect.left + editorRect.right) / 2 - anchorRect.left;
        let left = midX - toolbarW / 2;
        // Clamp into viewport
        const maxLeft = window.innerWidth - anchorRect.left - toolbarW - 8;
        const minLeft = 8 - anchorRect.left;
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

  return (
    <>
      <div ref={anchorRef} className="absolute inset-0 pointer-events-none" />
      {layout && count > 0 && (
        <>
          <div
            ref={toolbarRef}
            className={cn(TOOLBAR_SURFACE, 'absolute z-50')}
            style={{ top: layout.top, left: layout.left }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <span className="px-1.5 text-xs whitespace-nowrap text-fg-3">
              {t('blockSelectionCount', { count })}
            </span>
            <Divider />

            {/* Inline text formatting (applies to all selected blocks) */}
            <ActionButton onPress={() => applyMarks(c => c.toggleBold())} active={markActive('bold')} label={t('bubbleBold')}>
              <Bold size={14} />
            </ActionButton>
            <ActionButton onPress={() => applyMarks(c => c.toggleItalic())} active={markActive('italic')} label={t('bubbleItalic')}>
              <Italic size={14} />
            </ActionButton>
            <ActionButton onPress={() => applyMarks(c => c.toggleStrike())} active={markActive('strike')} label={t('bubbleStrike')}>
              <Strikethrough size={14} />
            </ActionButton>
            <ActionButton onPress={() => applyMarks(c => c.toggleCode())} active={markActive('code')} label={t('bubbleCode')}>
              <Code size={14} />
            </ActionButton>

            <Divider />

            {/* Color / highlight */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setColorOpen(v => !v); setBlockMenuOpen(false); }}
              className={cn(toolbarButton(colorOpen), 'flex-col gap-0')}
              title={t('bubbleTextColor')}
              aria-label={t('bubbleTextColor')}
              aria-expanded={colorOpen}
            >
              <span className="px-0.5 text-xs leading-none font-bold">A</span>
              <span className="mt-0.5 h-0.75 w-3.5 rounded-full bg-current" />
            </button>

            <Divider />

            {/* Turn into */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setBlockMenuOpen(v => !v); setColorOpen(false); }}
              className={toolbarButton(blockMenuOpen)}
              title={t('bubbleTurnInto')}
              aria-label={t('bubbleTurnInto')}
              aria-expanded={blockMenuOpen}
            >
              <Pilcrow size={14} />
              <ChevronDown size={12} />
            </button>

            <Divider />

            {/* Block actions */}
            <ActionButton onPress={copySelected} label={t('blockCopy')}>
              <Copy size={14} />
            </ActionButton>
            <ActionButton onPress={duplicateSelected} label={t('blockDuplicate')}>
              <CopyPlus size={14} />
            </ActionButton>
            <ActionButton onPress={deleteSelected} label={t('blockDelete')} danger>
              <Trash2 size={14} />
            </ActionButton>
          </div>

          {/* Color panel */}
          {colorOpen && (
            <EditorColorPanel
              ref={colorPanelRef}
              className="absolute z-50"
              style={{ top: layout.top + TOOLBAR_H + 4, left: layout.left }}
              onText={(value) => applyMarks(c => (value ? c.setColor(value) : c.unsetColor()))}
              onHighlight={(value) => applyMarks(c => (value ? c.setHighlight({ color: value }) : c.unsetHighlight()))}
            />
          )}

          {/* Turn-into menu */}
          {blockMenuOpen && (
            <div
              ref={blockMenuRef}
              className={cn(MENU_SURFACE, 'absolute z-50 min-w-52')}
              style={{ top: layout.top + TOOLBAR_H + 4, left: layout.left }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className={MENU_LABEL}>{t('bubbleTurnInto')}</div>
              {BLOCK_TYPES.map(type => (
                <button
                  type="button"
                  key={type}
                  onMouseDown={(e) => { e.preventDefault(); applyBlockType(type); }}
                  className={menuItem()}
                >
                  <span className={MENU_ICON}>{BLOCK_ICONS[type]}</span>
                  <span className="flex-1">{BLOCK_LABELS[type]}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
