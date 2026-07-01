'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { submitDemoFeedback, type DemoSentiment } from '@/lib/actions/demoFeedback';
import { logout } from '@/lib/actions/auth';

// Fires a few minutes into a demo session to gauge sentiment and nudge signup.
// Mounted ONLY for demo users (see (app)/layout.tsx). State is purely local —
// demo accounts are ephemeral, so a localStorage bit is enough to show it once.
const STORAGE_KEY = 'remnus_demo_feedback_v1';
const DELAY_MS = 3 * 60 * 1000; // ~3 minutes of demo time before we ask

const OPTIONS: { sentiment: DemoSentiment; emoji: string }[] = [
  { sentiment: 'positive', emoji: '😍' },
  { sentiment: 'neutral', emoji: '🙂' },
  { sentiment: 'negative', emoji: '😕' },
];

export default function DemoFeedbackPrompt() {
  const t = useTranslations('DemoFeedback');
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [sentiment, setSentiment] = useState<DemoSentiment | null>(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return; // already asked this session
    } catch {
      // localStorage blocked — just show it once, no persistence
    }
    timerRef.current = setTimeout(() => setOpen(true), DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const persist = (v: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // ignore
    }
  };

  const dismiss = () => {
    persist('dismissed');
    setOpen(false);
  };

  const submit = async () => {
    if (!sentiment || busy) return;
    setBusy(true);
    await submitDemoFeedback({ sentiment, comment });
    persist('submitted');
    setSubmitted(true);
    setBusy(false);
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed z-[120] inset-x-4 bottom-4 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-90 animate-fade-in animate-duration-200">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl p-4 relative">
        <button
          onClick={dismiss}
          className="absolute right-2.5 top-2.5 p-1 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
          aria-label={t('dismiss')}
        >
          <X size={15} />
        </button>

        {submitted ? (
          <div className="flex flex-col gap-3 pr-4">
            <div>
              <h3 className="text-sm font-semibold text-neutral-100">{t('thanksTitle')}</h3>
              <p className="text-xs text-neutral-400 mt-1">{t('thanksBody')}</p>
            </div>
            <div className="flex items-center gap-2">
              <form action={logout}>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
                >
                  {t('ctaSignup')}
                </button>
              </form>
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
              >
                {t('keepExploring')}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pr-4">
            <div>
              <h3 className="text-sm font-semibold text-neutral-100">{t('title')}</h3>
              <p className="text-xs text-neutral-400 mt-1">{t('subtitle')}</p>
            </div>

            <div className="flex items-center gap-2">
              {OPTIONS.map((o) => (
                <button
                  key={o.sentiment}
                  onClick={() => setSentiment(o.sentiment)}
                  className={`flex-1 py-2 text-2xl rounded-lg border transition-colors cursor-pointer ${
                    sentiment === o.sentiment
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-neutral-800 bg-neutral-850 hover:border-neutral-700'
                  }`}
                  aria-label={t(`sentiment_${o.sentiment}`)}
                  title={t(`sentiment_${o.sentiment}`)}
                >
                  {o.emoji}
                </button>
              ))}
            </div>

            {sentiment && (
              <>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t('commentPlaceholder')}
                  rows={2}
                  maxLength={1000}
                  className="w-full text-xs rounded-lg bg-neutral-850 border border-neutral-800 px-2.5 py-2 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700 resize-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={submit}
                    disabled={busy}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {busy ? t('sending') : t('submit')}
                  </button>
                  <button
                    onClick={dismiss}
                    className="px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                  >
                    {t('maybeLater')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
