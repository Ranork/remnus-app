import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ImageBlockView from './ImageBlockView';
import { mediaStopEvent } from './mediaStopEvent';

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// Content image block. Stores src/alt in attributes and serializes as a
// <div data-img-src> HTML block — the same round-trip-safe approach as
// ChildBlock (a plain markdown ![](url) is not used so it stays consistent
// with our other media blocks and survives the marked HTML-block tokenizer).
export const ImageBlock = Node.create({
  name: 'imageBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return { workspaceId: null as string | null };
  },

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      align: { default: 'center' }, // 'left' | 'center' | 'right'
      width: { default: 100 },      // percentage: 25 | 50 | 75 | 100
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-img-src]',
        priority: 1000,
        getAttrs(el) {
          const e = el as HTMLElement;
          return {
            src: e.getAttribute('data-img-src') || null,
            alt: e.getAttribute('data-img-alt') || '',
            align: e.getAttribute('data-img-align') || 'center',
            width: Number(e.getAttribute('data-img-width') || '100') || 100,
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'div',
      {
        'data-img-src': node.attrs.src || '',
        'data-img-alt': node.attrs.alt || '',
        'data-img-align': node.attrs.align || 'center',
        'data-img-width': String(node.attrs.width || 100),
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView, { stopEvent: mediaStopEvent });
  },

  // renderMarkdown is a @tiptap/markdown extension field, not in Tiptap core types
  renderMarkdown(node: any) {
    const indent = (node.attrs?.indent as number) ?? 0;
    const indentAttr = indent ? ` data-indent="${indent}"` : '';
    return `<div data-img-src="${esc(node.attrs.src || '')}" data-img-alt="${esc(node.attrs.alt || '')}" data-img-align="${esc(node.attrs.align || 'center')}" data-img-width="${node.attrs.width || 100}"${indentAttr}></div>`;
  },
});
