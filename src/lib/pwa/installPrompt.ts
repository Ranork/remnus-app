// Global capture for the browser's one-shot `beforeinstallprompt` event.
// The event fires once per page load (usually right after load, on any route),
// so a listener mounted only on /download would miss it after client-side
// navigation. PwaInstallCapture installs this at app load; consumers read the
// status via useSyncExternalStore and call triggerInstallPrompt() on click.

export type InstallPromptStatus = 'unavailable' | 'available' | 'installed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let status: InstallPromptStatus = 'unavailable';
let initialized = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function initInstallPromptCapture() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // Running standalone means the app is already installed (iOS exposes the
  // non-standard navigator.standalone instead of the display-mode media query).
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true) {
    status = 'installed';
    return;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    status = 'available';
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    status = 'installed';
    emit();
  });
}

export function subscribeInstallPrompt(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getInstallPromptStatus(): InstallPromptStatus {
  return status;
}

export function getServerInstallPromptStatus(): InstallPromptStatus {
  return 'unavailable';
}

export type InstallPlatform = 'ios' | 'android' | 'desktop';

// Which install instructions apply here. Android UAs contain "linux" and
// iPadOS 13+ reports as Mac (distinguished via maxTouchPoints) — same caveats
// as DownloadView's detectOS.
export function detectInstallPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  const plat = (navigator.platform || '').toLowerCase();
  if (ua.includes('android')) return 'android';
  if (/iphone|ipad|ipod/.test(ua) || (plat.includes('mac') && navigator.maxTouchPoints > 1)) return 'ios';
  return 'desktop';
}

export async function triggerInstallPrompt(): Promise<'accepted' | 'dismissed' | null> {
  if (!deferredPrompt) return null;
  const evt = deferredPrompt;
  // A BeforeInstallPromptEvent can only prompt once — clear it either way.
  deferredPrompt = null;
  await evt.prompt();
  const choice = await evt.userChoice;
  status = choice.outcome === 'accepted' ? 'installed' : 'unavailable';
  emit();
  return choice.outcome;
}
