'use client';

import { Check, Minus, Plus } from 'lucide-react';

// Shared controls for the recurrence surfaces. Both the rule editor and the
// scope dialog are choice-heavy forms, and native radios read as a settings
// list rather than as a decision — these render the same choices as pickable
// tiles with room for the sub-label that actually explains the option.

export function Segmented<T extends string>({
  options, value, onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-control bg-raised p-0.5 shadow-[inset_0_0_0_1px_var(--color-line)]">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          aria-pressed={value === opt.id}
          className={`h-7 cursor-pointer rounded-[calc(var(--radius-control)-2px)] px-2.5 text-xs font-medium transition-colors ${
            value === opt.id
              ? 'bg-sheet text-fg shadow-lift'
              : 'text-fg-3 hover:text-fg-2'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** −/+ instead of a number field: the values here are small, and adjusting by
 *  one is the only thing anyone actually does with them. */
export function Stepper({
  value, min, max, onChange, decreaseLabel, increaseLabel,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
}) {
  const btn = 'flex size-8 cursor-pointer items-center justify-center text-fg-3 transition-colors hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent';
  return (
    <div className="inline-flex items-center overflow-hidden rounded-control bg-raised shadow-[inset_0_0_0_1px_var(--color-line)]">
      <button type="button" aria-label={decreaseLabel} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className={btn}>
        <Minus size={14} />
      </button>
      <span className="w-8 text-center text-ui font-semibold text-fg tabular-nums">{value}</span>
      <button type="button" aria-label={increaseLabel} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className={btn}>
        <Plus size={14} />
      </button>
    </div>
  );
}

export function OptionTile({
  title, subtitle, selected, onSelect, wide = false, tone = 'signal',
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onSelect: () => void;
  wide?: boolean;
  /** `red` for destructive choices, so the delete dialog doesn't look inviting;
   *  otherwise the choice is a selection, carried by the signal. */
  tone?: 'signal' | 'red';
}) {
  const accent = tone === 'red'
    ? { tile: 'bg-red-500/10 shadow-[inset_0_0_0_1.5px_var(--color-red-500)]', dot: 'bg-red-500 text-white' }
    : { tile: 'bg-signal-soft shadow-[inset_0_0_0_1.5px_var(--color-signal)]', dot: 'bg-signal text-signal-fg' };

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative cursor-pointer rounded-control px-3 py-2.5 text-left transition-[background-color,box-shadow] ${wide ? 'col-span-2' : ''} ${
        selected
          ? accent.tile
          : 'bg-raised shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]'
      }`}
    >
      <span className={`block text-ui font-medium pr-5 ${selected ? 'text-fg' : 'text-fg-2'}`}>
        {title}
      </span>
      {/* The sub-label is the point of the tile: it resolves the choice against
          THIS card, so "Every month" reads as "on the 19th" and a delete scope
          reads as "12 cards". */}
      {subtitle && (
        <span className="block mt-0.5 text-xs text-fg-3 truncate">{subtitle}</span>
      )}
      {selected && (
        <span className={`absolute top-2.5 right-2.5 flex size-4 items-center justify-center rounded-full ${accent.dot}`}>
          <Check size={10} strokeWidth={3.5} />
        </span>
      )}
    </button>
  );
}
