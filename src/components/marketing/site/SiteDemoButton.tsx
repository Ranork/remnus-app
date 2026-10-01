'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { loginAsDemo } from '@/lib/actions/demo';
import { cn } from '@/lib/cn';

/** "Try the demo": signs in a throwaway demo account — the site's one yellow action. */
export default function SiteDemoButton({ label, className }: { label: string; className?: string }) {
  const [, formAction, isPending] = useActionState(loginAsDemo, null);
  return (
    <form action={formAction} className={cn('contents')}>
      <Button type="submit" variant="signal" size="lg" loading={isPending} className={cn('h-11 px-5 text-[15px]', className)}>
        {label}
      </Button>
    </form>
  );
}
