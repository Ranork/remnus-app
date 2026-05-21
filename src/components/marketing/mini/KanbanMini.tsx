const COLS = [
  {
    name: 'Backlog', color: 'var(--color-dim)', n: 5,
    cards: [
      { t: 'Set up i18n loader',         tag: 'infra',   tc: 'var(--color-opt-purple)' },
      { t: 'API rate limiting strategy',  tag: 'backend', tc: 'var(--color-opt-teal)'   },
      { t: 'Dark mode token audit',       tag: 'design',  tc: 'var(--color-opt-pink)'   },
    ],
  },
  {
    name: 'In progress', color: 'var(--color-blue-500)', n: 2,
    cards: [
      { t: 'Kanban segmented border', tag: 'design', tc: 'var(--color-opt-pink)'   },
      { t: 'Inline cell editor',      tag: 'editor', tc: 'var(--color-amber-500)' },
    ],
  },
  {
    name: 'Review', color: 'var(--color-opt-yellow)', n: 1,
    cards: [
      { t: 'MCP token auth',  tag: 'infra', tc: 'var(--color-opt-teal)' },
    ],
  },
  {
    name: 'Done', color: 'var(--color-green-400)', n: 8,
    cards: [
      { t: 'TanStack Query provider', tag: 'infra',   tc: 'var(--color-opt-purple)' },
      { t: 'Demo mode reset action',  tag: 'auth',    tc: 'var(--color-opt-teal)'   },
      { t: 'Drag-reorder workspaces', tag: 'sidebar', tc: 'var(--color-opt-purple)' },
    ],
  },
] as const;

export default function KanbanMini() {
  return (
    <div className="grid grid-cols-4 gap-3 bg-neutral-850 p-5 min-w-120">
      {COLS.map((col) => (
        <div key={col.name} className="flex flex-col gap-2">
          {/* column header */}
          <div className="flex items-center gap-2 px-0.5 pb-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: col.color }} />
            <span className="text-[12px] font-medium uppercase tracking-wider text-neutral-400 leading-none">
              {col.name}
            </span>
            <span className="text-dim text-[11px] font-mono tabular-nums">{col.n}</span>
          </div>

          {/* cards */}
          {col.cards.map((c) => (
            <div
              key={c.t}
              className="bg-neutral-800/40 rounded flex flex-col gap-2 py-2.5 px-3"
              style={{ borderLeft: `2.5px solid ${c.tc}` }}
            >
              <span className="text-neutral-100 font-medium text-[12.5px] leading-[1.3]">{c.t}</span>
              <span
                className="self-start font-mono text-[10.5px] px-1.5 py-0.5 rounded-sm"
                style={{ color: c.tc, background: `color-mix(in oklab, ${c.tc} 14%, transparent)` }}
              >
                {c.tag}
              </span>
            </div>
          ))}

          {/* add card placeholder */}
          <div className="flex items-center gap-1.5 px-1 py-1.5 text-neutral-600 hover:text-neutral-400 cursor-pointer">
            <span className="text-[15px] leading-none font-light">+</span>
            <span className="text-[11.5px]">New</span>
          </div>
        </div>
      ))}
    </div>
  );
}
