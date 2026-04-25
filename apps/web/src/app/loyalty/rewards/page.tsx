'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';

const EARN_ACTIONS = [
  { action: 'Purchase', description: 'Earn on every qualifying order', pointsExample: '1 pt per £1' },
  { action: 'Product Review', description: 'Write a review on a product you bought', pointsExample: '25 pts' },
  { action: 'Photo Review', description: 'Include a photo with your review', pointsExample: '50 pts' },
  { action: 'Social Share', description: 'Share a product on social media (up to 5/day)', pointsExample: '10 pts' },
  { action: 'Quiz', description: 'Pass a fandom quiz', pointsExample: '25–50 pts' },
  { action: 'Quest', description: 'Complete a quest challenge', pointsExample: 'Varies' },
  { action: 'Referral', description: 'Invite a friend who joins', pointsExample: '200 pts' },
  { action: 'Check-in', description: 'Check in at a House of Spells store', pointsExample: '15 pts' },
];

export default function LoyaltyRewardsPage() {
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getRedemptionOptions()
      .then((r) => setOptions(Array.isArray(r.data) ? r.data : []))
      .catch((e: any) => setError(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <RouteGuard allowedRoles={['CUSTOMER']}>
      <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl">
          <Link href="/loyalty" className="text-amber-500 text-sm font-secondary mb-4 inline-block">
            ← Back
          </Link>
          <h1 className="font-primary text-2xl text-amber-100 mb-6">Rewards</h1>

          <section className="mb-10">
            <h2 className="font-primary text-lg text-amber-200/90 mb-4">Ways to earn</h2>
            <div className="overflow-x-auto rounded border border-stone-800">
              <table className="w-full text-sm text-left text-stone-300">
                <thead className="bg-stone-900 text-stone-400">
                  <tr>
                    <th className="p-2">Action</th>
                    <th className="p-2">Details</th>
                    <th className="p-2 text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {EARN_ACTIONS.map((ea) => (
                    <tr key={ea.action} className="border-t border-stone-800">
                      <td className="p-2 font-secondary">{ea.action}</td>
                      <td className="p-2 text-stone-400 font-secondary">{ea.description}</td>
                      <td className="p-2 text-right text-amber-200 font-secondary whitespace-nowrap">{ea.pointsExample}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="font-primary text-lg text-amber-200/90 mb-4">Redemption options</h2>
            {loading ? (
              <p className="font-secondary text-stone-500">Loading…</p>
            ) : error ? (
              <p className="font-secondary text-red-400">{error}</p>
            ) : options.length === 0 ? (
              <p className="font-secondary text-stone-500">No rewards available at the moment.</p>
            ) : (
              <ul className="space-y-3">
                {options.map((o) => (
                  <li
                    key={o.id}
                    className="rounded-lg border border-stone-800 bg-stone-900/50 p-4 flex justify-between gap-4"
                  >
                    <div>
                      <p className="font-primary">{o.name}</p>
                      <p className="text-sm text-stone-500 font-secondary">{o.description || o.type}</p>
                    </div>
                    <p className="font-secondary text-amber-200 whitespace-nowrap">{o.pointsCost} pts</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
