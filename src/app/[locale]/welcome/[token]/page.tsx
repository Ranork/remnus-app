import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SearchX, Clock, Lock, ArrowRight } from 'lucide-react';
import { getProspectInviteByToken } from '@/lib/actions/prospectInvites';
import { PLAN_LIMITS } from '@/lib/billing/plans';
import ProspectInviteClaimClient from '@/components/features/ProspectInviteClaimClient';
import PendingGiftKeeper from '@/components/features/PendingGiftKeeper';

// Public Prospect Invite claim page — personalized outreach gift-signup link.
// Redesigned around one job: convert a cold-outreach click in ~5 seconds.
// The gift is the headline (not a footnote), the app's own logo is paired
// with Remnus's so the "who's giving this and to whom" reads instantly, plan
// limits are shown as concrete numbers (not just a tier name), and a link
// expiry — when the invite has one — becomes visible urgency instead of
// silently existing only in the database. See prospectInvites.ts.

function Shell({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-neutral-950 flex flex-col items-center justify-center gap-5 px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-[110px]"
      />
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-8 flex flex-col items-center text-center gap-4">
        {children}
      </div>
      {/* Deliberately OUTSIDE the card, not buried as a small footer line inside
          it — a visitor who wants to look around before signing up should have
          an easy, visible way out instead of feeling funneled into one choice. */}
      {footer}
    </div>
  );
}

function StatusMessage({ icon: Icon, text }: { icon: typeof SearchX; text: string }) {
  return (
    <Shell>
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-800 text-neutral-500">
        <Icon size={20} />
      </div>
      <p className="m-0 text-sm text-neutral-400">{text}</p>
      <Link href="/" className="text-[12px] text-neutral-600 hover:text-neutral-300">remnus.com</Link>
    </Shell>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-neutral-800 bg-neutral-850 px-3 py-1 text-[12px] text-neutral-300">
      {children}
    </span>
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
    <>
      {/* Co-brand lockup: Remnus is the one giving the gift, the app is who it's for */}
      <div className="flex items-center gap-2.5">
        <img src="/logo-square-dark.png" alt="Remnus" className="h-10 w-10 rounded-xl object-contain" />
        <span className="text-lg text-neutral-700">×</span>
        {invite.appLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Scout Forge asset; not worth a next/image remotePatterns entry for a one-off outreach link
          <img src={invite.appLogoUrl} alt={invite.appName} className="h-10 w-10 rounded-xl object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-sm font-semibold text-blue-300">
            {invite.appName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <p className="m-0 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
        {t('welcomeTitle', { appName: invite.appName })}
      </p>

      <h1 className="m-0 text-2xl font-bold leading-tight text-neutral-50">
        {t('giftLine', { days: invite.giftDays, tier: tierLabel })}
      </h1>

      <p className="m-0 text-[13px] leading-relaxed text-neutral-400">{t('pitchLine')}</p>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Chip>{t('chipSeats', { count: seatsLabel })}</Chip>
        <Chip>{t('chipAgents', { count: agentsLabel })}</Chip>
      </div>

      {invite.daysUntilLinkExpiry !== null && (
        <p className="m-0 flex items-center gap-1.5 text-[12px] text-amber-400">
          <Clock size={12} />
          {invite.daysUntilLinkExpiry <= 0 ? t('expiresToday') : t('expiresInDays', { days: invite.daysUntilLinkExpiry })}
        </p>
      )}
    </>
  );

  // Logged in → auto-claim (mirrors InviteAcceptClient's auto-trigger, but
  // holds on a confirmation instead of instant-redirecting — see the
  // component). `claimedByViewer` short-circuits a redundant claim call when
  // this viewer already has it (revisit, refresh, or a duplicate mount).
  if (session?.user) {
    return (
      <Shell>
        {header}
        <ProspectInviteClaimClient
          token={token}
          alreadyClaimed={invite.claimedByViewer}
          giftDays={invite.giftDays}
          tierLabel={tierLabel}
        />
      </Shell>
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
    <Shell
      footer={
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 px-4 py-2 text-[13px] font-medium text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-50"
        >
          {t('exploreCta')}
          <ArrowRight size={14} />
        </Link>
      }
    >
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
      <form action={signInToClaim} className="w-full mt-1">
        <button type="submit" className="w-full px-5 py-2.5 rounded-lg text-[13.5px] font-semibold text-white bg-blue-500 hover:opacity-90 transition-opacity">
          {t('signInCta', { days: invite.giftDays })}
        </button>
      </form>
      <p className="m-0 text-[11px] text-neutral-600">{t('noCardHint')}</p>
    </Shell>
  );
}
