'use client';
import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import tippy, { type Instance } from 'tippy.js';
import SlashCommandList, { SLASH_COMMANDS, type SlashCommandItem } from './SlashCommandList';

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
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

        items: ({ query }: { query: string }): SlashCommandItem[] => {
          if (!query) return SLASH_COMMANDS;
          return SLASH_COMMANDS.filter((item) =>
            item.label.toLowerCase().includes(query.toLowerCase())
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
