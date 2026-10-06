'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Check, FileText, Flag, KanbanSquare, Layers, LayoutGrid, Loader2, Table2, Waypoints } from 'lucide-react';
import AIMark, { type AIMarkName } from '../AIMark';
import { RemnusMark } from '@/components/ui/remnus-mark';
import { cn } from '@/lib/cn';

export type StageCopy = {
  label: string;
  prompt: string;
  newPage: string;
  task1: string;
  task2: string;
  task3: string;
  tasksCreated: string;
  moved: string;
  done: string;
  editing: string;
  edited: string;
  backlog: string;
  inProgress: string;
  doneColumn: string;
  card1: string;
  card2: string;
  card3: string;
  card4: string;
  dashboard: string;
  map: string;
  architecture: string;
  decisions: string;
  board: string;
  viewBoard: string;
  viewTable: string;
  high: string;
  medium: string;
};

/**
 * The landing hero: an agent works in a terminal and the Remnus workspace beside it
 * changes as it goes — a page appears in the tree, three tasks land on the board, one
 * moves to In progress. Yellow marks exactly what the agent is touching, then settles.
 * Each loop hands the terminal to the next agent (Claude Code → Codex → Cursor); the
 * terminal title, every mark and the "X is editing" chip follow it.
 *
 * One timeline drives everything (`phase`); the board is plain markup in the app's own
 * tokens, so it follows the theme. Off screen the loop stops; with reduced motion the
 * finished state is shown still, with the first agent.
 *
 * From md up the terminal hangs off the stage's bottom-right corner like a window of its
 * own: it is positioned against the figure, and neither the clipped stage nor the sheet
 * is positioned, so the stage's `overflow-hidden` does not clip it.
 */
const EVENTS: [at: number, phase: number][] = [
  [2300, 1], // create_page running
  [2900, 2], // page in the tree
  [3500, 3], // bulk_create_pages running
  [4100, 4], // three tasks on the board
  [5700, 5], // update_page running
  [6300, 6], // task moved
  [7500, 7], // done, highlights settle
  [11800, 8], // fade out
];
const LOOP_MS = 12500;
const FINAL = 7;

/** Agent names are product names, never translated; `short` fills the stage's {agent} chips. */
type StageAgent = { id: AIMarkName; name: string; short: string };
const AGENTS: StageAgent[] = [
  { id: 'claude', name: 'Claude Code', short: 'Claude' },
  { id: 'codex', name: 'Codex', short: 'Codex' },
  { id: 'cursor', name: 'Cursor', short: 'Cursor' },
];

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

