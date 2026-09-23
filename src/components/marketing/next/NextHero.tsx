import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import AIMark, { type AIMarkName } from '../AIMark';
import { QuickStartCard } from './AgentPrompt';
import { NoticeBadge } from './parts';
import styles from './landing-next.module.css';
import ThemedLogo from './ThemedLogo';

type Agent = 'claude' | 'codex' | 'cursor';

// Raw agent activity: deliberately a wall of paths and diff stats — the point of
// the left pane is that nobody can follow it. Code-like data, so not translated.
const ACTIVITY: { agent: Agent; verb: string; target: string; stat?: string; bad?: boolean }[] = [
  { agent: 'claude', verb: 'edit',   target: 'src/auth/session.ts',            stat: '+84 −12' },
  { agent: 'codex',  verb: 'create', target: 'db/migrations/0041_orgs.sql' },
  { agent: 'claude', verb: 'edit',   target: 'src/billing/webhook.ts',         stat: '+212 −140' },
  { agent: 'cursor', verb: 'edit',   target: 'app/settings/page.tsx',          stat: '+31 −8' },
  { agent: 'claude', verb: 'delete', target: 'src/legacy/tokens.ts' },
  { agent: 'codex',  verb: 'edit',   target: 'src/auth/middleware.ts',         stat: '+19 −22' },
  { agent: 'claude', verb: 'commit', target: '"refactor: move sessions to JWT"' },
  { agent: 'cursor', verb: 'edit',   target: 'components/InviteDialog.tsx',    stat: '+96 −4' },
  { agent: 'codex',  verb: 'test',   target: 'billing/webhook.test.ts',        stat: '2 failing', bad: true },
  { agent: 'claude', verb: 'edit',   target: 'src/org/model.ts',               stat: '+140' },
  { agent: 'codex',  verb: 'commit', target: '"chore: drop legacy tokens"' },
  { agent: 'claude', verb: 'edit',   target: 'docs/api.md',                    stat: '+12 −30' },
];

const AGENT_COLOR: Record<Agent, string> = {
  claude: '#e08a6c',
  codex: '#cfd3da',
  cursor: '#9aa3b5',
};

// The agents shown on the quick-start card: the marks say who the prompt is for.
const PROMPT_MARKS: AIMarkName[] = ['claude', 'codex', 'cursor'];

export default async function NextHero() {
  const t = await getTranslations('LandingNext.hero');

  // Left: the promise and the main action. Right: the fastest way in — a prompt
  // to paste into the agent the visitor already uses. The picture below carries
  // the rest of the argument, so neither side needs more copy.
  return (
    <section className="marketing-hero relative overflow-hidden px-4 sm:px-8 lg:px-14 pt-16 pb-16 lg:pt-24 lg:pb-24">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[640px] w-[1100px] -translate-x-1/2"
        style={{ background: 'radial-gradient(ellipse at center, rgba(68,92,149,0.20), transparent 62%)' }}
      />

      <div className="relative max-w-7xl mx-auto">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16 lg:items-center">
          <div className="flex flex-col items-start">
            <a
              href="#how"
              className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-[12px] text-accent-strong transition-colors hover:border-blue-500/70"
            >
              {t('badge')}
              <span aria-hidden>→</span>
            </a>

            <h1
              className="mt-7 mb-0 font-sans font-semibold text-neutral-100 leading-[0.98] text-[44px] sm:text-[64px] lg:text-[76px] text-balance"
              style={{ letterSpacing: '-0.045em' }}
            >
              {t('titlePre')}{' '}
              <span
                className="font-serif italic font-medium text-accent-strong text-[48px] sm:text-[70px] lg:text-[84px]"
                style={{ letterSpacing: '-0.025em' }}
              >
                {t('titleAccent')}
              </span>
            </h1>

            <p className="mt-6 mb-0 max-w-[36rem] text-[18px] lg:text-[19px] leading-[1.55] text-neutral-50">{t('lede')}</p>

            <Link
              href="/login"
              className="mt-9 inline-flex items-center gap-2.5 rounded-lg bg-blue-500 px-7 py-4 text-[16.5px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(68,92,149,0.7)] transition-colors duration-150 hover:bg-accent-strong"
            >
              {t('ctaPrimary')}
              <span aria-hidden>→</span>
            </Link>
          </div>

          <QuickStartCard
            title={t('quickTitle')}
            body={t('quickBody')}
            copyLabel={t('copy')}
            copiedLabel={t('promptCopied')}
            steps={[t('step1'), t('step2'), t('step3')]}
            marks={PROMPT_MARKS.map((id) => (
              <span
                key={id}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 bg-neutral-850 ring-2 ring-neutral-900"
              >
                <AIMark name={id} size={17} />
              </span>
            ))}
          />
        </div>

        <HeroPicture
          l={{
            agentLabel: t('agentLabel'),
            agentCaption: t('agentCaption'),
            remnusLabel: t('remnusLabel'),
            week: t('week'),
            shipped: t('shipped'),
            decisions: t('decisions'),
            decisionsNote: t('decisionsNote'),
            risks: t('risks'),
            needsYouTag: t('needsYouTag'),
            needsYou: t('needsYou'),
            feed1: t('feed1'),
            feed2: t('feed2'),
            feed3: t('feed3'),
          }}
        />
      </div>
    </section>
  );
}

