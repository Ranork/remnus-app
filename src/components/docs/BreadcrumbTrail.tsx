import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export type BreadcrumbItem = { name: string; href?: string };

// Visible breadcrumb trail — deliberately mirrors the BreadcrumbList JSON-LD
// (see src/lib/content/seo.ts) so structured data matches what's on the page.
export default function BreadcrumbTrail({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1.5 flex-wrap text-[12.5px] text-neutral-500">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={12} className="text-neutral-700 shrink-0" />}
            {item.href ? (
              <Link href={item.href} className="hover:text-neutral-300 transition-colors duration-150">
                {item.name}
              </Link>
            ) : (
              <span className="text-neutral-300" aria-current="page">{item.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