export default function HeroStage({ copy }: { copy: StageCopy }) {
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [phase, setPhase] = useState(0);
  const [typed, setTyped] = useState(0);
  const [agentIndex, setAgentIndex] = useState(0);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !inView) return;
    let timers: number[] = [];
    let round = 0;
    const chars = copy.prompt.length;
    const per = Math.min(45, 1700 / Math.max(chars, 1));
    const loop = () => {
      timers = [];
      setAgentIndex(round++ % AGENTS.length);
      setPhase(0);
      setTyped(0);
      for (let i = 1; i <= chars; i++) timers.push(window.setTimeout(() => setTyped(i), 350 + i * per));
      for (const [at, p] of EVENTS) timers.push(window.setTimeout(() => setPhase(p), at));
      timers.push(window.setTimeout(loop, LOOP_MS));
    };
    const first = window.setTimeout(loop, 0);
    return () => {
      window.clearTimeout(first);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [reduced, inView, copy.prompt.length]);

  const p = reduced ? FINAL : phase;
  const agent = AGENTS[reduced ? 0 : agentIndex];
  const shownPrompt = reduced || p >= 1 ? copy.prompt : copy.prompt.slice(0, typed);
  const live = p >= 1 && p < FINAL; // the agent is at work
  const fading = p >= 8;

  const newTasks = [
    { id: 't1', title: copy.task1, tag: copy.high, tone: 'high' as const },
    { id: 't2', title: copy.task2, tag: copy.medium, tone: 'medium' as const },
    { id: 't3', title: copy.task3, tag: copy.medium, tone: 'medium' as const },
  ];
  const moved = p >= 6;
  const backlog = [
    ...(p >= 4 ? newTasks.filter((t) => !(moved && t.id === 't1')) : []),
    { id: 'c1', title: copy.card1, tag: copy.high, tone: 'high' as const },
    { id: 'c2', title: copy.card2, tag: copy.medium, tone: 'medium' as const },
  ];
  const inProgress = [
    ...(moved ? [newTasks[0]] : []),
    { id: 'c3', title: copy.card3, tag: copy.medium, tone: 'medium' as const },
  ];
  const done = [{ id: 'c4', title: copy.card4, tag: copy.high, tone: 'high' as const }];
  const agentMade = new Set(p >= 4 && !fading ? ['t1', 't2', 't3'] : []);
  const ringed = new Set(live && p >= 4 ? (moved ? ['t1'] : ['t1', 't2', 't3']) : []);

  return (
    <figure ref={rootRef} aria-label={copy.label.replace('{agent}', agent.name)} className="site-marks relative m-0">
      <div aria-hidden className="overflow-hidden rounded-[14px] bg-desk shadow-modal ring-1 ring-line-strong md:h-[540px]">
        <div className="flex h-full flex-col md:flex-row">
          {/* Sidebar on the desk */}
          <div className="hidden w-[208px] shrink-0 flex-col gap-0.5 p-3 text-ui text-fg-2 lg:flex">
            <div className="flex items-center gap-2 px-1.5 pt-0.5 pb-3 font-semibold text-fg">
              <RemnusMark className="size-3.5" />
              Remnus
            </div>
            <div className="flex items-center gap-2 px-1.5 pb-2 font-medium text-fg">
              <span className="flex size-[18px] items-center justify-center rounded-[5px] bg-ink text-2xs font-semibold text-ink-fg">P</span>
              Paint Clone
            </div>
            <div className="mb-2 grid grid-cols-2 gap-1 px-1 text-xs">
              <span className="flex items-center justify-center gap-1.5 rounded-control bg-hover/60 py-1.5">
                <LayoutGrid className="size-3.5 text-fg-3" />
                {copy.dashboard}
              </span>
              <span className="flex items-center justify-center gap-1.5 rounded-control bg-hover/60 py-1.5">
                <Waypoints className="size-3.5 text-fg-3" />
                {copy.map}
              </span>
            </div>
            <TreeRow icon={<Layers className="size-4" />} label={copy.architecture} />
            <TreeRow icon={<Flag className="size-4" />} label={copy.decisions} />
            {p >= 2 && (
              <div className={cn('transition-opacity duration-700', fading && 'opacity-0')}>
                <TreeRow
                  className="site-arrive"
                  icon={<FileText className="size-4" />}
                  label={copy.newPage}
                  live={live}
                />
              </div>
            )}
            <TreeRow icon={<KanbanSquare className="size-4" />} label={copy.board} selected />
          </div>

          {/* The sheet */}
          <div className="m-2 flex min-h-0 flex-1 flex-col rounded-surface bg-sheet p-4 shadow-sheet sm:p-5 lg:ml-0 lg:p-6">
            <div className="flex items-center gap-3">
              <KanbanSquare className="size-5 shrink-0 text-fg-3" />
              <span className="truncate text-lg font-semibold tracking-[-0.02em] text-fg sm:text-xl">{copy.board}</span>
              <span className="ml-auto">
                {p >= 1 && !fading && (
                  <span
                    key={`${agent.id}-${live ? 'editing' : 'edited'}`}
                    className="site-arrive inline-flex items-center gap-2 rounded-full bg-raised py-1 pr-2.5 pl-1 text-xs text-fg-2 shadow-[inset_0_0_0_1px_var(--color-line)]"
                  >
                    <span className="flex size-5 items-center justify-center rounded-full bg-hover">
                      <AIMark name={agent.id} size={11} />
                    </span>
                    <span className="hidden sm:inline">{(live ? copy.editing : copy.edited).replace('{agent}', agent.short)}</span>
                    {live && <span className="size-1.5 rounded-full bg-signal" />}
                  </span>
                )}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-1 text-ui shadow-[inset_0_-1px_0_var(--color-line)]">
              <span className="relative flex h-8 items-center gap-1.5 px-2 font-medium text-fg">
                <KanbanSquare className="size-3.5" />
                {copy.viewBoard}
                <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-fg" />
              </span>
              <span className="flex h-8 items-center gap-1.5 px-2 text-fg-3">
                <Table2 className="size-3.5" />
                {copy.viewTable}
              </span>
            </div>

            <div className="mt-4 grid min-h-0 flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
              <Column name={copy.backlog} dot="bg-fg-4" count={backlog.length}>
                {backlog.map((c) => (
                  <Card key={c.id} {...c} by={agentMade.has(c.id) ? agent.id : null} ring={ringed.has(c.id)} fading={fading && c.id.startsWith('t')} delay={newTasks.findIndex((t) => t.id === c.id)} />
                ))}
              </Column>
              <Column name={copy.inProgress} dot="bg-amber-400" count={inProgress.length}>
                {inProgress.map((c) => (
                  <Card key={c.id} {...c} by={agentMade.has(c.id) ? agent.id : null} ring={ringed.has(c.id)} fading={fading && c.id.startsWith('t')} delay={0} />
                ))}
              </Column>
              <Column name={copy.doneColumn} dot="bg-green-400" count={done.length} className="hidden sm:flex">
                {done.map((c) => (
                  <Card key={c.id} {...c} by={null} ring={false} fading={false} delay={0} />
                ))}
              </Column>
            </div>

            {/* The agent's terminal: in the sheet's flow on phones, its own window from md up */}
            <div className="mt-4 md:absolute md:-right-4 md:-bottom-8 md:z-10 md:mt-0 md:w-[380px] lg:-right-8 lg:-bottom-10 lg:w-[400px]">
              <Terminal copy={copy} agent={agent} p={p} prompt={shownPrompt} typing={!reduced && p === 0} fading={fading} />
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}

