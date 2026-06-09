'use client';

import Script from 'next/script';
import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  CONSENT_UPDATED_EVENT,
  getStoredConsent,
  hasConsentDecision,
  hasMarketingConsent,
  type ConsentPreferences,
} from '@/lib/analytics/consent';
import { isMetaPixelEnabled, META_PIXEL_ID } from '@/lib/analytics/meta-pixel';
import { trackMetaPageView } from '@/lib/analytics/meta-events';

export function MetaPixel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPath = useRef<string | null>(null);
  const initialized = useRef(false);

  const trackCurrentPage = () => {
    if (!isMetaPixelEnabled() || !hasMarketingConsent()) return;

    const query = searchParams?.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    if (!path || lastTrackedPath.current === path) return;

    lastTrackedPath.current = path;
    trackMetaPageView(window.location.href);
  };

  useEffect(() => {
    if (!isMetaPixelEnabled()) return;

    const syncConsent = () => {
      const preferences = getStoredConsent();
      if (preferences && hasConsentDecision() && preferences.marketing) {
        if (!initialized.current && typeof window.fbq === 'function') {
          window.fbq('init', META_PIXEL_ID);
          initialized.current = true;
        }
        lastTrackedPath.current = null;
        trackCurrentPage();
      }
    };

    syncConsent();

    const onConsentUpdated = (event: Event) => {
      const detail = (event as CustomEvent<ConsentPreferences>).detail;
      if (!detail) return;

      if (detail.marketing) {
        if (!initialized.current && typeof window.fbq === 'function') {
          window.fbq('init', META_PIXEL_ID);
          initialized.current = true;
        }
        lastTrackedPath.current = null;
        trackCurrentPage();
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

  if (!isMetaPixelEnabled()) return null;

  return (
    <>
      <Script id="meta-pixel-base" strategy="afterInteractive">
        {`
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
`}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
