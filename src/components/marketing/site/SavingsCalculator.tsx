'use client';

import { useId, useState } from 'react';
import { useLocale } from 'next-intl';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { SESSION_SAVED } from './savingsBenchmark';

export type CalculatorCopy = {
  title: string;
  sessions: string;
  price: string;
  tokens: string; // "{amount} million tokens a month"
  money: string; // label under the amount
  note: string;
};

const PRICES = ['1', '3', '15'] as const;
type Price = (typeof PRICES)[number];

/**
 * The money line, with its assumptions on screen: the measured per-session saving times
 * the sessions the visitor says they run, at the input price they pick. Nothing else goes
 * into the figure.
 */
export default function SavingsCalculator({ copy }: { copy: CalculatorCopy }) {
  const locale = useLocale();
  const sliderId = useId();
  const [sessions, setSessions] = useState(200);
  const [price, setPrice] = useState<Price>('3');

  const tokensPerMonth = sessions * 30 * SESSION_SAVED;
  const money = (tokensPerMonth / 1_000_000) * Number(price);
  const millions = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(tokensPerMonth / 1_000_000);
  const usd = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return (
    <div className="flex h-full flex-col rounded-[14px] bg-sheet p-6 shadow-sheet lg:p-7">
      <h3 className="m-0 text-[15px] font-semibold text-fg">{copy.title}</h3>

      <div className="mt-5" aria-live="polite">
        <div className="text-[56px] leading-none font-semibold tracking-[-0.045em] text-fg">{usd.format(money)}</div>
        <div className="mt-2 text-sm text-fg-2">{copy.money}</div>
        <div className="mt-1 text-ui text-fg-3">{copy.tokens.replace('{amount}', millions)}</div>
      </div>

      <div className="mt-7 border-t border-line pt-6">
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor={sliderId} className="text-ui text-fg-2">
            {copy.sessions}
          </label>
          <span className="text-ui font-semibold text-fg tabular-nums">{sessions}</span>
        </div>
        <input
          id={sliderId}
          type="range"
          min={10}
          max={1000}
          step={10}
          value={sessions}
          onChange={(e) => setSessions(Number(e.target.value))}
          className="site-range mt-3 w-full"
          style={{ ['--fill' as string]: `${((sessions - 10) / 990) * 100}%` }}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <span className="text-ui text-fg-2">{copy.price}</span>
        <SegmentedControl value={price} onValueChange={setPrice} aria-label={copy.price}>
          {PRICES.map((p) => (
            <SegmentedControlItem key={p} value={p} className="px-3">
              ${p}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>

      <p className="m-0 mt-6 text-xs leading-relaxed text-fg-3 lg:mt-auto lg:pt-6">{copy.note}</p>
    </div>
  );
}
