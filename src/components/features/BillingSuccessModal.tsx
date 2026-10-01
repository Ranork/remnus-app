'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { CheckCircle2, Users, Bot, HardDrive, ScrollText, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { reconcileMySubscription } from '@/lib/actions/billing';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Sub = Awaited<ReturnType<typeof reconcileMySubscription>>;

function formatBytes(n: number): string {
  if (!isFinite(n)) return '∞';
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(n >= 10 * 1024 ** 3 ? 0 : 1)} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.round(n / 1024)} KB`;
}

// Shown once after a successful Stripe Checkout (lands on any page with ?billing=success).
export default function BillingSuccessModal() {
  const t = useTranslations('Billing');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const show = params.get('billing') === 'success';

  const [data, setData] = useState<Sub | null>(null);
  const fetched = useRef(false);

  useEffect(() => {
    if (!show || fetched.current) return;
    fetched.current = true;
    let cancelled = false;
    // Reconcile directly from Stripe (source of truth) instead of waiting on the
    // webhook — robust to delayed/unreachable webhooks. A fresh checkout's subscription
    // is normally live in Stripe by the time we land here, so the first call resolves;
    // we still retry a few times (max ~5s) in case it's a beat behind.
    const poll = async (attempt = 0) => {
      try {
        const sub = await reconcileMySubscription();
        if (cancelled) return;
        setData(sub);
        if (sub.tier === 'free' && attempt < 4) setTimeout(() => poll(attempt + 1), 1200);
      } catch {
        if (!cancelled && attempt < 4) setTimeout(() => poll(attempt + 1), 1200);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [show]);

  if (!show) return null;

  const close = () => router.replace(pathname);

  const tier = data?.tier ?? 'startup';
  const val = (n: number) => (isFinite(n) ? String(n) : t('unlimited'));
  const limits = data?.limits;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent size="md" className="items-center text-center sm:max-w-md">
        <CheckCircle2 size={40} strokeWidth={1.5} className="text-green-400" aria-hidden />

        {!data ? (
          <>
            <DialogTitle className="sr-only">{t('successTitle')}</DialogTitle>
            <div role="status" className="py-8"><Loader2 size={20} className="animate-spin text-fg-3" /></div>
          </>
        ) : (
          <>
            <DialogHeader className="items-center in-dialog-compact:px-8">
              <DialogTitle className="text-lg">{t('successTitle')}</DialogTitle>
              <Badge variant="outline" className="mt-1">{t(`tier_${tier}` as 'tier_free')}</Badge>
              <DialogDescription className="mt-2">{t('successBody')}</DialogDescription>
            </DialogHeader>

            <ul className="flex w-full flex-col gap-2.5 text-left">
              <Feat icon={<Users size={16} />} text={t('featSeats', { value: val(limits!.seats) })} />
              <Feat icon={<Bot size={16} />} text={t('featAgents', { value: val(limits!.agents) })} />
              <Feat icon={<HardDrive size={16} />} text={t('featStorage', { value: formatBytes(limits!.storageBytes) })} />
              <Feat icon={<ScrollText size={16} />} text={t('featAudit', { value: val(limits!.auditDays) })} />
            </ul>

            <DialogFooter className="w-full">
              <Button variant="primary" size="lg" className="w-full" onClick={close}>
                {t('successCta')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Feat({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-2.5 text-ui text-fg">
      <span className="shrink-0 text-fg-3">{icon}</span>
      {text}
    </li>
  );
}
