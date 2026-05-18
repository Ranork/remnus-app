'use client';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code2, Minus } from 'lucide-react';

export type SlashCommandItem = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  command: (props: { editor: any; range: any }) => void;
};

export const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: 'h1',
    label: 'Heading 1',
    description: 'Large section heading',
    icon: <Heading1 size={15} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(),
  },
  {
    id: 'h2',
    label: 'Heading 2',
    description: 'Medium section heading',
    icon: <Heading2 size={15} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
  },
  {
    id: 'h3',
    label: 'Heading 3',
    description: 'Small section heading',
    icon: <Heading3 size={15} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(),
  },
  {
    id: 'bullet',
    label: 'Bullet List',
    description: 'Unordered list of items',
    icon: <List size={15} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    id: 'ordered',
    label: 'Numbered List',
    description: 'Ordered list of items',
    icon: <ListOrdered size={15} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    id: 'quote',
    label: 'Quote',
    description: 'Capture a quote or callout',
    icon: <Quote size={15} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    id: 'code',
    label: 'Code Block',
    description: 'Display code with syntax',
    icon: <Code2 size={15} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    id: 'divider',
    label: 'Divider',
    description: 'Visual horizontal separator',
    icon: <Minus size={15} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

type Props = {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
};

const SlashCommandList = forwardRef<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }, Props>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          if (items[selectedIndex]) command(items[selectedIndex]);
          return true;
        }
        return false;
      },
    }));

    if (!items.length) return null;

    return (
      <div className="min-w-[220px] bg-neutral-900 border border-neutral-800 rounded-none shadow-xl overflow-hidden py-1">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => command(item)}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
              index === selectedIndex
                ? 'bg-neutral-800 text-neutral-100'
                : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'
            }`}
          >
            <span className="text-neutral-500 shrink-0">{item.icon}</span>
            <div>
              <div className="text-sm font-medium leading-none mb-0.5">{item.label}</div>
              <div className="text-xs text-neutral-600">{item.description}</div>
            </div>
          </button>
        ))}
      </div>
    );
  }
);

SlashCommandList.displayName = 'SlashCommandList';
export default SlashCommandList;
