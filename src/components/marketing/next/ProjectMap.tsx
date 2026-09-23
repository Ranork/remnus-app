'use client';

import { useState } from 'react';
import { AlertTriangle, Boxes, GitBranch, ListChecks } from 'lucide-react';
import styles from './landing-next.module.css';

export interface ProjectMapData {
  tabs: { decisions: string; architecture: string; backlog: string; risks: string };
  cols: { decision: string; source: string; status: string };
  statuses: { reviewed: string; needsReview: string; superseded: string };
  decisions: { title: string; source: string }[];
  archTitle: string;
  archIntro: string;
  archNodes: string[];
  archNote: string;
  backlogCols: string[];
  backlog: string[][];
  risks: { title: string; meta: string }[];
  footnote: string;
}

type Tab = keyof ProjectMapData['tabs'];

// Status per decision row, in the same order as the copy's `decisions` array:
// the human's correction is reviewed, Claude's original proposal it replaced is
// superseded — the page tells the "final say" story on its own.
const DECISION_STATUS = ['reviewed', 'reviewed', 'superseded', 'needsReview'] as const;

export default function ProjectMap({ data }: { data: ProjectMapData }) {
  const [tab, setTab] = useState<Tab>('decisions');

  const tabs: { id: Tab; icon: typeof ListChecks }[] = [
    { id: 'decisions', icon: ListChecks },
    { id: 'architecture', icon: Boxes },
    { id: 'backlog', icon: GitBranch },
    { id: 'risks', icon: AlertTriangle },
  ];

  return (
    <div className="marketing-preview-shadow overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
      <div role="tablist" aria-label="Project map" className="flex gap-7 overflow-x-auto border-b border-neutral-800 px-5 pt-3 lg:px-7">
        {tabs.map(({ id, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              role="tab"
              type="button"
              id={`map-tab-${id}`}
              aria-selected={active}
              aria-controls={`map-panel-${id}`}
              onClick={() => setTab(id)}
              className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 py-3 text-[13.5px] transition-colors ${
                active
                  ? 'border-accent-strong text-neutral-100'
                  : 'border-transparent text-dim hover:text-neutral-50'
              }`}
            >
              <Icon size={15} />
              {data.tabs[id]}
            </button>
          );
        })}
      </div>

      <div
        key={tab}
        role="tabpanel"
        id={`map-panel-${tab}`}
        aria-labelledby={`map-tab-${tab}`}
        className={`${styles.panelIn} min-h-[320px] p-5 lg:p-7`}
      >
        {tab === 'decisions' && <Decisions data={data} />}
        {tab === 'architecture' && <Architecture data={data} />}
        {tab === 'backlog' && <Backlog data={data} />}
        {tab === 'risks' && <Risks data={data} />}
      </div>

      <div className="border-t border-neutral-800 px-5 lg:px-7 py-3.5 text-[12.5px] text-dim">{data.footnote}</div>
    </div>
  );
}

function Pill({ status, data }: { status: (typeof DECISION_STATUS)[number]; data: ProjectMapData }) {
  const cls = {
    reviewed: 'text-green-400 bg-green-400/10 border-green-400/25',
    needsReview: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
    superseded: 'text-dim bg-neutral-800/40 border-neutral-800 line-through',
  }[status];
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[10.5px] ${cls}`}>
      {data.statuses[status]}
    </span>
  );
}

function Decisions({ data }: { data: ProjectMapData }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left text-[14px]">
        <thead>
          <tr className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-dim">
            <th className="pb-3 pr-4 font-normal">{data.cols.decision}</th>
            <th className="pb-3 pr-4 font-normal">{data.cols.source}</th>
            <th className="pb-3 font-normal">{data.cols.status}</th>
          </tr>
        </thead>
        <tbody>
          {data.decisions.map((d, i) => (
            <tr key={d.title} className="border-t border-neutral-800">
              <td className={`py-3.5 pr-4 ${DECISION_STATUS[i] === 'superseded' ? 'text-dim' : 'text-neutral-100'}`}>{d.title}</td>
              <td className="py-3.5 pr-4 text-[13px] text-dim">{d.source}</td>
              <td className="py-3.5"><Pill status={DECISION_STATUS[i] ?? 'reviewed'} data={data} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Architecture({ data }: { data: ProjectMapData }) {
  const [web, actions, services, db, mcp] = data.archNodes;
  const node = 'rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 text-center text-[13px] text-neutral-100';
  const line = 'mx-auto h-5 w-px bg-neutral-700';

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
      <div className="flex flex-col gap-3">
        <h3 className="m-0 text-[20px] font-semibold tracking-[-0.015em] text-neutral-100">{data.archTitle}</h3>
        <p className="m-0 max-w-[48ch] text-[14.5px] leading-[1.65] text-neutral-50">{data.archIntro}</p>
        <span className="font-mono text-[11.5px] text-dim">{data.archNote}</span>
      </div>
      <div className="flex flex-col" aria-hidden>
        <div className="grid grid-cols-2 gap-3">
          <div className={node}>{web}</div>
          <div className={`${node} border-blue-500/40 text-accent-strong`}>{mcp}</div>
        </div>
        <div className="grid grid-cols-2"><span className={line} /><span className={line} /></div>
        <div className={node}>{actions}</div>
        <span className={line} />
        <div className={node}>{services}</div>
        <span className={line} />
        <div className={`${node} text-dim`}>{db}</div>
      </div>
    </div>
  );
}

function Backlog({ data }: { data: ProjectMapData }) {
  const colors = ['var(--color-dim)', 'var(--color-accent-strong)', 'var(--color-green-400)'];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {data.backlogCols.map((col, i) => (
        <div key={col} className="flex flex-col gap-2.5">
          <span className="flex items-center gap-2 text-[13px] font-medium text-neutral-100">
            <span className="h-2 w-2 rounded-full" style={{ background: colors[i] }} />
            {col}
          </span>
          {(data.backlog[i] ?? []).map((card) => (
            <div key={card} className="rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-3 text-[13.5px] text-neutral-50">
              {card}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Risks({ data }: { data: ProjectMapData }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {data.risks.map((r, i) => (
        <li key={r.title} className="flex items-start gap-3.5 rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3.5">
          <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${i === 2 ? 'text-dim' : 'text-amber-400'}`} />
          <span className="flex flex-col gap-1">
            <span className="text-[14.5px] text-neutral-100">{r.title}</span>
            <span className="font-mono text-[11px] text-dim">{r.meta}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
