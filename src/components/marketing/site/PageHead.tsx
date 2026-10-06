import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** The heading of an inner site page (pricing, download, contact…): an H1 and one sentence. */
export default function PageHead({
  title,
  lede,
  align = 'start',
  className,
}: {
  title: ReactNode;
  lede?: string;
  /** `center` for a page whose hero is one centred action (download). */
  align?: 'start' | 'center';
  className?: string;
}) {
  const centered = align === 'center';
  return (
    <div className={cn('max-w-[46rem]', centered && 'mx-auto text-center', className)}>
      <h1 className="m-0 text-[36px] leading-[1.04] font-semibold tracking-[-0.04em] text-balance text-fg sm:text-[48px] lg:text-[56px]">
        {title}
      </h1>
      {lede && <p className={cn('m-0 mt-5 max-w-[38rem] text-base leading-[1.6] text-fg-2 sm:text-[17px]', centered && 'mx-auto')}>{lede}</p>}
    </div>
  );
}
