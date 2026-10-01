'use client';

import * as React from 'react';
import { useState } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { Check, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import {
  type SelectOption,
  type StatusGroup,
  normalizeOption,
  getStatusGroup,
  STATUS_GROUP_ORDER,
} from '@/lib/types/properties';
import { useMembers } from './MembersContext';
import { OptionChip, StatusChip, UserAvatar } from './PropertyTags';
import { MENU_EMPTY, MENU_LABEL } from './editor/menuStyles';

/**
 * The one picker for a select, multi-select, status or person value — the table cell
 * editor, the board's card editor and the row page all open this (V2 R8.2). Base UI
 * Combobox with the search field inside the popup: type to filter, arrows + Enter to
 * pick, Escape to close; a select/multi-select can also create the option you typed.
 * The popup wears the DropdownMenu look (float surface, rounded rows).
 */

type PickerColumn = {
  id: string;
  type: string;
  options?: (string | SelectOption)[];
};

/** Item ids that are not option values (a NUL prefix can't come from the UI). */
const EMPTY = '\u0000empty';
const CREATE = '\u0000create:';

const ITEM_CLASS =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-control px-2 py-1.5 text-left text-ui text-fg-2 outline-none select-none data-highlighted:bg-hover data-highlighted:text-fg';

export function PropertyValuePicker({
  column,
  value,
  onChange,
  onCreateOption,
  open,
  defaultOpen,
  onOpenChange,
  children,
  triggerClassName,
  triggerLabel,
}: {
  column: PickerColumn;
  value: unknown;
  /** A string for select/status/person ('' = empty), a string array for the multi kinds. */
  onChange: (next: string | string[]) => void;
  /** Persists a typed option onto the column (select/multi-select only). */
  onCreateOption?: (value: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The trigger's content: the current value as the surrounding view shows it. */
  children: React.ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  const t = useTranslations('Database');
  const members = useMembers();
  const [query, setQuery] = useState('');

  const isPerson = column.type === 'user' || column.type === 'multi_user';
  const multiple = column.type === 'multi_select' || column.type === 'multi_user';
  const options: SelectOption[] = isPerson ? [] : (column.options ?? []).map(normalizeOption);

  const trimmed = query.trim();
  const canCreate =
    !!onCreateOption &&
    (column.type === 'select' || column.type === 'multi_select') &&
    trimmed !== '' &&
    !options.some((o) => o.value.toLocaleLowerCase() === trimmed.toLocaleLowerCase());

  const memberLabel = (id: string) => {
    const m = members.find((x) => x.id === id);
    return m ? m.name || m.email || id : t('unknownUser');
  };
  const labelOf = (id: string) => {
    if (id === EMPTY) return isPerson ? t('unassigned') : t('empty');
    if (id.startsWith(CREATE)) return t('createOptionLabel', { value: id.slice(CREATE.length) });
    return isPerson ? memberLabel(id) : id;
  };

  const plainIds = isPerson ? members.map((m) => m.id) : options.map((o) => o.value);
  const statusGroupLabel: Record<StatusGroup, string> = {
    todo: t('statusGroupTodo'),
    in_progress: t('statusGroupInProgress'),
    complete: t('statusGroupComplete'),
  };
  const items =
    column.type === 'status'
      ? [
          { value: '', items: [EMPTY] },
          ...STATUS_GROUP_ORDER.map((g) => ({
            value: g,
            items: options.filter((o) => getStatusGroup(o) === g).map((o) => o.value),
          })).filter((g) => g.items.length > 0),
        ]
      : [
          ...(multiple ? [] : [EMPTY]),
          ...plainIds,
          ...(canCreate ? [`${CREATE}${trimmed}`] : []),
        ];

  const current: string[] = Array.isArray(value)
    ? (value as string[])
    : value !== undefined && value !== null && value !== ''
      ? [String(value)]
      : [];

  const renderItem = (id: string) => {
    let body: React.ReactNode;
    if (id === EMPTY) {
      body = <span className="text-fg-3">{labelOf(id)}</span>;
    } else if (id.startsWith(CREATE)) {
      body = (
        <>
          <Plus size={16} className="shrink-0 text-fg-3" />
          <span className="truncate">{labelOf(id)}</span>
        </>
      );
    } else if (isPerson) {
      const m = members.find((x) => x.id === id);
      body = (
        <>
          <UserAvatar member={m} size={20} />
          <span className="truncate text-fg">{labelOf(id)}</span>
        </>
      );
    } else if (column.type === 'status') {
      body = <StatusChip value={id} options={column.options} />;
    } else {
      body = <OptionChip value={id} options={column.options} />;
    }
    return (
      <Combobox.Item key={id} value={id} className={ITEM_CLASS}>
        <span className="flex min-w-0 flex-1 items-center gap-2">{body}</span>
        <Combobox.ItemIndicator className="shrink-0 text-fg">
          <Check size={16} />
        </Combobox.ItemIndicator>
      </Combobox.Item>
    );
  };

  const commitSingle = (id: string | null) => {
    if (!id || id === EMPTY) {
      onChange('');
    } else if (id.startsWith(CREATE)) {
      const created = id.slice(CREATE.length);
      onCreateOption?.(created);
      onChange(created);
    } else {
      onChange(id);
    }
  };

  const commitMultiple = (ids: string[]) => {
    const next = ids.map((id) => {
      if (!id.startsWith(CREATE)) return id;
      const created = id.slice(CREATE.length);
      onCreateOption?.(created);
      return created;
    });
    if (ids.some((id) => id.startsWith(CREATE))) setQuery('');
    onChange(Array.from(new Set(next)));
  };

  const searchPlaceholder = onCreateOption && !isPerson && column.type !== 'status'
    ? t('searchOrCreateOption')
    : t('searchPlaceholder');

  const shared = {
    items,
    itemToStringLabel: labelOf,
    inputValue: query,
    onInputValueChange: (next: string, details: { isItemPress?: boolean; cancel: () => void }) => {
      // Keep the filter while ticking several values.
      if (multiple && details.isItemPress) {
        details.cancel();
        return;
      }
      setQuery(next);
    },
    open,
    defaultOpen,
    onOpenChange: (next: boolean) => {
      if (!next) setQuery('');
      onOpenChange?.(next);
    },
    autoHighlight: true,
  };

  const parts = (
    <>
      <Combobox.Trigger className={triggerClassName} aria-label={triggerLabel}>
        {children}
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner className="isolate z-9999 outline-none" sideOffset={4} align="start">
          <Combobox.Popup className="flex max-h-(--available-height) w-max min-w-56 max-w-[min(20rem,var(--available-width))] origin-(--transform-origin) flex-col rounded-surface bg-float p-1 text-fg shadow-float outline-none animate-scale-in">
            {/* The popup only mounts while open, so autoFocus lands the caret here on
                every open — including a cell editor that mounts already open. */}
            <Combobox.Input
              autoFocus
              placeholder={searchPlaceholder}
              className="mb-1 h-8 w-full shrink-0 rounded-control bg-sheet px-2.5 text-ui text-fg outline-none shadow-[inset_0_0_0_1px_var(--color-line)] placeholder:text-fg-4 focus:shadow-[inset_0_0_0_1px_var(--color-focus)]"
            />
            <Combobox.Empty>
              <div className={MENU_EMPTY}>
                {isPerson && members.length === 0
                  ? t('noMembers')
                  : options.length === 0 && !isPerson
                    ? t('noOptionsConfigured')
                    : t('noMatches')}
              </div>
            </Combobox.Empty>
            <Combobox.List className="min-h-0 overflow-y-auto overscroll-contain outline-none data-empty:hidden max-h-72">
              {column.type === 'status'
                ? (group: { value: string; items: string[] }) => (
                    <Combobox.Group key={group.value || 'none'} items={group.items}>
                      {group.value && (
                        <Combobox.GroupLabel className={MENU_LABEL}>
                          {statusGroupLabel[group.value as StatusGroup]}
                        </Combobox.GroupLabel>
                      )}
                      <Combobox.Collection>{renderItem}</Combobox.Collection>
                    </Combobox.Group>
                  )
                : renderItem}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </>
  );

  return multiple ? (
    <Combobox.Root multiple value={current} onValueChange={(ids: string[]) => commitMultiple(ids)} {...shared}>
      {parts}
    </Combobox.Root>
  ) : (
    <Combobox.Root value={current[0] ?? null} onValueChange={(id: string | null) => commitSingle(id)} {...shared}>
      {parts}
    </Combobox.Root>
  );
}

/** The trigger look for a value cell: fills its box, no chrome of its own. */
export const PICKER_TRIGGER_CLASS = cn(
  'flex min-h-5 w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-control text-left outline-none',
);
