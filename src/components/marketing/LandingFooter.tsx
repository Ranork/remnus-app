import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

export default async function LandingFooter() {
  const t = await getTranslations('Landing');
  const year = new Date().getFullYear();

  const cols: { head: string; headHref?: string; links: { label: string; href: string }[] }[] = [
    {
      head: t('bridgeFooterColProtocol'),
      headHref: '/wiki',
      links: [
        { label: t('bridgeFooterProtocolMcp'),      href: '/wiki' },
        { label: t('bridgeFooterProtocolSdk'),       href: '/wiki/getting-started' },
        { label: t('bridgeFooterProtocolConnect'),   href: '/wiki/connect-editors' },
        { label: t('bridgeFooterProtocolTools'),     href: '/wiki/read-tools' },
        { label: t('bridgeFooterProtocolResources'), href: '/wiki/resources' },
      ],
    },
    {
      head: t('bridgeFooterCompanyBlog'),
      headHref: '/docs',
      links: [
        { label: 'How I Built Remnus',        href: '/docs/how-i-built-mcp-native' },
        { label: 'Remnus vs Notion MCP',      href: '/docs/remnus-vs-notion-mcp' },
        { label: 'MCP-Native vs Integrated',  href: '/docs/mcp-native-vs-integrated' },
        { label: 'Why AGPL-3.0',              href: '/docs/why-agpl-3' },
      ],
    },
    {
      head: t('bridgeFooterColIntegrations'),
      links: [
        { label: 'Claude',   href: '/#integrations' },
        { label: 'Cursor',   href: '/#integrations' },
        { label: 'Windsurf', href: '/#integrations' },
        { label: 'ChatGPT',  href: '/#integrations' },
      ],
    },
    {
      head: t('bridgeFooterColCompany'),
      links: [
        { label: t('bridgeFooterCompanyContact'),   href: '/contact' },
        { label: t('bridgeFooterCompanyPrivacy'),   href: '/privacy' },
        { label: t('bridgeFooterCompanyMobileApp'), href: '/download#mobile-install' },
        { label: t('bridgeFooterCompanyPricing'),   href: '/pricing' },
        { label: t('bridgeFooterCompanySecurity'),  href: '/security' },
        { label: t('bridgeFooterCompanyBrand'),     href: '/brand' },
      ],
    },
  ];

  return (
    <footer className="border-t border-neutral-800">
      <div className="px-4 sm:px-8 lg:px-14 py-12 lg:py-16">
        <div className="max-w-7xl mx-auto grid gap-10 lg:gap-16 grid-cols-2 sm:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          {/* Left: logo + tagline + copyright */}
          <div className="flex flex-col gap-4 col-span-2 sm:col-span-3 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image src="/logo-square-transparent.png" alt="Remnus" width={22} height={22} />
              <span className="font-semibold text-neutral-100 text-[15px] tracking-[-0.01em]">Remnus</span>
            </Link>
            <p className="text-[13.5px] text-dim leading-[1.55] max-w-55">
              {t('bridgeFooterTagline')}
            </p>
            <span className="font-mono text-[11px] text-dimmer mt-auto">
              {t('bridgeFooterCopyright', { year })}
            </span>
          </div>

          {/* 3 link columns */}
          {cols.map((col) => (
            <div key={col.head} className="flex flex-col gap-3">
              {col.headHref ? (
                <Link
                  href={col.headHref}
                  className="font-mono text-[11px] text-dim hover:text-neutral-100 uppercase tracking-[0.12em] mb-1 transition-colors duration-150"
                >
                  {col.head}
                </Link>
              ) : (
                <span className="font-mono text-[11px] text-dim uppercase tracking-[0.12em] mb-1">
                  {col.head}
                </span>
              )}
              {col.links.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="text-[13.5px] text-neutral-50 hover:text-neutral-100 transition-colors duration-150"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom strip: Akatron Network attribution + Scout Forge listing badge */}
      <div className="border-t border-neutral-800 px-4 py-5 flex flex-wrap items-center justify-center gap-3">
        <a
          href="https://akatron.net"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-4 py-2 text-[12.5px] text-dim hover:border-neutral-700 hover:text-dimmer transition-colors duration-150"
        >
          <Image src="/akatron-logo.png" alt="" width={16} height={16} className="shrink-0" />
          {t.rich('bridgeFooterCraftedBy', {
            b: (chunks) => <span className="font-semibold text-neutral-100">{chunks}</span>,
          })}
        </a>
        {/* Remotely served SVG badge — next/image would need a remotePatterns
            entry and buys nothing for a vector asset, so it stays a plain <img>. */}
        <a
          href="https://scoutforge.net/apps/remnus?ref=badge"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex opacity-90 hover:opacity-100 transition-opacity duration-150"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://scoutforge.net/badge/remnus/image?theme=dark&size=default"
            alt="Remnus on Scout Forge"
            width={300}
            height={72}
            loading="lazy"
            decoding="async"
            className="h-10 w-auto"
          />
        </a>
      </div>
    </footer>
  );
}
