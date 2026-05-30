import type { Metadata } from 'next';
import MarketingShell from '@/components/marketing/MarketingShell';
import LandingPricing from '@/components/marketing/LandingPricing';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple, transparent pricing for Remnus — the MCP-native workspace for vibe coders. Start free with unlimited pages and databases.',
  alternates: { canonical: 'https://remnus.com/pricing' },
  openGraph: {
    title: 'Pricing | Remnus',
    description: 'Simple, transparent pricing for Remnus — the MCP-native workspace for vibe coders. Start free with unlimited pages and databases.',
    url: 'https://remnus.com/pricing',
  },
};

export default async function PricingPage() {
  return (
    <MarketingShell>
      <LandingPricing />
    </MarketingShell>
  );
}

