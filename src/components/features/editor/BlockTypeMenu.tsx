'use client';
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { Pilcrow, Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code2, Check } from 'lucide-react';

type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'bullet' | 'ordered' | 'quote' | 'code';

type BlockOption = {
  type: BlockType;
  label: string;
  icon: React.ReactNode;
  apply: (editor: Editor) => void;
};

const BLOCK_OPTIONS: BlockOption[] = [
  {
    type: 'paragraph',
    label: 'Text',
    icon: <Pilcrow size={14} />,
    apply: (e) => e.chain().focus().clearNodes().run(),
  },
  {
    type: 'h1',
    label: 'Heading 1',
    icon: <Heading1 size={14} />,
    apply: (e) => e.chain().focus().clearNodes().setNode('heading', { level: 1 }).run(),
  },
  {
    type: 'h2',
    label: 'Heading 2',
    icon: <Heading2 size={14} />,
    apply: (e) => e.chain().focus().clearNodes().setNode('heading', { level: 2 }).run(),
  },
  {
    type: 'h3',
    label: 'Heading 3',
    icon: <Heading3 size={14} />,
    apply: (e) => e.chain().focus().clearNodes().setNode('heading', { level: 3 }).run(),
  },
  {
    type: 'bullet',
    label: 'Bullet List',
    icon: <List size={14} />,
    apply: (e) => {
      if (e.isActive('bulletList')) return;
      if (e.isActive('orderedList')) e.chain().focus().toggleOrderedList().run();
      e.chain().focus().toggleBulletList().run();
    },
  },
  {
    type: 'ordered',
    label: 'Numbered List',
    icon: <ListOrdered size={14} />,
    apply: (e) => {
      if (e.isActive('orderedList')) return;
      if (e.isActive('bulletList')) e.chain().focus().toggleBulletList().run();
      e.chain().focus().toggleOrderedList().run();
    },
  },
  {
    type: 'quote',
    label: 'Quote',
    icon: <Quote size={14} />,
    apply: (e) => e.chain().focus().clearNodes().toggleBlockquote().run(),
  },
  {
    type: 'code',
    label: 'Code Block',
    icon: <Code2 size={14} />,
    apply: (e) => e.chain().focus().clearNodes().toggleCodeBlock().run(),
  },
];

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

function getBlockDomEl(editor: Editor): HTMLElement | null {
  try {
    const { $from } = editor.state.selection;
    const { node: domNode } = editor.view.domAtPos($from.pos);
    let el = (domNode instanceof HTMLElement ? domNode : domNode.parentElement) as HTMLElement | null;

    // Walk up to find a meaningful block-level element or direct editor child
    const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'PRE', 'BLOCKQUOTE']);
    while (el && el !== editor.view.dom) {
      if (BLOCK_TAGS.has(el.tagName) || el.parentElement === editor.view.dom) break;
      el = el.parentElement;
    }
    return el && el !== editor.view.dom ? el : null;
  } catch {
    return null;
  }
}

type Props = { editor: Editor };

export default function BlockTypeMenu({ editor }: Props) {
  const [handle, setHandle] = useState<{ type: BlockType; top: number; left: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      if (!editor.isFocused) {
        setHandle(null);
        setMenuOpen(false);
        return;
      }

      const el = getBlockDomEl(editor);
      if (!el) { setHandle(null); return; }

      const rect = el.getBoundingClientRect();
      const editorRect = editor.view.dom.getBoundingClientRect();
      const type = getActiveType(editor);

      setHandle({
        type,
        top: rect.top,
        left: Math.max(4, editorRect.left - 28),
      });
    };

    const hide = () => { setHandle(null); setMenuOpen(false); };

    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    editor.on('blur', hide);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
      editor.off('blur', hide);
    };
  }, [editor]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  if (!handle) return null;

  const currentOpt = BLOCK_OPTIONS.find((o) => o.type === handle.type);
  const dropdownTop = Math.min(handle.top + 28, window.innerHeight - 320);

  return (
    <>
      <button
        style={{ position: 'fixed', top: handle.top + 2, left: handle.left, zIndex: 100 }}
        onMouseDown={(e) => { e.preventDefault(); setMenuOpen((v) => !v); }}
        className="p-1 text-neutral-700 hover:text-neutral-300 hover:bg-neutral-800/50 transition-colors"
        title="Change block type"
      >
        {currentOpt?.icon}
      </button>

      {menuOpen && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: dropdownTop, left: Math.max(4, handle.left - 4), zIndex: 9998 }}
          className="min-w-[196px] bg-neutral-900 border border-neutral-800 shadow-xl py-1 overflow-hidden"
        >
          <div className="px-3 py-1.5 text-xs text-neutral-600 font-medium uppercase tracking-wider">
            Turn into
          </div>
          {BLOCK_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              onMouseDown={(e) => {
                e.preventDefault();
                opt.apply(editor);
                setMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                opt.type === handle.type
                  ? 'text-neutral-100 bg-neutral-800'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
              }`}
            >
              <span className={opt.type === handle.type ? 'text-neutral-300' : 'text-neutral-600'}>
                {opt.icon}
              </span>
              <span className="text-sm">{opt.label}</span>
              {opt.type === handle.type && <Check size={12} className="ml-auto text-neutral-400" />}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
