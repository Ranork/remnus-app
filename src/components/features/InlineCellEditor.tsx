'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { formatDateValue } from '@/lib/types/properties';
import { Checkbox } from '@/components/ui/checkbox';
import DateRangePicker from './DateRangePicker';
import { OptionChip, StatusChip, UserChip, UserTags } from './PropertyTags';
import { PropertyValuePicker, PICKER_TRIGGER_CLASS } from './PropertyValuePicker';

/** Value kinds edited by picking rather than typing. */
const PICKED_TYPES = new Set(['select', 'multi_select', 'status', 'user', 'multi_user']);

/**
 * The editor a table cell or a board card's property turns into while it is being
 * edited. Picked values (select, status, people) open the shared PropertyValuePicker
 * straight away; closing it ends the edit. Text-like values edit in place.
 */
export default function InlineCellEditor({
  column,
  value,
  onSave,
  onClose,
  onCreateOption,
}: {
  column: any;
  value: any;
  onSave: (val: any) => void;
  onClose: () => void;
  /** Persists a brand-new option onto the column's schema (select/multi_select only). */
  onCreateOption?: (value: string) => void;
}) {
  const locale = useLocale();
  const [inputValue, setInputValue] = useState(value ?? '');
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) setAnchorRect(containerRef.current.getBoundingClientRect());
  }, []);

  const handleTextSave = () => { onSave(inputValue); onClose(); };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleTextSave();
    else if (e.key === 'Escape') onClose();
  };

  // ── SELECT / MULTI-SELECT / STATUS / PEOPLE ───────────────────────────────
  if (PICKED_TYPES.has(column.type)) {
    const list: string[] = Array.isArray(value) ? value : value ? [String(value)] : [];
    let display: React.ReactNode;
    if (list.length === 0) display = <span className="text-fg-4">—</span>;
    else if (column.type === 'select') display = <OptionChip value={list[0]} options={column.options} />;
    else if (column.type === 'status') display = <StatusChip value={list[0]} options={column.options} />;
    else if (column.type === 'user') display = <UserChip userId={list[0]} />;
    else if (column.type === 'multi_user') display = <UserTags value={list} />;
    else display = (
      <span className="flex flex-wrap gap-1">
        {list.map((v) => <OptionChip key={v} value={v} options={column.options} />)}
      </span>
    );

    return (
      <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
        <PropertyValuePicker
          column={column}
          value={value}
          onChange={onSave}
          onCreateOption={onCreateOption}
          defaultOpen
          onOpenChange={(open) => { if (!open) onClose(); }}
          triggerClassName={PICKER_TRIGGER_CLASS}
          triggerLabel={column.name}
        >
          {display}
        </PropertyValuePicker>
      </div>
    );
  }

  // ── TITLE ─────────────────────────────────────────────────────────────────
  if (column.id === 'title') {
    return (
      <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleTextSave}
          onKeyDown={handleKeyDown}
          autoFocus
          className="bg-transparent text-fg font-medium w-full focus:outline-none border-none p-0 m-0"
          style={{ fontFamily: 'inherit', fontSize: 'inherit' }}
        />
      </div>
    );
  }

  // ── CHECKBOX ─────────────────────────────────────────────────────────────
  if (column.type === 'checkbox') {
    const isChecked = value === true || value === 'true';
    return (
      <div className="relative flex w-full items-center" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isChecked}
          aria-label={column.name}
          onCheckedChange={(next) => { onSave(next); onClose(); }}
        />
      </div>
    );
  }

  // ── DATE / DATETIME ───────────────────────────────────────────────────────
  if (column.type === 'date' || column.type === 'datetime') {
    const displayVal = typeof value === 'string' ? value : '';
    return (
      <div ref={containerRef} className="relative w-full min-h-5">
        <span className="text-fg-2 pointer-events-none">
          {displayVal ? formatDateValue(displayVal, column.type as 'date' | 'datetime', column.dateFormat, locale) : '—'}
        </span>
        {anchorRect && (
          <DateRangePicker
            value={displayVal}
            showTime={column.type === 'datetime'}
            anchorRect={anchorRect}
            onChange={onSave}
            onClose={onClose}
          />
        )}
      </div>
    );
  }

  // ── TEXT / NUMBER / URL / EMAIL / PHONE ───────────────────────────────────
  return (
    <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
      <input
        type={column.type === 'number' ? 'number' : column.type === 'url' ? 'url' : column.type === 'email' ? 'email' : column.type === 'phone' ? 'tel' : 'text'}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleTextSave}
        onKeyDown={handleKeyDown}
        autoFocus
        className="bg-transparent text-fg w-full focus:outline-none border-none p-0 m-0"
        style={{ fontFamily: 'inherit', fontSize: 'inherit' }}
      />
    </div>
  );
}
