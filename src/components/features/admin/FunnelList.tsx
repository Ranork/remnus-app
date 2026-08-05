'use client';

// Shared compact funnel visualization — a stacked list of stages with a
// progress bar and stage-to-stage conversion %. Extracted from
// AdminActivationFunnel.tsx (was a local, non-exported function there) so
// ProspectInviteFunnel.tsx can reuse the exact same look instead of a
// second copy of the same ~30 lines.
export default function FunnelList({ stages }: { stages: { label: string; count: number }[] }) {
  const base = Math.max(1, stages[0]?.count ?? 0);
  return (
    <div className="flex flex-col">
      {stages.map((s, i) => {
        const prev = i === 0 ? null : stages[i - 1].count;
        const conv = prev == null ? null : prev === 0 ? 0 : Math.round((s.count / prev) * 100);
        const widthPct = Math.max(4, Math.round((s.count / base) * 100));
        return (
          <div
            key={s.label}
            className={`flex flex-col gap-1.5 py-2.5 ${i < stages.length - 1 ? 'border-b border-neutral-800/70' : 'pb-0.5'} ${i === 0 ? 'pt-0.5' : ''}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-neutral-300">{s.label}</span>
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold tabular-nums text-neutral-100">{s.count}</span>
                {conv != null && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      conv >= 50 ? 'bg-green-500/12 text-green-400' : conv >= 25 ? 'bg-amber-500/12 text-amber-400' : 'bg-red-500/12 text-red-400'
                    }`}
                  >
                    {conv}%
                  </span>
                )}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-neutral-850">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${widthPct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
