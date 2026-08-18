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
    <div className="inline-flex items-center gap-0.5 p-0.5 bg-neutral-900 border border-neutral-800 rounded-lg">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          aria-pressed={value === opt.id}
          className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
            value === opt.id
              ? 'bg-neutral-750 text-neutral-50'
              : 'text-neutral-500 hover:text-neutral-300'
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
  const btn = 'w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors';
  return (
    <div className="inline-flex items-center bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
      <button type="button" aria-label={decreaseLabel} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className={btn}>
        <Minus size={12} />
      </button>
      <span className="w-8 text-center text-xs font-semibold text-neutral-100 tabular-nums">{value}</span>
      <button type="button" aria-label={increaseLabel} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className={btn}>
        <Plus size={12} />
      </button>
    </div>
  );
}

export function OptionTile({
  title, subtitle, selected, onSelect, wide = false, tone = 'blue',
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onSelect: () => void;
  wide?: boolean;
  /** `red` for destructive choices, so the delete dialog doesn't look inviting. */
  tone?: 'blue' | 'red';
}) {
  const accent = tone === 'red'
    ? { border: 'border-red-500/40 bg-red-500/10', dot: 'bg-red-500' }
    : { border: 'border-blue-500/40 bg-blue-500/10', dot: 'bg-blue-500' };

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative text-left rounded-lg border px-3 py-2.5 transition-colors ${wide ? 'col-span-2' : ''} ${
        selected
          ? accent.border
          : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 hover:bg-neutral-900/70'
      }`}
    >
      <span className={`block text-xs font-medium pr-5 ${selected ? 'text-neutral-50' : 'text-neutral-300'}`}>
        {title}
      </span>
      {/* The sub-label is the point of the tile: it resolves the choice against
          THIS card, so "Every month" reads as "on the 19th" and a delete scope
          reads as "12 cards". */}
      {subtitle && (
        <span className="block mt-0.5 text-[10px] text-neutral-500 truncate">{subtitle}</span>
      )}
      {selected && (
        <span className={`absolute top-2 right-2 w-3.5 h-3.5 rounded-full flex items-center justify-center ${accent.dot}`}>
          <Check size={9} className="text-white" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
