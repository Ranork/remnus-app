'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import PageIcon from '../PageIcon';
import { searchPageItems, type PageLinkItem } from './pageLinkData';
import { MENU_EMPTY, MENU_SURFACE, menuItem } from './menuStyles';

type Props = {
  onSelect: (item: PageLinkItem) => void;
  onClose: () => void;
};

// Self-contained search box + list for the block "Link to page" picker. Unlike
// the inline "@" suggestion (which reads its query from the document), this owns
// its own input because it is opened on demand by a slash command.
export default function PagePickerPanel({ onSelect, onClose }: Props) {
  const t = useTranslations('Editor');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PageLinkItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // The picker is opened by a slash command while ProseMirror still owns focus,
  // and its async focus can land back on the editor after our mount effect runs.
  // Retry across a few frames so the search input reliably wins the focus race.
  useEffect(() => {
    let frame = 0;
    const grab = () => {
      const input = inputRef.current;
      if (input && document.activeElement !== input) input.focus();
      if (frame < 5) {
        frame++;
        requestAnimationFrame(grab);
      }
    };
    requestAnimationFrame(grab);
  }, []);

  useEffect(() => {
    let active = true;
    searchPageItems(query, 12).then(res => {
      if (active) {
        setItems(res);
        setSelectedIndex(0);
      }
    });
    return () => {
      active = false;
    };
  }, [query]);

  // Intercept navigation keys at the capture phase so they take effect even if
  // the editor (ProseMirror) still has DOM focus — otherwise arrows/Enter would
  // edit the document line instead of moving the selection.
  useEffect(() => {
    const onKeyDownCapture = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (!items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(i => (i + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(i => (i - 1 + items.length) % items.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (items[selectedIndex]) onSelect(items[selectedIndex]);
      }
    };
    document.addEventListener('keydown', onKeyDownCapture, true);
    return () => document.removeEventListener('keydown', onKeyDownCapture, true);
  }, [items, selectedIndex, onSelect, onClose]);

  return (
    <div className={cn(MENU_SURFACE, 'w-72 max-w-[calc(100vw-2rem)] p-0')}>
      {/* The search field is the panel's header: no well of its own, a hairline below. */}
      <div className="border-b border-line p-1">
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('pageLinkSearchPlaceholder')}
          aria-label={t('pageLinkSearchPlaceholder')}
          className="h-8 w-full rounded-control bg-transparent px-2.5 text-ui text-fg placeholder:text-fg-4 focus:outline-none"
        />
      </div>
      <div className="max-h-64 overflow-y-auto overscroll-contain p-1">
        {items.length === 0 ? (
          <div className={MENU_EMPTY}>{t('pageLinkEmpty')}</div>
        ) : (
          items.map((item, index) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onSelect(item)}
              onMouseMove={() => { if (index !== selectedIndex) setSelectedIndex(index); }}
              className={menuItem(index === selectedIndex)}
            >
              <span className="flex shrink-0 items-center">
                <PageIcon icon={item.icon} iconColor={item.iconColor} size={16} fallbackType={item.type} />
              </span>
              <span className="flex-1 truncate">{item.title}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
