'use client';
import { useCallback, useEffect, useState } from 'react';
import { useIsTauri } from '@/lib/hooks/useIsTauri';
import ConnectModal from '@/components/features/agents/ConnectModal';
import { getOnboardingProgress } from '@/lib/actions/onboarding';
import AgentDetectModal from './AgentDetectModal';
import AgentDetectNotice from './AgentDetectNotice';

const MODAL_SEEN_KEY = 'remnus_agent_detect_modal_seen';
const NOTICE_DISMISSED_KEY = 'remnus_agent_detect_notice_dismissed';
// Onboarding's own key (see OnboardingGuide) — read only, never written here.
const WELCOME_SEEN_KEY = 'remnus_onboarding_welcome_seen';

interface Props {
  /** Skip for ephemeral demo accounts, same as the onboarding guide. */
  userRole?: string;
}

/**
 * Desktop-only discovery surface: on Tauri, scans for AI coding tools already
 * on the user's machine (`detect_installed_agents`) and offers a one-time
 * "connect now" modal, then a persistent, independently-dismissible sidebar
 * notice so the offer isn't lost if the user wasn't ready yet. Mounted
 * alongside {@link OnboardingGuide} in WorkspaceSidebar (same `showOnboarding`
 * gate — the always-mounted desktop sidebar only, never the mobile drawer).
 */
export default function AgentDetectGuide({ userRole }: Props) {
  const isTauri = useIsTauri();
  const isEligible = isTauri && userRole !== 'demo';

  const [detected, setDetected] = useState<{ id: string }[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [mintTargets, setMintTargets] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!isEligible) return;
    let cancelled = false;
    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const rows = await invoke<{ id: string; detected: boolean }[]>('detect_installed_agents');
        const found = rows.filter(r => r.detected).map(r => ({ id: r.id }));
        if (cancelled || found.length === 0) return;

        setDetected(found);
        setNoticeDismissed(localStorage.getItem(NOTICE_DISMISSED_KEY) === '1');
      } catch {
        // not in the desktop shell, or detection failed — nothing to offer
      }
    })();
    return () => { cancelled = true; };
  }, [isEligible]);

  // Don't stack with the onboarding welcome modal on a brand-new user's very
  // first launch — only offer this once onboarding's own welcome has been
  // resolved. `WELCOME_SEEN_KEY` is written by a sibling component in the same
  // window (no `storage` event fires for that), so poll briefly instead of
  // relying on a one-time check — otherwise dismissing the welcome modal
  // wouldn't surface this until the next app launch.
  useEffect(() => {
    if (!isEligible || !detected || detected.length === 0 || modalOpen) return;
    if (localStorage.getItem(MODAL_SEEN_KEY) === '1') return; // already resolved once, never re-show

    const check = () => {
      if (localStorage.getItem(WELCOME_SEEN_KEY) === '1') setModalOpen(true);
    };
    check();
    const id = setInterval(check, 2000);
    return () => clearInterval(id);
  }, [isEligible, detected, modalOpen]);

  // Marks the offer as resolved so the poll effect above never reopens it —
  // must be called on EVERY path that closes the modal (connect or dismiss),
  // not just dismiss, otherwise the poll (which only checks this flag) sees
  // `modalOpen` go back to false and immediately reopens it.
  const markModalSeen = () => {
    try { localStorage.setItem(MODAL_SEEN_KEY, '1'); } catch { /* ignore */ }
  };

  const openConnect = useCallback(() => {
    markModalSeen();
    setModalOpen(false);
    void getOnboardingProgress().then(p => setMintTargets(p.mintTargets)).catch(() => {});
    setConnectOpen(true);
  }, []);

  const dismissModal = () => {
    markModalSeen();
    setModalOpen(false);
  };

  const dismissNotice = () => {
    try { localStorage.setItem(NOTICE_DISMISSED_KEY, '1'); } catch { /* ignore */ }
    setNoticeDismissed(true);
  };

  if (!isEligible || !detected) return null;

  const mcpUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : '/api/mcp';

  return (
    <>
      {!modalOpen && !noticeDismissed && (
        <AgentDetectNotice count={detected.length} onConnect={openConnect} onDismiss={dismissNotice} />
      )}

      {modalOpen && (
        <AgentDetectModal detected={detected} onConnect={openConnect} onDismiss={dismissModal} />
      )}

      {connectOpen && (
        <ConnectModal
          mcpUrl={mcpUrl}
          mintTargets={mintTargets}
          source="agent_detect"
          onClose={() => { setConnectOpen(false); dismissNotice(); }}
        />
      )}
    </>
  );
}
