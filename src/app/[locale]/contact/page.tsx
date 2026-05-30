import type { Metadata } from 'next';
import MarketingShell from '@/components/marketing/MarketingShell';
import ContactSection from '@/components/marketing/ContactSection';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with the Remnus team. Questions about MCP integration, enterprise plans, or self-hosting? We\'re here to help.',
  alternates: { canonical: 'https://remnus.com/contact' },
  openGraph: {
    title: 'Contact | Remnus',
    description: 'Get in touch with the Remnus team. Questions about MCP integration, enterprise plans, or self-hosting? We\'re here to help.',
    url: 'https://remnus.com/contact',
  },
};

export default function ContactPage() {
  return (
    <MarketingShell>
      <ContactSection />
    </MarketingShell>
  );
}
