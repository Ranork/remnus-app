import Link from '@/components/ui/link';
import type { BlogPost } from '@/lib/content/manifest';

// One article card on the /docs blog index.
export default function BlogCard({ post, dateLabel }: { post: BlogPost; dateLabel: string }) {
  return (
    <Link
      href={`/docs/${post.slug}`}
      className="group flex flex-col gap-3 rounded-[14px] bg-sheet p-6 shadow-sheet transition-shadow duration-200 hover:shadow-[0_0_0_1px_var(--color-line-strong),var(--shadow-sheet)]"
    >
      <div className="flex items-center gap-3">
        <post.icon size={18} className="shrink-0 text-fg-3" />
        <time className="text-ui text-fg-3">{dateLabel}</time>
      </div>
      <h2 className="m-0 text-[17px] leading-snug font-semibold tracking-[-0.01em] text-fg">{post.title}</h2>
      <p className="m-0 grow text-[15px] leading-[1.6] text-fg-2">{post.description}</p>
    </Link>
  );
}
