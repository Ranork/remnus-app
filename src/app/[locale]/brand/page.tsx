import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import MarketingShell from '@/components/marketing/MarketingShell';
import { METADATA_BASE_URL, DEFAULT_OG_IMAGE, DEFAULT_TWITTER_IMAGE } from '@/lib/metadata';

export const metadata: Metadata = {
  metadataBase: new URL(METADATA_BASE_URL),
  title: 'Brand Kit',
  description: 'Remnus brand kit — the color palette and typography behind the app and landing page. A reference for visuals and press.',
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

// Values mirror the `@theme` tokens in globals.css (the source of truth). Kept as
// literal hex here on purpose: a brand-kit reference must show the fixed brand
// colors, not whatever the active runtime theme resolves the token to.
type Swatch = { token: string; hex: string };

export default async function BrandPage() {
  const t = await getTranslations('Brand');

  const colorGroups: { name: string; colors: Swatch[] }[] = [
    {
      name: t('groupNeutrals'),
      colors: [
        { token: 'neutral-950', hex: '#111315' },
        { token: 'neutral-900', hex: '#1d2025' },
        { token: 'neutral-850', hex: '#171a1e' },
        { token: 'neutral-800', hex: '#383b41' },
        { token: 'neutral-500', hex: '#80838a' },
        { token: 'neutral-100', hex: '#cccfd5' },
        { token: 'neutral-50', hex: '#d7dae0' },
      ],
    },
    {
      name: t('groupAccent'),
      colors: [
        { token: 'blue-300', hex: '#7a94c5' },
        { token: 'blue-400', hex: '#5e75b0' },
        { token: 'blue-500', hex: '#445c95' },
        { token: 'blue-600', hex: '#3a4f82' },
      ],
    },
    {
      name: t('groupSemantic'),
      colors: [
        { token: 'red-400', hex: '#cd4d55' },
        { token: 'green-400', hex: '#7fc36d' },
        { token: 'amber-500', hex: '#cc7d45' },
      ],
    },
    {
      name: t('groupOptions'),
      colors: [
        { token: 'opt-yellow', hex: '#d2b350' },
        { token: 'opt-teal', hex: '#4cb5a8' },
        { token: 'opt-purple', hex: '#8a6dba' },
        { token: 'opt-pink', hex: '#c66d99' },
      ],
    },
  ];

  const fonts: { name: string; role: string; className: string }[] = [
    { name: 'Onest', role: t('fontSansRole'), className: 'font-sans' },
    { name: 'Fraunces', role: t('fontSerifRole'), className: 'font-serif' },
    { name: 'JetBrains Mono', role: t('fontMonoRole'), className: 'font-mono' },
  ];

  return (
    <MarketingShell>
      <section className="px-4 sm:px-8 lg:px-14 py-16 lg:py-24">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-500 mb-3">
              {t('eyebrow')}
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-neutral-100 mb-4 tracking-tight">
              {t('title')}
            </h1>
            <p className="text-neutral-300 text-[14.5px] leading-relaxed max-w-2xl mx-auto">
              {t('intro')}
            </p>
          </div>

          {/* Colors */}
          <div className="mb-20">
            <h2 className="text-lg font-semibold text-neutral-100 mb-1">{t('colorsTitle')}</h2>
            <p className="text-neutral-400 text-[13.5px] mb-8">{t('colorsSubtitle')}</p>

            <div className="flex flex-col gap-10">
              {colorGroups.map((group) => (
                <div key={group.name}>
                  <h3 className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-4">
                    {group.name}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {group.colors.map((c) => (
                      <div key={c.token} className="flex flex-col gap-2">
                        <div
                          className="h-16 rounded-lg border border-neutral-800"
                          style={{ backgroundColor: c.hex }}
                        />
                        <div className="flex flex-col leading-tight">
                          <span className="font-mono text-[11px] text-neutral-200">{c.token}</span>
                          <span className="font-mono text-[11px] text-neutral-500 uppercase">{c.hex}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Typography */}
          <div>
            <h2 className="text-lg font-semibold text-neutral-100 mb-1">{t('typographyTitle')}</h2>
            <p className="text-neutral-400 text-[13.5px] mb-8">{t('typographySubtitle')}</p>

            <div className="flex flex-col gap-5">
              {fonts.map((f) => (
                <div
                  key={f.name}
                  className="p-6 sm:p-8 rounded-xl border border-neutral-800 bg-neutral-900/40"
                >
                  <div className="flex items-baseline justify-between gap-4 mb-4 flex-wrap">
                    <span className={`${f.className} text-neutral-100 text-xl font-semibold`}>{f.name}</span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
                      {f.role}
                    </span>
                  </div>
                  <p className={`${f.className} text-neutral-200 text-2xl sm:text-3xl leading-snug mb-3`}>
                    {t('fontSampleHeading')}
                  </p>
                  <p className={`${f.className} text-neutral-500 text-sm tracking-wide`}>
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
