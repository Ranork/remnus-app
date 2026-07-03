// Renders trusted, repo-authored markdown (already converted to HTML by
// src/lib/content) as server-side HTML for SEO. Styled via `.prose-doc`
// (see globals.css). Content is first-party — no user input flows here.
export default function DocsProse({ html, className = '' }: { html: string; className?: string }) {
  return (
    <div
      className={`prose-doc ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
