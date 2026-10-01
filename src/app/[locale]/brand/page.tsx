import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import MarketingShell from '@/components/marketing/MarketingShell';
import PageHead from '@/components/marketing/site/PageHead';
import { RemnusMark } from '@/components/ui/remnus-mark';
import { METADATA_BASE_URL, DEFAULT_OG_IMAGE, DEFAULT_TWITTER_IMAGE } from '@/lib/metadata';

export const metadata: Metadata = {
  metadataBase: new URL(METADATA_BASE_URL),
  title: 'Brand Kit',
  description: 'Remnus brand kit: the logo, colour roles and typography behind the app and this site. A reference for visuals and press.',
  alternates: { canonical: 'https://remnus.com/brand' },
  openGraph: {
    title: 'Brand Kit | Remnus',
    description: 'Remnus brand kit — color palette and typography reference.',
    url: 'https://remnus.com/brand',
    siteName: 'Remnus',
    images: [DEFAULT_OG_IMAGE],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Brand Kit | Remnus',
    description: 'Remnus brand kit — color palette and typography reference.',
    images: [DEFAULT_TWITTER_IMAGE],
  },
};

// Values mirror the role tokens in globals.css (the source of truth): the default dark
// theme ("remnus") and Remnus's own light theme ("catppuccin" is its stored id). Kept as
// literal hex on purpose: a brand-kit reference shows the fixed brand colours, not
// whatever the active theme resolves a token to.
type Swatch = { token: string; dark: string; light: string };

