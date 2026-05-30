import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import MarketingShell from '@/components/marketing/MarketingShell';
import { Shield, Eye, Lock, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Remnus privacy policy — how we collect, use, and protect your data in the MCP-native workspace for vibe coders.',
  alternates: { canonical: 'https://remnus.com/privacy' },
  openGraph: {
    title: 'Privacy Policy | Remnus',
    description: 'Remnus privacy policy — how we collect, use, and protect your data in the MCP-native workspace for vibe coders.',
    url: 'https://remnus.com/privacy',
  },
};

export default async function PrivacyPage() {
  const t = await getTranslations('Privacy');

  const sections = [
    {
      icon: Eye,
      title: t('sec1Title'),
      body: t('sec1Body'),
    },
    {
      icon: Shield,
      title: t('sec2Title'),
      body: t('sec2Body'),
    },
    {
      icon: Lock,
      title: t('sec3Title'),
      body: t('sec3Body'),
    },
    {
      icon: Mail,
      title: t('sec4Title'),
      body: t('sec4Body'),
    },
  ];

  return (
    <MarketingShell>
      <section className="px-4 sm:px-8 lg:px-14 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-neutral-100 mb-4 tracking-tight">
              {t('title')}
            </h1>
            <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-500">
              {t('lastUpdated')}
            </p>
            <div className="h-px bg-neutral-800 my-8 max-w-xs mx-auto" />
            <p className="text-neutral-300 text-[14.5px] leading-relaxed max-w-2xl mx-auto">
              {t('intro')}
            </p>
          </div>

          {/* Sections List */}
          <div className="flex flex-col gap-6">
            {sections.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="p-6 sm:p-8 rounded-xl border border-neutral-800 bg-neutral-900/40 hover:border-neutral-700/80 transition-colors duration-200"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 shrink-0">
                    <Icon size={18} />
                  </div>
                  <h2 className="text-lg font-semibold text-neutral-100 m-0">
                    {title}
                  </h2>
                </div>
                <p className="text-neutral-300 text-[13.5px] leading-[1.65] m-0 pl-13">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
