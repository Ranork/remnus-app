import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import YoutubeEmbedView from './YoutubeEmbedView';
import { mediaStopEvent } from './mediaStopEvent';

// Extracts the 11-char video id from any common YouTube URL form
// (watch?v=, youtu.be/, /embed/, /shorts/) or accepts a bare id.
export function extractYouTubeId(input: string): string | null {
  if (!input) return null;
  const url = input.trim();
  const patterns = [
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  if (/^[\w-]{11}$/.test(url)) return url;
  return null;
}

export const YoutubeEmbed = Node.create({
  name: 'youtubeEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      videoId: { default: null },
    };
  },

  // @tiptap/markdown v3: DOM parseHTML — used by generateJSON inside parseHTMLToken
  parseHTML() {
    return [
      {
        tag: 'div[data-yt-id]',
        priority: 1000,
        getAttrs(el) {
          const e = el as HTMLElement;
          return { videoId: e.getAttribute('data-yt-id') || null };
        },
      },
    ];
  },

  renderHTML({ node }) {
    return ['div', { 'data-yt-id': node.attrs.videoId || '' }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(YoutubeEmbedView, { stopEvent: mediaStopEvent });
  },

  // @tiptap/markdown v3 serializer — outputs a <div data-yt-id> block; "div" is in
  // marked's known block-HTML tag list, so it round-trips via parseHTMLToken +
  // our parseHTML rule above (same approach as ChildBlock).
  // renderMarkdown is a @tiptap/markdown extension field, not in Tiptap core types
  renderMarkdown(node: any) {
    const indent = (node.attrs?.indent as number) ?? 0;
    const indentAttr = indent ? ` data-indent="${indent}"` : '';
    return `<div data-yt-id="${node.attrs.videoId || ''}"${indentAttr}></div>`;
  },
});
