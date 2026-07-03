import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { BlogPost } from '@/lib/content/manifest';

// One article card on the /docs blog index.
export default function BlogCard({ post, dateLabel }: { post: BlogPost; dateLabel: string }) {
  return (
    <Link
      href={`/docs/${post.slug}`}
      className="group flex flex-col gap-3 p-6 rounded-xl border border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 hover:bg-neutral-900/70 transition-colors duration-200"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 shrink-0">
          <post.icon size={18} />
        </span>
        <time className="font-mono text-[11px] uppercase tracking-wide text-neutral-500">
          {dateLabel}
        </time>
      </div>

      <h2 className="text-[17px] font-semibold text-neutral-100 leading-snug tracking-[-0.01em] m-0">
        {post.title}
      </h2>

      <p className="text-[13.5px] text-dim leading-[1.6] m-0 grow">
        {post.description}
      </p>

      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-blue-500 group-hover:gap-2.5 transition-all duration-200">
        <ArrowRight size={14} />
      </span>
    </Link>
  );
}
