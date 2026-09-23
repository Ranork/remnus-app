import { LayoutGrid, RefreshCw, Share2 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import AIMark from '../AIMark';
import { NoticeBadge, Section, SectionHead, StatusPill } from './parts';

// Illustrative week of agent activity (tasks touched per day, per agent).
const ACTIVITY = [
  { claude: 5, codex: 2, cursor: 1 },
  { claude: 7, codex: 3, cursor: 2 },
  { claude: 4, codex: 5, cursor: 1 },
  { claude: 8, codex: 2, cursor: 3 },
  { claude: 6, codex: 4, cursor: 2 },
  { claude: 2, codex: 1, cursor: 0 },
  { claude: 1, codex: 0, cursor: 0 },
];
const AGENT_BAR = { claude: '#d97757', codex: 'var(--color-accent-strong)', cursor: 'var(--color-opt-teal)' } as const;
const MAX = Math.max(...ACTIVITY.map((d) => d.claude + d.codex + d.cursor));

export default async function NextDashboards() {
  const t = await getTranslations('LandingNext.dashboards');
  const days = t.raw('days') as string[];

  const tiles = [
    { n: '7', k: t('tileShipped') },
    { n: '3', k: t('tileDecisions'), note: t('tileDecisionsNote') },
    { n: '2', k: t('tileRisks') },
    { n: '3', k: t('tileAgents') },
  ];

  const points = [
    { icon: LayoutGrid, title: t('p1Title'), body: t('p1Body') },
    { icon: RefreshCw, title: t('p2Title'), body: t('p2Body') },
    { icon: Share2, title: t('p3Title'), body: t('p3Body') },
  ];

  return (
    <Section id="dashboards">
      <SectionHead
        kicker={t('kicker')}
        pre={t('titlePre')}
        accent={t('titleAccent')}
        body={t('body')}
        aside={<StatusPill tone="warn">{t('soon')}</StatusPill>}
      />

      {/* Mock dashboard */}
      <div className="marketing-preview-shadow overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 px-5 lg:px-7 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] text-dim">{t('project')} /</span>
            <span className="text-[16px] font-semibold text-neutral-100">{t('title')}</span>
          </div>
          <span className="inline-flex items-center gap-2 text-[12px] text-dim">
            <AIMark name="claude" size={13} />
            {t('updated')}
          </span>
        </div>

        <div className="grid gap-px bg-neutral-800 grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.k} className="bg-neutral-900 px-5 lg:px-7 py-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[34px] font-semibold leading-none text-neutral-100 tabular-nums" style={{ letterSpacing: '-0.03em' }}>
                  {tile.n}
                </span>
                {tile.note && <NoticeBadge>{tile.note}</NoticeBadge>}
              </div>
              <div className="mt-2 text-[13px] text-dim">{tile.k}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-px border-t border-neutral-800 bg-neutral-800 lg:grid-cols-4">
          {/* Activity chart */}
          <div className="bg-neutral-900 px-5 lg:px-7 py-6 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <span className="text-[13px] font-medium text-neutral-100">{t('chartTitle')}</span>
              <span className="flex items-center gap-4 text-[11.5px] text-dim">
                {(['claude', 'codex', 'cursor'] as const).map((a) => (
                  <span key={a} className="inline-flex items-center gap-1.5 capitalize">
                    <span className="h-2 w-2 rounded-sm" style={{ background: AGENT_BAR[a] }} />
                    {a}
                  </span>
                ))}
              </span>
            </div>
            <div className="flex h-[150px] items-end gap-3" role="img" aria-label={t('chartTitle')}>
              {ACTIVITY.map((d, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center gap-2">
                  <div className="flex w-full max-w-[34px] flex-1 flex-col justify-end gap-[2px]">
                    {(['cursor', 'codex', 'claude'] as const).map((a) =>
                      d[a] ? (
                        <span
                          key={a}
                          className="block w-full rounded-[3px]"
                          style={{ height: `${(d[a] / MAX) * 100}%`, background: AGENT_BAR[a] }}
                        />
                      ) : null,
                    )}
                  </div>
                  <span className="font-mono text-[10.5px] text-dim">{days[i]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Waiting for you */}
          <div className="bg-neutral-900 px-5 lg:px-7 py-6 lg:col-span-2">
            <span className="text-[13px] font-medium text-neutral-100">{t('reviewTitle')}</span>
            <ul className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
              {[
                { title: t('review1'), meta: t('review1Meta'), agent: 'claude' as const },
                { title: t('review2'), meta: t('review2Meta'), agent: 'codex' as const },
              ].map((r) => (
                <li key={r.title} className="flex items-start gap-3 rounded-lg border border-amber-400/30 bg-amber-400/[0.04] px-3.5 py-3">
                  <span className="mt-0.5"><AIMark name={r.agent} size={15} /></span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[14px] text-neutral-100">{r.title}</span>
                    <span className="font-mono text-[11px] text-dim">{r.meta}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid gap-px border-t border-neutral-800 bg-neutral-800 md:grid-cols-2 lg:grid-cols-4">
          <div className="bg-neutral-900 px-5 lg:px-7 py-6 lg:col-span-2">
            <span className="text-[13px] font-medium text-neutral-100">{t('changesTitle')}</span>
            <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0 text-[14px] text-neutral-50">
              {[t('change1'), t('change2')].map((c) => (
                <li key={c} className="flex gap-3">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-strong" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-neutral-900 px-5 lg:px-7 py-6 lg:col-span-2">
            <span className="text-[13px] font-medium text-neutral-100">{t('risksTitle')}</span>
            <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0 text-[14px] text-neutral-50">
              {[t('risk1'), t('risk2')].map((r) => (
                <li key={r} className="flex gap-3">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-3">
        {points.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex flex-col gap-2.5">
            <Icon size={18} className="text-accent-strong" />
            <h3 className="m-0 text-[16px] font-semibold text-neutral-100">{title}</h3>
            <p className="m-0 text-[14.5px] leading-[1.6] text-dim">{body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
