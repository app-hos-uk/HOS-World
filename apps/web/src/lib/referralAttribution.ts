const COOKIE = 'hos_ref';
const STORAGE_KEY = 'hos_referral_pending';

/** Best-effort: query ?ref= → session stash → attribution cookie (set on /ref/[code]). */
export function getPendingReferralCode(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const q = new URLSearchParams(window.location.search).get('ref')?.trim();
    if (q) return q;
    const stored = sessionStorage.getItem(STORAGE_KEY)?.trim();
    if (stored) return stored;
    const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
    if (m?.[1]) return decodeURIComponent(m[1]).trim();
  } catch {
    /* ignore */
  }
  return undefined;
}

export function stashReferralFromQuery(ref: string | null | undefined): void {
  if (typeof window === 'undefined' || !ref?.trim()) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, ref.trim());
  } catch {
    /* ignore */
  }
}

export function clearPendingReferral(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
