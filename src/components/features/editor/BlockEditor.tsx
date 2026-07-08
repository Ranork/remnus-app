'use client';
import { useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useRouter } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { TableRow } from '@tiptap/extension-table-row';
import { MarkdownTable, BgTableCell, BgTableHeader } from './TableMarkdown';
import BubbleMenuBar from './BubbleMenuBar';
import BlockDragHandle, { getDragSource, getNestTarget, clearNestTarget } from './BlockDragHandle';
import TableControls from './TableControls';
import { Slice, Fragment } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { dropPoint } from '@tiptap/pm/transform';
import { joinTextblockForward } from '@tiptap/pm/commands';
import { SlashCommand } from './SlashCommandMenu';
import { ChildBlock } from './ChildBlockExtension';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import { YoutubeEmbed } from './YoutubeEmbedExtension';
import { fragmentToCleanMarkdown } from './clipboardMarkdown';

// Markdown has no native syntax for text/highlight colors, so the default
// serializer drops them (a colored run reverts on reload). These extends emit
// inline HTML carrying the color, which tiptap's own parseHTML rules
// (span[style] → textStyle, mark[data-color] → highlight) read back on parse.
//
// The color attr can originate from pasted/imported HTML (parseHTML reads the
// style/data-color attributes), so it is NOT trusted: a value like
// `red"><img src=x onerror=…>` would break out of the attribute and inject HTML.
// `safeColor` whitelists hex / rgb(a) / hsl(a) / named colors and rejects
// anything else (no quotes, angle brackets, or `;` can survive) → the wrapper is
// emitted only for a sanitized value, otherwise the run serializes uncolored.
const SAFE_COLOR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$|^(?:rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s/]+\)$|^[a-zA-Z]{1,32}$/;
function safeColor(value: unknown): string | null {
  return typeof value === 'string' && SAFE_COLOR_RE.test(value.trim()) ? value.trim() : null;
}

// Priority < 100 keeps these color marks INNERMOST during markdown
// serialization (below bold/italic/strike/code at 100). Otherwise the color
// `<span>`/`<mark>` wraps the formatting marks — e.g. `<span style="color:…">
// ~~text~~</span>` — and marked parses the whole span as one inline-HTML blob,
// so the `~~`/`**`/`*` inside it never re-tokenize and show up literally on
// reload. Innermost color emits `~~<span style="color:…">text</span>~~`
// instead, where the delimiters sit outside the HTML and round-trip cleanly.
// (TextStyle defaults to priority 101, which caused exactly this bug.)
const COLOR_MARK_PRIORITY = 99;

const ColorTextStyle = TextStyle.extend({
  priority: COLOR_MARK_PRIORITY,
  addCommands() {
    return {
      ...this.parent?.(),
      // The stock `removeEmptyTextStyle` (invoked by `unsetColor`) walks every
      // node intersecting the selection and calls
      // `tr.removeMark(pos, pos + node.nodeSize)` — using the NODE's full span,
      // not clamped to the selection. For container nodes (a `listItem`, or the
      // whole `orderedList`/`bulletList`) that span reaches far beyond the
      // selection, so "set default" on a few list items wiped the color from
      // every sibling in the list — even unselected ones. Clamp the removal to
      // the actual selection range so it only touches what the user picked.
      removeEmptyTextStyle: () => ({ tr }: any) => {
        const { from, to } = tr.selection;
        tr.doc.nodesBetween(from, to, (node: any, pos: number) => {
          if (node.isTextblock) return true;
          const hasStyle = node.marks
            .filter((m: any) => m.type === this.type)
            .some((m: any) => Object.values(m.attrs).some((v) => !!v));
          if (!hasStyle) {
            tr.removeMark(Math.max(pos, from), Math.min(pos + node.nodeSize, to), this.type);
          }
        });
        return true;
      },
    };
  },
  renderMarkdown(node: any, helpers: any) {
    const color = safeColor(node?.attrs?.color);
    const inner = helpers.renderChildren();
    return color ? `<span style="color: ${color}">${inner}</span>` : inner;
  },
});

