'use client';
import { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { SquarePlay, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { extractYouTubeId } from './YoutubeEmbedExtension';

export default function YoutubeEmbedView({
  node,
  deleteNode,
  updateAttributes,
}: {
  node: any;
  deleteNode: () => void;
  updateAttributes: (attrs: Record<string, any>) => void;
}) {
  const t = useTranslations('Editor');
  const videoId: string | null = node.attrs.videoId || null;
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!videoId) inputRef.current?.focus();
  }, [videoId]);

  const submit = () => {
    const id = extractYouTubeId(url);
    if (!id) {
      setError(true);
      return;
    }
    setError(false);
    updateAttributes({ videoId: id });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  return (
    <NodeViewWrapper>
      <div
        contentEditable={false}
        className="group/yt editor-object relative select-none"
      >

        {videoId ? (
          <div className="relative">
            <div className="relative w-full overflow-hidden rounded-control bg-black" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={`https://www.youtube.com/embed/${videoId}`}
                title={t('slashVideo')}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <button
              type="button"
              onClick={() => deleteNode()}
              className="absolute top-2 right-2 flex size-6 cursor-pointer items-center justify-center rounded-control bg-float text-fg-3 opacity-0 shadow-float transition-[opacity,color] group-hover/yt:opacity-100 hover:text-red-400 focus-visible:opacity-100"
              title={t('removeVideo')}
              aria-label={t('removeVideo')}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-control border border-line bg-raised px-3 py-2">
            <SquarePlay size={18} className="shrink-0 text-fg-3" />
            <input
              ref={inputRef}
              value={url}
              onChange={e => {
                setUrl(e.target.value);
                if (error) setError(false);
              }}
              onKeyDown={handleKeyDown}
              placeholder={t('videoPlaceholder')}
              aria-label={t('videoPlaceholder')}
              className="min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-fg-4 focus:outline-none"
            />
            {error && <span className="shrink-0 text-xs text-red-400">{t('videoInvalid')}</span>}
            <Button type="button" size="sm" onClick={submit}>
              {t('videoEmbed')}
            </Button>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
