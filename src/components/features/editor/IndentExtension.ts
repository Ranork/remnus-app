import { Extension } from '@tiptap/core';
import Paragraph from '@tiptap/extension-paragraph';
import { NodeSelection } from '@tiptap/pm/state';

export const MAX_INDENT = 6;

export const INDENT_ATTR = {
  default: 0,
  parseHTML: (el: HTMLElement) => {
    const v = parseInt(el.getAttribute('data-indent') ?? '0', 10);
    return isNaN(v) ? 0 : Math.min(Math.max(v, 0), MAX_INDENT);
  },
  renderHTML: (attrs: Record<string, any>) => {
    if (!attrs.indent) return {};
    // Inline style ensures the indent is visible regardless of whether the external
    // CSS rule has been compiled into the page (Turbopack hot-reload timing issue).
    return {
      'data-indent': String(attrs.indent),
      style: `padding-left: ${(attrs.indent as number) * 1.5}rem`,
    };
  },
};

// Adds the `indent` attribute to all block types (except paragraph and heading,
// which have their own addAttributes in IndentedParagraph / CollapsibleHeading).
// This covers atom blocks (imageBlock, calloutBlock, etc.) and built-in blocks
// (lists, blockquote, codeBlock) — giving them visual indentation support and
// enabling drag-to-nest via BlockDragHandle.
// Persistence note: atom blocks persist indent via their own renderMarkdown overrides.
// Built-in blocks (lists, blockquote, codeBlock) are visual-only — indent does not
// survive a markdown round-trip for those types.
export const IndentGlobal = Extension.create({
  name: 'indentGlobal',
  addGlobalAttributes() {
    return [
      {
        types: [
          'bulletList', 'orderedList', 'taskList', 'listItem', 'taskItem',
          'blockquote', 'codeBlock',
          'imageBlock', 'calloutBlock', 'bookmarkBlock', 'fileBlock', 'youtubeEmbed', 'childBlock',
        ],
        attributes: {
          indent: INDENT_ATTR,
        },
      },
    ];
  },
});

// Marker for empty paragraphs (blank lines), mirroring the stock
// @tiptap/extension-paragraph. Plain markdown collapses consecutive blank lines
// into a single block separator, so spacing paragraphs vanish on reload. Emitting
// &nbsp; for the 2nd+ empty paragraph in a consecutive run keeps them from
// collapsing; the inherited parseMarkdown turns &nbsp; back into an empty paragraph.
const EMPTY_PARAGRAPH_MARKDOWN = '&nbsp;';

// Extends the built-in paragraph node to support a numeric indent level (0–6).
// indent=0 → plain markdown paragraph (unchanged serialization)
// indent>0 → <p data-indent="N">content</p> HTML block; h.renderChildren serializes
//            the inline content as markdown text. Note: inline marks (bold, italic…)
//            inside indented HTML blocks are stored as literal markdown syntax on
//            round-trip and re-parsed as plain text — a known limitation.
export const IndentedParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      indent: INDENT_ATTR,
    };
  },

  // renderMarkdown is a @tiptap/markdown extension field, not in Tiptap core types
  renderMarkdown(node: any, h: any, ctx: any) {
    const indent = (node.attrs?.indent as number) ?? 0;
    const content = Array.isArray(node.content) ? node.content : [];

    // Empty paragraph = a blank line the user typed for spacing. Overriding the
    // base renderMarkdown for indent support dropped the stock extension's
    // blank-line preservation, so consecutive blank lines collapsed to one on
    // reload. Restore it: the first empty paragraph in a run stays '' (the natural
    // block separator), the 2nd+ emit &nbsp; so markdown doesn't merge them.
    if (content.length === 0) {
      const prevContent = Array.isArray(ctx?.previousNode?.content) ? ctx.previousNode.content : [];
      const prevIsEmptyParagraph = ctx?.previousNode?.type === 'paragraph' && prevContent.length === 0;
      const blank = prevIsEmptyParagraph ? EMPTY_PARAGRAPH_MARKDOWN : '';
      return indent ? `<p data-indent="${indent}">${blank}</p>` : blank;
    }

    const rendered = h.renderChildren(content);
    if (!indent) return rendered;
    return `<p data-indent="${indent}">${rendered}</p>`;
  },
});

// Block types that support indent via Tab/Shift-Tab in text context.
const TEXT_INDENTABLE = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote']);

// Block types that support indent when in NodeSelection (atom/block nodes).
const NODE_INDENTABLE = new Set([
  'imageBlock', 'calloutBlock', 'bookmarkBlock', 'fileBlock', 'youtubeEmbed', 'childBlock',
  'bulletList', 'orderedList', 'taskList', 'blockquote',
]);

// Keyboard shortcuts: Tab indents the current block, Shift-Tab unindents.
// Works for both text blocks (TextSelection) and atom blocks (NodeSelection).
// Gracefully skips list item contexts so the list extension's own Tab handler
// (nested list items) still works correctly.
export const IndentShortcuts = Extension.create({
  name: 'indentShortcuts',

  addKeyboardShortcuts() {
    const adjust = (editor: any, delta: 1 | -1): boolean => {
      const { state } = editor;
      const { selection } = state;
      const { $from } = selection;

      // NodeSelection: atom or block node selected directly
      if (selection instanceof NodeSelection) {
        const node = selection.node;
        if (!NODE_INDENTABLE.has(node.type.name)) return false;
        const current = (node.attrs?.indent as number) ?? 0;
        const next = current + delta;
        if (next < 0) return false;
        if (next > MAX_INDENT) return true;
        editor.view.dispatch(
          state.tr.setNodeMarkup(selection.from, undefined, { ...node.attrs, indent: next }),
        );
        return true;
      }

      // Let list extension handle Tab/Shift-Tab inside lists (nested list items)
      for (let d = $from.depth; d >= 0; d--) {
        const name = $from.node(d).type.name;
        if (name === 'bulletList' || name === 'orderedList' || name === 'taskList') {
          return false;
        }
      }

      const node = $from.node();
      const typeName = node.type.name;
      if (!TEXT_INDENTABLE.has(typeName)) return false;

      const current = (node.attrs?.indent as number) ?? 0;
      const next = current + delta;
      if (next < 0) return false;
      if (next > MAX_INDENT) return true; // consume event, already at max

      editor.chain().updateAttributes(typeName, { indent: next }).run();
      return true;
    };

    return {
      Tab: ({ editor }: any) => adjust(editor, 1),
      'Shift-Tab': ({ editor }: any) => adjust(editor, -1),
    };
  },
});
