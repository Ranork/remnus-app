'use client';

import { useTransition } from 'react';
import { LogIn } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { logout } from '@/lib/actions/auth';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * "You're in a demo, sign in to subscribe" — a small dialog shown to demo accounts
 * wherever a real user would be sent to Stripe (plan picker, pricing buttons). Opened from
 * another dialog it nests on top of it. The CTA signs the demo session out and lands on
 * /login (via the shared {@link logout} action) so they can continue with their own account.
 */
export default function DemoBillingNotice({ onClose }: { onClose: () => void }) {
  const t = useTranslations('Billing');
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('demoTitle')}</DialogTitle>
          <DialogDescription>{t('demoBody')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => startTransition(() => { void logout(); })}
            loading={pending}
          >
            <LogIn />
            {t('demoCta')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
