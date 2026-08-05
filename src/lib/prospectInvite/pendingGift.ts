// Client-side "I have a gift waiting" marker. Written when a not-yet-logged-in
// visitor lands on /welcome/[token] (see PendingGiftKeeper), read by the
// floating PendingGiftToast so the gift survives them wandering off to
// explore the marketing site before deciding to sign up — the whole point
// being they shouldn't have to keep the link around themselves.
//
// Purely a UI convenience, not a security boundary: the real claim always
// re-validates the token server-side (see claimProspectInvite) regardless of
// what's cached here. localStorage (not a cookie) because this only needs to
// survive client-side navigation within the same browser, not round-trip a
// server redirect (that's what the httpOnly pending_prospect_invite cookie
// is for, set separately by the page's own "sign in" action).

const KEY = 'remnus_pending_gift';

export interface PendingGift {
  token: string;
  appName: string;
  appLogoUrl: string | null;
  giftDays: number;
  giftTier: 'startup' | 'professional';
  /** ms epoch; null = the invite link itself has no expiry. */
  linkExpiresAt: number | null;
}

export function savePendingGift(gift: PendingGift) {
  try {
    localStorage.setItem(KEY, JSON.stringify(gift));
  } catch {
    // localStorage unavailable (private mode, disabled) — the toast just won't show.
  }
}

export function readPendingGift(): PendingGift | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingGift;
    if (!parsed?.token) return null;
    if (parsed.linkExpiresAt !== null && parsed.linkExpiresAt < Date.now()) {
      clearPendingGift();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingGift() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
