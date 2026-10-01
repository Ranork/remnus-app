import { cn } from '@/lib/cn';

/** The heading of an inner site page (pricing, download, contact…): an H1 and one sentence. */
export default function PageHead({ title, lede, className }: { title: string; lede?: string; className?: string }) {
  return (
    <div className={cn('max-w-[46rem]', className)}>
      <h1 className="m-0 text-[36px] leading-[1.04] font-semibold tracking-[-0.04em] text-balance text-fg sm:text-[48px] lg:text-[56px]">
        {title}
      </h1>
      {lede && <p className="m-0 mt-5 max-w-[38rem] text-base leading-[1.6] text-fg-2 sm:text-[17px]">{lede}</p>}
    </div>
  );
}
