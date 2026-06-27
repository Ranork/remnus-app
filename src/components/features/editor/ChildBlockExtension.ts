import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ChildBlockView from './ChildBlockView';

export const ChildBlock = Node.create({
  name: 'childBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return {
      workspaceId: null as string | null,
      parentId: null as string | null,
      onImmediateSave: null as ((md: string) => Promise<void>) | null,
      // pageId → slug map injected on public share pages so child blocks link to /share/[slug]
      shareMap: null as Record<string, string> | null,
    };
  },

  addAttributes() {
    return {
      itemId: { default: null },
      databaseId: { default: null },
      title: { default: 'Untitled' },
      itemType: { default: 'page' },
      icon: { default: null },
      iconColor: { default: null },
      // true = a reference/link to an existing page (deleting the block must NOT
      // delete the target). false/absent = an embedded sub-item owned by this page.
      linkOnly: { default: false },
    };
  },

  // @tiptap/markdown v3: DOM parseHTML — used by generateJSON inside parseHTMLToken
  parseHTML() {
    return [
      {
        tag: 'div[data-cb-id]',
        priority: 1000,
        getAttrs(el) {
          const e = el as HTMLElement;
          return {
            itemId: e.getAttribute('data-cb-id'),
            databaseId: e.getAttribute('data-cb-dbid') || null,
            itemType: e.getAttribute('data-cb-type') || 'page',
            title: e.getAttribute('data-cb-title') || 'Untitled',
            icon: e.getAttribute('data-cb-icon') || null,
            iconColor: e.getAttribute('data-cb-iconcolor') || null,
            linkOnly: e.getAttribute('data-cb-link') === '1',
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'div',
      {
        'data-cb-id': node.attrs.itemId,
        'data-cb-dbid': node.attrs.databaseId || '',
        'data-cb-type': node.attrs.itemType,
        'data-cb-title': node.attrs.title,
        'data-cb-icon': node.attrs.icon || '',
        'data-cb-iconcolor': node.attrs.iconColor || '',
        'data-cb-link': node.attrs.linkOnly ? '1' : '',
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChildBlockView);
  },

  // @tiptap/markdown v3 serializer — read via getExtensionField(ext, "renderMarkdown")
  // Outputs a <div data-cb-id> block; "div" is in marked's known block-HTML tag list
  // so marked tokenizes it as an HTML block, and parseHTMLToken re-parses it via
  // generateJSON + our parseHTML rule above.
  // renderMarkdown is a @tiptap/markdown extension field, not in Tiptap core types
  renderMarkdown(node: any) {
    const { itemId, databaseId, itemType, title, icon, iconColor, linkOnly, indent } = node.attrs;
    const safeTitle = (title || '').replace(/"/g, '&quot;');
    const indentAttr = indent ? ` data-indent="${indent}"` : '';
    return `<div data-cb-id="${itemId}" data-cb-dbid="${databaseId || ''}" data-cb-type="${itemType}" data-cb-title="${safeTitle}" data-cb-icon="${icon || ''}" data-cb-iconcolor="${iconColor || ''}" data-cb-link="${linkOnly ? '1' : ''}"${indentAttr}></div>`;
  },
});
