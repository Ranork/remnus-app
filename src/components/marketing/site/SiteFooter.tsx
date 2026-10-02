import Image from 'next/image';
import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import { RemnusMark } from '@/components/ui/remnus-mark';

export default async function SiteFooter({ home }: { home: string }) {
  const t = await getTranslations('Site.footer');
  const l = await getTranslations('Landing');
  const year = new Date().getFullYear();

  const cols = [
    {
      head: t('product'),
      links: [
        { label: l('bridgeFooterCompanyPricing'), href: '/pricing' },
        { label: l('bridgeNavDownload'), href: '/download' },
        { label: l('bridgeFooterCompanyMobileApp'), href: '/download#mobile-install' },
        { label: l('bridgeFooterCompanySecurity'), href: '/security' },
      ],
    },
    {
      head: t('docs'),
      links: [
        { label: l('bridgeFooterProtocolSdk'), href: '/wiki/getting-started' },
        { label: l('bridgeFooterProtocolConnect'), href: '/wiki/connect-editors' },
        { label: l('bridgeFooterProtocolContext'), href: '/wiki/context-first' },
        { label: l('bridgeFooterProtocolTools'), href: '/wiki/read-tools' },
      ],
    },
    {
      head: t('blog'),
      links: [
        { label: 'OKF Context Engine', href: '/docs/okf-context-engine-for-ai-agents' },
        { label: 'Remnus vs Notion MCP', href: '/docs/remnus-vs-notion-mcp' },
        { label: 'How I Built Remnus', href: '/docs/how-i-built-mcp-native' },
      ],
    },
    {
      head: t('company'),
      links: [
        { label: l('bridgeFooterCompanyContact'), href: '/contact' },
        { label: l('bridgeFooterCompanyPrivacy'), href: '/privacy' },
        { label: l('bridgeFooterCompanyBrand'), href: '/brand' },
        { label: 'GitHub', href: 'https://github.com/Ranork/remnus-app' },
      ],
    },
  ];

  return (
    <footer className="border-t border-line px-4 sm:px-8">
      <div className="mx-auto grid max-w-[1200px] gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(4,1fr)] lg:py-16">
        <div className="flex flex-col gap-3">
          <Link href={home} className="flex w-fit items-center gap-2 text-[15px] font-semibold text-fg">
            <RemnusMark className="size-[18px]" />
            Remnus
          </Link>
          <p className="m-0 max-w-[16rem] text-sm leading-[1.6] text-fg-3">{t('tagline')}</p>
        </div>
        {cols.map((col) => (
          <div key={col.head}>
            <h3 className="m-0 text-ui font-medium text-fg-3">{col.head}</h3>
            <ul className="m-0 mt-3 list-none space-y-2 p-0">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-fg-2 transition-colors hover:text-fg">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 border-t border-line py-6 text-ui text-fg-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{l('bridgeFooterCopyright', { year })}</span>
        <a href="https://akatron.net" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 transition-colors hover:text-fg-2">
          <Image src="/akatron-logo.png" alt="" width={14} height={14} />
          {l.rich('bridgeFooterCraftedBy', { b: (chunks) => <span className="font-medium text-fg-2">{chunks}</span> })}
        </a>
      </div>
    </footer>
  );
}
