'use client';

import { useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import { DEFAULT_CURRENCY } from '@/lib/regionConfig';

type SearchResult = {
  userId: string;
  membershipId: string;
  firstName: string | null;
  lastInitial: string | null;
  maskedEmail: string | null;
  maskedPhone: string | null;
  /** Only returned for exact card / email / phone lookups; required to redeem. */
  cardNumber: string | null;
  maskedCardNumber: string | null;
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
  const [terminalId, setTerminalId] = useState('');
  const [otpSentFor, setOtpSentFor] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [lastVoucher, setLastVoucher] = useState<{
    cardNumber: string;
    amount: number;
    currency: string;
    qrPayload?: string;
  } | null>(null);

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

  const sendOtp = async (row: SearchResult) => {
    const storeId = user?.storeId || adminStoreId.trim();
    if (!storeId) {
      toast.error('Store ID required');
      return;
    }
    try {
      await apiClient.sendLoyaltyRedeemOtp({ membershipId: row.membershipId, storeId });
      setOtpSentFor(row.userId);
      toast.success('Verification code sent to customer email');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not send OTP');
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
    if (!terminalId.trim()) {
      toast.error('Enter till terminal ID');
      return;
    }
    if (otpSentFor !== row.userId && !otpCode.trim()) {
      toast.error('Send and enter customer OTP first');
      return;
    }

    setRedeemingId(row.userId);
    try {
      const idempotencyKey = `${terminalId.trim()}:${storeId}:${row.userId}:${points}:${Math.floor(Date.now() / 300000)}`;
      const r = await apiClient.redeemLoyaltyPosVoucher({
        points,
        storeId,
        membershipId: row.membershipId,
        cardNumber: row.cardNumber,
        idempotencyKey,
        terminalId: terminalId.trim(),
        otpCode: otpCode.trim() || undefined,
      });
      const data = r.data as {
        cardNumber?: string;
        amount?: number;
        currency?: string;
        qrPayload?: string;
      };
      if (data?.cardNumber) {
        setLastVoucher({
          cardNumber: data.cardNumber,
          amount: data.amount ?? 0,
          currency: data.currency ?? DEFAULT_CURRENCY,
          qrPayload: data.qrPayload,
        });
      }
      toast.success('Voucher issued — show customer the card number');
      setRedeemPoints('');
      setOtpCode('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Redeem failed';
      const isPermission = /permission|not authorized|403/i.test(msg);
      if (isPermission) {
        toast.error(
          'The Lightspeed POS user does not have gift card permissions. Please contact your admin to update the Lightspeed user role.',
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setRedeemingId(null);
    }
  };

  return (
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
          <span className="text-hos-text-secondary">Till terminal ID</span>
          <input
            className={INPUT_CLS}
            value={terminalId}
            onChange={(e) => setTerminalId(e.target.value)}
            placeholder="e.g. TILL-01"
          />
        </label>

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
              {(row.cardNumber || row.maskedCardNumber) && (
                <p className="text-xs text-hos-text-muted font-mono">
                  {row.cardNumber || row.maskedCardNumber}
                </p>
              )}
            </div>
            <p className="text-sm text-hos-text-muted">
              {row.maskedEmail || '—'} · {row.maskedPhone || '—'}
            </p>

            {row.cardNumber ? (
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
                  onClick={() => void sendOtp(row)}
                  className="rounded-md border border-hos-border px-3 py-2 text-sm"
                >
                  Send OTP
                </button>
                <label className="block text-sm flex-1 min-w-[6rem]">
                  <span className="text-hos-text-secondary">Customer OTP</span>
                  <input
                    className={INPUT_CLS}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="6 digits"
                    maxLength={6}
                  />
                </label>
                <button
                  type="button"
                  disabled={redeemingId === row.userId}
                  onClick={() => void redeem(row)}
                  className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  {redeemingId === row.userId ? 'Redeeming…' : 'Redeem voucher'}
                </button>
              </div>
            ) : (
              <p className="pt-2 border-t border-hos-border text-xs text-hos-text-muted">
                Confirm the member by card, email or full phone number to redeem.
              </p>
            )}
          </div>
        ))}
      </div>

      {lastVoucher && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2">
          <p className="text-sm font-medium text-emerald-300">Voucher ready for till</p>
          <p className="font-mono text-xl tracking-widest">{lastVoucher.cardNumber}</p>
          <p className="text-sm text-hos-text-secondary">
            {lastVoucher.currency} {lastVoucher.amount.toFixed(2)}
          </p>
          {lastVoucher.qrPayload && (
            <p className="text-xs text-hos-text-muted break-all">{lastVoucher.qrPayload}</p>
          )}
        </div>
      )}
    </div>
  );
}
