// Confirm-button page for the emailed account-deletion link (mutation NOT on
// GET — mail scanners prefetch links, same reasoning as /unsubscribe). Not
// whitelisted in auth.config.ts: this route is deliberately auth-protected
// by the default middleware behavior (unauthenticated visits bounce to
// /login?callbackUrl=..., NextAuth's own redirect callback sends them back
// here afterward), since confirming deletion requires the SAME live session
// that requested it — the emailed link alone isn't sufficient.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AlertCircle, AlertTriangle, ShieldAlert } from 'lucide-react';
import { AuthNotice, AuthScreen, AuthStatus } from '@/components/features/auth/AuthScreen';
import { SubmitButton } from '@/components/features/auth/parts';
import { buttonVariants } from '@/components/ui/button';
import { db } from '@/db';
import { accountDeletionTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/session';
import { confirmAccountDeletion } from '@/lib/actions/account';

export const metadata = { title: 'Confirm account deletion | Remnus' };

function isTokenLive(row: { userId: string; usedAt: Date | null; expiresAt: Date } | undefined, userId: string): boolean {
  if (!row || row.userId !== userId || row.usedAt) return false;
  return row.expiresAt.getTime() > Date.now();
}

export default async function ConfirmAccountDeletePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const t = await getTranslations('UserSettings');
  const tErrors = await getTranslations('Errors');
  const user = await getCurrentUser();

  const [row] = token
    ? await db.select().from(accountDeletionTokens).where(eq(accountDeletionTokens.token, token)).limit(1)
    : [undefined];

  const valid = isTokenLive(row, user.id);

  async function confirm() {
    'use server';
    if (!token) return;
    const result = await confirmAccountDeletion(token);
    // Success redirects internally (signOut) and never returns here.
    if (result?.error) redirect(`/account-delete/confirm?token=${encodeURIComponent(token)}&error=1`);
  }

  const cancel = (
    <Link href="/app" className={buttonVariants({ variant: valid ? 'ghost' : 'secondary', size: 'lg', className: 'w-full' })}>
      {t('deleteAccountCancel')}
    </Link>
  );

  return (
    <AuthScreen>
      {!valid ? (
        <AuthStatus icon={<AlertTriangle />} tone="warning" title={t('deleteAccountLinkInvalidTitle')} action={cancel}>
          {t('deleteAccountLinkInvalidBody')}
        </AuthStatus>
      ) : (
        <AuthStatus
          icon={<ShieldAlert />}
          tone="danger"
          title={t('deleteAccountConfirmTitle')}
          action={
            <div className="flex w-full flex-col gap-2">
              {error === '1' && (
                <AuthNotice tone="danger" icon={<AlertCircle />}>{tErrors('accountDeleteInvalidToken')}</AuthNotice>
              )}
              <form action={confirm}>
                <SubmitButton variant="danger">{t('deleteAccountConfirmButton')}</SubmitButton>
              </form>
              {cancel}
            </div>
          }
        >
          {t('deleteAccountFinalConfirmBody')}
        </AuthStatus>
      )}
    </AuthScreen>
  );
}