function TreeRow({
  icon,
  label,
  selected = false,
  live = false,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  selected?: boolean;
  live?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-8 items-center gap-2 rounded-control px-2 [&_svg]:shrink-0 [&_svg]:text-fg-3',
        selected && 'bg-sheet font-medium text-fg shadow-lift',
        className,
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {live && <span className="size-1.5 shrink-0 rounded-full bg-signal" />}
    </div>
  );
}

function Column({
  name,
  dot,
  count,
  className,
  children,
}: {
  name: string;
  dot: string;
  count: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <div className="flex items-center gap-2 px-0.5 text-ui">
        <span className={cn('size-2 rounded-full', dot)} />
        <span className="truncate font-medium text-fg-2">{name}</span>
        <span className="text-fg-3">{count}</span>
      </div>
      {children}
    </div>
  );
}

function Card({
  title,
  tag,
  tone,
  by,
  ring,
  fading,
  delay,
}: {
  title: string;
  tag: string;
  tone: 'high' | 'medium';
  /** The agent that just wrote this card, if any. */
  by: AIMarkName | null;
  ring: boolean;
  fading: boolean;
  delay: number;
}) {
  return (
    <div
      className={cn(
        'relative rounded-control bg-raised p-2.5 transition-[box-shadow,opacity] duration-700',
        ring ? 'shadow-[0_0_0_1.5px_var(--color-signal)]' : 'shadow-[inset_0_0_0_1px_var(--color-line)]',
        by && 'site-arrive',
        fading && 'opacity-0',
      )}
      style={by && delay > 0 ? { animationDelay: `${delay * 140}ms` } : undefined}
    >
      <div className="pr-5 text-xs leading-snug font-medium text-fg sm:text-ui">{title}</div>
      <span
        className={cn(
          'mt-2 inline-flex h-5 items-center rounded-full px-2 text-2xs font-medium',
          tone === 'high' ? 'bg-red-500/14 text-red-400' : 'bg-amber-500/14 text-amber-400',
        )}
      >
        {tag}
      </span>
      {by && (
        <span className="absolute right-2 bottom-2 flex size-5 items-center justify-center rounded-full bg-hover text-fg-2">
          <AIMark name={by} size={11} />
        </span>
      )}
    </div>
  );
}

function Terminal({
  copy,
  agent,
  p,
  prompt,
  typing,
  fading,
}: {
  copy: StageCopy;
  agent: StageAgent;
  p: number;
  prompt: string;
  typing: boolean;
  fading: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-surface bg-[#16181c] text-[#e6e8eb] shadow-modal ring-1 ring-white/10">
      <div className="flex h-9 items-center gap-2 border-b border-white/[0.07] px-3.5 text-xs text-[#9aa0a8]">
        <AIMark name={agent.id} size={13} />
        <span key={agent.id} className="site-arrive font-medium text-[#d6d9de]">
          {agent.name}
        </span>
        <span className="ml-auto font-mono text-2xs">~/paint-clone</span>
      </div>
      <div className={cn('min-h-[172px] space-y-2 px-3.5 py-3 font-mono text-xs leading-relaxed transition-opacity duration-700', fading && 'opacity-0')}>
        <p className="m-0 text-[#e6e8eb]">
          <span className="mr-2 text-[#f0b43c]">&gt;</span>
          {prompt}
          {typing && <span className="site-caret ml-px inline-block h-3.5 w-[7px] translate-y-0.5 bg-[#e6e8eb]" />}
        </p>
        {p >= 1 && <ToolLine running={p < 2} tool="create_page" detail={copy.newPage} />}
        {p >= 3 && (
          <ToolLine running={p < 4} tool="bulk_create_pages" detail={copy.tasksCreated.replace('{count}', '3')} />
        )}
        {p >= 5 && (
          <ToolLine
            running={p < 6}
            tool="update_page"
            detail={copy.moved.replace('{task}', copy.task1).replace('{column}', copy.inProgress)}
          />
        )}
        {p >= 7 && <p className="site-arrive m-0 pt-1 font-sans text-[#b8bdc4]">{copy.done}</p>}
      </div>
    </div>
  );
}

function ToolLine({ running, tool, detail }: { running: boolean; tool: string; detail: string }) {
  return (
    <p className="site-arrive m-0 flex items-start gap-2">
      <span className="mt-[3px] flex size-3.5 shrink-0 items-center justify-center">
        {running ? (
          <Loader2 className="size-3.5 animate-spin text-[#9aa0a8]" />
        ) : (
          <Check className="size-3.5 text-[#7fc36d]" strokeWidth={2.5} />
        )}
      </span>
      <span className="min-w-0">
        <span className="inline-flex items-center gap-1.5 text-[#e6e8eb]">
          <RemnusMark className="size-3 text-[#9aa0a8]" />
          {tool}
        </span>
        <span className="ml-2 font-sans text-[#9aa0a8]">{detail}</span>
      </span>
    </p>
  );
}
