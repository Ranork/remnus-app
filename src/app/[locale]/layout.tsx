import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { auth } from '@/auth';
import { cookies, headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { PostHogProvider } from '@/components/providers/PostHogProvider';
import PostHogPageView from '@/components/providers/PostHogPageView';
import PostHogIdentify from '@/components/providers/PostHogIdentify';
import AttributionCapture from '@/components/providers/AttributionCapture';
import { ConsentProvider } from '@/components/providers/ConsentContext';
import CookieConsentBanner from '@/components/features/CookieConsentBanner';
import PwaInstallCapture from '@/components/providers/PwaInstallCapture';
import { CONSENT_COOKIE, isConsentRequired, parseConsent } from '@/lib/consent';
import { METADATA_BASE_URL, DEFAULT_OG_IMAGE, DEFAULT_TWITTER_IMAGE } from '@/lib/metadata';

export const metadata: Metadata = {
  metadataBase: new URL(METADATA_BASE_URL),
  title: {
    default: 'Remnus',
    template: '%s | Remnus',
  },
  description: 'Remnus is the MCP-Native workspace for vibe coders — kanban boards, databases, and pages that Claude, Cursor, and any AI agent can read and write via MCP.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Remnus',
  },
  icons: {
    icon: '/logo-square-dark.ico',
    shortcut: '/logo-square-dark.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Remnus | MCP-Native workspace for vibe coders',
    description: 'Kanban boards, databases, and pages that Claude, Cursor, and any AI agent can read and write via MCP.',
    url: METADATA_BASE_URL,
    siteName: 'Remnus',
    images: [DEFAULT_OG_IMAGE],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Remnus | MCP-Native workspace for vibe coders',
    description: 'Kanban boards, databases, and pages that Claude, Cursor, and any AI agent can read and write via MCP.',
    images: [DEFAULT_TWITTER_IMAGE],
  },
};

// Locale-level layout: providers only (intl, PostHog, consent). It is shared by ALL
// routes under [locale] — marketing, public share pages, auth, and the in-app routes.
// The authenticated app shell (sidebar/tabs) lives in the (app) route group's layout so
// that crossing between a public share page and the app mounts/unmounts the shell
// correctly (a conditional in this shared layout would be preserved across navigation).
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const [messages, session, headerStore, consentCookieStore] = await Promise.all([
    getMessages(),
    auth(),
    headers(),
    cookies(),
  ]);

  // Geo-aware cookie consent (server-resolved so the banner renders flash-free).
  const consentRequired = isConsentRequired(headerStore.get('x-vercel-ip-country'));
  const initialConsent = parseConsent(consentCookieStore.get(CONSENT_COOKIE)?.value);

  const sessionUser = session?.user ?? null;
  const isAdmin = sessionUser?.role === 'admin';

  return (
    <>
      <PostHogProvider consentRequired={consentRequired} initialConsent={initialConsent}>
        <PostHogPageView skip={isAdmin} />
        {sessionUser ? (
          <PostHogIdentify
            user={{
              id: sessionUser.id,
              name: sessionUser.name ?? null,
              email: sessionUser.email ?? null,
              role: sessionUser.role,
            }}
          />
        ) : (
          <AttributionCapture />
        )}
        <NextIntlClientProvider messages={messages}>
          <ConsentProvider
            consentRequired={consentRequired}
            initialConsent={initialConsent}
            userRole={sessionUser?.role}
          >
            {children}
            <CookieConsentBanner />
          </ConsentProvider>
        </NextIntlClientProvider>
      </PostHogProvider>
      <PwaInstallCapture />
      <Analytics />
    </>
  );
}
