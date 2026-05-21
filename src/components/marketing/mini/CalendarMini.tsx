// Static May 2026 demo calendar. Mon-first. Today = 21.
// Week 1: Apr 27(dim) … May 3
// Week 2: May 4–10
// Week 3: May 11–17
// Week 4: May 18–24 (today=21)
// Week 5: May 25–31, Jun 1(dim)

const HEADERS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

type CalEvent = { color: string; title: string };

const EVENTS: Record<number, CalEvent[]> = {
  1:  [{ color: 'var(--color-blue-500)',   title: 'Sprint planning' }],
  4:  [{ color: 'var(--color-opt-pink)',   title: 'Design review'  }],
  6:  [{ color: 'var(--color-opt-teal)',   title: 'Team sync'      }],
  8:  [{ color: 'var(--color-opt-yellow)', title: 'MCP launch prep'}],
  11: [{ color: 'var(--color-blue-500)',   title: 'Sprint review'  }],
  14: [{ color: 'var(--color-green-400)',  title: 'Deployment'     }],
  15: [{ color: 'var(--color-opt-purple)', title: 'Retro'          }],
  18: [{ color: 'var(--color-blue-500)',   title: 'v2.0 Release'   }, { color: 'var(--color-opt-teal)', title: 'Demo' }],
  19: [{ color: 'var(--color-opt-yellow)', title: 'Planning'       }],
  21: [{ color: 'var(--color-blue-500)',   title: 'Sprint start'   }],
  22: [{ color: 'var(--color-opt-pink)',   title: 'Team demo'      }],
  25: [{ color: 'var(--color-opt-teal)',   title: 'Design handoff' }],
  28: [{ color: 'var(--color-opt-purple)', title: 'Sprint end'     }],
  29: [{ color: 'var(--color-blue-500)',   title: 'Planning'       }],
};

// Mon Apr 27 … Sun Jun 1 (5 weeks × 7 = 35 slots)
// May 2026: May 1 = Friday. Mon-first → first slot = Apr 27 (Mon).
// Apr 27–30 (4 dim) + May 1–31 (31) = 35 slots, exactly 5 rows.
const DAYS = (() => {
  const days: { d: number; dim: boolean }[] = [];
  for (let d = 27; d <= 30; d++) days.push({ d, dim: true });
  for (let d = 1; d <= 31; d++) days.push({ d, dim: false });
  return days;
})();

export default function CalendarMini() {
  return (
    <div className="w-full min-w-140 bg-neutral-850">
      {/* weekday headers */}
      <div className="grid grid-cols-7 border-b border-neutral-800 bg-neutral-900/60">
        {HEADERS.map((h) => (
          <div key={h} className="py-2 px-2 text-[10.5px] text-neutral-500 font-mono font-semibold tracking-wider text-right">
            {h}
          </div>
        ))}
      </div>

      {/* day grid */}
      <div className="grid grid-cols-7">
        {DAYS.map((day, i) => {
          const isToday = !day.dim && day.d === 21;
          const evs: CalEvent[] = !day.dim ? (EVENTS[day.d] ?? []) : [];
          return (
            <div
              key={i}
              className="flex flex-col gap-1 p-1.5"
              style={{
                minHeight: 76,
                borderRight: (i + 1) % 7 ? '1px solid var(--color-border-soft)' : 'none',
                borderBottom: '1px solid var(--color-border-soft)',
                background: isToday
                  ? 'rgba(68,92,149,0.10)'
                  : day.dim
                  ? 'rgba(0,0,0,0.12)'
                  : 'transparent',
              }}
            >
              {/* day number */}
              <span
                className={`self-end text-right leading-none font-mono text-[10.5px] font-semibold w-5 h-5 flex items-center justify-center rounded-full ${
                  isToday
                    ? 'bg-blue-600 text-white'
                    : day.dim
                    ? 'text-neutral-600'
                    : 'text-neutral-300'
                }`}
              >
                {day.d}
              </span>

              {/* events */}
              {evs.map((ev, j) => (
                <div
                  key={j}
                  className="rounded-xs px-1.5 py-0.5 text-[10px] leading-[1.4] truncate"
                  style={{
                    background: `color-mix(in oklab, ${ev.color} 18%, transparent)`,
                    color: ev.color,
                    borderLeft: `2px solid ${ev.color}`,
                  }}
                >
                  {ev.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
