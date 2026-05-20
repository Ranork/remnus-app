import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css';
import { Analytics } from '@vercel/analytics/next';
import { auth, signOut } from '@/auth';
import { cookies } from 'next/headers';
import { getAllWorkspaceItems, getWorkspaces } from '@/lib/actions/workspace';
import WorkspaceSidebar from '@/components/features/WorkspaceSidebar';
import QueryProvider from '@/components/providers/QueryProvider';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { getTranslations } from 'next-intl/server';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Remnus',
  description: 'Customizable database and pages',
  icons: {
    icon: '/logo-square-dark.ico',
    shortcut: '/logo-square-dark.ico',
    apple: '/logo-square-dark.png',
  }
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
      <html lang={locale}>
        <body className={`${inter.className} bg-neutral-950 text-neutral-50`}>
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
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

  return (
    <html lang={locale}>
      <body className={`${inter.className} bg-neutral-950 text-neutral-50 flex h-screen overflow-hidden`}>
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            <aside className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col">
              <WorkspaceSidebar
                items={items}
                workspaces={workspacesList}
                activeWorkspace={activeWorkspace ?? { id: '', name: 'Workspace' }}
                currentUser={currentUser}
              />
            </aside>
            <main className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-850">
              {session.user.role === 'demo' && (
                <div className="shrink-0 flex items-center justify-between gap-4 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
                  <div className="flex items-center gap-2 text-xs text-amber-400">
                    <span className="font-semibold">{t('demoMode')}</span>
                    <span className="text-amber-500/70">—</span>
                    <span className="text-amber-400/80">{t('demoChangesNote')}</span>
                  </div>
                  <form
                    action={async () => {
                      'use server';
                      await signOut({ redirectTo: '/register' });
                    }}
                  >
                    <button
                      type="submit"
                      className="shrink-0 text-xs font-medium text-amber-300 hover:text-amber-100 transition-colors"
                    >
                      {t('createFreeAccount')}
                    </button>
                  </form>
                </div>
              )}
              {children}
            </main>
          </QueryProvider>
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
