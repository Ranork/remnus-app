// Public unsubscribe page (linked from every marketing email footer).
// Deliberately requires a button click: mail scanners (Outlook SafeLinks etc.)
// prefetch GET links, so mutating on page load would silently unsubscribe
// people. The RFC 8058 one-click header points at POST /api/unsubscribe
// instead. Whitelisted in auth.config.ts.

import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { MailX, MailCheck, AlertTriangle } from 'lucide-react';
import { getMailableUser, performUnsubscribe, verifyUnsubToken } from '@/lib/email/send';

export const metadata = { title: 'Unsubscribe | Remnus' };

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; t?: string; done?: string }>;
}) {
  const { u, t: token, done } = await searchParams;
  const t = await getTranslations('Mailing');

  const user = u ? await getMailableUser(u) : null;
  const valid = Boolean(user?.email && verifyUnsubToken(user!.id, user!.email!, token));
  const alreadyDone = valid && (done === '1' || Boolean(user!.emailUnsubscribedAt));

  async function confirm() {
    'use server';
    if (u) await performUnsubscribe(u, token);
    redirect(`/unsubscribe?u=${encodeURIComponent(u ?? '')}&t=${encodeURIComponent(token ?? '')}&done=1`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 p-8">
        <div className="mb-6 flex items-center gap-2.5">
          <Image src="/logo-square-dark.png" alt="Remnus" width={30} height={30} className="rounded-lg" />
          <span className="text-lg font-semibold text-neutral-100">Remnus</span>
        </div>

        {!valid ? (
          <>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/12 text-amber-500">
              <AlertTriangle size={20} />
            </div>
            <h1 className="text-lg font-semibold text-neutral-100">{t('unsubInvalidTitle')}</h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">{t('unsubInvalidBody')}</p>
          </>
        ) : alreadyDone ? (
          <>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/12 text-green-400">
              <MailCheck size={20} />
            </div>
            <h1 className="text-lg font-semibold text-neutral-100">{t('unsubDoneTitle')}</h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              {t('unsubDoneBody', { email: user!.email! })}
            </p>
          </>
        ) : (
          <>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/12 text-blue-400">
              <MailX size={20} />
            </div>
            <h1 className="text-lg font-semibold text-neutral-100">{t('unsubConfirmTitle')}</h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              {t('unsubConfirmBody', { email: user!.email! })}
            </p>
            <form action={confirm} className="mt-6">
              <button
                type="submit"
                className="w-full rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500/85"
              >
                {t('unsubConfirmCta')}
              </button>
            </form>
          </>
        )}

        <Link
          href="/"
          className="mt-6 inline-block text-xs text-neutral-500 underline-offset-2 hover:text-neutral-300 hover:underline"
        >
          {t('unsubBackHome')}
        </Link>
      </div>
    </div>
  );
}
