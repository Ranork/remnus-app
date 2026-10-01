'use client';
import { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CALLOUT_COLORS } from './CalloutBlockExtension';
import { MENU_SURFACE } from './menuStyles';

// The colour is the writer's choice (user data, blue included); the shape is the
// app's: a control-radius panel with a hairline in its own tint.
const COLOR_CLASSES: Record<string, string> = {
  default: 'bg-raised border-line',
  blue: 'bg-blue-500/10 border-blue-500/25',
  green: 'bg-green-400/10 border-green-400/25',
  amber: 'bg-amber-500/10 border-amber-500/25',
  red: 'bg-red-400/10 border-red-400/25',
};

const SWATCH: Record<string, string> = {
  default: 'bg-fg-4',
  blue: 'bg-blue-500',
  green: 'bg-green-400',
  amber: 'bg-amber-500',
  red: 'bg-red-400',
};

// Swatch names for tooltips (Editor namespace).
const SWATCH_LABEL_KEY: Record<string, string> = {
  default: 'bubbleColorDefault',
  blue: 'colorBlue',
  green: 'colorGreen',
  amber: 'colorOrange',
  red: 'colorRed',
};

const EMOJI_CHOICES = ['💡', 'ℹ️', '⚠️', '✅', '❌', '📌', '🔥', '📝'];

export default function CalloutBlockView({
  node,
  deleteNode,
  updateAttributes,
}: {
  node: any;
  deleteNode: () => void;
  updateAttributes: (attrs: Record<string, any>) => void;
}) {
  const t = useTranslations('Editor');
  const { icon, color, text } = node.attrs as { icon: string; color: string; text: string };
  const [emojiOpen, setEmojiOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Autosize the textarea to its content. On a freshly-inserted node the element
  // isn't laid out yet, so scrollHeight reads 0 — never collapse below one line,
  // or the box becomes 0px tall (no placeholder, unclickable) until a remount.
  const autosize = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.max(ta.scrollHeight, 24) + 'px';
  };
  useEffect(autosize, [text]);
  // Re-measure once after the first paint, when layout is finally available.
  useEffect(() => {
    const id = requestAnimationFrame(autosize);
    return () => cancelAnimationFrame(id);
  }, []);

  // A freshly-inserted callout leaves a NodeSelection on the atom, so the
  // textarea never receives the caret until the editor is remounted. Grab focus
  // on mount when empty (i.e. just created) across a few frames to win the race.
  useEffect(() => {
    if (text) return;
    let frame = 0;
    const grab = () => {
      const ta = taRef.current;
      if (ta && document.activeElement !== ta) ta.focus();
      if (frame < 4) {
        frame++;
        requestAnimationFrame(grab);
      }
    };
    requestAnimationFrame(grab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <NodeViewWrapper>
      <div
        contentEditable={false}
        className={cn(
          'group/callout editor-object relative flex gap-3 rounded-control border px-4 py-3 select-none',
          COLOR_CLASSES[color] || COLOR_CLASSES.blue,
        )}
      >
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setEmojiOpen(v => !v)}
            className="flex size-6.5 cursor-pointer items-center justify-center rounded text-lg leading-none transition-colors hover:bg-hover"
            title={t('calloutChangeIcon')}
            aria-label={t('calloutChangeIcon')}
            aria-expanded={emojiOpen}
          >
            {icon}
          </button>
          {emojiOpen && (
            <div className={cn(MENU_SURFACE, 'absolute top-8 left-0 z-50 grid w-max grid-cols-4 gap-0.5')}>
              {EMOJI_CHOICES.map(e => (
                <button
                  type="button"
                  key={e}
                  onClick={() => {
                    updateAttributes({ icon: e });
                    setEmojiOpen(false);
                  }}
                  className="flex size-8 cursor-pointer items-center justify-center rounded-control text-base leading-none transition-colors hover:bg-hover"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        <textarea
          ref={taRef}
          value={text}
          onChange={e => updateAttributes({ text: e.target.value })}
          // Pointer events are stopped natively via useStopNodeSelection (a React
          // onMouseDown fires too late to beat ProseMirror). Keys still need a
          // synthetic stop so PM shortcuts don't fire while typing.
          onKeyDown={e => e.stopPropagation()}
          rows={1}
          placeholder={t('calloutPlaceholder')}
          className="min-h-6 flex-1 resize-none overflow-hidden bg-transparent leading-[1.625] text-fg placeholder:text-fg-4 focus:outline-none"
        />

        {/* Colour + remove float over the top edge on hover, so the text keeps the
            whole width of the box instead of wrapping early around hidden controls. */}
        <div className="pointer-events-none absolute -top-3 right-2 z-10 flex items-center gap-1.5 rounded-control bg-float px-1.5 py-1 opacity-0 shadow-float transition-opacity group-hover/callout:pointer-events-auto group-hover/callout:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
          {CALLOUT_COLORS.map(c => {
            const label = t(SWATCH_LABEL_KEY[c]);
            return (
              <button
                type="button"
                key={c}
                onClick={() => updateAttributes({ color: c })}
                className={cn(
                  'size-3 cursor-pointer rounded-full',
                  SWATCH[c],
                  color === c && 'ring-2 ring-fg/60 ring-offset-1 ring-offset-float',
                )}
                title={label}
                aria-label={label}
                aria-pressed={color === c}
              />
            );
          })}
          <button
            type="button"
            onClick={() => deleteNode()}
            className="ml-0.5 flex size-5 cursor-pointer items-center justify-center rounded text-fg-3 transition-colors hover:bg-hover hover:text-red-400"
            title={t('calloutRemove')}
            aria-label={t('calloutRemove')}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
