import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import '../globals.css';
import { Analytics } from '@vercel/analytics/next';
import { auth, signOut } from '@/auth';
import { cookies } from 'next/headers';
import { getAllWorkspaceItems, getWorkspaces } from '@/lib/actions/workspace';
import WorkspaceSidebar from '@/components/features/WorkspaceSidebar';
import MobileNavWrapper from '@/components/features/MobileNavWrapper';
import QueryProvider from '@/components/providers/QueryProvider';
import AppShell from '@/components/AppShell';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { getTranslations } from 'next-intl/server';
import { PostHogProvider } from '@/components/providers/PostHogProvider';
import PostHogPageView from '@/components/providers/PostHogPageView';
import PostHogIdentify from '@/components/providers/PostHogIdentify';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: 'italic',
  variable: '--font-instrument-serif',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'Remnus',
  description: 'Customizable database and pages',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Remnus',
  },
  icons: {
    icon: '/logo-square-dark.ico',
    shortcut: '/logo-square-dark.ico',
    apple: '/logo-square-dark.png',
  },
  openGraph: {
    title: 'Remnus',
    description: 'Customizable database and pages',
    url: 'https://remnus.com',
    siteName: 'Remnus',
    images: [{ url: 'https://remnus.com/OG_1200x630.png', width: 1200, height: 630, alt: 'Remnus' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Remnus',
    description: 'Customizable database and pages',
    images: ['https://remnus.com/OG_1200x630.png'],
  },
};

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

  const messages = await getMessages();
  const session = await auth();

  if (!session?.user) {
    return (
      <html lang={locale} className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`}>
        <body className="font-sans bg-neutral-950 text-neutral-50">
          <PostHogProvider>
            <PostHogPageView />
            <NextIntlClientProvider messages={messages}>
              {children}
            </NextIntlClientProvider>
          </PostHogProvider>
          <Analytics />
        </body>
      </html>
    );
  }

  const t = await getTranslations('Layout');

  const [workspacesList, items] = await Promise.all([
    getWorkspaces(),
    getAllWorkspaceItems(),
  ]);

  const cookieStore = await cookies();
  const activeWorkspaceId = cookieStore.get('remnus_workspace_id')?.value;
  const activeWorkspace = workspacesList.find((w) => w.id === activeWorkspaceId) || workspacesList[0];

  const currentUser = {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
    role: session.user.role,
  };

  const demoBanner = session.user.role === 'demo' ? (
    <div className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
      <div className="flex items-center gap-1.5 text-xs text-amber-400 min-w-0">
        <span className="font-semibold shrink-0">{t('demoMode')}</span>
        <span className="text-amber-500/70 shrink-0">—</span>
        <span className="text-amber-400/80 truncate">{t('demoChangesNote')}</span>
      </div>
      <form
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/register' });
        }}
      >
        <button
          type="submit"
          className="shrink-0 text-xs font-medium text-amber-300 hover:text-amber-100 transition-colors self-start sm:self-auto"
        >
          {t('createFreeAccount')}
        </button>
      </form>
    </div>
  ) : undefined;

  return (
    <html lang={locale} className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`}>
      <body className="font-sans bg-neutral-950 text-neutral-50">
        <PostHogProvider>
          <PostHogPageView />
          <PostHogIdentify user={currentUser} />
          <NextIntlClientProvider messages={messages}>
            <QueryProvider>
              <AppShell
                sidebar={
                  <WorkspaceSidebar
                    items={items}
                    workspaces={workspacesList}
                    activeWorkspace={activeWorkspace ?? { id: '', name: 'Workspace' }}
                    currentUser={currentUser}
                  />
                }
                mobileNav={
                  <MobileNavWrapper
                    items={items}
                    workspaces={workspacesList}
                    activeWorkspace={activeWorkspace ?? { id: '', name: 'Workspace' }}
                    currentUser={currentUser}
                  />
                }
                demoBanner={demoBanner}
              >
                {children}
              </AppShell>
            </QueryProvider>
          </NextIntlClientProvider>
        </PostHogProvider>
        <Analytics />
      </body>
    </html>
  );
}
