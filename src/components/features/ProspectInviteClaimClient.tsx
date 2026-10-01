'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { claimProspectInvite } from '@/lib/actions/prospectInvites';
import { clearPendingGift } from '@/lib/prospectInvite/pendingGift';
import { AuthNotice } from '@/components/features/auth/AuthScreen';
import { Button } from '@/components/ui/button';

type Phase = 'claiming' | 'claimed' | 'error';

interface Props {
  token: string;
  /** Skips the claim call entirely and jumps straight to the confirmation —
   *  see the note below. */
  alreadyClaimed?: boolean;
  /** For the confirmation copy ("Your {giftDays}-day {tierLabel} gift is
   *  active!") — precomputed server-side (page already resolves both). */
  giftDays: number;
  tierLabel: string;
}

// Claims the gift for an already-logged-in user. Unlike InviteAcceptClient's
// instant auto-redirect, a gift claim deliberately does NOT navigate away as
// soon as it succeeds — it holds on a "you got it" confirmation and waits for
// an explicit Continue click, so the user actually registers what they got
// (which plan, for how long) instead of the page flashing by mid-redirect.
//
// `alreadyClaimed` (from the page's `claimedByViewer` check) skips the claim
// call entirely and jumps straight to the confirmation — covers both a
// same-user revisit/refresh AND React Strict Mode's dev double-effect-invoke,
// which would otherwise fire claimProspectInvite twice on first mount; the
// action itself is also idempotent for the same claimant as a second layer.
export default function ProspectInviteClaimClient({ token, alreadyClaimed = false, giftDays, tierLabel }: Props) {
  const t = useTranslations('ProspectInvites');
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(alreadyClaimed ? 'claimed' : 'claiming');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (alreadyClaimed) return;
    let done = false;
    claimProspectInvite(token)
      .then((r) => {
        if (done) return;
        if (r.ok) {
          setPhase('claimed');
        } else {
          setError(r.error ?? t('claimErrorGeneric'));
          setPhase('error');
        }
      })
      .catch(() => {
        setError(t('claimErrorGeneric'));
        setPhase('error');
      });
    return () => { done = true; };
  }, [token, t, alreadyClaimed]);

  // The gift is settled either way (claimed here, or the page already found
  // claimedByViewer true) — the "explore first" toast has nothing left to remind them of.
  useEffect(() => {
    if (phase === 'claimed') clearPendingGift();
  }, [phase]);

  const goToApp = () => {
    router.push('/app');
    router.refresh();
  };

  if (phase === 'error') return <AuthNotice tone="danger" icon={<AlertCircle />}>{error}</AuthNotice>;

  if (phase === 'claimed') {
    return (
      <div className="flex w-full flex-col gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-fg" role="status">
          <Check className="size-4 shrink-0 text-green-400" aria-hidden />
          {t('claimedTitle', { days: giftDays, tier: tierLabel })}
        </p>
        <Button variant="primary" size="lg" className="w-full" onClick={goToApp}>
          {t('continueCta')}
        </Button>
      </div>
    );
  }

  return (
    <p className="flex items-center gap-2 text-sm text-fg-3" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden /> {t('claiming')}
    </p>
  );
}
