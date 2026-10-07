import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { landingPageMetadata } from './lib/landingMetadata';
import { getMarketConfig } from './lib/marketConfig';
import { getSiteUrl } from '../lib/siteUrls';
import { cinzel, cinzelDecorative, cormorant } from '../lib/fonts';
import { LandingAnalytics } from './components/LandingAnalytics';
import { LandingStructuredData } from './components/LandingStructuredData';
import './landing.css';

const market = getMarketConfig();

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  ...landingPageMetadata({
    title:
      market.code === 'US'
        ? "House of Spells — Earth's Multi-Fandom Universe"
        : `House of Spells ${market.country} — Earth's Multi-Fandom Universe`,
    description: `House of Spells — the multi-fandom flagship in ${market.store.location}. Every universe. One destination. Register for founding membership.`,
    path: '/',
  }),
  manifest: '/landing/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#05050D',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const market = getMarketConfig();
  return (
    <html lang={market.locale}>
      <head>
        <LandingStructuredData />
      </head>
      <body
        className={`landing-site ${cinzelDecorative.variable} ${cinzel.variable} ${cormorant.variable}`}
        style={{
          fontFamily: 'var(--font-cormorant-landing), Georgia, serif',
        }}
      >
        <Suspense fallback={null}>
          <LandingAnalytics />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
