'use client';

import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * A section under the page body — comments, knowledge context, backlinks, local map.
 * A hairline and a heading, no card around it (V2 R8.1). Pass `onToggle` to make the
 * heading a disclosure button; without it the section is always open.
 */
export default function PageSection({
  icon,
  title,
  meta,
  open = true,
  onToggle,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<'section'>, 'title'> & {
  icon: React.ReactNode;
  title: React.ReactNode;
  /** Quiet text after the title (a count, a status). */
  meta?: React.ReactNode;
  open?: boolean;
  onToggle?: () => void;
}) {
  const heading = (
    <>
      {onToggle && (
        <ChevronRight
          aria-hidden
          className={cn('size-3.5 shrink-0 text-fg-4 transition-transform duration-150', open && 'rotate-90')}
        />
      )}
      <span aria-hidden className="flex shrink-0 text-fg-3 [&_svg]:size-3.5">{icon}</span>
      <span>{title}</span>
      {meta != null && meta !== '' && <span className="font-normal text-fg-3">{meta}</span>}
    </>
  );

  return (
    <section className={cn('mt-6 border-t border-line pt-4', className)} {...props}>
      {onToggle ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="-mx-1.5 flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-ui font-medium text-fg-2 transition-colors hover:bg-hover hover:text-fg"
        >
          {heading}
        </button>
      ) : (
        <h2 className="flex items-center gap-1.5 py-0.5 text-ui font-medium text-fg-2">{heading}</h2>
      )}
      {open && children}
    </section>
  );
}
