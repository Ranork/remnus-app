'use client';
import { forwardRef } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { COLOR_LABEL_KEY, HIGHLIGHT_COLORS, TEXT_COLORS, type EditorColor } from './editorColors';
import { MENU_LABEL, MENU_SURFACE } from './menuStyles';

type Props = {
  /** Current text colour / highlight of the selection, to mark the active swatch. */
  activeText?: string | null;
  activeHighlight?: string | null;
  /** `null` clears the colour. */
  onText: (value: string | null) => void;
  onHighlight: (value: string | null) => void;
  className?: string;
  style?: React.CSSProperties;
};

/** Text colour + highlight swatches — shared by the text-selection (BubbleMenuBar) and
 *  block-selection toolbars. Every control acts on mousedown and prevents the default,
 *  so the editor keeps its selection while a colour is picked. */
const EditorColorPanel = forwardRef<HTMLDivElement, Props>(function EditorColorPanel(
  { activeText, activeHighlight, onText, onHighlight, className, style },
  ref,
) {
  const t = useTranslations('Editor');
  return (
    <div
      ref={ref}
      style={style}
      onMouseDown={(e) => e.preventDefault()}
      className={cn(MENU_SURFACE, 'w-max p-2', className)}
    >
      <div className={cn(MENU_LABEL, 'px-1 pt-0.5')}>{t('bubbleTextColor')}</div>
      <SwatchRow colors={TEXT_COLORS} active={activeText} onPick={onText} clearLabel={t('bubbleColorDefault')} />
      <div className={cn(MENU_LABEL, 'mt-1.5 px-1')}>{t('bubbleHighlight')}</div>
      <SwatchRow colors={HIGHLIGHT_COLORS} active={activeHighlight} onPick={onHighlight} clearLabel={t('bubbleColorNone')} />
    </div>
  );
});

export default EditorColorPanel;

function SwatchRow({
  colors,
  active,
  onPick,
  clearLabel,
}: {
  colors: EditorColor[];
  active?: string | null;
  onPick: (value: string | null) => void;
  clearLabel: string;
}) {
  const t = useTranslations('Editor');
  return (
    <div className="flex items-center gap-1.5 px-1 pb-0.5">
      <button
        type="button"
        title={clearLabel}
        aria-label={clearLabel}
        onMouseDown={(e) => { e.preventDefault(); onPick(null); }}
        className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-fg-3 shadow-[inset_0_0_0_1px_var(--color-line-strong)] transition-colors hover:text-fg"
      >
        <X size={10} />
      </button>
      {colors.map((color) => {
        const label = t(COLOR_LABEL_KEY[color.name]);
        const on = active === color.value;
        return (
          <button
            key={color.value}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={on}
            onMouseDown={(e) => { e.preventDefault(); onPick(color.value); }}
            className={cn(
              'size-5 shrink-0 cursor-pointer rounded-full transition-shadow',
              on
                ? 'ring-2 ring-fg ring-offset-2 ring-offset-float'
                : 'hover:ring-2 hover:ring-line-strong hover:ring-offset-1 hover:ring-offset-float',
            )}
            style={{ backgroundColor: color.value }}
          />
        );
      })}
    </div>
  );
}
