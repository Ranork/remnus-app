import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import AIMark, { type AIMarkName } from '../AIMark';
import HeroStage, { type StageCopy } from './HeroStage';
import SiteDemoButton from './SiteDemoButton';

const CLIENTS: { id: AIMarkName; name: string }[] = [
  { id: 'claude', name: 'Claude Code' },
  { id: 'cursor', name: 'Cursor' },
  { id: 'codex', name: 'Codex' },
  { id: 'windsurf', name: 'Windsurf' },
  { id: 'chatgpt', name: 'ChatGPT' },
  { id: 'antigravity', name: 'Antigravity' },
  { id: 'continue', name: 'Continue' },
];

const STAGE_KEYS = [
  'label', 'prompt', 'newPage', 'task1', 'task2', 'task3', 'tasksCreated', 'moved', 'done', 'editing',
  'edited', 'backlog', 'inProgress', 'doneColumn', 'card1', 'card2', 'card3', 'card4', 'dashboard', 'map',
  'architecture', 'decisions', 'board', 'viewBoard', 'viewTable', 'high', 'medium',
] as const satisfies readonly (keyof StageCopy)[];

export default async function SiteHero() {
  const t = await getTranslations('Site.hero');
  const tStage = await getTranslations('Site.stage');
  // `tasksCreated` / `moved` keep their {placeholders}: the stage fills them per step.
  const stage = Object.fromEntries(STAGE_KEYS.map((k) => [k, tStage.raw(k) as string])) as StageCopy;

  return (
    <section className="px-4 pt-14 pb-20 sm:px-8 sm:pt-20 lg:pt-24 lg:pb-28">
      <div className="mx-auto max-w-[1200px]">
        <div className="grid items-end gap-8 lg:grid-cols-12 lg:gap-10">
          <h1 className="m-0 text-[40px] leading-[1.02] font-semibold tracking-[-0.04em] text-balance text-fg sm:text-[56px] lg:col-span-7 lg:text-[68px]">
            {t('title')}
          </h1>
          <div className="lg:col-span-5 lg:pb-2">
            <p className="m-0 max-w-[34rem] text-base leading-[1.6] text-fg-2 sm:text-[17px]">{t('lede')}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <SiteDemoButton label={t('demo')} />
              <Link href="/login" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11 px-5 text-[15px] text-fg')}>
                {t('start')}
              </Link>
            </div>
            <p className="m-0 mt-4 text-ui text-fg-3">{t('note')}</p>
          </div>
        </div>

        <div className="mt-12 lg:mt-16">
          <HeroStage copy={stage} />
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
          <span className="shrink-0 text-ui text-fg-3">{t('worksWith')}</span>
          <ul className="site-marks m-0 flex list-none flex-wrap items-center gap-x-6 gap-y-3 p-0 text-fg-2">
            {CLIENTS.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-sm">
                <AIMark name={c.id} size={16} />
                {c.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
