'use client';
import { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Long code blocks are collapsed to this pixel height on first render, with a
// "Show more" toggle. Reading down a page past a 500-line paste was painful.
const COLLAPSED_MAX_PX = 320;

export default function CodeBlockView() {
  const t = useTranslations('Editor');
  const preRef = useRef<HTMLPreElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);

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
        {collapsed && <div className="code-block-fade" contentEditable={false} />}
      </div>
      {overflowing && (
        <button
          type="button"
          contentEditable={false}
          // Keep the editor selection intact when toggling.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setExpanded((v) => !v)}
          className="code-block-toggle"
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? t('codeShowLess') : t('codeShowMore')}
        </button>
      )}
    </NodeViewWrapper>
  );
}
