'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
  const tWs = useTranslations('Workspace');
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

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="items-center">
        <DialogHeader className="w-full">
          <DialogTitle>{t('cropTitle')}</DialogTitle>
          <DialogDescription>{t('cropHint')}</DialogDescription>
        </DialogHeader>

        {/* Circular preview canvas */}
        <div
          className="relative overflow-hidden rounded-full bg-hover shadow-[inset_0_0_0_1px_var(--color-line-strong)]"
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
          {!imgLoaded && <div className="absolute inset-0 bg-hover" />}
        </div>

        {/* Zoom slider */}
        <div className="flex w-full items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={() => applyZoom(-0.2)} aria-label={tWs('zoomOut')}>
            <ZoomOut />
          </Button>
          <input
            type="range"
            min={100}
            max={500}
            step={5}
            value={Math.round(zoom * 100)}
            aria-label={tWs('zoom')}
            onChange={(e) => {
              const img = imgRef.current;
              if (!img) return;
              const newZoom = Number(e.target.value) / 100;
              const clamped = clampPan(img, newZoom, panX, panY);
              setZoom(newZoom);
              setPanX(clamped.x);
              setPanY(clamped.y);
            }}
            className="flex-1 cursor-pointer accent-signal"
          />
          <Button variant="ghost" size="icon-sm" onClick={() => applyZoom(0.2)} aria-label={tWs('zoomIn')}>
            <ZoomIn />
          </Button>
        </div>

        <DialogFooter className="w-full">
          <Button onClick={onCancel}>{t('cropCancel')}</Button>
          <Button variant="primary" onClick={handleConfirm} disabled={!imgLoaded}>
            <Check />
            {t('cropApply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
