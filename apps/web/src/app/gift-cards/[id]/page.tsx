'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';

export default function GiftCardDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { formatPrice } = useCurrency();
  const toast = useToast();
  const [giftCard, setGiftCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchGiftCard = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getMyGiftCards();
        const cards = Array.isArray(response?.data) ? response.data : [];
        const found = cards.find((c: any) => c.id === id);
        if (found) {
          setGiftCard(found);
        } else {
          setError('Gift card not found');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load gift card');
      } finally {
        setLoading(false);
      }
    };
    fetchGiftCard();
  }, [id]);

  if (loading) {
    return (
      <RouteGuard allowedRoles={['CUSTOMER', 'ADMIN']} showAccessDenied={true}>
        <div className="min-h-screen bg-white">
          <Header />
          <main className="container mx-auto px-4 py-12">
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
            </div>
          </main>
          <Footer />
        </div>
      </RouteGuard>
    );
  }

  if (error || !giftCard) {
    return (
      <RouteGuard allowedRoles={['CUSTOMER', 'ADMIN']} showAccessDenied={true}>
        <div className="min-h-screen bg-white">
          <Header />
          <main className="container mx-auto px-4 py-12">
            <div className="max-w-md mx-auto text-center">
              <p className="text-gray-600 mb-4">{error || 'Gift card not found'}</p>
              <Link href="/gift-cards" className="text-purple-600 hover:text-purple-800 font-medium">
                ← Back to Gift Cards
              </Link>
            </div>
          </main>
          <Footer />
        </div>
      </RouteGuard>
    );
  }

  const currency = giftCard.currency || 'GBP';
  const balance = Number(giftCard.balance ?? 0);
  const amount = Number(giftCard.amount ?? 0);

  return (
    <RouteGuard allowedRoles={['CUSTOMER', 'ADMIN']} showAccessDenied={true}>
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="max-w-md mx-auto">
            <Link href="/gift-cards" className="text-purple-600 hover:text-purple-800 mb-4 inline-block">
              ← Back to Gift Cards
            </Link>
            <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-8 text-white shadow-lg">
              <h1 className="text-2xl font-bold mb-2">Gift Card</h1>
              <p className="text-purple-200 text-sm mb-6">Your gift card balance</p>
              <p className="text-4xl font-bold mb-6">{formatPrice(balance, currency)}</p>
              {giftCard.code && (
                <div className="bg-white/10 rounded-lg p-4 mb-6">
                  <p className="text-xs text-purple-200 mb-1">Gift Card Code</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono font-semibold tracking-wider">{giftCard.code}</p>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(giftCard.code);
                          toast.success('Gift card code copied to clipboard!');
                        } catch {
                          toast.error('Failed to copy code. Please copy it manually.');
                        }
                      }}
                      className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md text-sm font-medium transition-colors"
                    >
                      Copy Code
                    </button>
                  </div>
                </div>
              )}
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-purple-200">Original Amount</dt>
                  <dd>{formatPrice(amount, currency)}</dd>
                </div>
                {giftCard.status && (
                  <div className="flex justify-between">
                    <dt className="text-purple-200">Status</dt>
                    <dd>{giftCard.status}</dd>
                  </div>
                )}
                {giftCard.expiresAt && (
                  <div className="flex justify-between">
                    <dt className="text-purple-200">Expires</dt>
                    <dd>{new Date(giftCard.expiresAt).toLocaleDateString()}</dd>
                  </div>
                )}
              </dl>
            </div>
            <p className="text-sm text-gray-500 mt-4 text-center">
              Use this code at checkout to apply your gift card balance.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
