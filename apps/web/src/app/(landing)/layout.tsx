import type { Metadata, Viewport } from 'next';
import { cinzel, cinzelDecorative, cormorantLanding } from '@/lib/fonts';
import { landingPageMetadata } from './lib/landingMetadata';
import './landing.css';

export const metadata: Metadata = {
  ...landingPageMetadata({
    title: "House of Spells — Earth's Multi-Fandom Universe",
    description:
      'House of Spells — the multi-fandom flagship opening in Times Square, New York. Every universe. One destination. Register for founding membership.',
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

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`landing-site ${cinzelDecorative.variable} ${cinzel.variable} ${cormorantLanding.variable}`}
      style={{
        fontFamily: 'var(--font-cormorant-landing), Georgia, serif',
      }}
    >
      {children}
    </div>
  );
}
