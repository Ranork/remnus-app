'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslations } from 'next-intl';

const PREVIEW_SIZE = 220;
const OUTPUT_SIZE = 256;

// Pure helper — no component state; safe to define at module scope.
function drawToCanvas(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  baseScale: number,
  z: number,
  px: number,
  py: number,
  size: number,
  clip: boolean,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = size;
  canvas.height = size;

  const ratio = size / PREVIEW_SIZE;
  const displayW = img.naturalWidth * baseScale * z * ratio;
  const displayH = img.naturalHeight * baseScale * z * ratio;
  const x = size / 2 - displayW / 2 + px * ratio;
  const y = size / 2 - displayH / 2 + py * ratio;

  ctx.clearRect(0, 0, size, size);

  if (clip) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
  }

  ctx.drawImage(img, x, y, displayW, displayH);

  if (clip) ctx.restore();
}

interface AvatarCropModalProps {
  objectUrl: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

export default function AvatarCropModal({ objectUrl, onConfirm, onCancel }: AvatarCropModalProps) {
  const t = useTranslations('UserSettings');
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false, lastX: 0, lastY: 0,
  });

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = objectUrl;
    return () => { img.onload = null; };
  }, [objectUrl]);

  function getBaseScale(img: HTMLImageElement): number {
    return Math.max(PREVIEW_SIZE / img.naturalWidth, PREVIEW_SIZE / img.naturalHeight);
  }

  function clampPan(img: HTMLImageElement, z: number, px: number, py: number) {
    const bs = getBaseScale(img);
    const displayW = img.naturalWidth * bs * z;
    const displayH = img.naturalHeight * bs * z;
    const maxPX = Math.max(0, (displayW - PREVIEW_SIZE) / 2);
    const maxPY = Math.max(0, (displayH - PREVIEW_SIZE) / 2);
    return {
      x: Math.max(-maxPX, Math.min(maxPX, px)),
      y: Math.max(-maxPY, Math.min(maxPY, py)),
    };
  }

  useEffect(() => {
    const img = imgRef.current;
    const canvas = previewCanvasRef.current;
    if (!img || !canvas || !imgLoaded) return;
    drawToCanvas(canvas, img, getBaseScale(img), zoom, panX, panY, PREVIEW_SIZE, true);
  }, [imgLoaded, zoom, panX, panY]);

  function applyZoom(delta: number) {
    const img = imgRef.current;
    if (!img) return;
    const newZoom = Math.max(1, Math.min(5, zoom + delta));
    const clamped = clampPan(img, newZoom, panX, panY);
    setZoom(newZoom);
    setPanX(clamped.x);
    setPanY(clamped.y);
  }

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    applyZoom(e.deltaY < 0 ? 0.15 : -0.15);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, panX, panY]);

  // Attach wheel as non-passive so we can preventDefault
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragRef.current.active) return;
    const img = imgRef.current;
    if (!img) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    const clamped = clampPan(img, zoom, panX + dx, panY + dy);
    setPanX(clamped.x);
    setPanY(clamped.y);
  }

  function stopDrag() {
    dragRef.current.active = false;
  }

  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    dragRef.current = { active: true, lastX: touch.clientX, lastY: touch.clientY };
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!dragRef.current.active) return;
    const img = imgRef.current;
    if (!img) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragRef.current.lastX;
    const dy = touch.clientY - dragRef.current.lastY;
    dragRef.current.lastX = touch.clientX;
    dragRef.current.lastY = touch.clientY;
    const clamped = clampPan(img, zoom, panX + dx, panY + dy);
    setPanX(clamped.x);
    setPanY(clamped.y);
  }

  function handleConfirm() {
    const img = imgRef.current;
    if (!img) return;
    const outputCanvas = document.createElement('canvas');
    drawToCanvas(outputCanvas, img, getBaseScale(img), zoom, panX, panY, OUTPUT_SIZE, false);
    outputCanvas.toBlob(
      (blob) => { if (blob) onConfirm(blob); },
      'image/jpeg',
      0.92,
    );
  }

  const content = (
    <div
      className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-neutral-850 border border-neutral-800 rounded-lg modal-shadow p-5 flex flex-col items-center gap-4 w-full max-w-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between w-full">
          <span className="text-sm font-semibold text-neutral-100">{t('cropTitle')}</span>
          <button
            onClick={onCancel}
            className="p-1 text-neutral-500 hover:text-neutral-200 rounded hover:bg-neutral-800 cursor-pointer transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Circular preview canvas */}
        <div
          className="relative rounded-full overflow-hidden border-2 border-neutral-700 bg-neutral-800"
          style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
        >
          <canvas
            ref={previewCanvasRef}
            width={PREVIEW_SIZE}
            height={PREVIEW_SIZE}
            className="block cursor-grab active:cursor-grabbing"
            style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE, touchAction: 'none' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={stopDrag}
          />
          {!imgLoaded && (
            <div className="absolute inset-0 bg-neutral-700 animate-pulse" />
          )}
        </div>

        <p className="text-[11px] text-neutral-500 text-center">{t('cropHint')}</p>

        {/* Zoom slider */}
        <div className="flex items-center gap-2 w-full">
          <button
            onClick={() => applyZoom(-0.2)}
            className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors cursor-pointer shrink-0"
          >
            <ZoomOut size={14} />
          </button>
          <input
            type="range"
            min={100}
            max={500}
            step={5}
            value={Math.round(zoom * 100)}
            onChange={(e) => {
              const img = imgRef.current;
              if (!img) return;
              const newZoom = Number(e.target.value) / 100;
              const clamped = clampPan(img, newZoom, panX, panY);
              setZoom(newZoom);
              setPanX(clamped.x);
              setPanY(clamped.y);
            }}
            className="flex-1 accent-signal cursor-pointer"
          />
          <button
            onClick={() => applyZoom(0.2)}
            className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors cursor-pointer shrink-0"
          >
            <ZoomIn size={14} />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 w-full justify-end">
          <button
            onClick={onCancel}
            className="text-xs px-4 py-2 border border-neutral-700 rounded-md text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors cursor-pointer"
          >
            {t('cropCancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!imgLoaded}
            className="text-xs font-semibold px-4 py-2 rounded-md bg-ink hover:bg-ink/88 text-ink-fg disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Check size={12} />
            {t('cropApply')}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
