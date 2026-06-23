export default function DatabaseLoading() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0 h-full bg-neutral-850">
      <div className="flex-1 flex flex-col w-full min-w-0 max-w-6xl mx-auto overflow-hidden pt-6 sm:pt-8 px-4 sm:px-8 animate-pulse">
        {/* Icon + Title (side by side) */}
        <div className="flex items-center gap-3 mb-8 shrink-0">
          <div className="h-10 w-10 rounded bg-neutral-800 shrink-0" />
          <div className="h-8 w-52 rounded bg-neutral-800" />
        </div>

        {/* Top bar: view tabs (left) + toolbar buttons (right), bottom border */}
        <div className="flex items-end justify-between border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-4 pb-2">
            <div className="h-6 w-16 rounded bg-neutral-800" />
            <div className="h-6 w-20 rounded bg-neutral-800/60" />
            <div className="h-6 w-20 rounded bg-neutral-800/60" />
          </div>
          <div className="flex items-center gap-2 pb-1.5">
            <div className="h-6 w-14 rounded bg-neutral-800/60" />
            <div className="h-6 w-16 rounded bg-neutral-800/60" />
            <div className="h-7 w-16 rounded bg-neutral-800" />
          </div>
        </div>

        {/* Table */}
        <div className="pt-4 pb-8">
          {/* Column header row */}
          <div className="flex gap-2 mb-2">
            <div className="h-8 w-48 rounded bg-neutral-800" />
            <div className="h-8 w-32 rounded bg-neutral-800" />
            <div className="h-8 w-32 rounded bg-neutral-800" />
            <div className="h-8 w-24 rounded bg-neutral-800" />
          </div>
          {/* Rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-2 mb-1">
              <div className="h-8 w-48 rounded bg-neutral-800/60" />
              <div className="h-8 w-32 rounded bg-neutral-800/60" />
              <div className="h-8 w-32 rounded bg-neutral-800/60" />
              <div className="h-8 w-24 rounded bg-neutral-800/60" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
