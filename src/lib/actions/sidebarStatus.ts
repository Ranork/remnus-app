'use server';
import { getCurrentUserAllowingWorkspaceLock } from '@/lib/auth/session';
import type { PlanTier } from '@/lib/billing/plans';
import type { AgentMetrics } from '@/lib/services/agentMetrics';
import { getUserTrashCount } from './trash';
import { getUserAgentTokenCount } from './agentToken';
import { getMyTier } from './billing';
import { getMyAgentMetrics } from './agentMetrics';
import { getOnboardingProgress, type OnboardingProgress } from './onboarding';

export type SidebarStatus = {
  trashCount: number | null;
  /** Account-level: null in a project window (not shown there) or on failure. */
  agentTokenCount: number | null;
  tier: PlanTier | null;
  /** The savings card's figures — the window's workspace in a project window. */
  metrics: AgentMetrics | null;
  /** Null in a project window, for demo accounts, or on failure (the guide then asks itself). */
  onboarding: OnboardingProgress | null;
};

const settled = <T,>(result: PromiseSettledResult<T>): T | null =>
  result.status === 'fulfilled' ? result.value : null;

/**
 * Everything the sidebar shows next to its rows, in ONE server action (V2 R9).
 *
 * Next runs server actions one at a time per page, so the sidebar's five separate
 * reads on mount (trash count, agent count, plan, savings, onboarding) queued behind
 * each other — and in front of the page's own panels. Measured on a page load: 14
 * actions back to back, the page's comments arriving ~1.5 s after the editor. Here the
 * same reads run side by side on the server, each with its own access rule (they are
 * the same functions), and a failing one only costs its own field.
 */
export async function getSidebarStatus(): Promise<SidebarStatus> {
  const user = await getCurrentUserAllowingWorkspaceLock();

  if (user.workspaceLock) {
    // A project window: workspace content only. The account-level reads would throw.
    const [trash, metrics] = await Promise.allSettled([
      getUserTrashCount(),
      getMyAgentMetrics(user.workspaceLock),
    ]);
    return { trashCount: settled(trash), agentTokenCount: null, tier: null, metrics: settled(metrics), onboarding: null };
  }

  const [trash, tokens, tier, metrics, onboarding] = await Promise.allSettled([
    getUserTrashCount(),
    getUserAgentTokenCount(),
    getMyTier(),
    getMyAgentMetrics(),
    user.role === 'demo' ? Promise.resolve(null) : getOnboardingProgress(),
  ]);
  return {
    trashCount: settled(trash),
    agentTokenCount: settled(tokens),
    tier: settled(tier),
    metrics: settled(metrics),
    onboarding: settled(onboarding),
  };
}
