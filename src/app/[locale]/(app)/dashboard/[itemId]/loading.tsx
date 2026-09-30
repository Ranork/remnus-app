export default function DashboardLoading() {
  return (
    <div className="flex-1 overflow-y-auto bg-sheet lg:bg-transparent">
      <div className="mx-auto w-full max-w-6xl animate-pulse px-5 py-8 sm:px-10 sm:py-10">
        {/* Icon + title */}
        <div className="mb-6 flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-surface bg-hover" />
          <div className="h-8 w-1/3 rounded-control bg-hover" />
        </div>

        {/* Block grid: four metrics, then two wide tiles */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-surface bg-raised lg:bg-sheet shadow-sheet p-4 lg:col-span-1">
              <div className="mb-3 h-2.5 w-16 rounded-sm bg-hover/70" />
              <div className="h-7 w-14 rounded-sm bg-hover" />
            </div>
          ))}
          {[0, 1].map((i) => (
            <div key={i} className="h-48 rounded-surface bg-raised lg:bg-sheet shadow-sheet p-4 lg:col-span-2">
              <div className="mb-4 h-2.5 w-24 rounded-sm bg-hover/70" />
              <div className="space-y-2.5">
                <div className="h-2.5 w-full rounded-sm bg-hover" />
                <div className="h-2.5 w-5/6 rounded-sm bg-hover" />
                <div className="h-2.5 w-2/3 rounded-sm bg-hover" />
                <div className="h-2.5 w-3/4 rounded-sm bg-hover" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
