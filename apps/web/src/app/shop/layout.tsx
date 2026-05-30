import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Shop — Fandom Marketplace | House of Spells' },
  description:
    'House of Spells marketplace: wizarding-world collectibles, multi-franchise fandom merch, and gifts from trusted vendors.',
  alternates: { canonical: '/shop' },
  openGraph: {
    siteName: 'House of Spells',
    title: 'Shop — Fandom Marketplace',
    description:
      'House of Spells marketplace: wizarding-world collectibles, multi-franchise fandom merch, and gifts from trusted vendors.',
    type: 'website',
    url: '/shop',
    locale: 'en_US',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'House of Spells Marketplace' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shop — Fandom Marketplace',
    description:
      'House of Spells marketplace: wizarding-world collectibles, multi-franchise fandom merch, and gifts from trusted vendors.',
    images: ['/og-image.png'],
  },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
