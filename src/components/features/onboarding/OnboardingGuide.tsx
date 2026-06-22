'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import ConnectModal from '@/components/features/agents/ConnectModal';
import WelcomeModal from './WelcomeModal';
import GettingStartedChecklist from './GettingStartedChecklist';
import { getOnboardingProgress, type OnboardingProgress } from '@/lib/actions/onboarding';

const WELCOME_SEEN_KEY = 'remnus_onboarding_welcome_seen';
const DISMISSED_KEY = 'remnus_onboarding_dismissed';   // permanent — only once every step is done
const COLLAPSED_KEY = 'remnus_onboarding_collapsed';   // minimized-to-button toggle

interface Props {
  /** Skip onboarding entirely for ephemeral demo accounts. */
  userRole?: string;
}

/**
 * Orchestrates the new-user onboarding surface, mounted inside the sidebar:
 *  • a one-time {@link WelcomeModal} (connect-agent vs. explore),
 *  • a persistent {@link GettingStartedChecklist} tracking the activation funnel,
 *  • the shared {@link ConnectModal} the steps open.
 *
 * Progress is real DB state (no stored flag); only "seen"/"dismissed" live in
 * localStorage. Polls gently while waiting for the first agent call so the tick
 * lands without a manual refresh.
 */
export default function OnboardingGuide({ userRole }: Props) {
  const isEligible = userRole !== 'demo';

  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const welcomeResolved = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const p = await getOnboardingProgress();
      setProgress(p);

      // Decide the welcome modal exactly once per mount, after the first fetch:
      // show only to a genuinely new user (no token yet) who hasn't seen it.
      if (!welcomeResolved.current) {
        welcomeResolved.current = true;
        const seen = localStorage.getItem(WELCOME_SEEN_KEY) === '1';
        if (!seen && !p.hasToken) setWelcomeOpen(true);
      }
    } catch {
      // best-effort — onboarding never blocks the app
    }
  }, []);

  // Mount + initial fetch. Wrapped in an async IIFE so the localStorage read +
  // setState don't run synchronously in the effect body (cascading-render lint).
  useEffect(() => {
    if (!isEligible) return;
    void (async () => {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === '1');
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1');
      await refresh();
    })();
  }, [isEligible, refresh]);

  // Re-check when the user returns to the tab (they may have run the agent elsewhere).
  useEffect(() => {
    if (!isEligible) return;
    const onFocus = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, [isEligible, refresh]);

  // Gentle poll while waiting for the first agent call (connected but no call yet).
  const waitingForCall = !!progress?.hasToken && !progress?.hasAgentCall && !dismissed;
  useEffect(() => {
    if (!isEligible || !waitingForCall) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 20_000);
    return () => clearInterval(id);
  }, [isEligible, waitingForCall, refresh]);

  const markWelcomeSeen = () => {
    welcomeResolved.current = true;
    try { localStorage.setItem(WELCOME_SEEN_KEY, '1'); } catch { /* ignore */ }
  };

  const handleConnect = () => {
    markWelcomeSeen();
    setWelcomeOpen(false);
    setConnectOpen(true);
  };

  const handleExplore = () => {
    markWelcomeSeen();
    setWelcomeOpen(false);
  };

  const handleToggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  // Permanent hide — only reachable from the "all done" celebratory state.
  const handleDismissChecklist = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* ignore */ }
  };

  if (!isEligible || !progress) return null;

  const mcpUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : '/api/mcp';
  const showChecklist = !dismissed;

  return (
    <>
      {showChecklist && (
        <GettingStartedChecklist
          progress={progress}
          collapsed={collapsed}
          onConnect={() => setConnectOpen(true)}
          onToggleCollapse={handleToggleCollapse}
          onDismiss={handleDismissChecklist}
        />
      )}

      {welcomeOpen && (
        <WelcomeModal
          onConnect={handleConnect}
          onExplore={handleExplore}
          onClose={handleExplore}
        />
      )}

      {connectOpen && (
        <ConnectModal
          mcpUrl={mcpUrl}
          mintTargets={progress.mintTargets}
          onClose={() => { setConnectOpen(false); refresh(); }}
        />
      )}
    </>
  );
}
