'use client';
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import {
  BetweenVerticalEnd, BetweenHorizontalEnd, Columns3, Rows3, Trash2, PanelTopClose, PaintBucket, Ban,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useZoom } from '@/components/providers/ZoomProvider';

type Props = { editor: Editor };

const TOOLBAR_H = 34;
const MARGIN = 8;

// Cell background tints — semi-transparent so they blend on both dark and light
// themes (same rationale as the highlight palette in BlockSelectionToolbar).
const CELL_COLORS: Array<{ label: string; value: string }> = [
  { label: 'Gray', value: 'rgba(156, 163, 175, 0.22)' },
  { label: 'Red', value: 'rgba(248, 113, 113, 0.22)' },
  { label: 'Orange', value: 'rgba(251, 146, 60, 0.22)' },
  { label: 'Yellow', value: 'rgba(250, 204, 21, 0.24)' },
  { label: 'Green', value: 'rgba(74, 222, 128, 0.22)' },
  { label: 'Blue', value: 'rgba(96, 165, 250, 0.22)' },
  { label: 'Purple', value: 'rgba(192, 132, 252, 0.22)' },
  { label: 'Pink', value: 'rgba(244, 114, 182, 0.22)' },
];

/** Walk up the selection ancestry to find the enclosing `table` node + its position. */
function findActiveTable(editor: Editor): { pos: number } | null {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'table') {
      return { pos: $from.before(d) };
    }
  }
  return null;
}

/**
 * Floating toolbar shown above the table the caret currently sits in.
 * Adds/removes columns and rows (tiptap table commands), toggles the header
 * row, and deletes the whole table — the affordances missing after `/table`.
 */
export default function TableControls({ editor }: Props) {
  const t = useTranslations('Editor');
  const zoom = useZoom();
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const anchorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ top: number; left: number } | null>(null);
  const [colorOpen, setColorOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      const active = findActiveTable(editor);
      if (!active || !editor.isEditable) { setLayout(null); setColorOpen(false); return; }

      try {
        const dom = editor.view.nodeDOM(active.pos) as HTMLElement | null;
        const tableEl = dom?.closest('table') ?? (dom?.tagName === 'TABLE' ? dom : dom?.querySelector('table'));
        if (!tableEl) { setLayout(null); return; }
        const rect = tableEl.getBoundingClientRect();

        const anchor = anchorRef.current;
        if (!anchor) return;
        const anchorRect = anchor.getBoundingClientRect();

        const z = zoomRef.current;
        const toLocal = (v: number) => v / z;

        const toolbarW = toolbarRef.current?.offsetWidth ?? 200;
        const top = toLocal(rect.top - anchorRect.top) - TOOLBAR_H - MARGIN;
        let left = toLocal(rect.left - anchorRect.left);
        // Clamp into viewport.
        const maxLeft = toLocal(window.innerWidth - anchorRect.left) - toolbarW - 8;
        const minLeft = toLocal(0 - anchorRect.left) + 8;
        left = Math.max(minLeft, Math.min(left, maxLeft));

        setLayout({ top: Math.max(0, top), left });
      } catch {
        setLayout(null);
      }
    };

    editor.on('transaction', update);
    editor.on('focus', update);
    editor.on('selectionUpdate', update);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      editor.off('transaction', update as any);
      editor.off('focus', update as any);
      editor.off('selectionUpdate', update as any);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [editor]);

  // Close the color popover on outside click.
  useEffect(() => {
    if (!colorOpen) return;
    const handler = (e: MouseEvent) => {
      if (!toolbarRef.current?.contains(e.target as Node)) setColorOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colorOpen]);

  // Applies to the cell at the caret, or every cell in the active CellSelection.
  const setCellBg = (value: string | null) => {
    editor.chain().focus().setCellAttribute('backgroundColor', value).run();
    setColorOpen(false);
  };

  const btn = 'flex items-center justify-center w-7 h-7 rounded-md text-neutral-100 hover:bg-neutral-800 transition-colors';

  return (
    <div ref={anchorRef} className="absolute top-0 left-0 w-0 h-0 pointer-events-none z-30">
      {layout && (
        <div
          ref={toolbarRef}
          className="absolute pointer-events-auto flex items-center gap-0.5 rounded-lg border border-neutral-800 bg-neutral-900 p-1 shadow-lg"
          style={{ top: layout.top, left: layout.left }}
          // Keep the editor selection (and thus the active table) while clicking.
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className={btn}
            title={t('tableAddColumn')}
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          >
            <BetweenVerticalEnd size={15} />
          </button>
          <button
            type="button"
            className={btn}
            title={t('tableAddRow')}
            onClick={() => editor.chain().focus().addRowAfter().run()}
          >
            <BetweenHorizontalEnd size={15} />
          </button>
          <div className="w-px h-4 bg-neutral-700 mx-0.5" />
          <button
            type="button"
            className={btn}
            title={t('tableDeleteColumn')}
            onClick={() => editor.chain().focus().deleteColumn().run()}
          >
            <Columns3 size={15} className="text-red-400" />
          </button>
          <button
            type="button"
            className={btn}
            title={t('tableDeleteRow')}
            onClick={() => editor.chain().focus().deleteRow().run()}
          >
            <Rows3 size={15} className="text-red-400" />
          </button>
          <div className="w-px h-4 bg-neutral-700 mx-0.5" />
          <div className="relative">
            <button
              type="button"
              className={btn}
              title={t('tableCellColor')}
              onClick={() => setColorOpen((v) => !v)}
            >
              <PaintBucket size={15} />
            </button>
            {colorOpen && (
              <div className="absolute top-9 left-0 z-10 flex flex-col gap-1 rounded-lg border border-neutral-800 bg-neutral-900 p-2 shadow-lg">
                <div className="flex items-center gap-1">
                  {CELL_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      className="w-6 h-6 rounded-md border border-neutral-700 hover:ring-2 hover:ring-signal transition-shadow"
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                      onClick={() => setCellBg(c.value)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-neutral-100 hover:bg-neutral-800 transition-colors"
                  onClick={() => setCellBg(null)}
                >
                  <Ban size={13} /> {t('tableCellColorNone')}
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className={btn}
            title={t('tableToggleHeaderRow')}
            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
          >
            <PanelTopClose size={15} />
          </button>
          <button
            type="button"
            className={btn}
            title={t('tableDelete')}
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            <Trash2 size={15} className="text-red-400" />
          </button>
        </div>
      )}
    </div>
  );
}
