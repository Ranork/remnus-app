'use client';
import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import tippy, { type Instance } from 'tippy.js';
import SlashCommandList, { SLASH_COMMANDS, SLASH_KEYWORDS, buildChildCommands, type SlashCommandItem } from './SlashCommandList';

// Case- and accent-insensitive, so "/baslik" finds "Başlık" and "/ozet" finds "Özet".
// (Dotless ı has no decomposition, hence the explicit map.)
function fold(value: string): string {
  return value.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').toLowerCase();
}

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      workspaceId: null as string | null,
      parentId: null as string | null,
      /** Command id → its name in the reader's language (the menu shows these). */
      labels: {} as Record<string, string>,
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: { editor: any; range: any; props: any }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,

        items: ({ query, editor }: { query: string; editor: any }): SlashCommandItem[] => {
          // Read options dynamically so they're always current regardless of closure timing
          const ext = editor.extensionManager.extensions.find((e: any) => e.name === 'slashCommand');
          const workspaceId = ext?.options?.workspaceId ?? null;
          const parentId = ext?.options?.parentId ?? null;
          const childCmds =
            workspaceId && parentId
              ? buildChildCommands(workspaceId, parentId)
              : [];
          const all = [...SLASH_COMMANDS, ...childCmds];
          if (!query) return all;
          const q = fold(query);
          const labels: Record<string, string> = ext?.options?.labels ?? {};
          // Match the name the menu shows, the English label, the id, or any
          // registered shortcut/synonym so "/h1", "/img", "/todo" resolve too.
          return all.filter(item =>
            (labels[item.id] ? fold(labels[item.id]).includes(q) : false) ||
            fold(item.label).includes(q) ||
            item.id.toLowerCase().includes(q) ||
            (SLASH_KEYWORDS[item.id] ?? []).some(k => k.includes(q)),
          );
        },

        render: () => {
          let component: ReactRenderer<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }>;
          let popup: Instance[];

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(SlashCommandList, {
                props,
                editor: props.editor,
              });

              if (!props.clientRect) return;

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                zIndex: 9999,
                animation: false,
                maxWidth: 'none',
              }) as Instance[];
            },

            onUpdate: (props: any) => {
              component.updateProps(props);
              if (!props.clientRect) return;
              popup[0]?.setProps({ getReferenceClientRect: props.clientRect });
            },

            onKeyDown: (props: any) => {
              if (props.event.key === 'Escape') {
                popup[0]?.hide();
                return true;
              }
              return component.ref?.onKeyDown(props) ?? false;
            },

            onExit: () => {
              popup[0]?.destroy();
              component.destroy();
            },
          };
        },
      }),
    ];
  },
});
