import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { getWorkspaceItems } from '@/lib/actions/workspace';
import WorkspaceSidebar from '@/components/features/WorkspaceSidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Remna',
  description: 'Customizable database and pages',
  icons: {
    icon: '/logo-square-dark.ico',
    shortcut: '/logo-square-dark.ico',
    apple: '/logo-square-dark.png',
  }
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const items = await getWorkspaceItems();

  return (
    <html lang="en">
      <body className={`${inter.className} bg-neutral-950 text-neutral-50 flex h-screen overflow-hidden`}>
        <aside className="w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col">
          <div className="p-4 flex items-center justify-between border-b border-neutral-800">
            <Link href="/" className="font-semibold flex items-center gap-2 text-white hover:text-neutral-300 transition-colors">
              <img src="/logo-square-dark.png" alt="Remna Logo" className="w-5 h-5 object-contain" /> Remna
            </Link>
          </div>
          <WorkspaceSidebar items={items} />
        </aside>
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-950">
          {children}
        </main>
      </body>
    </html>
  );
}
