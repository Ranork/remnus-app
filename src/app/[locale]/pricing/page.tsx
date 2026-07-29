import type { Metadata } from 'next';
import MarketingShell from '@/components/marketing/MarketingShell';
import LandingPricing from '@/components/marketing/LandingPricing';
import { METADATA_BASE_URL, DEFAULT_OG_IMAGE, DEFAULT_TWITTER_IMAGE } from '@/lib/metadata';

export const metadata: Metadata = {
  metadataBase: new URL(METADATA_BASE_URL),
  title: 'Pricing',
  description: 'Simple, transparent pricing for Remnus — the Human-Agent Collaborative Workspace. Start free with unlimited pages and databases.',
  alternates: { canonical: 'https://remnus.com/pricing' },
  openGraph: {
    title: 'Pricing | Remnus',
    description: 'Simple, transparent pricing for Remnus — the Human-Agent Collaborative Workspace. Start free with unlimited pages and databases.',
    url: 'https://remnus.com/pricing',
    siteName: 'Remnus',
    images: [DEFAULT_OG_IMAGE],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing | Remnus',
    description: 'Simple, transparent pricing for Remnus — the Human-Agent Collaborative Workspace. Start free with unlimited pages and databases.',
    images: [DEFAULT_TWITTER_IMAGE],
  },
};

export default async function PricingPage() {
  return (
    <MarketingShell>
      <LandingPricing showComparison />
    </MarketingShell>
  );
}

