'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { EmailLogRow } from '@/lib/actions/mailing';

const KIND_STYLE: Record<string, string> = {
  welcome: 'bg-blue-500/10 text-blue-400',
  inactivity: 'bg-amber-500/10 text-amber-500',
  agent_nudge: 'bg-amber-500/10 text-amber-500',
  agent_connected: 'bg-green-500/10 text-green-400',
  newsletter: 'bg-neutral-800 text-neutral-300',
  test: 'bg-neutral-800 text-neutral-500',
};

const KIND_LABEL_KEYS: Record<string, string> = {
  welcome: 'kindWelcome',
  inactivity: 'kindInactivity',
  agent_nudge: 'kindAgentNudge',
  agent_connected: 'kindAgentConnected',
  newsletter: 'kindNewsletter',
  test: 'kindTest',
};

export default function EmailLogTable({ rows }: { rows: EmailLogRow[] }) {
  const t = useTranslations('Mailing');
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-8 text-center text-xs text-neutral-500">
        {t('logEmpty')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead>
          <tr className="border-b border-neutral-800 text-[10.5px] uppercase tracking-wider text-neutral-500">
            <th className="px-4 py-2.5 font-medium">{t('colRecipient')}</th>
            <th className="px-4 py-2.5 font-medium">{t('colKind')}</th>
            <th className="px-4 py-2.5 font-medium">{t('colSubject')}</th>
            <th className="px-4 py-2.5 font-medium">{t('colStatus')}</th>
            <th className="px-4 py-2.5 font-medium">{t('colDate')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-neutral-850 last:border-0 hover:bg-neutral-800/10">
              <td className="px-4 py-2.5 text-neutral-300">{row.email}</td>
              <td className="px-4 py-2.5">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${KIND_STYLE[row.kind] ?? KIND_STYLE.test}`}>
                  {t(KIND_LABEL_KEYS[row.kind] ?? 'kindTest')}
                </span>
              </td>
              <td className="max-w-[260px] truncate px-4 py-2.5 text-neutral-400" title={row.subject}>
                {row.subject}
              </td>
              <td className="px-4 py-2.5">
                {row.status === 'sent' ? (
                  <span className="text-green-400">{t('statusOk')}</span>
                ) : (
                  <span className="text-red-400" title={row.error ?? undefined}>{t('statusFailed')}</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-neutral-500">
                {fmt.format(new Date(row.createdAt))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
