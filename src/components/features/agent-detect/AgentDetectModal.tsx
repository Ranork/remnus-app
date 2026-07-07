'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import AIMark from '@/components/marketing/AIMark';
import { VscodeMark } from '@/components/features/agents/AgentMark';
import { EDITORS } from '@/lib/mcp/deeplinks';

function DetectedIcon({ id, size = 20 }: { id: string; size?: number }) {
  const meta = EDITORS.find(e => e.id === id);
  if (id === 'vscode' || !meta?.aiMark) return <VscodeMark size={size} />;
  return <AIMark name={meta.aiMark} size={size} />;
}

interface Props {
  /** Editor ids Tauri detected on this device. */
  detected: { id: string }[];
  onConnect: () => void;
  onDismiss: () => void;
}

/**
 * One-time, Tauri-only "we found these on your device" modal. Shown after the
 * onboarding {@link WelcomeModal} has already been resolved, so the two never
 * stack on a brand-new user's very first launch. Dismissing hands off to the
 * persistent {@link AgentDetectNotice} sidebar pill — this modal itself never
 * reappears once dismissed (see AgentDetectGuide's localStorage flag).
 */
export default function AgentDetectModal({ detected, onConnect, onDismiss }: Props) {
  const t = useTranslations('Onboarding');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  return createPortal(
    <div
      className="fixed inset-0 z-120 flex items-center justify-center p-4 bg-black/70"
      onClick={onDismiss}
    >
      <div
        className="relative w-full max-w-md bg-neutral-850 border border-neutral-800 rounded-2xl modal-shadow overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onDismiss}
          className="absolute top-3.5 right-3.5 p-1 text-neutral-500 hover:text-neutral-200 transition-colors rounded hover:bg-neutral-800"
          aria-label={t('agentDetectMaybeLater')}
        >
          <X size={16} />
        </button>

        <div className="px-7 pt-9 pb-2 flex flex-col items-center text-center gap-3">
          <span className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
            <Sparkles size={22} className="text-emerald-400" />
          </span>
          <h2 className="text-lg font-semibold text-neutral-50">{t('agentDetectTitle')}</h2>
          <p className="text-sm text-neutral-400 max-w-xs leading-relaxed">{t('agentDetectBody')}</p>
        </div>

        <div className="px-7 py-5 flex flex-wrap justify-center gap-2.5">
          {detected.map(({ id }) => {
            const meta = EDITORS.find(e => e.id === id);
            return (
              <span
                key={id}
                className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5"
              >
                <DetectedIcon id={id} size={14} />
                <span className="text-xs font-medium text-neutral-200">{meta?.label ?? id}</span>
              </span>
            );
          })}
        </div>

        <div className="px-7 pb-7 flex flex-col gap-2">
          <button
            onClick={onConnect}
            className="flex items-center justify-center gap-2 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-400 px-4 py-2.5 rounded-lg transition-colors"
          >
            {t('agentDetectConnect')} <ArrowRight size={14} />
          </button>
          <button
            onClick={onDismiss}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors py-1"
          >
            {t('agentDetectMaybeLater')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
