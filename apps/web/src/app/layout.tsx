import type { Metadata } from 'next';
import { Cormorant_Garamond, Figtree, Inter } from 'next/font/google';
import { ThemeProviderWrapper } from '@/components/ThemeProviderWrapper';
import { AuthProviderWrapper } from '@/components/AuthProviderWrapper';
import { QueryProvider } from '@/components/QueryProvider';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { CartProvider } from '@/contexts/CartContext';
import { GDPRConsentBanner } from '@/components/GDPRConsentBanner';
import { GoogleTags } from '@/components/analytics/GoogleTags';
import { AnalyticsProvider } from '@/components/analytics/AnalyticsProvider';
import { SiteStructuredData } from '@/components/analytics/StructuredData';
import { Toaster } from '@/components/Toaster';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Suspense } from 'react';
import './globals.css';

// Cormorant Garamond — display headings & body (reference storefront)
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-cormorant',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
});

// Figtree — UI labels, buttons, nav (reference storefront)
const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  weight: ['400', '600', '700'],
  display: 'swap',
});

// Inter for admin dashboards - modern, professional, highly readable
const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-ui',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'House of Spells — Fandom Marketplace | Collectables & Merchandise',
    template: '%s | House of Spells',
  },
  description: 'House of Spells marketplace: wizarding-world collectibles, multi-franchise fandom merch, and gifts from trusted US vendors — one checkout, tracked delivery.',
  keywords: ['Harry Potter', 'merchandise', 'collectibles', 'magical', 'fandoms', 'spells', 'marketplace'],
  authors: [{ name: 'House of Spells' }],
  creator: 'House of Spells',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://hos-marketplaceweb-production.up.railway.app'),
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'House of Spells',
    title: 'House of Spells - Magical Marketplace',
    description: 'Discover magical merchandise, collectibles, and enchanted items from your favorite fandoms.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'House of Spells Marketplace' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'House of Spells - Magical Marketplace',
    description: 'Discover magical merchandise and collectibles.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-US">
      <body className={`${cormorant.variable} ${figtree.variable} ${inter.variable} storefront-theme antialiased`}>
        <GoogleTags />
        <SiteStructuredData />
        <QueryProvider>
          <AuthProviderWrapper>
            <CurrencyProvider>
              <CartProvider>
                <ThemeProviderWrapper>
                  <ErrorBoundary>
                    {children}
                  </ErrorBoundary>
                  <Suspense fallback={null}>
                    <AnalyticsProvider />
                  </Suspense>
                  <GDPRConsentBanner />
                  <Toaster />
                </ThemeProviderWrapper>
              </CartProvider>
            </CurrencyProvider>
          </AuthProviderWrapper>
        </QueryProvider>
      </body>
    </html>
  );
}


