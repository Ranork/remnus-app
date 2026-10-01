'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { CheckSquare, Heading1, Heading2, Heading3, List, ListOrdered, Minus, Quote, Code2, Table, FileText, Database, Link2, SquarePlay, ImageIcon, Info, Bookmark, Paperclip } from 'lucide-react';
import { createStandalonePage, createWorkspaceDatabase } from '@/lib/actions/workspace';
import { useTranslations } from 'next-intl';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/cn';
import { openPagePicker } from './pagePicker';
import { MENU_ICON, MENU_LABEL, MENU_SURFACE, menuItem } from './menuStyles';

export type SlashCommandItem = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  command: (props: { editor: any; range: any }) => void;
};

export function buildChildCommands(workspaceId: string, parentId: string): SlashCommandItem[] {
  return [
    {
      id: 'child-link',
      label: 'Link to page',
      description: 'Link to an existing page or database',
      icon: <Link2 size={15} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        openPagePicker(editor);
      },
    },
    {
      id: 'child-page',
      label: 'Page',
      description: 'Embed a nested page',
      icon: <FileText size={15} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        createStandalonePage(workspaceId, 'Untitled', parentId).then(({ itemId }) => {
          editor.commands.insertContent({
            type: 'childBlock',
            attrs: { itemId, title: 'Untitled', itemType: 'page', icon: null, iconColor: null },
          });
        });
      },
    },
    {
      id: 'child-database',
      label: 'Database',
      description: 'Embed a nested database',
      icon: <Database size={15} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        createWorkspaceDatabase(workspaceId, 'Untitled', { parentId }).then(result => {
          editor.commands.insertContent({
            type: 'childBlock',
            attrs: { itemId: result.itemId, databaseId: result.dbId, title: 'Untitled', itemType: 'database', icon: null, iconColor: null },
          });
        });
      },
    },
  ];
}

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
    label: 'Bullet list',
    description: 'Unordered list of items',
    icon: <List size={15} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    id: 'ordered',
    label: 'Numbered list',
    description: 'Ordered list of items',
    icon: <ListOrdered size={15} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    id: 'task',
    label: 'Task list',
    description: 'Checkbox list for tasks',
    icon: <CheckSquare size={15} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
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
    label: 'Code block',
    description: 'Display code with syntax',
    icon: <Code2 size={15} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    id: 'table',
    label: 'Table',
    description: 'Insert a 3×3 table',
    icon: <Table size={15} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: 'divider',
    label: 'Divider',
    description: 'A line between sections',
    icon: <Minus size={15} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    id: 'video',
    label: 'YouTube video',
    description: 'Embed a YouTube video',
    icon: <SquarePlay size={15} />,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: 'youtubeEmbed', attrs: { videoId: null } })
        .run(),
  },
  {
    id: 'image',
    label: 'Image',
    description: 'Upload or embed an image',
    icon: <ImageIcon size={15} />,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: 'imageBlock', attrs: { src: null } })
        .run(),
  },
  {
    id: 'callout',
    label: 'Callout',
    description: 'Highlighted info box',
    icon: <Info size={15} />,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: 'calloutBlock', attrs: { icon: '💡', color: 'blue', text: '' } })
        .run(),
  },
  {
    id: 'bookmark',
    label: 'Bookmark',
    description: 'Link preview card',
    icon: <Bookmark size={15} />,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: 'bookmarkBlock', attrs: { url: null } })
        .run(),
  },
  {
    id: 'file',
    label: 'File',
    description: 'Upload a file attachment',
    icon: <Paperclip size={15} />,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: 'fileBlock', attrs: { url: null } })
        .run(),
  },
];

// Typed shortcuts / synonyms so "/h1", "/img", "/todo" etc. match. Used by the
// suggestion filter in SlashCommandMenu alongside the (English) label.
export const SLASH_KEYWORDS: Record<string, string[]> = {
  h1: ['h1', 'heading1', 'title'],
  h2: ['h2', 'heading2', 'subtitle'],
  h3: ['h3', 'heading3'],
  bullet: ['ul', 'bullet', 'list', 'unordered'],
  ordered: ['ol', 'numbered', 'ordered'],
  task: ['todo', 'task', 'checkbox', 'check'],
  quote: ['quote', 'blockquote'],
  code: ['code', 'codeblock', 'pre'],
  table: ['table', 'grid'],
  divider: ['hr', 'divider', 'rule', 'separator', 'line'],
  video: ['video', 'youtube', 'yt', 'embed'],
  image: ['image', 'img', 'picture', 'photo'],
  callout: ['callout', 'info', 'note', 'warning', 'tip'],
  bookmark: ['bookmark', 'link', 'url', 'preview'],
  file: ['file', 'attachment', 'attach', 'upload', 'pdf'],
  'child-link': ['link', 'mention', 'reference'],
  'child-page': ['page', 'subpage'],
  'child-database': ['database', 'db', 'table'],
};

