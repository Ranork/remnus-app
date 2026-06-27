import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import FileBlockView from './FileBlockView';
import { mediaStopEvent } from './mediaStopEvent';

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/\r?\n/g, ' ');
}

// Downloadable file attachment. url/name/size stored in attributes and
// serialized as a single-line <div data-file-url> HTML block (round-trip-safe).
export const FileBlock = Node.create({
  name: 'fileBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return { workspaceId: null as string | null };
  },

  addAttributes() {
    return {
      url: { default: null },
      name: { default: '' },
      size: { default: 0 },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-file-url]',
        priority: 1000,
        getAttrs(el) {
          const e = el as HTMLElement;
          const u = e.getAttribute('data-file-url');
          return {
            // Only http(s) — a javascript:/data: scheme must never reach the href sink.
            url: /^https?:\/\//i.test(u || '') ? u : null,
            name: e.getAttribute('data-file-name') || '',
            size: Number(e.getAttribute('data-file-size')) || 0,
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'div',
      {
        'data-file-url': node.attrs.url || '',
        'data-file-name': node.attrs.name || '',
        'data-file-size': String(node.attrs.size || 0),
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileBlockView, { stopEvent: mediaStopEvent });
  },

  // renderMarkdown is a @tiptap/markdown extension field, not in Tiptap core types
  renderMarkdown(node: any) {
    const a = node.attrs;
    const indent = (a?.indent as number) ?? 0;
    const indentAttr = indent ? ` data-indent="${indent}"` : '';
    return `<div data-file-url="${esc(a.url || '')}" data-file-name="${esc(a.name || '')}" data-file-size="${a.size || 0}"${indentAttr}></div>`;
  },
});
