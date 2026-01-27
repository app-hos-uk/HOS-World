import type { Metadata } from 'next';
import { Cinzel, Lora, Inter } from 'next/font/google';
import { ThemeProviderWrapper } from '@/components/ThemeProviderWrapper';
import { AuthProviderWrapper } from '@/components/AuthProviderWrapper';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { CartProvider } from '@/contexts/CartContext';
import { GDPRConsentBanner } from '@/components/GDPRConsentBanner';
import { Toaster } from '@/components/Toaster';
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
  title: 'House of Spells Marketplace',
  description: 'Discover magical items from your favorite fandoms',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
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
                {children}
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


