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
            ? 'inline-flex items-center gap-1.5 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-700'
            : 'inline-flex items-center gap-1 text-[11px] text-neutral-500 transition-colors hover:text-neutral-200'
        }
      >
        <Plus size={prominent ? 13 : 12} />
        {t('addBlock')}
      </button>
      {open && <DashboardBlockEditor itemId={itemId} onClose={() => setOpen(false)} />}
    </>
  );
}
