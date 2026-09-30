'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import DashboardBlockEditor from './DashboardBlockEditor';

/** "Add block" — opens the block editor with nothing selected yet. */
export default function DashboardAddBlock({ itemId, prominent = false }: { itemId: string; prominent?: boolean }) {
  const t = useTranslations('Dashboard');
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          prominent
            ? 'inline-flex h-8 items-center gap-1.5 rounded-control bg-ink px-3.5 text-ui font-semibold text-ink-fg transition-colors hover:bg-ink/88'
            : 'inline-flex h-7 items-center gap-1 rounded-control px-2 text-xs text-fg-3 transition-colors hover:bg-hover hover:text-fg'
        }
      >
        <Plus size={prominent ? 16 : 14} />
        {t('addBlock')}
      </button>
      {open && <DashboardBlockEditor itemId={itemId} onClose={() => setOpen(false)} />}
    </>
  );
}
