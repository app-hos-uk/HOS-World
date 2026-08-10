'use client';

import { useMemo, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';

type SearchResult = {
  userId: string;
  firstName: string | null;
  lastInitial: string | null;
  maskedEmail: string | null;
  maskedPhone: string | null;
  cardNumber: string | null;
  tierName: string | null;
  currentBalance: number;
};

const INPUT_CLS =
  'mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border';

type SearchMode = 'cardNumber' | 'email' | 'phone' | 'phoneLastFour' | 'name';

export default function StoreLookupPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [mode, setMode] = useState<SearchMode>('cardNumber');
  const [query, setQuery] = useState('');
  const [adminStoreId, setAdminStoreId] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [redeemPoints, setRedeemPoints] = useState('');

  const needsAdminStore = user?.role === 'ADMIN' && !user.storeId;

  const placeholder = useMemo(() => {
    switch (mode) {
      case 'cardNumber':
        return 'Loyalty card number';
      case 'email':
        return 'customer@example.com';
      case 'phone':
        return 'Phone (E.164 or national)';
      case 'phoneLastFour':
        return 'Last 4 digits';
      case 'name':
        return 'First or last name (min 2 chars)';
    }
  }, [mode]);

  const search = async () => {
    const q = query.trim();
    if (!q) {
      toast.error('Enter a search value');
      return;
    }
    if (mode === 'name' && q.length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }
    if (mode === 'phoneLastFour' && !/^\d{4}$/.test(q)) {
      toast.error('Enter exactly 4 digits');
      return;
    }
    if (needsAdminStore && !adminStoreId.trim()) {
      toast.error('Enter a store ID to search as admin');
      return;
    }

    setSearching(true);
    setResults([]);
    try {
      const body: Record<string, string> = { [mode]: q };
      if (needsAdminStore || adminStoreId.trim()) {
        body.storeId = adminStoreId.trim() || String(user?.storeId || '');
      }
      const r = await apiClient.searchStoreCustomers(body);
      setResults((r.data as SearchResult[]) || []);
      if (!r.data || (Array.isArray(r.data) && r.data.length === 0)) {
        toast.info('No members found');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const redeem = async (row: SearchResult) => {
    const points = Number(redeemPoints);
    if (!Number.isInteger(points) || points < 1) {
      toast.error('Enter a valid points amount');
      return;
    }
    if (!row.cardNumber) {
      toast.error('Member has no card number for redemption');
      return;
    }
    const storeId = user?.storeId || adminStoreId.trim();
    if (!storeId) {
      toast.error('Store ID required for redemption');
      return;
    }

    setRedeemingId(row.userId);
    try {
      const idempotencyKey = `web:${storeId}:${row.userId}:${points}:${Date.now()}`;
      await apiClient.redeemLoyaltyPosVoucher({
        points,
        storeId,
        cardNumber: row.cardNumber,
        idempotencyKey,
      });
      toast.success('Voucher redemption submitted');
      setRedeemPoints('');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Redeem failed');
    } finally {
      setRedeemingId(null);
    }
  };

  return (
    <RouteGuard allowedRoles={['STORE_STAFF', 'ADMIN']} showAccessDenied>
      <div className="min-h-screen bg-hos-bg p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-hos-text-secondary">Customer lookup</h1>
            <p className="text-sm text-hos-text-muted mt-1">
              Find loyalty members by card, email, phone, or name. Results are masked for privacy.
            </p>
          </div>

          <div className="space-y-3 rounded-lg border border-hos-border bg-hos-bg-secondary p-4">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['cardNumber', 'Card'],
                  ['email', 'Email'],
                  ['phone', 'Phone'],
                  ['phoneLastFour', 'Last 4'],
                  ['name', 'Name'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    mode === value
                      ? 'bg-violet-700 text-white'
                      : 'bg-hos-bg text-hos-text-secondary border border-hos-border'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {needsAdminStore && (
              <label className="block text-sm">
                <span className="text-hos-text-secondary">Store ID (admin)</span>
                <input
                  className={INPUT_CLS}
                  value={adminStoreId}
                  onChange={(e) => setAdminStoreId(e.target.value)}
                  placeholder="UUID of the store"
                />
              </label>
            )}

            <label className="block text-sm">
              <span className="text-hos-text-secondary">Search</span>
              <input
                className={INPUT_CLS}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void search();
                }}
              />
            </label>

            <button
              type="button"
              disabled={searching}
              onClick={() => void search()}
              className="rounded-md bg-violet-700 px-4 py-2 text-white text-sm font-medium disabled:opacity-50"
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>

          <div className="space-y-3">
            {results.map((row) => (
              <div
                key={row.userId}
                className="rounded-lg border border-hos-border bg-hos-bg-secondary p-4 space-y-2"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-medium text-hos-text-secondary">
                      {[row.firstName, row.lastInitial ? `${row.lastInitial}.` : null]
                        .filter(Boolean)
                        .join(' ') || 'Member'}
                    </p>
                    <p className="text-sm text-hos-text-muted">
                      {row.tierName || 'No tier'} · {row.currentBalance} pts
                    </p>
                  </div>
                  {row.cardNumber && (
                    <p className="text-xs text-hos-text-muted font-mono">{row.cardNumber}</p>
                  )}
                </div>
                <p className="text-sm text-hos-text-muted">
                  {row.maskedEmail || '—'} · {row.maskedPhone || '—'}
                </p>

                <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-hos-border">
                  <label className="block text-sm flex-1 min-w-[8rem]">
                    <span className="text-hos-text-secondary">Redeem points</span>
                    <input
                      className={INPUT_CLS}
                      type="number"
                      min={1}
                      value={redeemPoints}
                      onChange={(e) => setRedeemPoints(e.target.value)}
                      placeholder="e.g. 100"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={redeemingId === row.userId || !row.cardNumber}
                    onClick={() => void redeem(row)}
                    className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {redeemingId === row.userId ? 'Redeeming…' : 'Redeem voucher'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
