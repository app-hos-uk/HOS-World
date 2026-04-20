'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';

export default function LoyaltyCardPage() {
  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getLoyaltyCard()
      .then((r) => setCard(r.data))
      .catch((e: any) => setError(e?.message || 'Could not load card'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <RouteGuard allowedRoles={['CUSTOMER']}>
      <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-10 max-w-lg">
          <Link href="/loyalty" className="text-amber-500 text-sm font-secondary mb-4 inline-block">
            ← Back
          </Link>
          <h1 className="font-primary text-2xl text-amber-100 mb-6">Digital card</h1>
          {loading ? (
            <p className="font-secondary text-stone-500">Loading…</p>
          ) : error ? (
            <p className="font-secondary text-red-400">{error}</p>
          ) : !card ? (
            <p className="font-secondary text-stone-500">No card found. Enroll first.</p>
          ) : (
            <div className="rounded-xl border-2 border-amber-700/50 bg-gradient-to-br from-stone-900 to-stone-950 p-8 shadow-lg">
              <p className="text-xs text-stone-500 font-secondary tracking-widest">HOUSE OF SPELLS</p>
              <p className="font-primary text-lg text-amber-100 mt-2">{card.tier}</p>
              <p className="font-mono text-stone-300 mt-6 text-sm break-all">{card.cardNumber}</p>
              <p className="text-stone-500 text-sm mt-4 font-secondary">{card.balance} points</p>
              <p className="text-xs text-stone-600 mt-6 break-all font-mono">{card.qrPayload}</p>
            </div>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
