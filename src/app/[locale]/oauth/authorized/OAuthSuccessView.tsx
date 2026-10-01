'use client';

import { useEffect } from 'react';
import { Check } from 'lucide-react';
import { AuthStatus } from '@/components/features/auth/AuthScreen';

interface Props {
  to: string;
  successTitle: string;
  successMessage: string;
  successClose: string;
}

export function OAuthSuccessView({ to, successTitle, successMessage, successClose }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.replace(to);
    }, 1200);
    return () => clearTimeout(timer);
  }, [to]);

  return (
    <AuthStatus icon={<Check />} tone="success" title={successTitle}>
      <p>{successMessage}</p>
      <p className="mt-2 text-xs">{successClose}</p>
    </AuthStatus>
  );
}
