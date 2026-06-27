import CodeBlock from '@tiptap/extension-code-block';
import { ReactNodeViewRenderer } from '@tiptap/react';
import CodeBlockView from './CodeBlockView';

// Default @tiptap/extension-code-block always serializes with a 3-backtick fence.
// When the code body itself contains a ``` run, CommonMark requires the opening
// fence to be LONGER than the longest backtick run inside, otherwise the inner
// ``` closes the block early and the markdown round-trip corrupts the content.
// We override renderMarkdown to size the fence accordingly (4+ backticks when needed).
export const FencedCodeBlock = CodeBlock.extend({
  // React node view: collapses long code blocks behind a "Show more" toggle.
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },

  // renderMarkdown is a @tiptap/markdown extension field, not in Tiptap core types
  renderMarkdown(node: any, h: any) {
    const language = node.attrs?.language || '';
    const content = node.content ? h.renderChildren(node.content) : '';

    // Longest run of consecutive backticks anywhere in the body.
    const longestRun = (content.match(/`+/g) || []).reduce(
      (max: number, run: string) => Math.max(max, run.length),
      0,
    );
    const fence = '`'.repeat(Math.max(3, longestRun + 1));

    if (!content) return `${fence}${language}\n\n${fence}`;
    return `${fence}${language}\n${content}\n${fence}`;
  },
});
