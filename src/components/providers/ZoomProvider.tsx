'use client';
import { useState, useEffect } from 'react';

const ZOOM_KEY = 'remnus_desktop_zoom';

function readZoom(): number {
  try {
    const v = parseFloat(localStorage.getItem(ZOOM_KEY) || '');
    if (!isNaN(v) && v >= 0.5 && v <= 2.0) return v;
  } catch {}
  return 1;
}

export default function ZoomProvider({ children }: { children: React.ReactNode }) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setZoom(readZoom());
    // Clear any CSS zoom applied by Tauri initialization_script before React mounted
    document.documentElement.style.zoom = '';
    document.documentElement.style.width = '';
    document.documentElement.style.height = '';
    document.documentElement.style.overflow = '';

    const handler = () => setZoom(readZoom());
    window.addEventListener('remnus-zoom-changed', handler);
    return () => window.removeEventListener('remnus-zoom-changed', handler);
  }, []);

  if (zoom === 1) {
    return <div className="h-screen overflow-hidden">{children}</div>;
  }

  const inv = `${(100 / zoom).toFixed(4)}%`;
  return (
    <div className="h-screen w-screen overflow-hidden">
      <div
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
          width: inv,
          height: inv,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}
