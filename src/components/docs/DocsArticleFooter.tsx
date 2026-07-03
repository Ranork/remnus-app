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
    <footer className="mt-14 pt-8 border-t border-neutral-800">
      <Link
        href="/docs"
        className="inline-flex items-center gap-1.5 text-[13px] text-neutral-400 hover:text-neutral-100 transition-colors duration-150"
      >
        <ChevronLeft size={14} />
        {backLabel}
      </Link>

      {(prev || next) && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {prev ? (
            <Link
              href={`/docs/${prev.slug}`}
              className="group flex flex-col gap-1 p-4 rounded-lg border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/50 transition-colors duration-200"
            >
              <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wide text-neutral-500">
                <ArrowLeft size={12} /> {prevLabel}
              </span>
              <span className="text-[13.5px] font-medium text-neutral-200 group-hover:text-neutral-100 leading-snug">
                {prev.title}
              </span>
            </Link>
          ) : (
            <span />
          )}

          {next && (
            <Link
              href={`/docs/${next.slug}`}
              className="group flex flex-col gap-1 p-4 rounded-lg border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/50 transition-colors duration-200 sm:text-right"
            >
              <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wide text-neutral-500 sm:justify-end">
                {nextLabel} <ArrowRight size={12} />
              </span>
              <span className="text-[13.5px] font-medium text-neutral-200 group-hover:text-neutral-100 leading-snug">
                {next.title}
              </span>
            </Link>
          )}
        </div>
      )}
    </footer>
  );
}
