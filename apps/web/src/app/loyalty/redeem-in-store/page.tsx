'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';

type VoucherResult = {
  voucherId: string;
  cardNumber: string;
  amount: number;
  currency: string;
  status: string;
  points: number;
  ttlExpiresAt?: string | null;
  qrPayload?: string;
};

export default function RedeemInStorePage() {
  const toast = useToast();
  const { user } = useAuth();
  const [membership, setMembership] = useState<{ currentBalance?: number } | null>(null);
  const [storeId, setStoreId] = useState('');
  const [points, setPoints] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VoucherResult | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    apiClient.getLoyaltyMembership().then((r) => setMembership((r.data as any) ?? null)).catch(() => undefined);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const countdown = useMemo(() => {
    if (!result?.ttlExpiresAt) return null;
    const ms = new Date(result.ttlExpiresAt).getTime() - now;
    if (ms <= 0) return 'Expired';
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${String(s).padStart(2, '0')}`;
  }, [result?.ttlExpiresAt, now]);

  const redeem = async () => {
    const pts = Number(points);
    if (!storeId.trim()) {
      toast.error('Enter the store ID shown at the till');
      return;
    }
    if (!Number.isInteger(pts) || pts < 1) {
      toast.error('Enter a valid points amount');
      return;
    }
    setLoading(true);
    try {
      const r = await apiClient.redeemLoyaltyInStore({
        points: pts,
        storeId: storeId.trim(),
        idempotencyKey: `web-customer:${user?.id}:${storeId.trim()}:${pts}:${Math.floor(Date.now() / 300000)}`,
      });
      setResult(r.data as VoucherResult);
      toast.success('Voucher ready — show this code at the till');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Redemption failed');
    } finally {
      setLoading(false);
    }
  };

  const cancel = async () => {
    if (!result?.voucherId) return;
    try {
      await apiClient.cancelPosVoucher(result.voucherId, 'Customer cancelled');
      toast.success('Voucher cancelled and points restored');
      setResult(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Cancel failed');
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <div>
        <Link href="/loyalty" className="text-sm text-violet-400 hover:underline">
          ← Back to loyalty
        </Link>
        <h1 className="text-2xl font-semibold mt-2 text-hos-text">Redeem in store</h1>
        <p className="text-sm text-hos-text-muted mt-1">
          Burn points here, then show the QR or card number at the till within the countdown window.
        </p>
      </div>

      {membership && (
        <p className="text-hos-text-secondary">
          Balance: <strong>{membership.currentBalance ?? 0}</strong> points
        </p>
      )}

      {!result ? (
        <div className="space-y-4 rounded-lg border border-hos-border p-4 bg-hos-bg-secondary">
          <label className="block text-sm text-hos-text-secondary">
            Store ID
            <input
              className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg text-hos-text border-hos-border"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              placeholder="Ask staff for store ID"
            />
          </label>
          <label className="block text-sm text-hos-text-secondary">
            Points to redeem
            <input
              type="number"
              min={1}
              className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg text-hos-text border-hos-border"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={redeem}
            className="w-full py-2 rounded bg-violet-600 text-white font-medium disabled:opacity-50"
          >
            {loading ? 'Issuing…' : 'Create till voucher'}
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-hos-border p-6 bg-hos-bg-secondary text-center space-y-4">
          <p className="text-sm uppercase tracking-wide text-hos-text-muted">Gift card number</p>
          <p className="text-2xl font-mono font-bold tracking-widest text-hos-gold break-all">
            {result.cardNumber}
          </p>
          <p className="text-hos-text-secondary">
            {result.currency} {result.amount.toFixed(2)} · {result.points} points burned
          </p>
          {countdown && (
            <p className="text-lg font-medium text-amber-400">Expires in {countdown}</p>
          )}
          {result.qrPayload && (
            <p className="text-xs text-hos-text-muted break-all">QR payload: {result.qrPayload}</p>
          )}
          <button
            type="button"
            onClick={cancel}
            className="text-sm text-red-400 hover:underline"
          >
            Cancel voucher and restore points
          </button>
        </div>
      )}
    </div>
  );
}