// Media / embed commands rendered as their own group.
export const MEDIA_IDS = ['video', 'image', 'callout', 'bookmark', 'file'];

/** Editor namespace key of each command's visible name. Also handed to the SlashCommand
 *  extension (BlockEditor) so typing in the reader's own language finds a command. */
export const SLASH_LABEL_KEYS: Record<string, string> = {
  h1: 'slashHeading1',
  h2: 'slashHeading2',
  h3: 'slashHeading3',
  bullet: 'slashBulletList',
  ordered: 'slashNumberedList',
  task: 'slashTaskList',
  quote: 'slashQuote',
  code: 'slashCodeBlock',
  table: 'slashTable',
  divider: 'slashDivider',
  video: 'slashVideo',
  image: 'slashImage',
  callout: 'slashCallout',
  bookmark: 'slashBookmark',
  file: 'slashFile',
  'child-link': 'slashLinkPage',
  'child-page': 'slashPage',
  'child-database': 'slashDatabase',
};

const SLASH_DESC_KEYS: Record<string, string> = {
  h1: 'slashHeading1Desc',
  h2: 'slashHeading2Desc',
  h3: 'slashHeading3Desc',
  bullet: 'slashBulletListDesc',
  ordered: 'slashNumberedListDesc',
  task: 'slashTaskListDesc',
  quote: 'slashQuoteDesc',
  code: 'slashCodeBlockDesc',
  table: 'slashTableDesc',
  divider: 'slashDividerDesc',
  video: 'slashVideoDesc',
  image: 'slashImageDesc',
  callout: 'slashCalloutDesc',
  bookmark: 'slashBookmarkDesc',
  file: 'slashFileDesc',
  'child-link': 'slashLinkPageDesc',
  'child-page': 'slashPageDesc',
  'child-database': 'slashDatabaseDesc',
};

// The markdown a person can type instead of opening the menu (the editor's input
// rules), shown at the end of the row the way DropdownMenuShortcut shows a key.
const SLASH_SHORTCUTS: Record<string, string> = {
  h1: '#',
  h2: '##',
  h3: '###',
  bullet: '-',
  ordered: '1.',
  task: '[]',
  quote: '>',
  code: '```',
  divider: '---',
};

type SlashGroup = 'basic' | 'media' | 'pages';
const GROUP_LABEL_KEYS: Record<SlashGroup, string> = {
  basic: 'slashGroupBasic',
  media: 'slashGroupMedia',
  pages: 'slashGroupPages',
};

function groupOf(id: string): SlashGroup {
  if (id.startsWith('child-')) return 'pages';
  return MEDIA_IDS.includes(id) ? 'media' : 'basic';
}

type Props = {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
};

const SlashCommandList = forwardRef<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }, Props>(
  ({ items, command }, ref) => {
    const t = useTranslations('Editor');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    useEffect(() => setSelectedIndex(0), [items]);

    // Arrow keys can move past the visible part of the (scrolling) list.
    useEffect(() => {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

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
      <div className={cn(MENU_SURFACE, 'max-h-80 w-64 overflow-y-auto overscroll-contain')}>
        {items.map((item, index) => {
          const group = groupOf(item.id);
          const startsGroup = index === 0 || groupOf(items[index - 1].id) !== group;
          const labelKey = SLASH_LABEL_KEYS[item.id];
          const descKey = SLASH_DESC_KEYS[item.id];
          const shortcut = SLASH_SHORTCUTS[item.id];
          return (
            <div key={item.id}>
              {startsGroup && <div className={MENU_LABEL}>{t(GROUP_LABEL_KEYS[group])}</div>}
              <button
                type="button"
                ref={(el) => { itemRefs.current[index] = el; }}
                onClick={() => command(item)}
                // Pointer MOVE, not enter: a list scrolled by the arrow keys slides items
                // under a resting pointer, which must not steal the keyboard highlight.
                onMouseMove={() => { if (index !== selectedIndex) setSelectedIndex(index); }}
                title={descKey ? t(descKey) : item.description}
                className={menuItem(index === selectedIndex)}
              >
                <span className={MENU_ICON}>{item.icon}</span>
                <span className="flex-1 truncate">{labelKey ? t(labelKey) : item.label}</span>
                {shortcut && <Kbd>{shortcut}</Kbd>}
              </button>
            </div>
          );
        })}
      </div>
    );
  }
);

SlashCommandList.displayName = 'SlashCommandList';
export default SlashCommandList;
