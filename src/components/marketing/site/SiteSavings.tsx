import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { cn } from '@/lib/cn';
import SavingsCalculator, { type CalculatorCopy } from './SavingsCalculator';
import SectionHead from './SectionHead';
import { SESSION_REMNUS, SESSION_ROOM_FACTOR, SESSION_SAVED_PERCENT, SESSION_STEPS, SESSION_USUAL } from './savingsBenchmark';

/**
 * The savings pitch: one measured agent session read two ways (bars), and what that is
 * worth at the visitor's own volume and price (calculator). Yellow is the Remnus bar.
 */
export default async function SiteSavings() {
  const t = await getTranslations('Site.savings');
  const locale = await getLocale();
  const nf = new Intl.NumberFormat(locale);

  const rows = [
    ...SESSION_STEPS.map((s) => ({ label: t(s.key), usual: s.usual, remnus: s.remnus, total: false })),
    { label: t('rowTotal'), usual: SESSION_USUAL, remnus: SESSION_REMNUS, total: true },
  ];
  const max = SESSION_USUAL;

  const calculator: CalculatorCopy = {
    title: t('calcTitle'),
    sessions: t('calcSessions'),
    price: t('calcPrice'),
    tokens: t.raw('calcTokens') as string,
    money: t('calcMoney'),
    note: t('calcNote'),
  };

  return (
    <section className="px-4 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-[1200px]">
        <SectionHead title={t('title', { percent: SESSION_SAVED_PERCENT })} lede={t('lede')} />

        <div className="mt-12 grid gap-6 lg:mt-16 lg:grid-cols-12">
          <div className="rounded-[14px] bg-sheet p-6 shadow-sheet lg:col-span-7 lg:p-7">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-ui text-fg-2">
              <span className="flex items-center gap-2">
                <span className="h-2 w-4 rounded-full bg-fg-4" />
                {t('usual')}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-4 rounded-full bg-signal" />
                {t('remnus')}
              </span>
            </div>

            <dl className="m-0 mt-6 space-y-5">
              {rows.map((row) => (
                <div key={row.label} className={cn(row.total && 'border-t border-line pt-5')}>
                  <dt className={cn('text-ui', row.total ? 'font-semibold text-fg' : 'text-fg-2')}>{row.label}</dt>
                  <dd className="m-0 mt-2 space-y-1.5">
                    <Bar value={row.usual} max={max} tone="usual" label={t('tokens', { count: nf.format(row.usual) })} />
                    <Bar value={row.remnus} max={max} tone="remnus" label={t('tokens', { count: nf.format(row.remnus) })} />
                  </dd>
                </div>
              ))}
            </dl>

            <p className="m-0 mt-6 text-[15px] leading-[1.6] text-fg-2">{t('room', { factor: SESSION_ROOM_FACTOR })}</p>
            <Link
              href="/docs/agent-token-efficiency"
              className="mt-3 inline-flex text-sm font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg-3"
            >
              {t('method')}
            </Link>
          </div>

          <div className="lg:col-span-5">
            <SavingsCalculator copy={calculator} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Bar({ value, max, tone, label }: { value: number; max: number; tone: 'usual' | 'remnus'; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-raised">
        <div
          className={cn('h-full rounded-full', tone === 'remnus' ? 'bg-signal' : 'bg-fg-4')}
          style={{ width: `${Math.max(1.5, (value / max) * 100)}%` }}
        />
      </div>
      <span className={cn('w-24 shrink-0 text-right text-xs tabular-nums', tone === 'remnus' ? 'font-semibold text-fg' : 'text-fg-3')}>
        {label}
      </span>
    </div>
  );
}
