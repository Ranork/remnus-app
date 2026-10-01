import { cn } from '@/lib/cn';

/** A section's heading on the left and its one supporting sentence on the right. */
export default function SectionHead({ title, lede, className }: { title: string; lede?: string; className?: string }) {
  return (
    <div className={cn('grid gap-4 lg:grid-cols-12 lg:items-end lg:gap-10', className)}>
      <h2 className="m-0 text-[32px] leading-[1.06] font-semibold tracking-[-0.035em] text-balance text-fg sm:text-[40px] lg:col-span-7 lg:text-[46px]">
        {title}
      </h2>
      {lede && <p className="m-0 max-w-[30rem] text-base leading-[1.6] text-fg-2 sm:text-[17px] lg:col-span-5 lg:pb-1.5">{lede}</p>}
    </div>
  );
}
