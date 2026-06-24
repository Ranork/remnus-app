'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/reportClientError';

/**
 * Last-resort boundary: catches errors thrown by the root/locale LAYOUTS
 * themselves (above `[locale]/error.tsx`). It REPLACES the root layout when it
 * fires, so it must render its own `<html>`/`<body>` and cannot rely on any
 * provider — hence no i18n (the locale provider may be exactly what crashed).
 * Plain English fallback, dark-themed to match the app frame.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, { boundary: 'global' });
  }, [error]);

  return (
    <html lang="en" data-theme="remnus">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1d1f23',
          color: '#d7dae0',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '0 1.5rem',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff', margin: 0 }}>
          Something went wrong
        </h1>
        <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', opacity: 0.7, maxWidth: 420 }}>
          The app ran into an unexpected error. Try reloading the page.
        </p>
        <button
          onClick={() => reset()}
          style={{
            marginTop: '1.5rem',
            border: 'none',
            borderRadius: 6,
            background: '#fff',
            color: '#1d1f23',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
