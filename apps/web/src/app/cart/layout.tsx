import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shopping Cart | House of Spells',
  description: 'Review items in your House of Spells marketplace cart before checkout.',
  robots: { index: false, follow: false },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
