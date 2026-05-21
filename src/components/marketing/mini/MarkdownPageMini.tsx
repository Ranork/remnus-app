const CHECKLIST = [
  { done: true,  text: 'Drag-reorder workspaces' },
  { done: true,  text: 'Inline cell editor' },
  { done: false, text: 'Date format selector' },
  { done: false, text: 'Per-view default icon', aiEdit: true },
];

interface MarkdownPageMiniProps {
  width?: number;
}

export default function MarkdownPageMini({ width = 520 }: MarkdownPageMiniProps) {
  return (
    <div className="bg-neutral-850 px-5 py-4 text-[12px] leading-[1.5] w-full" style={{ maxWidth: width }}>
      <div className="text-[19px] font-bold text-neutral-100 tracking-[-0.015em] mb-1.5">
        Sprint 14 kickoff
      </div>
      <div className="text-neutral-50 mb-2.5 text-[11.5px]">
        Ship the Kanban borders, finish mobile peek, unblock{' '}
        <span className="text-accent-strong">Hindi</span>
        {' '}+{' '}
        <span className="text-accent-strong">Türkçe</span>
        {' '}review.
      </div>
      <div className="flex flex-col gap-[5px] mb-2.5">
        {CHECKLIST.map((it, i) => (
          <div
            key={i}
            className={`flex items-center gap-1.5 text-[11.5px] ${it.done ? 'text-dim line-through' : 'text-neutral-100'}`}
          >
            <span
              className="w-[11px] h-[11px] rounded-[2px] shrink-0 inline-flex items-center justify-center text-[8px] text-white"
              style={{
                border: `1px solid ${it.done ? 'var(--color-blue-500)' : 'var(--color-neutral-800)'}`,
                background: it.done ? 'var(--color-blue-500)' : 'transparent',
              }}
            >
              {it.done ? '✓' : ''}
            </span>
            <span className="flex-1">{it.text}</span>
            {it.aiEdit && (
              <span className="font-mono text-[8.5px] bg-blue-500 text-white px-1 py-0.5 rounded-[2px] tracking-[0.04em]">
                cursor
              </span>
            )}
          </div>
        ))}
      </div>
      <div
        className="px-2.5 py-1.5 text-[11px] text-neutral-50"
        style={{ borderLeft: '2px solid var(--color-blue-500)', background: 'rgba(68,92,149,0.14)' }}
      >
        💡 Linked database —{' '}
        <span className="text-accent-strong">📊 Sprint Board</span>
      </div>
    </div>
  );
}
