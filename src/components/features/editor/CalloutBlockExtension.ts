import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import CalloutBlockView from './CalloutBlockView';
import { mediaStopEvent } from './mediaStopEvent';

// Encode for an HTML attribute value that must survive markdown round-trip.
// Newlines become &#10; so the whole block stays on one line (a blank line
// inside a <div> HTML block would split it for marked's tokenizer).
function escAttr(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/\r?\n/g, '&#10;');
}

export const CALLOUT_COLORS = ['default', 'blue', 'green', 'amber', 'red'] as const;

// Callout / highlight box: an icon (emoji), a theme color and a plain-text body.
// Kept as an atom (body stored in an attribute) so it round-trips reliably as a
// single-line <div data-callout-*> HTML block, consistent with our other blocks.
export const CalloutBlock = Node.create({
  name: 'calloutBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      icon: { default: '💡' },
      color: { default: 'blue' },
      text: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-callout-color]',
        priority: 1000,
        getAttrs(el) {
          const e = el as HTMLElement;
          return {
            icon: e.getAttribute('data-callout-icon') || '💡',
            color: e.getAttribute('data-callout-color') || 'blue',
            text: e.getAttribute('data-callout-text') || '',
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'div',
      {
        'data-callout-icon': node.attrs.icon || '💡',
        'data-callout-color': node.attrs.color || 'blue',
        'data-callout-text': node.attrs.text || '',
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutBlockView, { stopEvent: mediaStopEvent });
  },

  // renderMarkdown is a @tiptap/markdown extension field, not in Tiptap core types
  renderMarkdown(node: any) {
    const indent = (node.attrs?.indent as number) ?? 0;
    const indentAttr = indent ? ` data-indent="${indent}"` : '';
    return `<div data-callout-icon="${escAttr(node.attrs.icon || '💡')}" data-callout-color="${escAttr(node.attrs.color || 'blue')}" data-callout-text="${escAttr(node.attrs.text || '')}"${indentAttr}></div>`;
  },
});
