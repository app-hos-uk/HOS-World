const INFLUENCER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Loyalty program (Enchanted Circle) — cookie set on /ref/[code], read at registration. */
const LOYALTY_COOKIE = 'hos_ref';
const LOYALTY_SESSION_KEY = 'hos_referral_pending';

/** Influencer commission referrals — localStorage, tracked via POST /referrals/track. */
const INFLUENCER_CODE_KEY = 'referral_code';
const INFLUENCER_EXPIRES_KEY = 'referral_expires';
const VISITOR_ID_KEY = 'visitor_id';

/** Loyalty referral code format (e.g. HOS-JAMES-A7F2). */
export const LOYALTY_REF_CODE_RE = /^HOS-[A-Z0-9][A-Z0-9-]{2,62}$/i;

/** Influencer / generic referral codes — alphanumeric with optional hyphens/underscores. */
export const INFLUENCER_REF_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/;

/** Best-effort: query ?ref= → session stash → loyalty attribution cookie (set on /ref/[code]). */
export function getPendingReferralCode(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const q = new URLSearchParams(window.location.search).get('ref')?.trim();
    if (q) return q;
    const stored = sessionStorage.getItem(LOYALTY_SESSION_KEY)?.trim();
    if (stored) return stored;
    const m = document.cookie.match(new RegExp(`(?:^|; )${LOYALTY_COOKIE}=([^;]*)`));
    if (m?.[1]) return decodeURIComponent(m[1]).trim();
  } catch {
    /* ignore */
  }
  return undefined;
}

export function stashReferralFromQuery(ref: string | null | undefined): void {
  if (typeof window === 'undefined' || !ref?.trim()) return;
  try {
    sessionStorage.setItem(LOYALTY_SESSION_KEY, ref.trim());
  } catch {
    /* ignore */
  }
}

export function clearPendingReferral(): void {
  try {
    sessionStorage.removeItem(LOYALTY_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function isValidLoyaltyReferralCode(code: string): boolean {
  return LOYALTY_REF_CODE_RE.test(code.trim());
}

export function isValidInfluencerReferralCode(code: string): boolean {
  return INFLUENCER_REF_CODE_RE.test(code.trim());
}

export function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let visitorId = localStorage.getItem(VISITOR_ID_KEY)?.trim();
    if (!visitorId) {
      visitorId = `v_${Math.random().toString(36).slice(2, 11)}`;
      localStorage.setItem(VISITOR_ID_KEY, visitorId);
    }
    return visitorId;
  } catch {
    return `v_${Math.random().toString(36).slice(2, 11)}`;
  }
}

export function getVisitorId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return localStorage.getItem(VISITOR_ID_KEY)?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export function setInfluencerReferral(code: string, expiresAtMs?: number): void {
  if (typeof window === 'undefined' || !code.trim()) return;
  try {
    localStorage.setItem(INFLUENCER_CODE_KEY, code.trim());
    localStorage.setItem(
      INFLUENCER_EXPIRES_KEY,
      String(expiresAtMs ?? Date.now() + INFLUENCER_TTL_MS),
    );
  } catch {
    /* ignore */
  }
}

export function getInfluencerReferral(): { referralCode: string; visitorId: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const code = localStorage.getItem(INFLUENCER_CODE_KEY)?.trim();
    const exp = localStorage.getItem(INFLUENCER_EXPIRES_KEY);
    if (!code || !exp || Date.now() > parseInt(exp, 10)) return null;
    const visitorId = getOrCreateVisitorId();
    return { referralCode: code, visitorId };
  } catch {
    return null;
  }
}

export function clearInfluencerReferral(): void {
  try {
    localStorage.removeItem(INFLUENCER_CODE_KEY);
    localStorage.removeItem(INFLUENCER_EXPIRES_KEY);
  } catch {
    /* ignore */
  }
}

/** Capture ?ref= on any page: track server-side and persist influencer attribution. */
export async function captureInfluencerReferralFromQuery(
  refCode: string,
  landingPage?: string,
): Promise<void> {
  const code = refCode.trim();
  if (!code || !isValidInfluencerReferralCode(code)) return;

  const visitorId = getOrCreateVisitorId();
  try {
    const { apiClient } = await import('@/lib/api');
    await apiClient.trackReferral({
      referralCode: code,
      visitorId,
      landingPage: landingPage || (typeof window !== 'undefined' ? window.location.pathname : undefined),
    });
    setInfluencerReferral(code);
  } catch {
    /* non-blocking */
  }
}