const ColorHighlight = Highlight.extend({
  priority: COLOR_MARK_PRIORITY,
  renderMarkdown(node: any, helpers: any) {
    const color = safeColor(node?.attrs?.color);
    const inner = helpers.renderChildren();
    return color
      ? `<mark data-color="${color}" style="background-color: ${color}; color: inherit">${inner}</mark>`
      : `==${inner}==`;
  },
});
import { ImageBlock } from './ImageBlockExtension';
import { CalloutBlock } from './CalloutBlockExtension';
import { BookmarkBlock } from './BookmarkBlockExtension';
import { FileBlock } from './FileBlockExtension';
import { PageLink } from './PageLinkNode';
import { PageMention } from './PageMentionExtension';
import { EmojiSuggestion } from './EmojiExtension';
import { FencedCodeBlock } from './CodeBlockExtension';
import { CollapsibleHeading, HeadingCollapsePlugin } from './HeadingCollapseExtension';
import { IndentedParagraph, IndentShortcuts, IndentGlobal, MAX_INDENT } from './IndentExtension';
import { BlockSelection } from './BlockSelectionExtension';
import BlockSelectionToolbar from './BlockSelectionToolbar';
import type { WorkspaceItemRow } from '@/lib/actions/workspace';


export type BlockEditorHandle = {
  focusStart: () => void;
  insertLineAtStart: () => void;
};

type Props = {
  initialContent: string;
  onChange: (markdown: string) => void;
  onImmediateSave?: (markdown: string) => void;
  placeholder?: string;
  workspaceId?: string;
  parentId?: string;
  initialSubItems?: WorkspaceItemRow[];
  shareMap?: Record<string, string> | null;
  editable?: boolean;
};

// Block-level markdown patterns that HTML clipboard cannot reliably represent.
const BLOCK_MARKDOWN_RE = /^#{1,6} |^[-*+] |^\d+\. |^> |^```|^\|/m;

// Upload a dropped/pasted image and insert it as an imageBlock at `pos`
// (or the current selection when pos is omitted).
async function uploadAndInsertImage(editor: any, file: File, workspaceId: string | null, pos?: number) {
  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', 'image');
    if (workspaceId) fd.append('workspaceId', workspaceId);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) return;
    const { url } = await res.json();
    const attrs = { src: url, alt: file.name.replace(/\.[^.]+$/, '') };
    if (typeof pos === 'number') {
      editor.chain().insertContentAt(pos, { type: 'imageBlock', attrs }).run();
    } else {
      editor.chain().focus().insertContent({ type: 'imageBlock', attrs }).run();
    }
  } catch {
    /* best-effort */
  }
}

