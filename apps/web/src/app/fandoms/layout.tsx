import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Browse Fandoms — Fandom Marketplace | House of Spells',
  description:
    'Explore collectibles and merchandise from Harry Potter, Lord of the Rings, Marvel, Star Wars, and more at House of Spells.',
  alternates: { canonical: '/fandoms' },
  openGraph: {
    title: 'Browse Fandoms | House of Spells',
    description: 'Shop by franchise across the House of Spells marketplace.',
    url: '/fandoms',
  },
};

export default function FandomsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
