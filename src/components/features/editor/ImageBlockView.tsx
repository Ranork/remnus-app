'use client';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NodeViewWrapper } from '@tiptap/react';
import { ImageIcon, Loader2, AlignLeft, AlignCenter, AlignRight, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { deleteUploadedAsset } from './assetClient';

async function uploadImage(file: File, workspaceId: string | null): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('kind', 'image');
  if (workspaceId) fd.append('workspaceId', workspaceId);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  if (!res.ok) throw new Error('upload failed');
  const { url } = await res.json();
  return url as string;
}

export default function ImageBlockView({
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
  const workspaceId: string | null =
    editor?.extensionManager?.extensions?.find((e: any) => e.name === 'imageBlock')?.options?.workspaceId ?? null;

  const src: string | null = node.attrs.src || null;
  const align: string = node.attrs.align || 'center';
  const width: number = node.attrs.width || 100;
  const indent: number = (node.attrs.indent as number) ?? 0;

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const [resizeLabel, setResizeLabel] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true); setError(false);
    try {
      const uploaded = await uploadImage(file, workspaceId);
      updateAttributes({ src: uploaded, alt: file.name.replace(/\.[^.]+$/, '') });
    } catch { setError(true); }
    finally { setLoading(false); }
  };

  const submitUrl = () => {
    const u = url.trim();
    if (!/^https?:\/\//.test(u)) { setError(true); return; }
    updateAttributes({ src: u });
  };

  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = width;
    let current = startWidth;

    const onMove = (ev: MouseEvent) => {
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      const parentW = parent.getBoundingClientRect().width;
      const dx = ev.clientX - startX;
      const pct = Math.max(10, Math.min(100, Math.round(((startWidth / 100) * parentW + dx) / parentW * 100)));
      current = pct;
      setLiveWidth(pct);
      setResizeLabel(pct);
    };

    const onUp = () => {
      const snapped = Math.max(10, Math.min(100, Math.round(current / 5) * 5));
      updateAttributes({ width: snapped });
      setLiveWidth(null);
      setResizeLabel(null);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    // IndentGlobal's renderHTML doesn't reach ReactNodeViewRenderer — apply indent directly
    <NodeViewWrapper style={indent ? { paddingLeft: `${indent * 1.5}rem` } : undefined}>
      <div contentEditable={false} className="group/img editor-object relative select-none">
        {src ? (
          <div
            className={`flex ${align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center'}`}
          >
            <div ref={containerRef} style={{ width: `${liveWidth ?? width}%` }} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={node.attrs.alt || ''}
                className="block w-full cursor-zoom-in rounded-control"
                onClick={() => setLightbox(true)}
                draggable={false}
              />

              {/* Resize label shown while dragging (tooltip look: inverted) */}
              {resizeLabel !== null && (
                <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-control bg-fg px-2 py-0.5 text-2xs font-medium text-desk tabular-nums shadow-float">
                  {resizeLabel}%
                </div>
              )}

              {/* Hover toolbar */}
              <div className="absolute top-2 right-2 flex items-center gap-0.5 rounded-control bg-float p-0.5 opacity-0 shadow-float transition-opacity group-hover/img:opacity-100 focus-within:opacity-100">
                {([
                  ['left', AlignLeft],
                  ['center', AlignCenter],
                  ['right', AlignRight],
                ] as const).map(([a, Icon]) => {
                  const label = t(`imageAlign_${a}` as 'imageAlign_left' | 'imageAlign_center' | 'imageAlign_right');
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => updateAttributes({ align: a })}
                      className={cn(
                        'flex size-6 cursor-pointer items-center justify-center rounded transition-colors',
                        align === a ? 'bg-hover text-fg' : 'text-fg-3 hover:bg-hover hover:text-fg',
                      )}
                      title={label}
                      aria-label={label}
                      aria-pressed={align === a}
                    >
                      <Icon size={14} />
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => { deleteUploadedAsset(src); deleteNode(); }}
                  className="flex size-6 cursor-pointer items-center justify-center rounded text-fg-3 transition-colors hover:bg-red-500/12 hover:text-red-400"
                  title={t('removeImage')}
                  aria-label={t('removeImage')}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Right-edge drag resize handle: an ink pill with a ring in the ink's
                  opposite, so it reads on any photo in any theme. */}
              <button
                type="button"
                onMouseDown={onResizeMouseDown}
                className="absolute inset-y-0 right-0 flex w-4 cursor-ew-resize items-center justify-end pr-0.5 opacity-0 transition-opacity group-hover/img:opacity-100"
                title={t('imageWidthIncrease')}
                aria-label={t('imageWidthIncrease')}
              >
                <div className="h-10 w-1.5 rounded-full bg-ink shadow-[0_0_0_1.5px_var(--color-ink-fg),0_1px_4px_rgb(0_0_0/0.4)]" />
              </button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
            className="rounded-control border border-line bg-raised p-3"
          >
            <div className="flex items-center gap-2">
              <ImageIcon size={18} className="shrink-0 text-fg-3" />
              <input
                value={url}
                onChange={e => { setUrl(e.target.value); if (error) setError(false); }}
                onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); submitUrl(); } }}
                placeholder={t('imagePlaceholder')}
                aria-label={t('imagePlaceholder')}
                className="min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-fg-4 focus:outline-none"
              />
              <Button type="button" size="sm" onClick={submitUrl}>
                {t('imageAdd')}
              </Button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-fg-3 transition-colors hover:text-fg disabled:opacity-50"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />}
                {t('imageUpload')}
              </button>
              {error && <span className="text-xs text-red-400">{t('imageError')}</span>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
          </div>
        )}
      </div>

      {/* Lightbox — a near-black stage whatever the theme: it is for looking at the picture */}
      {lightbox && src && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85"
          onClick={() => setLightbox(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 flex size-9 cursor-pointer items-center justify-center rounded-full bg-float/85 text-fg-2 shadow-float transition-colors hover:bg-float hover:text-fg"
            onClick={() => setLightbox(false)}
            title={t('imageLightboxClose')}
            aria-label={t('imageLightboxClose')}
          >
            <X size={18} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={node.attrs.alt || ''}
            className="max-h-[90vh] max-w-[90vw] rounded-control object-contain shadow-modal"
            onClick={e => e.stopPropagation()}
            draggable={false}
          />
        </div>,
        document.body,
      )}
    </NodeViewWrapper>
  );
}
