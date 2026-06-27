import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import BookmarkBlockView from './BookmarkBlockView';
import { mediaStopEvent } from './mediaStopEvent';

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/\r?\n/g, ' ');
}

// Attributes can arrive from raw/synced markdown — only keep http(s) URLs so a
// javascript:/data: scheme can never reach an href/src sink.
function httpOnly(u: string | null): string {
  return /^https?:\/\//i.test(u || '') ? (u as string) : '';
}

// Link-preview / bookmark card. Open Graph metadata is fetched once (via
// /api/og) and frozen into attributes so the card renders offline and the
// content round-trips as a single-line <div data-bm-url> HTML block.
export const BookmarkBlock = Node.create({
  name: 'bookmarkBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url: { default: null },
      title: { default: '' },
      description: { default: '' },
      image: { default: '' },
      favicon: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-bm-url]',
        priority: 1000,
        getAttrs(el) {
          const e = el as HTMLElement;
          return {
            url: httpOnly(e.getAttribute('data-bm-url')) || null,
            title: e.getAttribute('data-bm-title') || '',
            description: e.getAttribute('data-bm-desc') || '',
            image: httpOnly(e.getAttribute('data-bm-image')),
            favicon: httpOnly(e.getAttribute('data-bm-favicon')),
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'div',
      {
        'data-bm-url': node.attrs.url || '',
        'data-bm-title': node.attrs.title || '',
        'data-bm-desc': node.attrs.description || '',
        'data-bm-image': node.attrs.image || '',
        'data-bm-favicon': node.attrs.favicon || '',
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BookmarkBlockView, { stopEvent: mediaStopEvent });
  },

  // renderMarkdown is a @tiptap/markdown extension field, not in Tiptap core types
  renderMarkdown(node: any) {
    const a = node.attrs;
    const indent = (a?.indent as number) ?? 0;
    const indentAttr = indent ? ` data-indent="${indent}"` : '';
    return `<div data-bm-url="${esc(a.url || '')}" data-bm-title="${esc(a.title || '')}" data-bm-desc="${esc(a.description || '')}" data-bm-image="${esc(a.image || '')}" data-bm-favicon="${esc(a.favicon || '')}"${indentAttr}></div>`;
  },
});
