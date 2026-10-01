'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import type { EmojiEntry } from './emojiData';
import { MENU_EMPTY, MENU_SURFACE, menuItem } from './menuStyles';

type Props = {
  items: EmojiEntry[];
  command: (item: EmojiEntry) => void;
};

const EmojiList = forwardRef<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }, Props>(
  ({ items, command }, ref) => {
    const t = useTranslations('Editor');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    useEffect(() => setSelectedIndex(0), [items]);

    // The list scrolls (max-h-64): keep the keyboard highlight in view.
    useEffect(() => {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (!items.length) return false;
        if (event.key === 'ArrowUp') {
          setSelectedIndex(i => (i - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex(i => (i + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          if (items[selectedIndex]) command(items[selectedIndex]);
          return true;
        }
        return false;
      },
    }));

    if (!items.length) {
      return (
        <div className={cn(MENU_SURFACE, 'w-60')}>
          <div className={MENU_EMPTY}>{t('emojiPickerEmpty')}</div>
        </div>
      );
    }

    return (
      <div className={cn(MENU_SURFACE, 'max-h-64 w-64 overflow-y-auto overscroll-contain')}>
        {items.map((item, index) => (
          <button
            type="button"
            key={item.name}
            ref={(el) => { itemRefs.current[index] = el; }}
            onClick={() => command(item)}
            onMouseMove={() => { if (index !== selectedIndex) setSelectedIndex(index); }}
            className={menuItem(index === selectedIndex)}
          >
            <span className="shrink-0 text-base leading-none">{item.emoji}</span>
            {/* The short name is what you type after ":" — literal text, so mono. */}
            <span className="flex-1 truncate font-mono text-xs">:{item.name}:</span>
          </button>
        ))}
      </div>
    );
  },
);

EmojiList.displayName = 'EmojiList';
export default EmojiList;
