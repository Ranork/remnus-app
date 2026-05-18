'use client';
import { useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import Placeholder from '@tiptap/extension-placeholder';
import BubbleMenuBar from './BubbleMenuBar';
import { SlashCommand } from './SlashCommandMenu';

function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

type Props = {
  initialContent: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
};

// Block-level markdown patterns that HTML clipboard cannot reliably represent.
const BLOCK_MARKDOWN_RE = /^#{1,6} |^[-*+] |^\d+\. |^> |^```/m;

export default function BlockEditor({ initialContent, onChange, placeholder }: Props) {
  const editorRef = useRef<any>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Markdown.configure({ transformPastedText: true }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') return 'Heading...';
          return placeholder ?? "Type '/' for commands or start writing...";
        },
        showOnlyCurrent: false,
      }),
      SlashCommand,
    ],
    content: initialContent,
    contentType: 'markdown',
    onUpdate: ({ editor }) => {
      const md = (editor as any).getMarkdown();
      onChange(md);
    },
    editorProps: {
      attributes: {
        class: 'prose-editor focus:outline-none min-h-[500px]',
      },
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData('text/plain');
        if (!text || !BLOCK_MARKDOWN_RE.test(text)) return false;

        const ed = editorRef.current;
        if (!ed) return false;

        try {
          // @tiptap/markdown v3 exposes the manager on editor.markdown
          const manager: any = (ed as any).markdown ?? ed.storage?.manager;
          if (!manager) return false;

          // parse() returns { type: 'doc', content: JSONContent[] }
          const json = manager.parse(text);
          if (!json?.content?.length) return false;

          ed.commands.insertContent(json.content);
          return true;
        } catch {
          return false;
        }
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="relative">
      <BubbleMenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
