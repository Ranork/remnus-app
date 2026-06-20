'use client';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  node: any;
  getPos: () => number | undefined;
  editor: any;
  decorations: readonly any[];
}

export default function HeadingView({ node, getPos, editor, decorations }: Props) {
  const level = node.attrs.level;
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3';
  const isCollapsed = decorations.some((d) => d.spec?.headingIsCollapsed === true);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = getPos();
    if (pos === undefined) return;
    // Guard: on documents whose content is invalid per the schema (e.g. an inline
    // node that ended up at the top level during markdown parsing), the dispatched
    // transaction makes the trailing-node plugin try to insert at doc end and
    // ProseMirror throws "contentMatchAt on a node with invalid content". Swallow
    // it so the whole app doesn't white-screen on a single bad page.
    try {
      editor.commands.toggleHeadingCollapse(pos);
    } catch (err) {
      console.error('Heading collapse toggle failed (likely invalid document content):', err);
    }
  };

  return (
    <NodeViewWrapper as={Tag}>
      <button
        contentEditable={false}
        onClick={handleToggle}
        className={`heading-collapse-btn${isCollapsed ? ' heading-collapse-btn--collapsed' : ''}`}
        aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
        title={isCollapsed ? 'Expand section' : 'Collapse section'}
      >
        {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
      </button>
      { }
      <NodeViewContent as={'span' as any} />
    </NodeViewWrapper>
  );
}
