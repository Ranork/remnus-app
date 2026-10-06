import { Plus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

/** The questions people ask before they connect a repo; plain disclosure rows, no script. */
export default async function SiteFaq() {
  const t = await getTranslations('Site.faq');
  const items = t.raw('items') as { q: string; a: string }[];

  return (
    <section id="faq" className="scroll-mt-20 px-4 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-12">
        <h2 className="m-0 text-[32px] leading-[1.06] font-semibold tracking-[-0.035em] text-balance text-fg sm:text-[40px] lg:col-span-5 lg:text-[46px]">
          {t('title')}
        </h2>
        <div className="border-t border-line-strong lg:col-span-7">
          {items.map((item) => (
            <details key={item.q} className="group border-b border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[17px] font-medium text-fg [&::-webkit-details-marker]:hidden">
                {item.q}
                <Plus className="size-5 shrink-0 text-fg-3 transition-transform duration-200 group-open:rotate-45" aria-hidden />
              </summary>
              <p className="m-0 max-w-[62ch] pb-6 text-[15px] leading-[1.65] text-fg-2">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
