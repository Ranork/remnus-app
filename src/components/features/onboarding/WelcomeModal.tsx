'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Plug, PencilLine, ArrowRight, ShieldCheck, ScrollText, X } from 'lucide-react';

interface Props {
  /** Recommended path — open the editor-connection flow. */
  onConnect: () => void;
  /** Secondary path — dismiss and let the user explore the workspace manually. */
  onExplore: () => void;
  /** Close (X / backdrop / Esc) — treated like "explore" but without intent signal. */
  onClose: () => void;
}

/**
 * First-run welcome modal shown once to a brand-new user. Splits intent into the
 * two real activation paths (connect an AI agent vs. explore manually) and frames
 * the pre-seeded "Paint clone" workspace as a sample so it isn't mistaken for the
 * user's own data. See {@link OnboardingGuide}.
 */
export default function WelcomeModal({ onConnect, onExplore, onClose }: Props) {
  const t = useTranslations('Onboarding');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-120 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-neutral-850 border border-neutral-800 rounded-2xl modal-shadow overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1 text-neutral-500 hover:text-neutral-200 transition-colors rounded hover:bg-neutral-800"
          aria-label={t('welcomeSkip')}
        >
          <X size={16} />
        </button>

        <div className="px-8 pt-11 pb-7 flex flex-col items-center text-center gap-3.5">
          <Image src="/logo-square-transparent.png" alt="Remnus" width={56} height={56} className="opacity-90" />
          <h2 className="text-2xl font-semibold text-neutral-50">{t('welcomeTitle')}</h2>
          <p className="text-sm text-neutral-400 max-w-md leading-relaxed">{t('welcomeSubtitle')}</p>
        </div>

        <div className="px-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Recommended: connect an AI agent */}
          <button
            onClick={onConnect}
            className="group relative flex flex-col items-start gap-2 p-5 rounded-xl border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/15 hover:-translate-y-0.5 transition-all text-left"
          >
            <span className="absolute top-2.5 right-2.5 text-[9px] font-bold text-blue-300 bg-blue-500/15 border border-blue-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              {t('welcomeRecommended')}
            </span>
            <span className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
              <Plug size={18} className="text-blue-300" />
            </span>
            <span className="text-sm font-semibold text-blue-100">{t('welcomeConnectTitle')}</span>
            <span className="text-[11px] leading-snug text-neutral-400">{t('welcomeConnectDesc')}</span>
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-300 group-hover:gap-1.5 transition-all">
              {t('welcomeConnectCta')} <ArrowRight size={12} />
            </span>
          </button>

          {/* Secondary: explore manually */}
          <button
            onClick={onExplore}
            className="group flex flex-col items-start gap-2 p-5 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 hover:-translate-y-0.5 transition-all text-left"
          >
            <span className="w-9 h-9 rounded-lg bg-neutral-950/60 border border-neutral-800 flex items-center justify-center">
              <PencilLine size={18} className="text-neutral-300" />
            </span>
            <span className="text-sm font-semibold text-neutral-200">{t('welcomeExploreTitle')}</span>
            <span className="text-[11px] leading-snug text-neutral-400">{t('welcomeExploreDesc')}</span>
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-400 group-hover:text-neutral-200 group-hover:gap-1.5 transition-all">
              {t('welcomeExploreCta')} <ArrowRight size={12} />
            </span>
          </button>
        </div>

        {/* Trust strip — the differentiator + the "this is a sample" framing */}
        <div className="px-8 pt-5 pb-7 mt-5 space-y-2">
          <div className="flex items-start gap-2 text-[11px] text-neutral-400 leading-relaxed">
            <ShieldCheck size={13} className="text-green-400 shrink-0 mt-0.5" />
            <span>{t('welcomeTrust')}</span>
          </div>
          <div className="flex items-start gap-2 text-[11px] text-neutral-500 leading-relaxed">
            <ScrollText size={13} className="text-neutral-500 shrink-0 mt-0.5" />
            <span>{t('welcomeSeedNote')}</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
