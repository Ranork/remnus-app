import Image from 'next/image';
import Link from '@/components/ui/link';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import SectionHead from './SectionHead';

/** The two other ways to open Remnus, each with the screen it shows; the whole sheet is the link. */
export default async function SiteApps() {
  const t = await getTranslations('Site.apps');
  const apps = [
    { title: t('desktopTitle'), body: t('desktopBody'), cta: t('desktopCta'), href: '/download', shot: 'board', alt: t('desktopAlt'), phone: false },
    { title: t('phoneTitle'), body: t('phoneBody'), cta: t('phoneCta'), href: '/download#mobile-install', shot: 'phone', alt: t('phoneAlt'), phone: true },
  ];

  return (
    <section className="px-4 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-[1200px]">
        <SectionHead title={t('title')} />
        <div className="mt-12 grid gap-6 md:grid-cols-[1.5fr_1fr] lg:mt-16">
          {apps.map((app) => (
            <Link
              key={app.title}
              href={app.href}
              className="group flex flex-col overflow-hidden rounded-[14px] bg-sheet shadow-sheet transition-shadow duration-200 hover:shadow-float"
            >
              <div className="p-6 lg:p-7">
                <h3 className="m-0 text-lg font-semibold tracking-[-0.015em] text-fg">{app.title}</h3>
                <p className="m-0 mt-1.5 text-[15px] leading-[1.6] text-fg-2">{app.body}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-fg underline decoration-line-strong underline-offset-4 group-hover:decoration-fg-3">
                  {app.cta}
                  <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                </span>
              </div>
              <div className={app.phone ? 'mt-auto flex h-64 justify-center overflow-hidden px-6 lg:h-72' : 'mt-auto h-64 overflow-hidden pl-6 lg:h-72 lg:pl-7'}>
                <div
                  className={
                    app.phone
                      ? 'w-56 overflow-hidden rounded-t-[26px] bg-desk p-1.5 pb-0 ring-1 ring-line-strong'
                      : 'overflow-hidden rounded-tl-surface ring-1 ring-line-strong'
                  }
                >
                  {(['dark', 'light'] as const).map((tone) => (
                    <Image
                      key={tone}
                      src={`/marketing/app-${app.shot}-${tone}.webp`}
                      alt={app.alt}
                      width={app.phone ? 780 : 2400}
                      height={app.phone ? 1688 : 1500}
                      sizes={app.phone ? '224px' : '(min-width: 1240px) 700px, 100vw'}
                      className={`site-shot-${tone} h-auto ${app.phone ? 'w-full rounded-t-[20px]' : 'w-[880px] max-w-none'}`}
                    />
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
