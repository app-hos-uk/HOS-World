export interface ConsentPreferences {
  essential: boolean;
  marketing: boolean;
  analytics: boolean;
}

export const CONSENT_GIVEN_KEY = 'gdpr_consent_given';
export const CONSENT_STORAGE_KEY = 'gdpr_consent_preferences';
export const CONSENT_UPDATED_EVENT = 'hos:consent-updated';

const DEFAULT_CONSENT: ConsentPreferences = {
  essential: true,
  marketing: false,
  analytics: false,
};

export function getStoredConsent(): ConsentPreferences | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentPreferences>;
    return {
      essential: true,
      marketing: Boolean(parsed.marketing),
      analytics: Boolean(parsed.analytics),
    };
  } catch {
    return null;
  }
}

export function hasConsentDecision(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(CONSENT_GIVEN_KEY) === 'true';
}

export function hasAnalyticsConsent(): boolean {
  const prefs = getStoredConsent();
  return Boolean(prefs?.analytics);
}

export function hasMarketingConsent(): boolean {
  const prefs = getStoredConsent();
  return Boolean(prefs?.marketing);
}

export function dispatchConsentUpdated(preferences: ConsentPreferences): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(CONSENT_UPDATED_EVENT, { detail: preferences }),
  );
}

export { DEFAULT_CONSENT };
