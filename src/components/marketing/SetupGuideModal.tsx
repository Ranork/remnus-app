'use client';

import { useState } from 'react';

interface Props {
  linkLabel: string;
  title: string;
  subtitle: string;
  s1Label: string; s1Title: string; s1Body: string;
  s2Label: string; s2Title: string; s2Body: string;
  s3Label: string; s3Title: string; s3Body: string;
  endpointLabel: string;
  headerLabel: string;
  docsNote: string;
  closeLabel: string;
  /** 'link' (default) — quiet inline text link, used inside the per-client cards.
   *  'button' — bordered pill CTA, used where the trigger stands alone (e.g. LandingSetup). */
  variant?: 'link' | 'button';
}

const STEPS = (p: Props) => [
  { label: p.s1Label, title: p.s1Title, body: p.s1Body },
  { label: p.s2Label, title: p.s2Title, body: p.s2Body },
  { label: p.s3Label, title: p.s3Title, body: p.s3Body },
];

export default function SetupGuideModal(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          props.variant === 'button'
            ? 'inline-flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-full border border-neutral-700 font-medium text-[13px] text-neutral-100 hover:border-accent-strong hover:text-accent-strong transition-colors duration-150 cursor-pointer'
            : 'mt-4.5 inline-flex items-center gap-1.5 font-mono text-[12px] text-accent-strong hover:text-blue-400 transition-colors duration-150 cursor-pointer'
        }
      >
        {props.linkLabel}{' '}
        <span aria-hidden className="text-[11px]">→</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden"
            style={{ boxShadow: '0 32px 64px -16px rgba(0,0,0,0.7)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* header */}
            <div className="px-7 pt-6 pb-5 border-b border-neutral-800">
              <h2 className="text-[17px] font-semibold text-neutral-100 tracking-[-0.015em] m-0">
                {props.title}
              </h2>
              <p className="mt-1.5 text-[13px] text-dim leading-[1.55] m-0">
                {props.subtitle}
              </p>
            </div>

            {/* steps */}
            <div className="px-7 py-5 flex flex-col gap-5">
              {STEPS(props).map((s, i) => (
                <div key={i} className="flex gap-4">
                  <div className="shrink-0 flex flex-col items-center gap-1.5 pt-0.5">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white font-mono shrink-0"
                      style={{ background: 'var(--color-blue-500)' }}
                    >
                      {i + 1}
                    </span>
                    {i < 2 && <span className="w-px flex-1 bg-neutral-800" />}
                  </div>
                  <div className="pb-1">
                    <div className="text-[13.5px] font-semibold text-neutral-100 leading-none mb-1.5">
                      {s.title}
                    </div>
                    <p className="m-0 text-[12.5px] text-dim leading-[1.6]">{s.body}</p>

                    {/* code snippets on step 3 */}
                    {i === 2 && (
                      <div className="mt-3 flex flex-col gap-2">
                        <div>
                          <span className="block font-mono text-[10px] text-neutral-500 uppercase tracking-wider mb-1">
                            {props.endpointLabel}
                          </span>
                          <code className="block font-mono text-[11.5px] text-accent-strong bg-neutral-850 border border-neutral-800 rounded px-3 py-1.5">
                            https://www.remnus.com/api/mcp
                          </code>
                        </div>
                        <div>
                          <span className="block font-mono text-[10px] text-neutral-500 uppercase tracking-wider mb-1">
                            {props.headerLabel}
                          </span>
                          <code className="block font-mono text-[11.5px] text-neutral-100 bg-neutral-850 border border-neutral-800 rounded px-3 py-1.5">
                            Authorization: Bearer{' '}
                            <span className="text-dim">rmns_xxxxxxxx_…</span>
                          </code>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* docs note */}
            <div className="mx-7 mb-5 flex items-start gap-2.5 px-3.5 py-3 bg-neutral-850 border border-neutral-800 rounded-md"
              style={{ borderLeft: '3px solid var(--color-blue-500)' }}>
              <span className="text-[12px] text-dim leading-[1.55]">{props.docsNote}</span>
            </div>

            {/* footer */}
            <div className="px-7 pb-6 flex justify-end">
              <button
                onClick={() => setOpen(false)}
                className="px-5 py-2 bg-blue-500 hover:bg-accent-strong text-white text-[13px] font-medium rounded-md transition-colors duration-150 cursor-pointer"
              >
                {props.closeLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
