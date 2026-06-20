'use client';
import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations, useLocale } from 'next-intl';
import AIMark, { type AIMarkName } from '@/components/marketing/AIMark';
import { AGENT_OPTIONS } from '@/components/features/workspace-settings/types';

const BRAND_COLORS: Record<AIMarkName, string> = {
  claude:      '#D97757',
  cursor:      '#C8C8C8',
  windsurf:    '#3FC1B8',
  chatgpt:     '#10A37F',
  continue:    '#7B7CF4',
  zed:         '#5B8EF0',
  gemini:      '#8AB4F8',
  antigravity: '#3186FF',
  codex:       '#C8C8C8',  // Codex mark is monochrome — silver tint, like Cursor
};

function resolveAgent(agentName: string | null): { aiMarkName: AIMarkName; label: string } | null {
  if (!agentName) return null;
  const opt = AGENT_OPTIONS.find(a => a.id === agentName);
  return opt ? { aiMarkName: opt.aiMarkName, label: opt.label } : null;
}

export default function AgentEditBadge({
  agentName,
  tokenName,
  editedAt,
  className = '',
}: {
  agentName: string | null;
  tokenName?: string | null;
  editedAt: Date | string | null;
  className?: string;
}) {
  const t = useTranslations('Database');
  const locale = useLocale();
  const [tipStyle, setTipStyle] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  if (!editedAt) return null;

  const date = editedAt instanceof Date ? editedAt : new Date(editedAt);
  const timeStr = date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

  const agent = resolveAgent(agentName);
  const aiMark = agent?.aiMarkName ?? null;
  const color = aiMark ? BRAND_COLORS[aiMark] : '#94a3b8';

  const handleEnter = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setTipStyle({ top: r.top, right: window.innerWidth - r.right });
    }
  };

  return (
    <div
      ref={ref}
      className={`flex items-center justify-center cursor-default select-none ${className}`}
      style={{
        background: `${color}14`,
        borderTop: `1px solid ${color}2e`,
        borderLeft: `1px solid ${color}2e`,
      }}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setTipStyle(null)}
      onClick={(e) => e.stopPropagation()}
    >
      {aiMark ? (
        <AIMark name={aiMark} size={14} />
      ) : (
        // Generic bot icon as fallback
        <svg width={14} height={14} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18 2.5 2.5 0 0 0 10 15.5 2.5 2.5 0 0 0 7.5 13m9 0A2.5 2.5 0 0 0 14 15.5a2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 16.5 13z" />
        </svg>
      )}

      {tipStyle && typeof document !== 'undefined' && createPortal(
        <div
          className="pointer-events-none z-9999 fixed w-52"
          style={{
            top: tipStyle.top,
            right: tipStyle.right,
            transform: 'translateY(calc(-100% - 10px))',
          }}
        >
          <div
            className="rounded-lg shadow-2xl px-3 py-2.5 text-left"
            style={{
              background: 'rgba(20,22,27,0.98)',
              border: `1px solid ${color}28`,
              boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${color}10`,
            }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              {aiMark && <AIMark name={aiMark} size={13} />}
              <span className="text-[11px] font-semibold" style={{ color }}>
                {agent?.label ?? agentName ?? t('agentEditedLabel')}
              </span>
            </div>
            {tokenName && (
              <p className="text-[11px] text-neutral-300 font-medium truncate mb-1.5">{tokenName}</p>
            )}
            <p
              className="text-[10px] text-neutral-500 pt-1.5"
              style={{ borderTop: `1px solid ${color}18` }}
            >
              {t('agentEditedVia')} · {timeStr}
            </p>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
