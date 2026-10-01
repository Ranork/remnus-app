import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SearchX, Clock, Lock } from 'lucide-react';
import { getProspectInviteByToken } from '@/lib/actions/prospectInvites';
import { PLAN_LIMITS } from '@/lib/billing/plans';
import ProspectInviteClaimClient from '@/components/features/ProspectInviteClaimClient';
import PendingGiftKeeper from '@/components/features/PendingGiftKeeper';
import { AuthScreen, AuthStatus } from '@/components/features/auth/AuthScreen';
import { GiftLockup } from '@/components/features/auth/GiftLockup';
import { SubmitButton } from '@/components/features/auth/parts';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// Public Prospect Invite claim page — personalized outreach gift-signup link.
// Redesigned around one job: convert a cold-outreach click in ~5 seconds.
// The gift is the headline (not a footnote), the app's own logo is paired
// with Remnus's so the "who's giving this and to whom" reads instantly, plan
// limits are shown as concrete numbers (not just a tier name), and a link
// expiry — when the invite has one — becomes visible urgency instead of
// silently existing only in the database. See prospectInvites.ts.
// One sheet on the desk like every sign-in screen (V2 R8.6).

function StatusMessage({ icon: Icon, text }: { icon: typeof SearchX; text: string }) {
  return (
    <AuthScreen>
      <AuthStatus icon={<Icon />} title={text} />
    </AuthScreen>
  );
}

export default async function ProspectWelcomePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // session first — getProspectInviteByToken needs the viewer id to tell
  // "you already claimed this, welcome back" apart from "someone else did".
  const [t, tBilling, session] = await Promise.all([
    getTranslations('ProspectInvites'),
    getTranslations('Billing'),
    auth(),
  ]);
  const invite = await getProspectInviteByToken(token, session?.user?.id);

  if (!invite) return <StatusMessage icon={SearchX} text={t('notFound')} />;
  if (invite.linkExpired) return <StatusMessage icon={Clock} text={t('linkExpired')} />;
  // Claimed by someone else (not the current viewer) — the real "already used" case.
  if (invite.claimed && !invite.claimedByViewer) return <StatusMessage icon={Lock} text={t('alreadyClaimed')} />;

  // "Startup"/"Professional" alone (Billing.tier_*, shared across the whole
  // app) reads ambiguously to a cold-outreach prospect — could sound like a
  // company-stage label, not a specific named plan. Wrapped in tierPlanLabel
  // ("{tier} Plan") for this page/toast specifically; the shared Billing
  // labels themselves are untouched (used all over the rest of the app).
  const rawTierLabel = tBilling(invite.giftTier === 'professional' ? 'tier_professional' : 'tier_startup');
  const tierLabel = t('tierPlanLabel', { tier: rawTierLabel });
  const limits = PLAN_LIMITS[invite.giftTier];
  const seatsLabel = limits.seats === Infinity ? t('unlimitedLabel') : String(limits.seats);
  const agentsLabel = limits.agents === Infinity ? t('unlimitedLabel') : String(limits.agents);

  const header = (
    <div className="flex flex-col gap-4">
      {/* Co-brand lockup: Remnus is the one giving the gift, the app is who it's for */}
      <GiftLockup appName={invite.appName} appLogoUrl={invite.appLogoUrl} />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-fg-3">{t('welcomeTitle', { appName: invite.appName })}</p>
        <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em] text-balance text-fg">
          {t('giftLine', { days: invite.giftDays, tier: tierLabel })}
        </h1>
        <p className="text-sm leading-relaxed text-fg-3">{t('pitchLine')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{t('chipSeats', { count: seatsLabel })}</Badge>
        <Badge>{t('chipAgents', { count: agentsLabel })}</Badge>
        {invite.daysUntilLinkExpiry !== null && (
          <Badge variant="warning">
            <Clock />
            {invite.daysUntilLinkExpiry <= 0 ? t('expiresToday') : t('expiresInDays', { days: invite.daysUntilLinkExpiry })}
          </Badge>
        )}
      </div>
    </div>
  );

  // Logged in → auto-claim (mirrors InviteAcceptClient's auto-trigger, but
  // holds on a confirmation instead of instant-redirecting — see the
  // component). `claimedByViewer` short-circuits a redundant claim call when
  // this viewer already has it (revisit, refresh, or a duplicate mount).
  if (session?.user) {
    return (
      <AuthScreen width="md">
        <Card className="gap-6 p-6 sm:p-8">
          {header}
          <ProspectInviteClaimClient
            token={token}
            alreadyClaimed={invite.claimedByViewer}
            giftDays={invite.giftDays}
            tierLabel={tierLabel}
          />
        </Card>
      </AuthScreen>
    );
  }

  // Not logged in → stash the token in a cookie, then send them to sign in.
  // After login, /app picks the cookie up and routes back here.
  async function signInToClaim() {
    'use server';
    const c = await cookies();
    c.set('pending_prospect_invite', token, { path: '/', maxAge: 600, httpOnly: true, sameSite: 'lax' });
    redirect('/login');
  }

  return (
    <AuthScreen
      width="md"
      // Deliberately OUTSIDE the sheet, not buried as a small line inside it — a visitor
      // who wants to look around before signing up should have an easy, visible way out
      // instead of feeling funneled into one choice.
      footer={
        <Link href="/" className={buttonVariants({ variant: 'ghost' })}>
          {t('exploreCta')}
        </Link>
      }
    >
      <Card className="gap-6 p-6 sm:p-8">
        {/* Lets the visitor wander off to explore the site first without losing
            the gift — PendingGiftToast picks this up on whatever page they land on next. */}
        <PendingGiftKeeper
          token={token}
          appName={invite.appName}
          appLogoUrl={invite.appLogoUrl}
          giftDays={invite.giftDays}
          giftTier={invite.giftTier}
          daysUntilLinkExpiry={invite.daysUntilLinkExpiry}
        />
        {header}
        <form action={signInToClaim} className="flex flex-col gap-2">
          <SubmitButton>{t('signInCta', { days: invite.giftDays })}</SubmitButton>
          <p className="text-center text-xs text-fg-3">{t('noCardHint')}</p>
        </form>
      </Card>
    </AuthScreen>
  );
}
