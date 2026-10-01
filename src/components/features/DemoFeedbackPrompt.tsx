'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { submitDemoFeedback, type DemoSentiment } from '@/lib/actions/demoFeedback';
import { logout } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { toastSurfaceClass } from '@/components/ui/toast';
import { cn } from '@/lib/cn';

// Fires a few minutes into a demo session to gauge sentiment and nudge signup.
// Mounted ONLY for demo users (see (app)/layout.tsx). State is purely local —
// demo accounts are ephemeral, so a localStorage bit is enough to show it once.
// A small form, so not a toast — but it wears the toast's surface and sits in its corner.
const STORAGE_KEY = 'remnus_demo_feedback_v1';
const DELAY_MS = 3 * 60 * 1000; // ~3 minutes of demo time before we ask

const OPTIONS: { sentiment: DemoSentiment; emoji: string }[] = [
  { sentiment: 'positive', emoji: '😍' },
  { sentiment: 'neutral', emoji: '🙂' },
  { sentiment: 'negative', emoji: '😕' },
];

export default function DemoFeedbackPrompt() {
  const t = useTranslations('DemoFeedback');
  const tUi = useTranslations('UI');
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [sentiment, setSentiment] = useState<DemoSentiment | ''>('');
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
    <section
      aria-label={submitted ? t('thanksTitle') : t('title')}
      className={cn(
        toastSurfaceClass,
        'fixed inset-x-4 bottom-[calc(var(--consent-banner-height,0px)+4.5rem)] z-350 mx-auto max-w-90 p-4 animate-scale-in lg:right-4 lg:bottom-[calc(var(--consent-banner-height,0px)+1rem)] lg:left-auto lg:mx-0 lg:w-90',
      )}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={dismiss}
        aria-label={tUi('close')}
        className="absolute top-2 right-2"
      >
        <X />
      </Button>

      {submitted ? (
        <div className="flex flex-col gap-3 pr-6">
          <div>
            <h3 className="text-sm font-semibold text-fg">{t('thanksTitle')}</h3>
            <p className="mt-1 text-xs leading-relaxed text-fg-3">{t('thanksBody')}</p>
          </div>
          <div className="flex items-center gap-2">
            <form action={logout}>
              <Button type="submit" variant="primary" size="sm">{t('ctaSignup')}</Button>
            </form>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t('keepExploring')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="pr-6">
            <h3 className="text-sm font-semibold text-fg">{t('title')}</h3>
            <p className="mt-1 text-xs leading-relaxed text-fg-3">{t('subtitle')}</p>
          </div>

          <SegmentedControl
            value={sentiment}
            onValueChange={(v) => setSentiment(v as DemoSentiment)}
            aria-label={t('title')}
            className="w-full"
          >
            {OPTIONS.map((o) => (
              <SegmentedControlItem
                key={o.sentiment}
                value={o.sentiment}
                aria-label={t(`sentiment_${o.sentiment}`)}
                title={t(`sentiment_${o.sentiment}`)}
                className="h-10 text-xl"
              >
                {o.emoji}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>

          {sentiment && (
            <>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('commentPlaceholder')}
                rows={2}
                maxLength={1000}
                className="min-h-0 resize-none text-xs"
              />
              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={submit} loading={busy}>
                  {t('submit')}
                </Button>
                <Button variant="ghost" size="sm" onClick={dismiss}>
                  {t('maybeLater')}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>,
    document.body,
  );
}
