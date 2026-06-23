export default function PageEditorLoading() {
  return (
    <div className="flex-1 overflow-y-auto bg-neutral-850">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 lg:px-16 py-6 sm:py-10 animate-pulse">
        {/* Header bar: back link (left) · SaveStatus + ⋯ (right) */}
        <div className="mb-10 flex items-center justify-between">
          <div className="h-4 w-40 rounded bg-neutral-800/60" />
          <div className="flex items-center gap-3">
            <div className="h-4 w-14 rounded bg-neutral-800/60" />
            <div className="h-7 w-7 rounded border border-neutral-800 bg-neutral-800/40" />
          </div>
        </div>

        {/* Icon + Title (side by side) */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded bg-neutral-800 shrink-0" />
          <div className="h-9 w-1/2 rounded bg-neutral-800" />
        </div>

        {/* Inline properties (label + value rows, full width) */}
        <div className="mb-12 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col sm:flex-row sm:gap-8 pb-3 border-b border-neutral-800/60"
            >
              <div className="h-4 w-32 rounded bg-neutral-800/60 shrink-0 mb-2 sm:mb-0" />
              <div className="h-4 w-44 rounded bg-neutral-800/60" />
            </div>
          ))}
        </div>

        {/* Content lines */}
        <div className="space-y-3">
          <div className="h-4 rounded bg-neutral-800 w-full" />
          <div className="h-4 rounded bg-neutral-800 w-5/6" />
          <div className="h-4 rounded bg-neutral-800 w-4/5" />
          <div className="h-4 rounded bg-neutral-800 w-3/4" />
        </div>
      </div>
    </div>
  );
}
