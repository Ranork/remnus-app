import { cn } from '@/lib/cn';

// The editor's floating menus and toolbars wear the DropdownMenu look
// (components/ui/dropdown-menu.tsx, V2 R8) but cannot use its Base UI popup: they must
// never take focus from ProseMirror — a blurred editor drops its selection, and with it
// the bubble menu, the slash query and the table under the caret — so they are placed by
// hand and driven by mousedown + preventDefault. Keep these classes in step with
// DropdownMenuContent / Item / Label / Separator / Shortcut.

/** A menu or popover panel: the float surface, its shadow carries the edge. */
export const MENU_SURFACE = 'rounded-surface bg-float p-1 text-fg shadow-float';

/** A menu row. `active` is the keyboard highlight or the current choice. */
export function menuItem(active = false, danger = false) {
  return cn(
    'flex w-full cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-1.5 text-left text-ui transition-colors select-none',
    danger
      ? 'text-red-400 hover:bg-red-500/12'
      : active
        ? 'bg-hover text-fg'
        : 'text-fg-2 hover:bg-hover hover:text-fg',
  );
}

/** The icon slot at the start of a menu row (16px, like DropdownMenuItem's icons). */
export const MENU_ICON = 'flex size-4 shrink-0 items-center justify-center text-fg-3 [&_svg]:size-4';

/** A group heading inside a menu (sentence case, never uppercase). */
export const MENU_LABEL = 'px-2.5 pt-2 pb-1 text-2xs font-medium text-fg-3';

export const MENU_SEPARATOR = '-mx-1 my-1 h-px bg-line';

/** "Nothing matches" line inside a menu. */
export const MENU_EMPTY = 'px-2.5 py-2 text-xs text-fg-3';

/** A floating toolbar (text selection, block selection, table): one row of icon buttons. */
export const TOOLBAR_SURFACE = 'flex items-center gap-0.5 rounded-surface bg-float p-1 text-fg shadow-float select-none';

/** Height of TOOLBAR_SURFACE (28px buttons + 4px padding twice); used to place it. */
export const TOOLBAR_HEIGHT = 36;

export function toolbarButton(active = false) {
  return cn(
    'inline-flex h-7 min-w-7 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-control px-1.5 text-xs font-medium transition-colors',
    active ? 'bg-hover text-fg' : 'text-fg-3 hover:bg-hover hover:text-fg',
  );
}

export const TOOLBAR_DIVIDER = 'mx-0.5 h-4 w-px shrink-0 bg-line';
