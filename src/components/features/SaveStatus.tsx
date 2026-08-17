'use client';
import { useEffect, useState } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

type State = 'idle' | 'saving' | 'saved' | 'error';

interface SaveStatusProps {
  state: State;
  className?: string;
}

export default function SaveStatus({ state, className = '' }: SaveStatusProps) {
  const t = useTranslations('Page');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (state === 'idle') {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (state === 'saved') {
      const t = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(t);
    }
  }, [state]);

  if (!visible) return null;

  if (state === 'saving') {
    return (
      <div className={`flex items-center gap-1.5 text-[11px] text-neutral-500 select-none ${className}`}>
        <div className="w-2.5 h-2.5 rounded-full border border-neutral-600 border-t-transparent animate-spin shrink-0" />
        <span>{t('saving')}</span>
      </div>
    );
  }

  if (state === 'saved') {
    return (
      <div className={`flex items-center gap-1 text-[11px] text-green-400 select-none ${className}`}>
        <Check size={11} strokeWidth={2.5} />
        <span>{t('saved')}</span>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className={`flex items-center gap-1 text-[11px] text-red-400 select-none ${className}`}>
        <AlertCircle size={11} />
        <span>{t('savingError')}</span>
      </div>
    );
  }

  return null;
}

export type { State as SaveState };
