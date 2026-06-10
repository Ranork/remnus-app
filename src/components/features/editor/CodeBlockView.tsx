'use client';
import { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

// Long code blocks are collapsed to this pixel height on first render, with a
// "Show more" toggle. Reading down a page past a 500-line paste was painful.
const COLLAPSED_MAX_PX = 320;

export default function CodeBlockView({ node }: { node: { textContent: string } }) {
  const t = useTranslations('Editor');
  const preRef = useRef<HTMLPreElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const el = preRef.current;
    if (!el) return;
    // scrollHeight reports the full content height even while the element is
    // clipped by max-height, so the measurement is valid in either state.
    const check = () => setOverflowing(el.scrollHeight > COLLAPSED_MAX_PX + 16);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const collapsed = overflowing && !expanded;

  const copy = () => {
    navigator.clipboard?.writeText(node.textContent ?? '').then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => {},
    );
  };

  // Stops ProseMirror from grabbing the selection / losing the caret on toggle.
  const swallow = (e: React.MouseEvent) => e.preventDefault();

  return (
    <NodeViewWrapper className="code-block-view">
      <div className="code-block-pre-wrap">
        <pre
          ref={preRef}
          className={collapsed ? 'code-block-collapsed' : undefined}
          // Clicking into a collapsed block to edit would drop the caret into a
          // hidden region — expand as soon as it takes focus.
          onFocus={() => setExpanded(true)}
        >
          <NodeViewContent<'code'> as="code" />
        </pre>

        <button
          type="button"
          contentEditable={false}
          onMouseDown={swallow}
          onClick={copy}
          className="code-block-copy"
          aria-label={copied ? t('codeCopied') : t('codeCopy')}
          title={copied ? t('codeCopied') : t('codeCopy')}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>

        {collapsed && (
          <button
            type="button"
            contentEditable={false}
            onMouseDown={swallow}
            onClick={() => setExpanded(true)}
            className="code-block-expand"
          >
            <span className="code-block-expand-label">
              <ChevronDown size={13} />
              {t('codeShowMore')}
            </span>
          </button>
        )}
      </div>

      {overflowing && expanded && (
        <button
          type="button"
          contentEditable={false}
          onMouseDown={swallow}
          onClick={() => setExpanded(false)}
          className="code-block-collapse"
        >
          <ChevronUp size={13} />
          {t('codeShowLess')}
        </button>
      )}
    </NodeViewWrapper>
  );
}
