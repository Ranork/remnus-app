import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

// A delete to the Trash leaves the links other pages hold to the item in place, so
// a restore brings them back. Until then the editor marks them: a page link gets a
// dimmed, inert style (BlockEditor's click handler skips `data-trashed`), and a
// child block reads the `trashed` decoration spec in ChildBlockView. BlockEditor
// asks the server once per editor which targets are trashed and hands the answer
// over as this plugin's meta.

type TrashedState = { ids: Set<string>; decorations: DecorationSet };

export const trashedTargetsKey = new PluginKey<TrashedState>('trashedTargets');

const PAGE_HREF = /^\/page\/([^/?#]+)/;
const DB_HREF = /^\/db\/([^/?#]+)(?:\/([^/?#]+))?/;

function nodeTargets(node: PMNode): string[] {
  if (node.type.name === 'childBlock') return [node.attrs.itemId, node.attrs.databaseId].filter(Boolean);
  if (node.type.name !== 'pageLink') return [];
  const href = String(node.attrs.href || '');
  const page = href.match(PAGE_HREF);
  if (page) return [page[1]];
  const dbMatch = href.match(DB_HREF);
  if (dbMatch) return dbMatch[2] ? [dbMatch[1], dbMatch[2]] : [dbMatch[1]];
  return [];
}

/** Every item id the document links to (page links and child blocks). */
export function collectLinkTargets(doc: PMNode): string[] {
  const ids = new Set<string>();
  doc.descendants((node) => {
    for (const id of nodeTargets(node)) ids.add(id);
  });
  return [...ids];
}

function build(doc: PMNode, ids: Set<string>, hint: string): DecorationSet {
  if (ids.size === 0) return DecorationSet.empty;
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!nodeTargets(node).some((id) => ids.has(id))) return;
    decorations.push(node.type.name === 'pageLink'
      ? Decoration.node(pos, pos + node.nodeSize, { class: 'page-link-trashed', 'data-trashed': '', title: hint })
      : Decoration.node(pos, pos + node.nodeSize, {}, { trashed: true }));
  });
  return DecorationSet.create(doc, decorations);
}

export const TrashedTargets = Extension.create<{ hint: string }>({
  name: 'trashedTargets',

  addOptions() {
    return { hint: '' };
  },

  addProseMirrorPlugins() {
    const hint = this.options.hint;
    return [
      new Plugin<TrashedState>({
        key: trashedTargetsKey,
        state: {
          init: () => ({ ids: new Set(), decorations: DecorationSet.empty }),
          apply(tr, value, _oldState, newState) {
            const next = tr.getMeta(trashedTargetsKey) as string[] | undefined;
            if (next) {
              const ids = new Set(next);
              return { ids, decorations: build(newState.doc, ids, hint) };
            }
            if (!tr.docChanged || value.ids.size === 0) return value;
            return { ids: value.ids, decorations: value.decorations.map(tr.mapping, tr.doc) };
          },
        },
        props: {
          decorations: (state) => trashedTargetsKey.getState(state)?.decorations,
        },
      }),
    ];
  },
});
