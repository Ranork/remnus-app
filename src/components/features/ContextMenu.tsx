'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';

// A single entry in a Notion-style context menu. `action` is the default kind
// (icon + label + handler); `separator` draws a divider; `label` is a small
// uppercase section header.
export type MenuItem =
  | {
      kind?: 'action';
      id: string;
      label: string;
      icon?: LucideIcon;
      danger?: boolean;
      hint?: string;
      disabled?: boolean;
      onSelect: () => void;
    }
  | { kind: 'separator' }
  | { kind: 'label'; text: string };

function ContextMenuView({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Null until measured — keeps the menu hidden for the first paint so it never
  // flashes at the raw cursor point before being clamped into the viewport.
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const margin = 8;
    let left = x;
    let top = y;
    if (left + width > window.innerWidth - margin) left = Math.max(margin, x - width);
    if (top + height > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - height - margin);
    setPos({ left, top });
  }, [x, y, items]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Any scroll (capture phase to catch inner scrollers) or resize dismisses it,
    // since the anchor point would otherwise drift.
    const onScroll = () => onClose();
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose]);

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-9998 cursor-default"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        ref={ref}
        role="menu"
        className="fixed z-9999 min-w-56 max-w-xs bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl py-1 px-1 animate-scale-in select-none"
        style={{ left: pos?.left ?? x, top: pos?.top ?? y, visibility: pos ? 'visible' : 'hidden' }}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {items.map((item, i) => {
          if ('kind' in item && item.kind === 'separator') {
            return <div key={`sep-${i}`} className="my-1 border-t border-neutral-800" />;
          }
          if ('kind' in item && item.kind === 'label') {
            return (
              <div
                key={`lbl-${i}`}
                className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-600"
              >
                {item.text}
              </div>
            );
          }
          const action = item as Extract<MenuItem, { onSelect: () => void }>;
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              role="menuitem"
              disabled={action.disabled}
              onClick={() => {
                if (action.disabled) return;
                action.onSelect();
                onClose();
              }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                action.danger
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-neutral-300 hover:bg-neutral-800 hover:text-neutral-50'
              }`}
            >
              {Icon && (
                <Icon size={15} className={`shrink-0 ${action.danger ? 'text-red-400' : 'text-neutral-500'}`} />
              )}
              <span className="flex-1 truncate">{action.label}</span>
              {action.hint && <span className="text-[11px] text-neutral-600 shrink-0">{action.hint}</span>}
            </button>
          );
        })}
      </div>
    </>,
    document.body
  );
}

type OpenEvent = Pick<React.MouseEvent, 'preventDefault' | 'stopPropagation' | 'clientX' | 'clientY'>;

/**
 * Notion-style right-click / context menu. Build a `MenuItem[]` and call
 * `open(event, items)` from an `onContextMenu` (or button) handler; render the
 * returned `node` somewhere in the tree. `onClose` runs whenever the menu
 * dismisses (outside click, Esc, scroll, selection) — handy for clearing any
 * "active row" highlight the caller keeps in sync.
 */
export function useContextMenu(onClose?: () => void) {
  const [state, setState] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);

  const open = (e: OpenEvent, items: MenuItem[]) => {
    e.preventDefault();
    e.stopPropagation();
    setState({ x: e.clientX, y: e.clientY, items });
  };
  const close = () => {
    setState(null);
    onClose?.();
  };

  const node = state ? (
    <ContextMenuView x={state.x} y={state.y} items={state.items} onClose={close} />
  ) : null;

  return { open, close, node, isOpen: state !== null };
}
