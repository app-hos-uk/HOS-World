'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CustomerQr } from '@/components/CustomerQr';
import { apiClient } from '@/lib/api';

type LoyaltyCard = {
  cardNumber?: string;
  tier?: string;
  balance?: number;
  qrPayload?: unknown;
};

function qrValueFromCard(card: LoyaltyCard): string {
  const payload = card.qrPayload;
  if (typeof payload === 'string' && payload.trim()) return payload;
  if (payload && typeof payload === 'object') return JSON.stringify(payload);
  if (card.cardNumber) {
    return JSON.stringify({ t: 'hos-loyalty', c: card.cardNumber });
  }
  return '';
}

export default function LoyaltyCardPage() {
  const [card, setCard] = useState<LoyaltyCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getLoyaltyCard()
      .then((r) => setCard((r.data as LoyaltyCard) ?? null))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load card'))
      .finally(() => setLoading(false));
  }, []);

  const qrValue = card ? qrValueFromCard(card) : '';

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
            <div className="rounded-xl border-2 border-amber-700/50 bg-gradient-to-br from-stone-900 to-stone-950 p-8 shadow-lg flex flex-col items-center text-center">
              <p className="text-xs text-stone-500 font-secondary tracking-widest">HOUSE OF SPELLS</p>
              <p className="font-primary text-lg text-amber-100 mt-2">{card.tier}</p>
              {qrValue ? (
                <CustomerQr
                  value={qrValue}
                  size={220}
                  alt="Enchanted Circle loyalty card"
                  showValue={false}
                  className="mt-6 flex flex-col items-center"
                />
              ) : null}
              <p className="font-mono text-stone-200 mt-5 text-sm tracking-wide break-all">
                {card.cardNumber}
              </p>
              <p className="text-stone-500 text-sm mt-3 font-secondary">
                {card.balance} points
              </p>
              <p className="text-xs text-stone-500 mt-4 font-secondary">
                Show this code at the till to earn and redeem.
              </p>
            </div>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
