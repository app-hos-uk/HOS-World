import type { ConsentPreferences } from './consent';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || '';
export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID?.trim() || '';

export function isGoogleAnalyticsEnabled(): boolean {
  return Boolean(GA_MEASUREMENT_ID);
}

export function isGoogleTagManagerEnabled(): boolean {
  return Boolean(GTM_ID);
}

export function isAnyGoogleTagEnabled(): boolean {
  return isGoogleAnalyticsEnabled() || isGoogleTagManagerEnabled();
}

function ensureGtag(): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer?.push(args);
    };
  }
}

export function gtag(...args: unknown[]): void {
  if (typeof window === 'undefined') return;
  ensureGtag();
  window.gtag?.(...args);
}

export function initConsentDefaults(): void {
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500,
  });
}

export function updateGoogleConsent(preferences: ConsentPreferences): void {
  gtag('consent', 'update', {
    analytics_storage: preferences.analytics ? 'granted' : 'denied',
    ad_storage: preferences.marketing ? 'granted' : 'denied',
    ad_user_data: preferences.marketing ? 'granted' : 'denied',
    ad_personalization: preferences.marketing ? 'granted' : 'denied',
  });
}

export function configureGoogleAnalytics(): void {
  if (!GA_MEASUREMENT_ID || isGoogleTagManagerEnabled()) return;

  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false,
    anonymize_ip: true,
  });
}

export function trackPageView(url: string): void {
  if (!isAnyGoogleTagEnabled()) return;

  if (isGoogleTagManagerEnabled()) {
    gtag('event', 'page_view', {
      page_location: url,
      page_path: typeof window !== 'undefined' ? window.location.pathname : url,
    });
    return;
  }

  if (GA_MEASUREMENT_ID) {
    gtag('config', GA_MEASUREMENT_ID, {
      page_path: typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : url,
      page_location: url,
    });
  }
}