type PictureLabels = Record<
  | 'agentLabel' | 'agentCaption' | 'remnusLabel' | 'week' | 'shipped' | 'decisions'
  | 'decisionsNote' | 'risks' | 'needsYouTag' | 'needsYou' | 'feed1' | 'feed2' | 'feed3',
  string
>;

function HeroPicture({ l: t0 }: { l: PictureLabels }) {
  const t = (k: keyof PictureLabels) => t0[k];
  const lines = [...ACTIVITY, ...ACTIVITY];

  return (
    <div
      className="marketing-preview-shadow mt-14 lg:mt-20 grid overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_88px_minmax(0,1.15fr)]"
      style={{ boxShadow: '0 40px 80px -30px rgba(0,0,0,0.6), 0 12px 24px -12px rgba(0,0,0,0.4)' }}
    >
      {/* Left: the noise */}
      <div className={`${styles.onDarkSurface} flex flex-col`} style={{ background: '#0c0d10', color: '#cfd3da' }}>
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5" style={{ borderColor: '#23262c' }}>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: '#8a8f9a' }}>
            {t('agentLabel')}
          </span>
          <span className="flex gap-1.5" aria-hidden>
            {['#3a3d44', '#3a3d44', '#3a3d44'].map((c, i) => (
              <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
            ))}
          </span>
        </div>
        <div className={`${styles.tickerWindow} h-[260px] sm:h-[320px] px-5`} aria-hidden>
          <div className={styles.ticker}>
            {lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2.5 py-[6px] font-mono text-[12px] leading-none whitespace-nowrap">
                {/* Agent mark first: at a glance you see three agents interleaving, not one log. */}
                <span className="flex w-[70px] shrink-0 items-center gap-2" style={{ color: AGENT_COLOR[l.agent] }}>
                  <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-white/[0.06]">
                    <AIMark name={l.agent} size={12} />
                  </span>
                  {l.agent}
                </span>
                <span className="w-[46px] shrink-0" style={{ color: '#6f7480' }}>{l.verb}</span>
                <span className="truncate">{l.target}</span>
                {l.stat && (
                  <span className="shrink-0" style={{ color: l.bad ? '#e2776d' : '#7fc36d' }}>{l.stat}</span>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="border-t px-5 py-3 font-mono text-[11.5px]" style={{ borderColor: '#23262c', color: '#8a8f9a' }}>
          {t('agentCaption')}
        </div>
      </div>

      {/* Middle: the bridge */}
      <div className="hidden lg:flex items-center justify-center border-x border-neutral-800 bg-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <div className={`${styles.bridge} h-3 w-[72px]`} aria-hidden>
            <span className="absolute left-0 right-0 top-1/2 h-px bg-neutral-800" />
            <span className={styles.bridgeDot} />
            <span className={styles.bridgeDot} />
            <span className={styles.bridgeDot} />
          </div>
          <ThemedLogo size={22} className="opacity-90" />
        </div>
      </div>

      {/* Right: the picture */}
      <div className="flex flex-col bg-neutral-900">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-5 py-3.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent-strong">{t('remnusLabel')}</span>
          <span className="text-[12px] text-dim">acme-api · {t('week')}</span>
        </div>
        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { n: '7', k: t('shipped') },
              { n: '3', k: t('decisions'), note: t('decisionsNote') },
              { n: '2', k: t('risks') },
            ].map((tile, i) => (
              <div
                key={tile.k}
                className={`${styles.tile} rounded-lg border bg-neutral-950 px-3 py-2.5 ${
                  tile.note ? 'border-amber-400/40' : 'border-neutral-800'
                }`}
                style={{ animationDelay: `${0.15 + i * 0.1}s` }}
              >
                {/* The count and, when something waits on the human, a notification badge beside it. */}
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-[26px] font-semibold leading-none text-neutral-100 tabular-nums">{tile.n}</span>
                  {tile.note && <NoticeBadge>{tile.note}</NoticeBadge>}
                </div>
                <div className="mt-1.5 text-[11.5px] leading-tight text-dim">{tile.k}</div>
              </div>
            ))}
          </div>

          <div className={`${styles.needsYou} flex items-center gap-3 rounded-lg border border-amber-400/40 bg-amber-400/5 px-3.5 py-3`}>
            <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 font-mono text-[10.5px] leading-[1.4] text-amber-400">
              {t('needsYouTag')}
            </span>
            <span className="text-[13.5px] leading-snug text-neutral-100">{t('needsYou')}</span>
          </div>

          <div className="flex flex-col divide-y divide-neutral-800 rounded-lg border border-neutral-800">
            {[
              { id: 'claude' as const, text: t('feed1') },
              { id: 'codex' as const, text: t('feed2') },
              { id: 'cursor' as const, text: t('feed3') },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3 px-3.5 py-2.5 text-[13px] text-neutral-50">
                <AIMark name={f.id} size={15} />
                <span className="truncate">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

