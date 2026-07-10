import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * Renders a skeleton where an image/file upload will land, for as long as the
 * request is in flight.
 *
 * This is a *decoration*, not a node. A placeholder node would be part of the
 * document: it would fire onUpdate, serialize into the saved markdown, and be
 * persisted if the user navigated away (or the upload failed) mid-flight.
 * Decorations live beside the doc, so nothing is saved and no update is emitted
 * — while still being position-mapped, so the skeleton follows the content if
 * the user keeps typing above it.
 */
export const uploadPlaceholderKey = new PluginKey<DecorationSet>('uploadPlaceholder');

export type UploadKind = 'image' | 'file';

type PlaceholderMeta =
  | { add: { id: string; pos: number; kind: UploadKind; name: string } }
  | { remove: { id: string } };

function skeleton(kind: UploadKind, name: string, label: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = `upload-skeleton upload-skeleton--${kind}`;
  wrap.setAttribute('contenteditable', 'false');
  wrap.setAttribute('role', 'status');
  wrap.setAttribute('aria-live', 'polite');
  wrap.setAttribute('aria-label', `${label}: ${name}`);

  const body = document.createElement('div');
  body.className = 'upload-skeleton__body';

  const meta = document.createElement('div');
  meta.className = 'upload-skeleton__meta';

  const title = document.createElement('span');
  title.className = 'upload-skeleton__name';
  title.textContent = name;

  const status = document.createElement('span');
  status.className = 'upload-skeleton__status';
  status.textContent = label;

  meta.append(title, status);
  wrap.append(body, meta);
  return wrap;
}

/** Current position of a pending placeholder, or null once it's gone. */
export function findPlaceholderPos(state: EditorState, id: string): number | null {
  const set = uploadPlaceholderKey.getState(state);
  const found = set?.find(undefined, undefined, (spec) => spec.id === id);
  return found && found.length ? found[0].from : null;
}

export const UploadPlaceholder = Extension.create({
  name: 'uploadPlaceholder',

  addOptions() {
    return { uploadingLabel: 'Uploading…' };
  },

  addProseMirrorPlugins() {
    const { uploadingLabel } = this.options;

    return [
      new Plugin<DecorationSet>({
        key: uploadPlaceholderKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            // Keep the skeleton glued to its content as the doc changes around it.
            set = set.map(tr.mapping, tr.doc);
            const meta = tr.getMeta(uploadPlaceholderKey) as PlaceholderMeta | undefined;
            if (!meta) return set;

            if ('add' in meta) {
              const { id, pos, kind, name } = meta.add;
              const widget = Decoration.widget(pos, skeleton(kind, name, uploadingLabel), {
                id,
                side: -1,
              });
              return set.add(tr.doc, [widget]);
            }

            return set.remove(set.find(undefined, undefined, (spec) => spec.id === meta.remove.id));
          },
        },
        props: {
          decorations(state) {
            return uploadPlaceholderKey.getState(state);
          },
          // The skeleton is a widget inside an (often empty) paragraph, whose
          // Tiptap placeholder ::before keeps rendering underneath it — the
          // "type '/' for commands" hint showed through the skeleton. Flag the
          // editor root so globals.css can suppress the hint while uploading.
          // ProseMirror merges `class` across every plugin's attributes.
          attributes(state): Record<string, string> {
            const set = uploadPlaceholderKey.getState(state);
            return set && set.find().length > 0 ? { class: 'has-upload-skeleton' } : {};
          },
        },
      }),
    ];
  },
});
