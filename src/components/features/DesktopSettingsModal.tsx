'use client';
import { useState, useEffect } from 'react';
import { X, Monitor, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';

const ZOOM_KEY = 'remnus_desktop_zoom';
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.1;
const ZOOM_DEFAULT = 1.0;

export function applyDesktopZoom(factor: number) {
  try { localStorage.setItem(ZOOM_KEY, String(factor)); } catch {}
  window.dispatchEvent(new Event('remnus-zoom-changed'));
}

export function initDesktopZoom() {
  // ZoomProvider handles initialization on mount — nothing to do here
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function getSavedZoom(): number {
  try {
    const saved = localStorage.getItem(ZOOM_KEY);
    if (saved) {
      const f = parseFloat(saved);
      if (!isNaN(f) && f >= ZOOM_MIN && f <= ZOOM_MAX) return f;
    }
  } catch {}
  return ZOOM_DEFAULT;
}

interface Props {
  onClose: () => void;
}

export default function DesktopSettingsModal({ onClose }: Props) {
  const t = useTranslations('Workspace');
  const [zoom, setZoom] = useState<number>(getSavedZoom);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function changeZoom(next: number) {
    const clamped = round1(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next)));
    setZoom(clamped);
    applyDesktopZoom(clamped); // fire-and-forget, updates are immediate
  }

  const pct = Math.round(zoom * 100);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200 cursor-pointer"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-sm bg-neutral-850 border border-neutral-800 rounded-lg shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] overflow-hidden pointer-events-auto animate-in zoom-in-95 duration-200">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-800 bg-neutral-900/30 shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="text-neutral-500 hover:text-neutral-200 transition-colors p-1 cursor-pointer rounded"
              >
                <X size={16} />
              </button>
              <span className="text-[11px] bg-neutral-800 text-neutral-400 font-medium py-0.5 px-2 border border-neutral-700/40 uppercase tracking-wider rounded">
                {t('desktopSettings')}
              </span>
            </div>
            <Monitor size={14} className="text-neutral-500" />
          </div>

          {/* Zoom section */}
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-300">{t('zoom')}</span>
              <span className="text-xs text-neutral-500 font-mono tabular-nums bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700/40">
                {pct}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => changeZoom(zoom - ZOOM_STEP)}
                disabled={zoom <= ZOOM_MIN}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 disabled:opacity-30 disabled:cursor-not-allowed border border-neutral-800 cursor-pointer rounded transition-colors"
              >
                <ZoomOut size={12} />
                {t('zoomOut')}
              </button>

              <button
                onClick={() => changeZoom(ZOOM_DEFAULT)}
                disabled={zoom === ZOOM_DEFAULT}
                className="flex items-center justify-center p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 disabled:opacity-30 disabled:cursor-not-allowed border border-neutral-800 cursor-pointer rounded transition-colors"
                title={t('resetZoom')}
              >
                <RotateCcw size={12} />
              </button>

              <button
                onClick={() => changeZoom(zoom + ZOOM_STEP)}
                disabled={zoom >= ZOOM_MAX}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 disabled:opacity-30 disabled:cursor-not-allowed border border-neutral-800 cursor-pointer rounded transition-colors"
              >
                <ZoomIn size={12} />
                {t('zoomIn')}
              </button>
            </div>

            <input
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={ZOOM_STEP}
              value={zoom}
              onChange={(e) => changeZoom(parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
        </div>
      </div>
    </>
  );
}
