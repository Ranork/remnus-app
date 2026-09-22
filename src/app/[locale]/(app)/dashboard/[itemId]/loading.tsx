export default function DashboardLoading() {
  return (
    <div className="flex-1 overflow-y-auto bg-neutral-850">
      <div className="mx-auto w-full max-w-6xl animate-pulse px-5 py-8 sm:px-10 sm:py-10">
        {/* Icon + title */}
        <div className="mb-6 flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded bg-neutral-800" />
          <div className="h-8 w-1/3 rounded bg-neutral-800" />
        </div>

        {/* Block grid: four metrics, then two wide tiles */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 border border-neutral-800 bg-neutral-900 p-4 lg:col-span-1">
              <div className="mb-3 h-2.5 w-16 rounded bg-neutral-800/60" />
              <div className="h-7 w-14 rounded bg-neutral-800" />
            </div>
          ))}
          {[0, 1].map((i) => (
            <div key={i} className="h-48 border border-neutral-800 bg-neutral-900 p-4 lg:col-span-2">
              <div className="mb-4 h-2.5 w-24 rounded bg-neutral-800/60" />
              <div className="space-y-2.5">
                <div className="h-2.5 w-full rounded bg-neutral-800" />
                <div className="h-2.5 w-5/6 rounded bg-neutral-800" />
                <div className="h-2.5 w-2/3 rounded bg-neutral-800" />
                <div className="h-2.5 w-3/4 rounded bg-neutral-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
