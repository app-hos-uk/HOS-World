import Script from 'next/script';
import { GA_MEASUREMENT_ID, GTM_ID } from '@/lib/analytics/gtag';

const CONSENT_DEFAULTS_SCRIPT = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  functionality_storage: 'granted',
  security_storage: 'granted',
  wait_for_update: 500
});
`;

/**
 * Loads Google Tag Manager and/or GA4 (gtag.js).
 * When GTM is configured, use it as the container for GA4 + Ads pixels.
 * When only GA_MEASUREMENT_ID is set, loads gtag.js directly.
 */
export function GoogleTags() {
  const hasGtm = Boolean(GTM_ID);
  const hasGa = Boolean(GA_MEASUREMENT_ID);

  if (!hasGtm && !hasGa) return null;

  return (
    <>
      <Script id="google-consent-defaults" strategy="beforeInteractive">
        {CONSENT_DEFAULTS_SCRIPT}
      </Script>

      {hasGtm ? (
        <>
          <Script id="google-tag-manager" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
          </Script>
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
              title="Google Tag Manager"
            />
          </noscript>
        </>
      ) : null}

      {hasGa && !hasGtm ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics-config" strategy="afterInteractive">
            {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false, anonymize_ip: true });
`}
          </Script>
        </>
      ) : null}
    </>
  );
}