function buildInitialContent(markdown: string, subItems: WorkspaceItemRow[]): string {
  if (!subItems.length) return markdown;

  // Find which item IDs are already serialized in the markdown
  const inMarkdown = new Set<string>();
  const idRe = /data-cb-id="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = idRe.exec(markdown)) !== null) inMarkdown.add(m[1]);

  const missing = subItems.filter(i => !inMarkdown.has(i.id));
  if (!missing.length) return markdown;

  // Prepend any items that weren't saved yet (e.g. debounce didn't fire before navigation)
  const blocks = missing
    .map(item => {
      const safeTitle = (item.title || '').replace(/"/g, '&quot;');
      return `<div data-cb-id="${item.id}" data-cb-dbid="${item.databaseId || ''}" data-cb-type="${item.type}" data-cb-title="${safeTitle}" data-cb-icon="${item.icon || ''}" data-cb-iconcolor="${item.iconColor || ''}"></div>`;
    })
    .join('\n\n');

  return blocks + (markdown ? '\n\n' + markdown : '');
}

const BlockEditor = forwardRef<BlockEditorHandle, Props>(function BlockEditor({
  initialContent,
  onChange,
  onImmediateSave,
  placeholder,
  workspaceId,
  parentId,
  initialSubItems,
  shareMap,
  editable = true,
}, ref) {
  const editorRef = useRef<any>(null);
  const router = useRouter();

  useImperativeHandle(ref, () => ({
    focusStart: () => {
      editorRef.current?.chain().focus('start').run();
    },
    insertLineAtStart: () => {
      const editor = editorRef.current;
      if (!editor) return;
      const { state, view } = editor;
      const para = state.schema.nodes.paragraph.create();
      const tr = state.tr.insert(0, para);
      view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(1))));
      view.focus();
    },
  }), []);

  // Kept in a ref so the (closure-captured) editorProps click handler always
  // reaches the latest onImmediateSave without recreating the editor.
  const onImmediateSaveRef = useRef(onImmediateSave);
  useEffect(() => {
    onImmediateSaveRef.current = onImmediateSave;
  }, [onImmediateSave]);

  const computedInitial = useMemo(
    () => buildInitialContent(initialContent, initialSubItems ?? []),
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        dropcursor: false,
        heading: false,
        // Replaced by IndentedParagraph below which adds indent attribute support.
        paragraph: false,
        // Replaced with FencedCodeBlock (below) which sizes the markdown fence
        // to be longer than any ``` run inside the code body, so code blocks
        // containing backtick fences survive the markdown round-trip.
        codeBlock: false,
        // Typed/pasted URLs auto-link and become clickable. We drive navigation
        // ourselves (openOnClick: false) so internal page links use the SPA
        // router instead of a full page load.
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          defaultProtocol: 'https',
          HTMLAttributes: {
            rel: 'noopener noreferrer nofollow',
          },
        },
      }),
      IndentedParagraph,
      IndentGlobal,
      IndentShortcuts,
      CollapsibleHeading,
      HeadingCollapsePlugin.configure({
        pageId: parentId ?? null,
      }),
      Markdown,
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') return 'Heading...';
          return placeholder ?? "Type '/' for commands or start writing...";
        },
        showOnlyCurrent: true,
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      MarkdownTable.configure({ resizable: true, lastColumnResizable: false }),
      TableRow,
      BgTableCell,
      BgTableHeader,
      ChildBlock.configure({
        workspaceId: workspaceId ?? null,
        parentId: parentId ?? null,
        onImmediateSave: onImmediateSave ?? null,
        shareMap: shareMap ?? null,
      }),
      SlashCommand.configure({
        workspaceId: workspaceId ?? null,
        parentId: parentId ?? null,
      }),
      YoutubeEmbed,
      ImageBlock.configure({ workspaceId: workspaceId ?? null }),
      CalloutBlock,
      BookmarkBlock,
      FileBlock.configure({ workspaceId: workspaceId ?? null }),
      PageLink,
      PageMention,
      EmojiSuggestion,
      FencedCodeBlock,
      ColorTextStyle,
      Color,
      ColorHighlight.configure({ multicolor: true }),
      BlockSelection,
    ],
    content: computedInitial,
    contentType: 'markdown',
    onUpdate: ({ editor }) => {
      const md = (editor as any).getMarkdown();
      onChange(md);
    },
    editorProps: {
      attributes: {
        class: 'prose-editor focus:outline-none min-h-[500px]',
        spellcheck: 'false',
      },
      // Selecting all the text of a SINGLE table cell (triple-click, or a drag
      // that grazes the cell border) yields a single-cell CellSelection whose
      // copied slice is still wrapped in table→row→cell. That wrapper makes the
      // clipboard carry a whole `<table>` (text/html) and `| … |` GFM syntax
      // (text/plain) — so pasting anywhere reproduces a table instead of the
      // plain cell text. `transformCopied` runs BEFORE both the html and text
      // serializers, so unwrapping the slice to just the cell's own content here
      // fixes EVERY clipboard format at once. A multi-cell / whole-row / whole-
      // table copy has >1 cell (or a `table` at the top) and is left untouched.
      transformCopied: (slice) => {
        const content = slice.content;
        if (content.childCount !== 1) return slice;
        const row = content.firstChild;
        if (!row || row.type.spec.tableRole !== 'row' || row.childCount !== 1) return slice;
        const cell = row.firstChild;
        const role = cell?.type.spec.tableRole;
        if (!cell || (role !== 'cell' && role !== 'header_cell')) return slice;
        if (cell.content.size === 0) return Slice.empty;
        // Keep the cell's block content, opened one level so a single-paragraph
        // cell pastes inline (matching a normal in-paragraph text copy).
        return new Slice(cell.content, 1, 1);
      },
      // Copy/cut a native text selection as clean markdown (not the storage HTML
      // for atom blocks, and with no doubled blank lines) — so a callout pastes
      // as a blockquote and consecutive paragraphs paste tightly. The marquee
      // block selection goes through serializeBlockSelectionMarkdown, which uses
      // the same cleaner, so both copy paths produce identical output. The slice
      // reaching here is already unwrapped by transformCopied for single-cell
      // table copies, so cell text serializes as plain text, not a `| … |` row.
      clipboardTextSerializer: (slice) => {
        const ed = editorRef.current;
        if (!ed) return slice.content.textBetween(0, slice.content.size, '\n\n', '\n');
        return fragmentToCleanMarkdown(ed, slice.content);
      },
      handleClick: (_view, _pos, event) => {
        const anchor = (event.target as HTMLElement | null)?.closest('a');
        const href = anchor?.getAttribute('href');
        if (!href) return false;

        event.preventDefault();
        // Internal page/database links → SPA navigation (save first so edits
        // persist on return). External links → open in a new tab.
        // Guard against protocol-relative ("//evil.com") and backslash tricks
        // ("/\\evil.com") which start with "/" but resolve off-origin.
        const isInternal = href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/\\');
        if (isInternal) {
          const md = editorRef.current?.getMarkdown?.();
          const save = onImmediateSaveRef.current;
          const go = () => router.push(href);
          if (md && typeof save === 'function') {
            Promise.resolve(save(md)).catch(() => {}).finally(go);
          } else {
            go();
          }
        } else {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
        return true;
      },
      // Clicking on a list item's marker (the "2." number/bullet) lands on the
      // <li> element since ::marker pseudo-elements don't receive pointer events.
      // ProseMirror's posAtCoords may then return a position outside the paragraph
      // inside the list item, so the cursor ends up outside. This is especially
      // visible on empty list items (no text to click on). Intercept direct clicks
      // on listItem nodes and force the cursor into the first paragraph.
      handleClickOn: (view, _pos, node, nodePos, _event, direct) => {
        if (!direct || node.type.name !== 'listItem') return false;
        try {
          // nodePos+1 = inside listItem; nodePos+2 = inside its first paragraph.
          const $inside = view.state.doc.resolve(nodePos + 2);
          view.dispatch(view.state.tr.setSelection(TextSelection.near($inside)));
          view.focus();
          return true;
        } catch {
          return false;
        }
      },
      handleKeyDown: (view, event) => {
        // Delete at the end of a textblock should merge with the next textblock even
        // when the next block is a different node type (e.g. paragraph → listItem inside
        // a bulletList). ProseMirror's base keymap only binds `joinForward` for Delete,
        // which requires the two nodes at the boundary to be the same type — so pressing
        // Delete at end of a paragraph above a bullet list does nothing (it falls through
        // to `selectNodeForward` which just selects the list). `joinTextblockForward`
        // descends into the next container and finds the first textblock, enabling the
        // "Delete at end of parent → child merges up" behaviour the user expects.
        if (event.key === 'Delete') {
          const { state } = view;
          const { empty, $from } = state.selection;
          if (empty && $from.parentOffset === $from.parent.content.size) {
            return joinTextblockForward(state, view.dispatch, view) ?? false;
          }
          return false;
        }

        if (event.key !== 'Backspace') return false;
        const { state } = view;
        const { selection } = state;
        const { $from, empty } = selection;

        if (!empty || $from.parentOffset !== 0) return false;
        if ($from.parent.type.name !== 'paragraph' || $from.parent.content.size !== 0) return false;

        const pos = $from.before($from.depth);
        if (pos === 0) return false;
        const nodeBefore = state.doc.resolve(pos).nodeBefore;
        if (!nodeBefore || nodeBefore.type.name !== 'horizontalRule') return false;

        const hrFrom = pos - nodeBefore.nodeSize;
        view.dispatch(state.tr.delete(hrFrom, pos));
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        // Image file drops
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []);
        const images = files.filter(f => f.type.startsWith('image/'));
        if (images.length) {
          event.preventDefault();
          const coords = { left: (event as DragEvent).clientX, top: (event as DragEvent).clientY };
          const pos = view.posAtCoords(coords)?.pos ?? view.state.selection.from;
          const ed = editorRef.current;
          if (ed) images.forEach(img => uploadAndInsertImage(ed, img, workspaceId ?? null, pos));
          return true;
        }

        // Nest-inside drop: block was dragged into the middle zone of another block.
        if (moved) {
          const nestTgt = getNestTarget();
          if (nestTgt) {
            clearNestTarget();
            const dragSrc = getDragSource();
            if (dragSrc) {
              const { pos: srcPos, node: srcNode } = dragSrc;
              // Re-read target node from current state (doc may have changed)
              const tgtNode = view.state.doc.nodeAt(nestTgt.pos);
              if (tgtNode && srcPos !== nestTgt.pos) {
                const tgtIndent = (tgtNode.attrs?.indent as number) ?? 0;
                const newIndent = Math.min(tgtIndent + 1, MAX_INDENT);

                // Build moved node with increased indent
                const newNode = srcNode.type.create(
                  { ...srcNode.attrs, indent: newIndent },
                  srcNode.content,
                  srcNode.marks,
                );

                const insertPos = nestTgt.pos + tgtNode.nodeSize;
                const tr = view.state.tr;

                if (srcPos < insertPos) {
                  // Source is before insert point → delete src first, then insert
                  tr.delete(srcPos, srcPos + srcNode.nodeSize);
                  tr.insert(insertPos - srcNode.nodeSize, newNode);
                } else {
                  // Source is after insert point → insert first, then delete shifted src
                  tr.insert(insertPos, newNode);
                  tr.delete(srcPos + newNode.nodeSize, srcPos + newNode.nodeSize + srcNode.nodeSize);
                }

                view.dispatch(tr.scrollIntoView());
                event.preventDefault();
                return true;
              }
            }
            clearNestTarget();
            return false;
          }
        }

        // Custom drop handling for blocks dragged from our handle.
        if (moved) {
          const dragSrc = getDragSource();
          if (dragSrc) {
            const rawDropPos = view.posAtCoords({
              left: (event as DragEvent).clientX,
              top: (event as DragEvent).clientY,
            })?.pos;
            if (rawDropPos != null) {
              const $drop = view.state.doc.resolve(rawDropPos);
              let inList = false;
              for (let d = 0; d <= $drop.depth; d++) {
                const n = $drop.node(d);
                if (n.type.name === 'bulletList' || n.type.name === 'orderedList' || n.type.name === 'taskList') {
                  inList = true;
                  break;
                }
              }

              const { pos: srcPos, node: srcNode } = dragSrc;
              const isListItemSrc = srcNode.type.name === 'listItem' || srcNode.type.name === 'taskItem';

              if (!inList && isListItemSrc) {
                // Un-nest: listItem dropped outside any list → extract paragraph content
                // as plain blocks instead of letting ProseMirror re-wrap in a new list.
                const content = srcNode.content;
                const srcSize = srcNode.nodeSize;
                const validInsertPos = dropPoint(view.state.doc, rawDropPos, new Slice(content, 0, 0));
                if (validInsertPos != null) {
                  let tr = view.state.tr;
                  if (validInsertPos <= srcPos) {
                    tr = tr.insert(validInsertPos, content);
                    tr = tr.delete(srcPos + content.size, srcPos + content.size + srcSize);
                  } else {
                    tr = tr.delete(srcPos, srcPos + srcSize);
                    tr = tr.insert(validInsertPos - srcSize, content);
                  }
                  view.dispatch(tr);
                  return true;
                }
              }

              if (inList && !isListItemSrc) {
                // Non-listItem block (page block, image, etc.) dropped into a list.
                // HTML atom blocks inside list items break the markdown round-trip
                // (the serialized <div> isn't re-parsed correctly inside a list),
                // which causes an infinite serialize→parse loop and freezes the editor.
                // Redirect the drop to just after the OUTERMOST containing list (d=1,
                // a direct doc child) so the block lands at root level.
                // Iterating d=1→depth ensures we find the outermost list first — going
                // innermost-first placed the block inside a listItem's block* slot, which
                // is still inside the list and still breaks markdown round-trip.
                let afterListPos = $drop.after(1); // depth-1 node is always a doc child
                // Verify the result is truly outside any list (double-safety).
                try {
                  const $after = view.state.doc.resolve(afterListPos);
                  for (let d = 0; d <= $after.depth; d++) {
                    const n = $after.node(d);
                    if (n.type.name === 'bulletList' || n.type.name === 'orderedList' || n.type.name === 'taskList') {
                      // Still inside a list — jump to after the depth-1 ancestor of this list
                      afterListPos = $after.after(1);
                      break;
                    }
                  }
                } catch { /* position already valid */ }

                const nodeFrag = Fragment.from(srcNode);
                const validInsertPos = dropPoint(view.state.doc, afterListPos, new Slice(nodeFrag, 0, 0));
                const insertAt = validInsertPos ?? afterListPos;

                // Verify insertAt is not inside any list before dispatching
                let insertInList = false;
                try {
                  const $ins = view.state.doc.resolve(insertAt);
                  for (let d = 0; d <= $ins.depth; d++) {
                    const n = $ins.node(d);
                    if (n.type.name === 'bulletList' || n.type.name === 'orderedList' || n.type.name === 'taskList') {
                      insertInList = true; break;
                    }
                  }
                } catch { insertInList = true; }

                if (insertInList) {
                  // Still no safe position found — silently cancel
                  event.preventDefault();
                  return true;
                }

                let tr = view.state.tr;
                if (insertAt <= srcPos) {
                  tr = tr.insert(insertAt, nodeFrag);
                  tr = tr.delete(srcPos + nodeFrag.size, srcPos + nodeFrag.size + srcNode.nodeSize);
                } else {
                  tr = tr.delete(srcPos, srcPos + srcNode.nodeSize);
                  tr = tr.insert(insertAt - srcNode.nodeSize, nodeFrag);
                }
                view.dispatch(tr);
                return true;
              }
            }
          }
        }

        return false;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        const images = files.filter(f => f.type.startsWith('image/'));
        if (images.length) {
          const ed = editorRef.current;
          if (ed) images.forEach(img => uploadAndInsertImage(ed, img, workspaceId ?? null));
          return true;
        }

        const text = event.clipboardData?.getData('text/plain');
        if (!text || !BLOCK_MARKDOWN_RE.test(text)) return false;

        const ed = editorRef.current;
        if (!ed) return false;

        try {
          const manager: any = (ed as any).markdown;
          if (!manager?.parse) return false;

          const doc = manager.parse(text);
          if (!doc?.content?.length) return false;

          const LIST_TYPES_SET = new Set(['bulletList', 'orderedList', 'taskList']);
          const LIST_ITEM_TYPES_SET = new Set(['listItem', 'taskItem']);

          // Count total list items and whether there is non-list content mixed in.
          let totalListItems = 0;
          let hasNonList = false;
          for (const item of doc.content) {
            if (LIST_TYPES_SET.has(item.type)) totalListItems += (item.content ?? []).length;
            else hasNonList = true;
          }

          if (totalListItems > 0) {
            if (totalListItems === 1 && !hasNonList) {
              // Single bullet → paste as plain text (unwrap the list wrapper).
              const innerContent = doc.content[0]?.content?.[0]?.content ?? [];
              if (innerContent.length) {
                ed.commands.insertContent(innerContent);
                return true;
              }
            } else {
              // Multiple list items and cursor is inside a list item:
              // split the current item at the cursor and insert the pasted items
              // between the two halves — the natural "insert at cursor" semantics.
              //
              //   cursor at item end   → pasted items become next siblings (most common)
              //   cursor at item start → pasted items inserted before item's content
              //   cursor in middle     → item splits; pasted items fill the gap
              //   cursor in empty item → empty slot replaced; no phantom bullet left
              const { $from } = _view.state.selection;
              let listItemDepth = -1;
              for (let d = $from.depth; d >= 0; d--) {
                if (LIST_ITEM_TYPES_SET.has($from.node(d).type.name)) {
                  listItemDepth = d;
                  break;
                }
              }

              if (listItemDepth >= 0) {
                const { schema } = _view.state;
                const siblings: any[] = [];
                for (const item of doc.content) {
                  if (LIST_TYPES_SET.has(item.type)) {
                    for (const li of (item.content ?? [])) siblings.push(li);
                  } else {
                    siblings.push({ type: 'listItem', content: [item] });
                  }
                }

                if (siblings.length) {
                  const siblingNodes = siblings.map((s: any) => schema.nodeFromJSON(s));
                  const listItemNode = $from.node(listItemDepth);
                  const itemStart = $from.before(listItemDepth);
                  const itemEnd = $from.after(listItemDepth);

                  const isEmptyItem =
                    listItemNode.childCount === 1 &&
                    listItemNode.firstChild?.type.name === 'paragraph' &&
                    listItemNode.firstChild?.content.size === 0;
                  const hasSinglePara =
                    listItemNode.childCount === 1 &&
                    listItemNode.firstChild?.type.name === 'paragraph';

                  let newNodes: ReturnType<typeof schema.nodeFromJSON>[];

                  if (isEmptyItem) {
                    // Empty slot — replace entirely; pasted items fill its position.
                    newNodes = siblingNodes;
                  } else if (hasSinglePara) {
                    // Split at cursor; rebuild the item from the two halves.
                    const cursorOffset = $from.parentOffset;
                    const paraContent = $from.parent.content;
                    const beforeContent = paraContent.cut(0, cursorOffset);
                    const afterContent = paraContent.cut(cursorOffset);
                    const paraType = schema.nodes.paragraph;
                    const listItemType = listItemNode.type;
                    newNodes = [];
                    if (beforeContent.size > 0) {
                      newNodes.push(listItemType.create(
                        listItemNode.attrs,
                        paraType.create($from.parent.attrs, beforeContent),
                        listItemNode.marks,
                      ));
                    }
                    newNodes.push(...siblingNodes);
                    if (afterContent.size > 0) {
                      newNodes.push(listItemType.create(
                        listItemNode.attrs,
                        paraType.create($from.parent.attrs, afterContent),
                        listItemNode.marks,
                      ));
                    }
                  } else {
                    // Complex item (nested lists / multiple children) → insert after.
                    _view.dispatch(
                      _view.state.tr.insert(
                        $from.after(listItemDepth),
                        Fragment.fromArray(siblingNodes),
                      ),
                    );
                    return true;
                  }

                  _view.dispatch(
                    _view.state.tr.replaceWith(itemStart, itemEnd, Fragment.fromArray(newNodes)),
                  );
                  return true;
                }
              }
            }
          }

          ed.commands.insertContent(doc.content);
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

  // Heal a schema-invalid initial document. @tiptap/markdown can parse certain
  // HTML-bearing / Notion-imported markdown into structurally invalid nodes — a
  // stray top-level text node, a paragraph nested inside a paragraph, or an empty
  // listItem. ProseMirror builds the doc anyway (fromJSON doesn't validate), then
  // the editor hard-crashes on the very next transaction: TrailingNode's
  // appendTransaction calls contentMatchAt on the invalid doc and throws
  // "Called contentMatchAt on a node with invalid content", which made every
  // interaction (even starting a marquee selection) blow up.
  //
  // Fix: round-trip the doc through HTML. ProseMirror's DOMParser enforces the
  // schema (auto-wraps stray inline content, drops illegal nesting), producing a
  // valid doc. Only runs when actually invalid (no-op otherwise) and does NOT
  // emit an update — it heals in memory; a later real edit re-saves clean markdown.
  useEffect(() => {
    if (!editor) return;
    const doc = editor.state.doc;
    let invalid = !doc.type.validContent(doc.content);
    if (!invalid) {
      doc.descendants((node) => {
        if (invalid) return false;
        if (!node.type.validContent(node.content)) { invalid = true; return false; }
        return true;
      });
    }
    if (!invalid) return;
    try {
      editor.commands.setContent(editor.getHTML(), { contentType: 'html', emitUpdate: false });
      if (process.env.NODE_ENV !== 'production') {
         
        console.warn('[BlockEditor] normalized a schema-invalid parsed document via HTML round-trip');
      }
    } catch (e) {
       
      console.error('[BlockEditor] failed to normalize invalid document:', e);
    }
  }, [editor]);

  // Sync child block title/icon/iconColor from initialSubItems.
  // The markdown stores these attrs at save time; if a sub-page was renamed
  // after the last save the stale values would show. This patches the editor
  // state on mount (and whenever initialSubItems changes) so the display is
  // always up-to-date. The resulting onChange will re-persist the fresh values.
  useEffect(() => {
    if (!editor || !initialSubItems?.length) return;
    const map = new Map(initialSubItems.map(i => [i.id, i]));

    // Collect changes first so we can apply them in reverse-position order.
    // Applying high→low ensures each setNodeMarkup doesn't shift positions
    // that haven't been processed yet (safe even for non-atom nodes).
    const changes: Array<{ pos: number; attrs: Record<string, unknown> }> = [];

    editor.view.state.doc.descendants((node: any, pos: number) => {
      if (node.type.name !== 'childBlock') return;
      const item = map.get(node.attrs.itemId);
      if (!item) return;
      const next = {
        ...node.attrs,
        title: item.title || node.attrs.title,
        icon: item.icon ?? null,
        iconColor: item.iconColor ?? null,
      };
      if (next.title !== node.attrs.title || next.icon !== node.attrs.icon || next.iconColor !== node.attrs.iconColor) {
        changes.push({ pos, attrs: next });
      }
    });

    if (changes.length === 0) return;

    try {
      const state = editor.view.state;
      const tr = state.tr;
      // Descending order: later positions processed first so earlier ones stay valid.
      for (const { pos, attrs } of changes.sort((a, b) => b.pos - a.pos)) {
        const mappedPos = tr.mapping.map(pos);
        if (mappedPos >= 0 && mappedPos < tr.doc.content.size) {
          tr.setNodeMarkup(mappedPos, undefined, attrs);
        }
      }
      editor.view.dispatch(tr);
    } catch {
      // Position became stale (e.g. concurrent edit) — skip; values update on next save.
    }
  }, [editor, initialSubItems]);

  if (!editor) return null;

  return (
    <div className="relative">
      <BubbleMenuBar editor={editor} />
      {editable && <BlockDragHandle editor={editor} />}
      {editable && <BlockSelectionToolbar editor={editor} />}
      {editable && <TableControls editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
});

export default BlockEditor;
