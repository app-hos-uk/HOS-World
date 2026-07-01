import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Checkout | House of Spells',
  description: 'Complete your House of Spells marketplace order securely.',
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
