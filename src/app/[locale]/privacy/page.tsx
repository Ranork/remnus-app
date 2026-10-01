import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import MarketingShell from '@/components/marketing/MarketingShell';
import { Shield, Eye, Lock, Mail, Clock } from 'lucide-react';
import PageHead from '@/components/marketing/site/PageHead';
import DocSections from '@/components/marketing/site/DocSections';
import { METADATA_BASE_URL, DEFAULT_OG_IMAGE, DEFAULT_TWITTER_IMAGE } from '@/lib/metadata';

export const metadata: Metadata = {
  metadataBase: new URL(METADATA_BASE_URL),
  title: 'Privacy Policy',
  description: 'Remnus privacy policy — how we collect, use, and protect your data in the Human-Agent Collaborative Workspace.',
  alternates: { canonical: 'https://remnus.com/privacy' },
  openGraph: {
    title: 'Privacy Policy | Remnus',
    description: 'Remnus privacy policy — how we collect, use, and protect your data in the Human-Agent Collaborative Workspace.',
    url: 'https://remnus.com/privacy',
    siteName: 'Remnus',
    images: [DEFAULT_OG_IMAGE],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacy Policy | Remnus',
    description: 'Remnus privacy policy — how we collect, use, and protect your data in the Human-Agent Collaborative Workspace.',
    images: [DEFAULT_TWITTER_IMAGE],
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
    {
      icon: Clock,
      title: t('sec5Title'),
      body: t('sec5Body'),
    },
  ];

  return (
    <MarketingShell>
      <section className="px-4 sm:px-8">
        <div className="mx-auto max-w-[1200px] pt-14 pb-24 sm:pt-20 lg:pb-32">
          <PageHead title={t('title')} lede={t('intro')} />
          <p className="m-0 mt-4 text-ui text-fg-3">{t('lastUpdated')}</p>
          <DocSections sections={sections} />
        </div>
      </section>
    </MarketingShell>
  );
}
