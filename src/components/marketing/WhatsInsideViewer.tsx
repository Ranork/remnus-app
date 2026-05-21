'use client';

import { useState, useEffect } from 'react';
import KanbanMini from './mini/KanbanMini';
import TableMini from './mini/TableMini';
import CalendarMini from './mini/CalendarMini';

const CYCLE_MS = 4000;

interface Props {
  breadcrumb1: string;
  breadcrumb2: string;
  viewLabel: string;
  labels: [string, string, string];
  subs: [string, string, string];
  footer1: string;
  footer2: string;
}

export default function WhatsInsideViewer({
  breadcrumb1, breadcrumb2, viewLabel,
  labels, subs, footer1, footer2,
}: Props) {
  const [active, setActive] = useState(0);

  // Reset interval on every change so user clicks also reset the timer
  useEffect(() => {
    const id = setInterval(() => setActive(p => (p + 1) % 3), CYCLE_MS);
    return () => clearInterval(id);
  }, [active]);

  const panels = [
    { sub: subs[0], content: <KanbanMini /> },
    { sub: subs[1], content: <TableMini rows={6} /> },
    { sub: subs[2], content: <CalendarMini /> },
  ];

  return (
    <div
      className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden"
      style={{ boxShadow: '0 30px 60px -20px rgba(0,0,0,0.4)' }}
    >
      {/* breadcrumb / view bar */}
      <div className="flex items-center gap-3 sm:gap-3 px-4 sm:px-5 py-3 border-b border-neutral-800 bg-neutral-850">
        {/* breadcrumb — hidden on mobile, too cramped */}
        <span className="text-dim text-[13px] hidden sm:block">{breadcrumb1}</span>
        <span className="text-neutral-100 text-[13px] hidden sm:block">{breadcrumb2}</span>
        <span className="hidden sm:block flex-1" />
        <span className="text-dim text-[12px] hidden sm:block">{viewLabel}</span>
        {labels.map((lbl, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`text-[12.5px] pb-0.5 transition-colors duration-200 cursor-pointer ${
              active === i
                ? 'text-neutral-100 font-medium'
                : 'text-dim hover:text-neutral-100'
            }`}
            style={active === i ? { borderBottom: '1.5px solid var(--color-accent-strong)' } : undefined}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* sliding panels */}
      <div className="overflow-hidden">
        <div
          className="flex"
          style={{
            transform: `translateX(-${active * 100}%)`,
            transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {panels.map((panel, i) => (
            <div key={i} className="min-w-full bg-neutral-850 flex flex-col">
              {/* panel header */}
              <div className="relative flex items-center gap-3 px-6 pt-5 pb-4">
                <div>
                  <div className="text-[15px] font-semibold text-neutral-100 tracking-tight">
                    {labels[i]}
                  </div>
                  <div className="font-mono text-[11px] text-dim mt-0.5 tracking-[0.02em]">
                    {panel.sub}
                  </div>
                </div>
                <span className="absolute top-5 right-6 font-mono text-[10px] px-1.5 py-0.5 rounded-[3px] tracking-[0.06em] uppercase transition-all duration-300"
                  style={{
                    background: active === i ? 'var(--color-blue-500)' : 'transparent',
                    color: active === i ? 'white' : 'transparent',
                  }}
                >
                  active
                </span>
              </div>

              {/* mini view — horizontally scrollable on mobile */}
              <div className="px-4 sm:px-6 pb-7 overflow-x-auto">
                {panel.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* progress dots */}
      <div className="flex items-center justify-center gap-2 py-2.5 bg-neutral-850 border-t border-neutral-800/50">
        {[0, 1, 2].map(i => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className="rounded-full transition-all duration-300 cursor-pointer"
            style={{
              width: active === i ? 16 : 6,
              height: 6,
              background: active === i ? 'var(--color-blue-500)' : 'var(--color-neutral-700)',
            }}
          />
        ))}
      </div>

      {/* footer */}
      <div className="flex items-center gap-2.5 flex-wrap px-6 py-3.5 border-t border-neutral-800 bg-neutral-850 text-[12.5px] text-dim">
        <span className="w-1.75 h-1.75 rounded-full shrink-0 bg-accent-strong" />
        <span className="text-neutral-100">{footer1}</span>
        <span className="flex-1" />
        <span className="font-mono text-accent-strong">{footer2}</span>
      </div>
    </div>
  );
}
