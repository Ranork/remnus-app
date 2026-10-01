'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { acceptInvite } from '@/lib/actions/invites';
import { AuthNotice } from '@/components/features/auth/AuthScreen';

// Auto-accepts the invite for an already-logged-in user, then sends them to the app.
export default function InviteAcceptClient({ token }: { token: string }) {
  const t = useTranslations('Billing');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let done = false;
    acceptInvite(token)
      .then((r) => {
        if (done) return;
        if (r.ok) { router.push('/app'); router.refresh(); }
        else setError(r.error ?? t('inviteErrorGeneric'));
      })
      .catch(() => setError(t('inviteErrorGeneric')));
    return () => { done = true; };
  }, [token, router, t]);

  if (error) return <AuthNotice tone="danger" icon={<AlertCircle />}>{error}</AuthNotice>;
  return (
    <p className="flex items-center gap-2 text-sm text-fg-3" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden /> {t('inviteAccepting')}
    </p>
  );
}
