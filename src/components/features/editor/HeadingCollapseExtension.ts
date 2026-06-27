import Heading from '@tiptap/extension-heading';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { ReactNodeViewRenderer } from '@tiptap/react';
import HeadingView from './HeadingView';
import { MAX_INDENT } from './IndentExtension';

export const headingCollapseKey = new PluginKey<{
  collapsed: Set<number>;
  decorations: DecorationSet;
}>('headingCollapse');

function buildDecorations(doc: PMNode, collapsed: Set<number>): DecorationSet {
  if (collapsed.size === 0) return DecorationSet.empty;

  const children: Array<{ node: PMNode; offset: number }> = [];
  doc.forEach((node, offset) => children.push({ node, offset }));

  const decos: Decoration[] = [];

  for (let i = 0; i < children.length; i++) {
    const { node, offset } = children[i];
    if (node.type.name !== 'heading' || !collapsed.has(offset)) continue;

    // Spec decoration on the heading itself → signals the NodeView it's collapsed
    decos.push(Decoration.node(offset, offset + node.nodeSize, {}, { headingIsCollapsed: true }));

    const level = node.attrs.level as number;
    for (let j = i + 1; j < children.length; j++) {
      const s = children[j];
      if (s.node.type.name === 'heading' && (s.node.attrs.level as number) <= level) break;
      decos.push(
        Decoration.node(s.offset, s.offset + s.node.nodeSize, { class: 'heading-collapsed-child' }),
      );
    }
  }

  return DecorationSet.create(doc, decos);
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    headingCollapse: {
      toggleHeadingCollapse: (pos: number) => ReturnType;
    };
  }
}

export const CollapsibleHeading = Heading.configure({ levels: [1, 2, 3] }).extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      indent: {
        default: 0,
        parseHTML: (el: HTMLElement) => {
          const val = parseInt(el.getAttribute('data-indent') ?? '0', 10);
          return isNaN(val) ? 0 : Math.min(Math.max(val, 0), MAX_INDENT);
        },
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.indent) return {};
          return {
            'data-indent': String(attrs.indent),
            style: `padding-left: ${attrs.indent * 1.5}rem`,
          };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(HeadingView);
  },

  // renderMarkdown is a @tiptap/markdown extension field, not in Tiptap core types
  renderMarkdown(node: any, h: any) {
    const level = node.attrs?.level ?? 1;
    const indent = (node.attrs?.indent as number) ?? 0;
    const content = node.content ? h.renderChildren(node.content) : '';
    if (!indent) return `${'#'.repeat(level)} ${content}`;
    return `<h${level} data-indent="${indent}">${content}</h${level}>`;
  },
});

export const HeadingCollapsePlugin = Extension.create({
  name: 'headingCollapse',

  addOptions() {
    return {
      pageId: null as string | null,
    };
  },

  addCommands() {
    return {
      toggleHeadingCollapse:
        (pos: number) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(headingCollapseKey, { toggle: pos });
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const pageId = this.options.pageId;
    return [
      new Plugin({
        key: headingCollapseKey,
        state: {
          init(config, state) {
            const collapsed = new Set<number>();
            if (pageId && typeof window !== 'undefined') {
              try {
                const saved = localStorage.getItem(`remnus_collapsed_headings_${pageId}`);
                if (saved) {
                  const savedTitles = JSON.parse(saved) as string[];
                  state.doc.forEach((node, offset) => {
                    if (node.type.name === 'heading') {
                      const headingKey = `${node.attrs.level}:${node.textContent}`;
                      if (savedTitles.includes(headingKey)) {
                        collapsed.add(offset);
                      }
                    }
                  });
                }
              } catch (e) {
                console.error('Error loading collapsed headings from localStorage:', e);
              }
            }
            return { collapsed, decorations: buildDecorations(state.doc, collapsed) };
          },
          apply(tr, prev) {
            // Map existing positions through the transaction to keep them stable during edits
            const mapped = new Set<number>();
            for (const p of prev.collapsed) {
              const mp = tr.mapping.map(p);
              if (mp >= 0) mapped.add(mp);
            }
            const meta = tr.getMeta(headingCollapseKey) as { toggle?: number } | undefined;
            if (meta?.toggle !== undefined) {
              if (mapped.has(meta.toggle)) mapped.delete(meta.toggle);
              else mapped.add(meta.toggle);
            }

            // Save collapsed headings to localStorage
            if (pageId && typeof window !== 'undefined') {
              try {
                const savedTitles: string[] = [];
                tr.doc.forEach((node, offset) => {
                  if (node.type.name === 'heading' && mapped.has(offset)) {
                    savedTitles.push(`${node.attrs.level}:${node.textContent}`);
                  }
                });
                localStorage.setItem(`remnus_collapsed_headings_${pageId}`, JSON.stringify(savedTitles));
              } catch (e) {
                console.error('Error saving collapsed headings to localStorage:', e);
              }
            }

            return { collapsed: mapped, decorations: buildDecorations(tr.doc, mapped) };
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)?.decorations ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
