import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Clock, SearchX } from 'lucide-react';
import { getInviteByToken } from '@/lib/actions/invites';
import InviteAcceptClient from '@/components/features/InviteAcceptClient';
import { AuthCard, AuthScreen, AuthStatus } from '@/components/features/auth/AuthScreen';
import { SubmitButton } from '@/components/features/auth/parts';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [t, tErrors] = await Promise.all([getTranslations('Billing'), getTranslations('Errors')]);
  const session = await auth();
  const invite = await getInviteByToken(token);

  // The two dead-end messages live in `Errors` (this page used to ask `Billing` for them
  // and showed the raw key).
  if (!invite || invite.expired) {
    return (
      <AuthScreen>
        <AuthStatus
          icon={invite ? <Clock /> : <SearchX />}
          title={invite ? tErrors('inviteExpired') : tErrors('inviteInvalid')}
        />
      </AuthScreen>
    );
  }

  // Logged in → auto-accept and go to the app.
  if (session?.user) {
    return (
      <AuthScreen>
        <AuthCard title={t('inviteJoinTitle', { workspace: invite.workspaceName })}>
          <InviteAcceptClient token={token} />
        </AuthCard>
      </AuthScreen>
    );
  }

  // Not logged in → stash the token in a cookie, then send them to sign in.
  // After login, /app picks the cookie up and routes back here.
  async function signInToAccept() {
    'use server';
    const c = await cookies();
    c.set('pending_invite', token, { path: '/', maxAge: 600, httpOnly: true, sameSite: 'lax' });
    redirect('/login');
  }

  return (
    <AuthScreen>
      <AuthCard title={t('inviteJoinTitle', { workspace: invite.workspaceName })} description={t('inviteJoinBody')}>
        <form action={signInToAccept}>
          <SubmitButton>{t('inviteSignIn')}</SubmitButton>
        </form>
      </AuthCard>
    </AuthScreen>
  );
}
