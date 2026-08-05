'use client';

import { useEffect } from 'react';
import { savePendingGift } from '@/lib/prospectInvite/pendingGift';

interface Props {
  token: string;
  appName: string;
  appLogoUrl: string | null;
  giftDays: number;
  giftTier: 'startup' | 'professional';
  daysUntilLinkExpiry: number | null;
}

// Invisible — mounted only on the logged-out branch of /welcome/[token].
// Writes the "gift waiting" marker on mount so PendingGiftToast (mounted
// site-wide for logged-out visitors) can surface it if the user wanders off
// to check out the marketing site before signing up. Carries enough of the
// invite's own content (logo, tier, days) for the toast's hover-expand
// preview to mirror this page, not just name-drop it.
export default function PendingGiftKeeper({ token, appName, appLogoUrl, giftDays, giftTier, daysUntilLinkExpiry }: Props) {
  useEffect(() => {
    savePendingGift({
      token,
      appName,
      appLogoUrl,
      giftDays,
      giftTier,
      linkExpiresAt: daysUntilLinkExpiry !== null ? Date.now() + daysUntilLinkExpiry * 24 * 60 * 60 * 1000 : null,
    });
  }, [token, appName, appLogoUrl, giftDays, giftTier, daysUntilLinkExpiry]);

  return null;
}
