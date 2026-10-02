import Image from 'next/image';
import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import SectionHead from './SectionHead';

/** The two other ways to open Remnus, each with the screen it shows. */
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
            <div key={app.title} className="flex flex-col overflow-hidden rounded-[14px] bg-sheet shadow-sheet">
              <div className="p-6 lg:p-7">
                <h3 className="m-0 text-lg font-semibold tracking-[-0.015em] text-fg">{app.title}</h3>
                <p className="m-0 mt-1.5 text-[15px] leading-[1.6] text-fg-2">{app.body}</p>
                <Link
                  href={app.href}
                  className="mt-4 inline-flex text-sm font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg-3"
                >
                  {app.cta}
                </Link>
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
