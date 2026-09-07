import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Join the Enchanted Circle',
  description:
    'Sign up for the House of Spells Enchanted Circle loyalty programme in seconds. Scan the in-store QR, join, and show your Welcome Reward at the till.',
};

export default function LoyaltyJoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