export default async function BrandPage() {
  const t = await getTranslations('Brand');

  const colorGroups: { name: string; desc: string; colors: Swatch[] }[] = [
    {
      name: t('groupSurfaces'),
      desc: t('groupSurfacesDesc'),
      colors: [
        { token: 'desk', dark: '#111316', light: '#eceef1' },
        { token: 'sheet', dark: '#191b1f', light: '#ffffff' },
        { token: 'raised', dark: '#1f2226', light: '#f7f8fa' },
        { token: 'line', dark: '#2a2d33', light: '#e4e6ea' },
        { token: 'line-strong', dark: '#3c4047', light: '#d2d6dc' },
      ],
    },
    {
      name: t('groupText'),
      desc: t('groupTextDesc'),
      colors: [
        { token: 'fg', dark: '#eceef1', light: '#15171b' },
        { token: 'fg-2', dark: '#b0b4bc', light: '#454a53' },
        { token: 'fg-3', dark: '#979ca5', light: '#5f6570' },
        { token: 'fg-4', dark: '#5d626b', light: '#9ba0a9' },
      ],
    },
    {
      name: t('groupInk'),
      desc: t('groupInkDesc'),
      colors: [
        { token: 'ink', dark: '#eceef1', light: '#15171b' },
        { token: 'signal', dark: '#f0b43c', light: '#f5b300' },
        { token: 'signal-text', dark: '#f0b43c', light: '#5c4600' },
      ],
    },
    {
      name: t('groupSemantic'),
      desc: t('groupSemanticDesc'),
      colors: [
        { token: 'red-400', dark: '#cd4d55', light: '#d33c3c' },
        { token: 'green-400', dark: '#7fc36d', light: '#1a7f4b' },
        { token: 'amber-400', dark: '#d9914d', light: '#b86a0a' },
      ],
    },
    {
      name: t('groupData'),
      desc: t('groupDataDesc'),
      colors: [
        { token: 'chart-1', dark: '#3987e5', light: '#2a78d6' },
        { token: 'chart-2', dark: '#d95926', light: '#eb6834' },
        { token: 'chart-3', dark: '#199e70', light: '#1baf7a' },
        { token: 'chart-4', dark: '#c98500', light: '#eda100' },
        { token: 'chart-5', dark: '#d55181', light: '#e87ba4' },
        { token: 'chart-6', dark: '#008300', light: '#008300' },
        { token: 'chart-7', dark: '#9085e9', light: '#4a3aa7' },
        { token: 'chart-8', dark: '#e66767', light: '#e34948' },
      ],
    },
  ];

  const fonts: { name: string; role: string; className: string }[] = [
    { name: 'Onest', role: t('fontSansRole'), className: 'font-sans' },
    { name: 'JetBrains Mono', role: t('fontMonoRole'), className: 'font-mono' },
  ];

  return (
    <MarketingShell>
      <section className="px-4 sm:px-8">
        <div className="mx-auto max-w-[1200px] pt-14 pb-24 sm:pt-20 lg:pb-32">
          <PageHead title={t('title')} lede={t('intro')} />

          {/* Logo */}
          <div className="mt-14 grid gap-4 sm:grid-cols-2">
            <div className="flex h-44 items-center justify-center gap-3 rounded-[14px] bg-[#111316] text-[#eceef1] ring-1 ring-line-strong">
              <RemnusMark className="size-9" />
              <span className="text-[28px] font-semibold tracking-[-0.02em]">Remnus</span>
            </div>
            <div className="flex h-44 items-center justify-center gap-3 rounded-[14px] bg-white text-[#15171b] ring-1 ring-line-strong">
              <RemnusMark className="size-9" />
              <span className="text-[28px] font-semibold tracking-[-0.02em]">Remnus</span>
            </div>
          </div>

          {/* Colors */}
          <div className="mt-20">
            <h2 className="m-0 text-[28px] leading-tight font-semibold tracking-[-0.03em] text-fg sm:text-[34px]">{t('colorsTitle')}</h2>
            <p className="m-0 mt-3 max-w-[38rem] text-[15px] leading-[1.6] text-fg-2">{t('colorsSubtitle')}</p>

            <div className="mt-6">
              {colorGroups.map((group) => (
                <div key={group.name} className="grid gap-5 border-t border-line-strong py-8 lg:grid-cols-12 lg:gap-10">
                  <div className="lg:col-span-4">
                    <h3 className="m-0 text-lg font-semibold tracking-[-0.015em] text-fg">{group.name}</h3>
                    <p className="m-0 mt-1.5 text-ui leading-relaxed text-fg-3">{group.desc}</p>
                  </div>
                  <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 md:grid-cols-4 lg:col-span-8">
                    {group.colors.map((c) => (
                      <li key={c.token} className="flex flex-col gap-2">
                        <div className="flex h-16 overflow-hidden rounded-control ring-1 ring-line-strong">
                          <span className="flex-1" style={{ backgroundColor: c.dark }} title={`${t('dark')} ${c.dark}`} />
                          <span className="flex-1" style={{ backgroundColor: c.light }} title={`${t('light')} ${c.light}`} />
                        </div>
                        <div className="flex flex-col leading-tight">
                          <span className="font-mono text-xs text-fg">{c.token}</span>
                          <span className="mt-0.5 font-mono text-xs text-fg-3">
                            {c.dark} <span className="text-fg-4">/</span> {c.light}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="m-0 text-ui text-fg-3">{t('swatchNote')}</p>
          </div>

          {/* Typography */}
          <div className="mt-20">
            <h2 className="m-0 text-[28px] leading-tight font-semibold tracking-[-0.03em] text-fg sm:text-[34px]">{t('typographyTitle')}</h2>
            <p className="m-0 mt-3 max-w-[38rem] text-[15px] leading-[1.6] text-fg-2">{t('typographySubtitle')}</p>

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {fonts.map((f) => (
                <div key={f.name} className="rounded-[14px] bg-sheet p-6 shadow-sheet sm:p-8">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <span className={`${f.className} text-xl font-semibold text-fg`}>{f.name}</span>
                    <span className="text-ui text-fg-3">{f.role}</span>
                  </div>
                  <p className={`${f.className} m-0 mt-5 text-2xl leading-snug text-fg sm:text-3xl`}>{t('fontSampleHeading')}</p>
                  <p className={`${f.className} m-0 mt-3 text-sm break-words text-fg-3`}>
                    ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
