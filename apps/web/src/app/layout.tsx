import type { Metadata } from 'next';
import { Cinzel, Lora, Inter } from 'next/font/google';
import { ThemeProviderWrapper } from '@/components/ThemeProviderWrapper';
import { AuthProviderWrapper } from '@/components/AuthProviderWrapper';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { CartProvider } from '@/contexts/CartContext';
import { GDPRConsentBanner } from '@/components/GDPRConsentBanner';
import { Toaster } from '@/components/Toaster';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import './globals.css';

// Cinzel for headings, brand, and magical feel (customer-facing)
const cinzel = Cinzel({ 
  subsets: ['latin'],
  variable: '--font-cinzel',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

// Lora for body text - readable and elegant (customer-facing)
const lora = Lora({ 
  subsets: ['latin'],
  variable: '--font-lora',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

// Inter for admin dashboards - modern, professional, highly readable
const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'House of Spells - Magical Marketplace',
    template: '%s | House of Spells',
  },
  description: 'Discover magical merchandise, collectibles, and enchanted items from your favourite fandoms at House of Spells marketplace.',
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
    locale: 'en_GB',
    siteName: 'House of Spells',
    title: 'House of Spells - Magical Marketplace',
    description: 'Discover magical merchandise, collectibles, and enchanted items from your favourite fandoms.',
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${cinzel.variable} ${lora.variable} ${inter.variable}`}>
        <AuthProviderWrapper>
          <CurrencyProvider>
            <CartProvider>
              <ThemeProviderWrapper>
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
                <GDPRConsentBanner />
                <Toaster />
              </ThemeProviderWrapper>
            </CartProvider>
          </CurrencyProvider>
        </AuthProviderWrapper>
      </body>
    </html>
  );
}


