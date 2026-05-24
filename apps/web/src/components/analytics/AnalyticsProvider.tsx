'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  CONSENT_UPDATED_EVENT,
  configureGoogleAnalytics,
  getStoredConsent,
  hasAnalyticsConsent,
  hasConsentDecision,
  isAnyGoogleTagEnabled,
  trackPageView,
  updateGoogleConsent,
  type ConsentPreferences,
} from '@/lib/analytics';

function applyConsent(preferences: ConsentPreferences): void {
  updateGoogleConsent(preferences);
  configureGoogleAnalytics();
}

export function AnalyticsProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPath = useRef<string | null>(null);

  const trackCurrentPage = () => {
    if (!isAnyGoogleTagEnabled() || !hasAnalyticsConsent()) return;

    const query = searchParams?.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    if (!path || lastTrackedPath.current === path) return;

    lastTrackedPath.current = path;
    trackPageView(window.location.href);
  };

  useEffect(() => {
    if (!isAnyGoogleTagEnabled()) return;

    const syncConsent = () => {
      const preferences = getStoredConsent();
      if (preferences && hasConsentDecision()) {
        applyConsent(preferences);
        if (preferences.analytics) {
          lastTrackedPath.current = null;
          trackCurrentPage();
        }
      }
    };

    syncConsent();

    const onConsentUpdated = (event: Event) => {
      const detail = (event as CustomEvent<ConsentPreferences>).detail;
      if (detail) {
        applyConsent(detail);
        if (detail.analytics) {
          lastTrackedPath.current = null;
          trackCurrentPage();
        }
      }
    };

    window.addEventListener(CONSENT_UPDATED_EVENT, onConsentUpdated);
    window.addEventListener('storage', syncConsent);

    return () => {
      window.removeEventListener(CONSENT_UPDATED_EVENT, onConsentUpdated);
      window.removeEventListener('storage', syncConsent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    trackCurrentPage();
  }, [pathname, searchParams]);

  return null;
}
