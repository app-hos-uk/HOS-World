import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'All Products — Fandom Marketplace | House of Spells',
  description: 'Browse collectibles, apparel, and gifts from franchises you love on House of Spells.',
  alternates: { canonical: '/products' },
};

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
