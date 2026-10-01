'use client';
import { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { Link2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

// Module-level sequential queue so multiple bookmarks on the same page fetch
// OG metadata one-at-a-time instead of all at once.
let _ogChain: Promise<void> = Promise.resolve();
function enqueueOgFetch(fn: () => Promise<void>): void {
  _ogChain = _ogChain.then(fn).catch(() => {});
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

// YouTube exposes thumbnails at a predictable URL — no scraping needed.
function getYoutubeThumbnail(url: string): string | null {
  try {
    const u = new URL(url);
    let id: string | null = null;
    if (u.hostname === 'youtu.be') {
      id = u.pathname.slice(1).split('/')[0] || null;
    } else if (/youtube\.com/.test(u.hostname)) {
      id = u.searchParams.get('v') ||
        (u.pathname.startsWith('/shorts/') ? u.pathname.split('/')[2] : null) ||
        (u.pathname.startsWith('/embed/') ? u.pathname.split('/')[2] : null);
    }
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
  } catch { return null; }
}

export default function BookmarkBlockView({
  node,
  deleteNode,
  updateAttributes,
  editor,
}: {
  node: any;
  deleteNode: () => void;
  updateAttributes: (attrs: Record<string, any>) => void;
  editor: any;
}) {
  const t = useTranslations('Editor');
  const { url, title, description, image, favicon } = node.attrs as {
    url: string | null;
    title: string;
    description: string;
    image: string;
    favicon: string;
  };
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoFetchedRef = useRef(false);

  const httpOnly = (u: string | null | undefined) => (/^https?:\/\//i.test(u || '') ? (u as string) : '');
  const safeUrl = httpOnly(url) || '#';
  const safeFavicon = httpOnly(favicon);
  const domain = url ? getDomain(url) : '';

  // Prefer stored OG image; fall back to YouTube thumbnail when applicable.
  const safeImage = httpOnly(image) || (url ? (getYoutubeThumbnail(url) ?? '') : '');

  useEffect(() => {
    if (!url) inputRef.current?.focus();
  }, [url]);

  // Auto-fetch OG metadata for bookmarks imported without OG data (title is
  // empty or equals the raw URL). Fetches are serialised through a module-level
  // queue so a page with many bookmarks doesn't fire all requests at once.
  // Only runs in editable editors; shared / read-only views are unaffected.
  useEffect(() => {
    if (autoFetchedRef.current) return;
    if (!url || !editor?.isEditable) return;
    if (title && title !== url) return;
    autoFetchedRef.current = true;
    enqueueOgFetch(async () => {
      try {
        const res = await fetch(`/api/og?url=${encodeURIComponent(url)}`);
        if (!res.ok) return;
        const data = await res.json();
        updateAttributes({
          title: data.title || url,
          description: data.description || '',
          image: data.image || '',
          favicon: data.favicon || '',
        });
      } catch { /* best-effort */ }
    });
  }, [url, title, editor, updateAttributes]);

  const fetchMeta = async () => {
    const u = input.trim();
    if (!/^https?:\/\//.test(u)) { setError(true); return; }
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/og?url=${encodeURIComponent(u)}`);
      const data = await res.json();
      updateAttributes({
        url: data.url || u,
        title: data.title || u,
        description: data.description || '',
        image: data.image || '',
        favicon: data.favicon || '',
      });
    } catch {
      updateAttributes({ url: u, title: u });
    } finally {
      setLoading(false);
    }
  };

  const openUrl = () => {
    if (safeUrl !== '#') window.open(safeUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <NodeViewWrapper>
      <div contentEditable={false} className="group/bm editor-object relative select-none">
        {url ? (
          <div className="relative">
            <div
              role="link"
              tabIndex={0}
              onClick={openUrl}
              onKeyDown={e => e.key === 'Enter' && openUrl()}
              className="flex cursor-pointer items-stretch overflow-hidden rounded-control border border-line bg-raised transition-colors hover:border-line-strong hover:bg-hover/40"
            >
              {/* Left: OG / YouTube thumbnail or placeholder */}
              <div className="relative w-25 shrink-0 overflow-hidden bg-hover sm:w-32.5">
                {safeImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={safeImage}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {safeFavicon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={safeFavicon} alt="" className="size-8 rounded" />
                    ) : (
                      <Link2 size={22} className="text-fg-4" />
                    )}
                  </div>
                )}
              </div>

              {/* Right: text */}
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3.5 py-3">
                <p className="m-0 truncate text-sm leading-snug font-semibold text-fg">
                  {title && title !== url ? title : domain}
                </p>
                {description && (
                  <p className="m-0 line-clamp-2 text-xs leading-relaxed text-fg-3">
                    {description}
                  </p>
                )}
                <div className="mt-1.5 flex items-center gap-1.5">
                  {safeFavicon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={safeFavicon} alt="" className="size-3 shrink-0 rounded-sm" />
                  )}
                  <span className="truncate text-2xs text-fg-3">{domain}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={e => { e.stopPropagation(); deleteNode(); }}
              className="absolute top-2 right-2 flex size-6 cursor-pointer items-center justify-center rounded-control bg-float text-fg-3 opacity-0 shadow-float transition-[opacity,color] group-hover/bm:opacity-100 hover:text-red-400 focus-visible:opacity-100"
              title={t('bookmarkRemove')}
              aria-label={t('bookmarkRemove')}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-control border border-line bg-raised px-3 py-2">
            <Link2 size={18} className="shrink-0 text-fg-3" />
            <input
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); if (error) setError(false); }}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Enter') { e.preventDefault(); fetchMeta(); }
              }}
              placeholder={t('bookmarkPlaceholder')}
              aria-label={t('bookmarkPlaceholder')}
              className="min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-fg-4 focus:outline-none"
            />
            {error && <span className="shrink-0 text-xs text-red-400">{t('bookmarkInvalid')}</span>}
            <Button type="button" size="sm" onClick={fetchMeta} loading={loading}>
              {t('bookmarkAdd')}
            </Button>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
