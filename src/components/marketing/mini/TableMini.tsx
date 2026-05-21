import LandingChip from '../LandingChip';

const ALL_ROWS = [
  { t: 'MCP token auth & rate limiting',    st: 'In progress', stc: 'var(--color-blue-500)',   pri: 'High',   prc: 'var(--color-red-400)',     due: 'May 23', a: 'EA', ac: 'var(--color-opt-purple)', aiEdit: true },
  { t: 'Inline cell editor — date popover', st: 'In progress', stc: 'var(--color-blue-500)',   pri: 'Medium', prc: 'var(--color-amber-500)',   due: 'May 24', a: 'CK', ac: 'var(--color-opt-teal)'   },
  { t: 'Drag-reorder workspaces',           st: 'Review',      stc: 'var(--color-opt-yellow)', pri: 'Medium', prc: 'var(--color-amber-500)',   due: 'May 25', a: 'EA', ac: 'var(--color-opt-purple)' },
  { t: 'Kanban segmented border accent',    st: 'Done',        stc: 'var(--color-green-400)',  pri: 'Low',    prc: 'var(--color-opt-teal)',    due: 'May 21', a: 'SK', ac: 'var(--color-opt-yellow)' },
  { t: 'Audit Auth.js session caching',     st: 'Backlog',     stc: 'var(--color-dim)',        pri: 'High',   prc: 'var(--color-red-400)',     due: 'May 28', a: 'EA', ac: 'var(--color-opt-purple)' },
  { t: 'Mobile bottom-sheet peek modal',    st: 'Backlog',     stc: 'var(--color-dim)',        pri: 'Low',    prc: 'var(--color-opt-teal)',    due: 'Jun 02', a: 'CK', ac: 'var(--color-opt-teal)'   },
];

const COLS = ['Title', 'Status', 'Priority', 'Due', 'Assignee'];
const GRID = 'minmax(0,2fr) minmax(0,1fr) minmax(0,0.9fr) minmax(0,0.7fr) minmax(0,0.6fr)';

interface TableMiniProps { rows?: number }

export default function TableMini({ rows = 6 }: TableMiniProps) {
  const shown = ALL_ROWS.slice(0, rows);
  return (
    <div className="w-full min-w-140 bg-neutral-850">
      {/* header */}
      <div
        className="grid px-4 py-2 border-b border-neutral-800 bg-neutral-900"
        style={{ gridTemplateColumns: GRID }}
      >
        {COLS.map((c) => (
          <span key={c} className="font-mono text-[11px] text-neutral-400 uppercase tracking-wider whitespace-nowrap">
            {c}
          </span>
        ))}
      </div>

      {/* rows */}
      {shown.map((r, i) => (
        <div
          key={i}
          className="relative grid items-center px-4 py-2.5"
          style={{
            gridTemplateColumns: GRID,
            borderBottom: '1px solid var(--color-border-soft)',
            background: r.aiEdit ? 'rgba(68,92,149,0.10)' : 'transparent',
          }}
        >
          {r.aiEdit && (
            <span className="absolute top-1 right-3 font-mono text-[10px] text-accent-strong tracking-[0.04em]">
              · claude
            </span>
          )}

          {/* Title */}
          <span className="text-neutral-100 text-[13px] overflow-hidden text-ellipsis whitespace-nowrap pr-10">
            {r.t}
          </span>

          {/* Status */}
          <span className="inline-flex overflow-hidden">
            <LandingChip color={r.stc} dot>
              <span className="truncate block">{r.st}</span>
            </LandingChip>
          </span>

          {/* Priority */}
          <span className="inline-flex overflow-hidden">
            <LandingChip color={r.prc}>
              <span className="truncate block">{r.pri}</span>
            </LandingChip>
          </span>

          {/* Due */}
          <span className="font-mono text-[11.5px] text-neutral-50">{r.due}</span>

          {/* Assignee */}
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center font-mono text-[9px] font-semibold text-white"
            style={{ background: r.ac }}
          >
            {r.a}
          </span>
        </div>
      ))}

      {/* add row */}
      <div className="flex items-center gap-2 px-4 py-2 text-neutral-600">
        <span className="text-[15px] leading-none font-light">+</span>
        <span className="text-[12px]">New</span>
      </div>
    </div>
  );
}
