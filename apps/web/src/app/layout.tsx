import type { Metadata } from 'next';
import { Cinzel, Lora } from 'next/font/google';
import { ThemeProviderWrapper } from '@/components/ThemeProviderWrapper';
import { AuthProviderWrapper } from '@/components/AuthProviderWrapper';
import './globals.css';

// Cinzel for headings, brand, and magical feel
const cinzel = Cinzel({ 
  subsets: ['latin'],
  variable: '--font-cinzel',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

// Lora for body text - readable and elegant
const lora = Lora({ 
  subsets: ['latin'],
  variable: '--font-lora',
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
      <body className={`${cinzel.variable} ${lora.variable}`}>
        <AuthProviderWrapper>
          <ThemeProviderWrapper>
            {children}
          </ThemeProviderWrapper>
        </AuthProviderWrapper>
      </body>
    </html>
  );
}


