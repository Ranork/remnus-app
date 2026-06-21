'use client';

import { useTransition } from 'react';
import { LogIn, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { logout } from '@/lib/actions/auth';

/**
 * Friendly "you're in a demo, sign in to subscribe" panel shown to demo accounts
 * wherever a real user would be sent to Stripe. Styled like the other billing modals
 * (header + divider + body). The CTA signs the demo session out and lands on /login
 * (via the shared {@link logout} action) so they can continue with their own account.
 */
export default function DemoBillingNotice({ className = '', onClose }: { className?: string; onClose?: () => void }) {
  const t = useTranslations('Billing');
  const [pending, startTransition] = useTransition();

  return (
    <div
      className={`overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-[0_8px_40px_rgba(0,0,0,0.6)] ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <LogIn size={15} className="text-amber-400" />
          <span className="text-sm font-semibold text-neutral-100">{t('demoTitle')}</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200 transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        <p className="m-0 text-[13px] leading-relaxed text-neutral-300">{t('demoBody')}</p>
        <button
          type="button"
          onClick={() => startTransition(() => { void logout(); })}
          disabled={pending}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold text-[#1d1f23] bg-amber-500 hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
          {t('demoCta')}
        </button>
      </div>
    </div>
  );
}
