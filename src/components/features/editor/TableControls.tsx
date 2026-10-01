'use client';
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import {
  BetweenVerticalEnd, BetweenHorizontalEnd, Columns3, Rows3, Trash2, PanelTopClose, PaintBucket, Ban,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useZoom } from '@/components/providers/ZoomProvider';
import { cn } from '@/lib/cn';
import { CELL_COLORS, COLOR_LABEL_KEY } from './editorColors';
import { MENU_SURFACE, TOOLBAR_DIVIDER, TOOLBAR_HEIGHT, TOOLBAR_SURFACE, menuItem, toolbarButton } from './menuStyles';

type Props = { editor: Editor };

const TOOLBAR_H = TOOLBAR_HEIGHT;
const MARGIN = 8;

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

  const btn = toolbarButton();
  // Removing a column, a row or the table is destructive: the icon says so in red.
  const dangerBtn = cn(toolbarButton(), 'text-red-400 hover:bg-red-500/12 hover:text-red-400');

  return (
    <div ref={anchorRef} className="absolute top-0 left-0 w-0 h-0 pointer-events-none z-30">
      {layout && (
        <div
          ref={toolbarRef}
          className={cn(TOOLBAR_SURFACE, 'absolute pointer-events-auto')}
          style={{ top: layout.top, left: layout.left }}
          // Keep the editor selection (and thus the active table) while clicking.
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className={btn}
            title={t('tableAddColumn')}
            aria-label={t('tableAddColumn')}
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          >
            <BetweenVerticalEnd size={15} />
          </button>
          <button
            type="button"
            className={btn}
            title={t('tableAddRow')}
            aria-label={t('tableAddRow')}
            onClick={() => editor.chain().focus().addRowAfter().run()}
          >
            <BetweenHorizontalEnd size={15} />
          </button>
          <div className={TOOLBAR_DIVIDER} />
          <button
            type="button"
            className={dangerBtn}
            title={t('tableDeleteColumn')}
            aria-label={t('tableDeleteColumn')}
            onClick={() => editor.chain().focus().deleteColumn().run()}
          >
            <Columns3 size={15} />
          </button>
          <button
            type="button"
            className={dangerBtn}
            title={t('tableDeleteRow')}
            aria-label={t('tableDeleteRow')}
            onClick={() => editor.chain().focus().deleteRow().run()}
          >
            <Rows3 size={15} />
          </button>
          <div className={TOOLBAR_DIVIDER} />
          <div className="relative">
            <button
              type="button"
              className={toolbarButton(colorOpen)}
              title={t('tableCellColor')}
              aria-label={t('tableCellColor')}
              aria-expanded={colorOpen}
              onClick={() => setColorOpen((v) => !v)}
            >
              <PaintBucket size={15} />
            </button>
            {colorOpen && (
              <div className={cn(MENU_SURFACE, 'absolute top-9 left-0 z-10 flex w-max flex-col gap-1')}>
                <div className="flex items-center gap-1 p-1">
                  {CELL_COLORS.map((c) => {
                    const label = t(COLOR_LABEL_KEY[c.name]);
                    return (
                      <button
                        key={c.value}
                        type="button"
                        className="size-6 cursor-pointer rounded shadow-[inset_0_0_0_1px_var(--color-line-strong)] transition-shadow hover:ring-2 hover:ring-line-strong hover:ring-offset-1 hover:ring-offset-float"
                        style={{ backgroundColor: c.value }}
                        title={label}
                        aria-label={label}
                        onClick={() => setCellBg(c.value)}
                      />
                    );
                  })}
                </div>
                <button
                  type="button"
                  className={menuItem()}
                  onClick={() => setCellBg(null)}
                >
                  <Ban size={14} className="text-fg-3" /> {t('tableCellColorNone')}
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className={btn}
            title={t('tableToggleHeaderRow')}
            aria-label={t('tableToggleHeaderRow')}
            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
          >
            <PanelTopClose size={15} />
          </button>
          <button
            type="button"
            className={dangerBtn}
            title={t('tableDelete')}
            aria-label={t('tableDelete')}
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
