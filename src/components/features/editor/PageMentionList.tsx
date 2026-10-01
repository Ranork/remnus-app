'use client';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import PageIcon from '../PageIcon';
import type { PageLinkItem } from './pageLinkData';
import { MENU_EMPTY, MENU_SURFACE, menuItem } from './menuStyles';

type Props = {
  items: PageLinkItem[];
  command: (item: PageLinkItem) => void;
};

const PageMentionList = forwardRef<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }, Props>(
  ({ items, command }, ref) => {
    const t = useTranslations('Editor');
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [items]);

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
        if (event.key === 'Enter') {
          if (items[selectedIndex]) command(items[selectedIndex]);
          return true;
        }
        return false;
      },
    }));

    if (!items.length) {
      return (
        <div className={cn(MENU_SURFACE, 'w-60')}>
          <div className={MENU_EMPTY}>{t('pageLinkEmpty')}</div>
        </div>
      );
    }

    return (
      <div className={cn(MENU_SURFACE, 'w-72 max-w-[calc(100vw-2rem)]')}>
        {items.map((item, index) => (
          <button
            type="button"
            key={item.id}
            onClick={() => command(item)}
            onMouseMove={() => { if (index !== selectedIndex) setSelectedIndex(index); }}
            className={menuItem(index === selectedIndex)}
          >
            <span className="flex shrink-0 items-center">
              <PageIcon icon={item.icon} iconColor={item.iconColor} size={16} fallbackType={item.type} />
            </span>
            <span className="flex-1 truncate">{item.title}</span>
          </button>
        ))}
      </div>
    );
  },
);

PageMentionList.displayName = 'PageMentionList';
export default PageMentionList;
