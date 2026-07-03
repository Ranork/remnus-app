import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { Mail, ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getMailingOverview } from '@/lib/actions/mailing';
import MailingDashboard from '@/components/features/admin/mailing/MailingDashboard';

export const metadata = { title: 'Mailing | Remnus' };

export default async function AdminMailingPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') redirect('/login');

  const [t, overview] = await Promise.all([getTranslations('Mailing'), getMailingOverview()]);

  return (
    <div className="flex h-full flex-1 flex-col overflow-auto bg-neutral-850">
      {/* Header */}
      <div className="shrink-0 border-b border-neutral-800 px-8 py-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
            title={t('backToAdmin')}
          >
            <ArrowLeft size={17} />
          </Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/12 text-blue-400">
            <Mail size={18} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-neutral-100">{t('title')}</h1>
            <p className="mt-0.5 text-xs text-neutral-500">{t('subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-8 py-7">
        <MailingDashboard initial={overview} />
      </div>
    </div>
  );
}
