'use client';

import { useEffect } from 'react';
import { initInstallPromptCapture } from '@/lib/pwa/installPrompt';

// Captures the one-shot `beforeinstallprompt` event at app load so the
// /download page's install CTA still works after client-side navigation.
export default function PwaInstallCapture() {
  useEffect(() => {
    initInstallPromptCapture();
  }, []);
  return null;
}
