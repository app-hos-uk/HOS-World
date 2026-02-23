'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';

function maskCode(code: string): string {
  if (!code || code.length <= 6) return code || '****';
  return code.slice(0, 4) + '-****-' + code.slice(-4);
}

function getStatusStyle(status: string): { bg: string; text: string; label: string } {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':
      return { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' };
    case 'USED':
    case 'REDEEMED':
      return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Used' };
    case 'EXPIRED':
      return { bg: 'bg-red-100', text: 'text-red-700', label: 'Expired' };
    case 'DISABLED':
      return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Disabled' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600', label: status || 'Unknown' };
  }
}

export default function GiftCardsPage() {
  const { formatPrice } = useCurrency();
  const toast = useToast();
  const [giftCards, setGiftCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGiftCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchGiftCards = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getMyGiftCards();
      const cards = Array.isArray(response?.data) ? response.data : [];
      setGiftCards(cards);
    } catch (err: any) {
      const message = err?.message || 'Failed to load gift cards';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['CUSTOMER', 'ADMIN']} showAccessDenied={true}>
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-primary text-purple-900">
                  My Gift Cards
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  View and manage your gift card balances
                </p>
              </div>
              <Link
                href="/gift-cards/purchase"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all duration-300 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Purchase Gift Card
              </Link>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
                  <p className="text-sm text-gray-600">Loading your gift cards...</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {!loading && error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-800 font-medium mb-1">Failed to load gift cards</p>
                <p className="text-sm text-red-600 mb-4">{error}</p>
                <button
                  onClick={fetchGiftCards}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && giftCards.length === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 sm:p-12 text-center">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No Gift Cards Yet</h3>
                <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                  You don&apos;t have any gift cards. Purchase one for yourself or send one to a friend!
                </p>
                <Link
                  href="/gift-cards/purchase"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
                >
                  Purchase Your First Gift Card
                </Link>
              </div>
            )}

            {/* Gift Cards Grid */}
            {!loading && !error && giftCards.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {giftCards.map((card: any) => {
                  const currency = card.currency || 'GBP';
                  const balance = Number(card.balance ?? 0);
                  const statusStyle = getStatusStyle(card.status);
                  const isExpired = card.expiresAt && new Date(card.expiresAt) < new Date();
                  const effectiveStatus = isExpired && card.status?.toUpperCase() === 'ACTIVE'
                    ? getStatusStyle('EXPIRED')
                    : statusStyle;

                  return (
                    <Link
                      key={card.id}
                      href={`/gift-cards/${card.id}`}
                      className="group block"
                    >
                      <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-5 text-white shadow-md hover:shadow-lg transition-all duration-200 group-hover:scale-[1.02] h-full flex flex-col">
                        <div className="flex items-start justify-between mb-3">
                          <p className="text-xs font-medium text-purple-200 uppercase tracking-wider">Gift Card</p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${effectiveStatus.bg} ${effectiveStatus.text}`}>
                            {effectiveStatus.label}
                          </span>
                        </div>

                        <p className="text-2xl sm:text-3xl font-bold mb-1">{formatPrice(balance, currency)}</p>
                        <p className="text-xs text-purple-200 mb-4">Balance remaining</p>

                        <div className="mt-auto space-y-2 text-sm">
                          {card.code && (
                            <div className="flex justify-between items-center">
                              <span className="text-purple-200">Code</span>
                              <span className="font-mono font-medium tracking-wider">{maskCode(card.code)}</span>
                            </div>
                          )}
                          {card.expiresAt && (
                            <div className="flex justify-between items-center">
                              <span className="text-purple-200">Expires</span>
                              <span>{new Date(card.expiresAt).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between">
                          <span className="text-xs text-purple-200">View details</span>
                          <svg className="w-4 h-4 text-purple-200 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
