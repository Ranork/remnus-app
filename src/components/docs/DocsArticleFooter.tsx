import Link from 'next/link';
import { ArrowLeft, ArrowRight, ChevronLeft } from 'lucide-react';
import type { BlogPost } from '@/lib/content/manifest';

// Prev/next + "back to blog" footer for a /docs article.
export default function DocsArticleFooter({
  prev,
  next,
  backLabel,
  prevLabel,
  nextLabel,
}: {
  prev: BlogPost | null;
  next: BlogPost | null;
  backLabel: string;
  prevLabel: string;
  nextLabel: string;
}) {
  return (
    <footer className="mt-14 border-t border-line pt-8">
      <Link
        href="/docs"
        className="inline-flex items-center gap-1.5 text-ui text-fg-3 transition-colors duration-150 hover:text-fg"
      >
        <ChevronLeft size={14} />
        {backLabel}
      </Link>

      {(prev || next) && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {prev ? (
            <Link
              href={`/docs/${prev.slug}`}
              className="group flex flex-col gap-1 rounded-control bg-raised p-4 shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors duration-200 hover:bg-hover/60"
            >
              <span className="inline-flex items-center gap-1.5 text-ui text-fg-3">
                <ArrowLeft size={12} /> {prevLabel}
              </span>
              <span className="text-sm leading-snug font-medium text-fg-2 group-hover:text-fg">
                {prev.title}
              </span>
            </Link>
          ) : (
            <span />
          )}

          {next && (
            <Link
              href={`/docs/${next.slug}`}
              className="group flex flex-col gap-1 rounded-control bg-raised p-4 shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors duration-200 hover:bg-hover/60 sm:text-right"
            >
              <span className="inline-flex items-center gap-1.5 text-ui text-fg-3 sm:justify-end">
                {nextLabel} <ArrowRight size={12} />
              </span>
              <span className="text-sm leading-snug font-medium text-fg-2 group-hover:text-fg">
                {next.title}
              </span>
            </Link>
          )}
        </div>
      )}
    </footer>
  );
}
