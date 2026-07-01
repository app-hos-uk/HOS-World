import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Wishlist | House of Spells',
  description: 'Save and manage your favorite fandom products on House of Spells.',
  robots: { index: false, follow: false },
};

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
