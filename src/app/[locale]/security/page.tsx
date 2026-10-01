import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import MarketingShell from '@/components/marketing/MarketingShell';
import { KeyRound, Bot, ShieldCheck, ListChecks, FileText, Mail, ChevronRight } from 'lucide-react';
import PageHead from '@/components/marketing/site/PageHead';
import DocSections from '@/components/marketing/site/DocSections';
import { METADATA_BASE_URL, DEFAULT_OG_IMAGE, DEFAULT_TWITTER_IMAGE } from '@/lib/metadata';

export const metadata: Metadata = {
  metadataBase: new URL(METADATA_BASE_URL),
  title: 'Security & Authentication',
  description: 'How Remnus authenticates users and AI agents — Google/GitHub OAuth, MCP Personal Access Tokens, OAuth 2.1 + PKCE, token scopes, and responsible disclosure.',
  alternates: { canonical: 'https://remnus.com/security' },
  openGraph: {
    title: 'Security & Authentication | Remnus',
    description: 'How Remnus authenticates users and AI agents — OAuth, MCP tokens, PKCE, audit logs, and responsible disclosure.',
    url: 'https://remnus.com/security',
    siteName: 'Remnus',
    images: [DEFAULT_OG_IMAGE],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Security & Authentication | Remnus',
    description: 'How Remnus authenticates users and AI agents — OAuth, MCP tokens, PKCE, audit logs, and responsible disclosure.',
    images: [DEFAULT_TWITTER_IMAGE],
  },
};

export default async function SecurityPage() {
  const t = await getTranslations('Security');

  const sections = [
    { icon: KeyRound, title: t('loginTitle'), body: t('loginBody'), badge: 'Google, GitHub' },
    { icon: Bot, title: t('patTitle'), body: t('patBody'), badge: 'rmns_…' },
    { icon: ShieldCheck, title: t('oauthTitle'), body: t('oauthBody'), badge: 'RFC 9728, PKCE S256' },
    { icon: ListChecks, title: t('scopesTitle'), body: t('scopesBody'), badge: 'read, write' },
    { icon: FileText, title: t('auditTitle'), body: t('auditBody'), badge: null },
    { icon: Mail, title: t('disclosureTitle'), body: t('disclosureBody'), badge: null },
  ].map(({ badge, body, ...rest }) => ({
    ...rest,
    body: (
      <>
        <p>{body}</p>
        {badge && <p><code className="rounded-sm bg-raised px-1.5 py-0.5 font-mono text-xs text-fg-2 shadow-[inset_0_0_0_1px_var(--color-line)]">{badge}</code></p>}
      </>
    ),
  }));

  const flow = ['Claude Desktop', '/oauth/authorize', 'Browser Login', '/api/oauth/token', '/api/mcp'];

  return (
    <MarketingShell>
      <section className="px-4 sm:px-8">
        <div className="mx-auto max-w-[1200px] pt-14 pb-24 sm:pt-20 lg:pb-32">
          <PageHead title={t('title')} lede={t('intro')} />
          <p className="m-0 mt-4 text-ui text-fg-3">{t('lastUpdated')}</p>
          <DocSections sections={sections} />

          {/* Token flow */}
          <div className="mt-4 rounded-[14px] bg-sheet p-6 shadow-sheet sm:p-8">
            <h2 className="m-0 text-[15px] font-semibold text-fg">OAuth 2.1 + PKCE</h2>
            <ol className="m-0 mt-5 flex list-none flex-col gap-2 p-0 sm:flex-row sm:flex-wrap sm:items-center">
              {flow.map((step, i) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="rounded-control bg-raised px-3 py-1.5 font-mono text-xs whitespace-nowrap text-fg-2 shadow-[inset_0_0_0_1px_var(--color-line)]">
                    {step}
                  </span>
                  {i < flow.length - 1 && <ChevronRight className="hidden size-4 text-fg-4 sm:block" aria-hidden />}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
