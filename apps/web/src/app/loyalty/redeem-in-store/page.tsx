'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import { CustomerQr } from '@/components/CustomerQr';

type VoucherResult = {
  voucherId: string;
  cardNumber: string;
  promoCode?: string;
  type?: string;
  amount: number;
  currency: string;
  status: string;
  points: number;
  ttlExpiresAt?: string | null;
  qrPayload?: string;
};

type RedemptionOption = {
  id: string;
  name: string;
  description?: string;
  pointsCost: number;
  value?: number | null;
  type?: string;
};

export default function RedeemInStorePage() {
  const toast = useToast();
  const { user } = useAuth();
  const [membership, setMembership] = useState<{ currentBalance?: number } | null>(null);
  const [options, setOptions] = useState<RedemptionOption[]>([]);
  const [optionId, setOptionId] = useState('');
  const [storeCode, setStoreCode] = useState('');
  const [purchaseSubtotal, setPurchaseSubtotal] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VoucherResult | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    apiClient.getLoyaltyMembership().then((r) => setMembership((r.data as any) ?? null)).catch(() => undefined);
    apiClient
      .getRedemptionOptions({ channel: 'HOS_OUTLET_POS' })
      .then((r) => {
        const list = Array.isArray(r.data) ? (r.data as RedemptionOption[]) : [];
        setOptions(list);
        if (list.length === 1) setOptionId(list[0].id);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const selected = options.find((o) => o.id === optionId) ?? null;
  const balance = membership?.currentBalance ?? 0;

  const countdown = useMemo(() => {
    if (!result?.ttlExpiresAt) return null;
    const ms = new Date(result.ttlExpiresAt).getTime() - now;
    if (ms <= 0) return 'Expired';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1_000);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  }, [result?.ttlExpiresAt, now]);

  const redeem = async () => {
    const code = storeCode.trim().toUpperCase();
    if (!code) {
      toast.error('Enter the store code shown at the till');
      return;
    }
    if (!selected) {
      toast.error('Select a reward option');
      return;
    }
    if (balance < selected.pointsCost) {
      toast.error('Insufficient points for this reward');
      return;
    }
    const merch = purchaseSubtotal.trim() === '' ? undefined : Number(purchaseSubtotal);
    if (merch != null && (!Number.isFinite(merch) || merch < 0)) {
      toast.error('Enter a valid till merchandise total');
      return;
    }
    setLoading(true);
    try {
      const r = await apiClient.redeemLoyaltyInStore({
        points: selected.pointsCost,
        optionId: selected.id,
        storeCode: code,
        purchaseSubtotal: merch,
        idempotencyKey: `web-customer:${user?.id}:${code}:${selected.id}:${Math.floor(Date.now() / 300000)}`,
      });
      setResult(r.data as VoucherResult);
      toast.success('Voucher ready — show this code at the till');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Redemption failed');
    } finally {
      setLoading(false);
    }
    try {
      const refreshed = await apiClient.getLoyaltyMembership();
      setMembership((refreshed.data as any) ?? null);
    } catch { /* balance refresh is best-effort */ }
  };

  const cancel = async () => {
    if (!result?.voucherId) return;
    try {
      await apiClient.cancelPosVoucher(result.voucherId, 'Customer cancelled');
      toast.success('Voucher cancelled and points restored');
      setResult(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Cancel failed');
      return;
    }
    try {
      const refreshed = await apiClient.getLoyaltyMembership();
      setMembership((refreshed.data as any) ?? null);
    } catch { /* balance refresh is best-effort */ }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <div>
        <Link href="/loyalty" className="text-sm text-violet-400 hover:underline">
          ← Back to loyalty
        </Link>
        <h1 className="text-2xl font-semibold mt-2 text-hos-text">Redeem in store</h1>
        <p className="text-sm text-hos-text-muted mt-1">
          Choose a listed reward, then show the QR or code at the till within the countdown window.
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
            Store code
            <input
              className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg text-hos-text border-hos-border uppercase tracking-wider"
              value={storeCode}
              onChange={(e) => setStoreCode(e.target.value)}
              placeholder="e.g. HOS-LONDON-01"
              maxLength={30}
            />
            <span className="text-xs text-hos-text-muted mt-1 block">
              Ask staff for the store code displayed at the till
            </span>
          </label>
          <label className="block text-sm text-hos-text-secondary">
            Reward
            <select
              className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg text-hos-text border-hos-border"
              value={optionId}
              onChange={(e) => setOptionId(e.target.value)}
            >
              <option value="">Select a reward</option>
              {options.map((opt) => (
                <option key={opt.id} value={opt.id} disabled={balance < opt.pointsCost}>
                  {opt.name} — {opt.pointsCost.toLocaleString()} pts
                  {opt.value != null ? ` · ${Number(opt.value).toFixed(2)} off` : ''}
                </option>
              ))}
            </select>
            {options.length === 0 && (
              <span className="text-xs text-hos-text-muted mt-1 block">
                No in-store rewards are available right now. Ask staff or try again later.
              </span>
            )}
          </label>
          <label className="block text-sm text-hos-text-secondary">
            Till merchandise total
            <input
              type="number"
              min={0}
              step="0.01"
              className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg text-hos-text border-hos-border"
              value={purchaseSubtotal}
              onChange={(e) => setPurchaseSubtotal(e.target.value)}
              placeholder="Current sale total, gift cards excluded"
            />
            <span className="text-xs text-hos-text-muted mt-1 block">
              Required when a redemption cap is set, and for Welcome Reward. Ask staff for the till subtotal.
            </span>
          </label>
          <button
            type="button"
            disabled={loading || !optionId}
            onClick={redeem}
            className="w-full py-2 rounded bg-violet-600 text-white font-medium disabled:opacity-50"
          >
            {loading ? 'Issuing…' : selected ? `Redeem ${selected.pointsCost.toLocaleString()} points` : 'Create till voucher'}
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-hos-border p-6 bg-hos-bg-secondary text-center space-y-4">
          <p className="text-sm uppercase tracking-wide text-hos-text-muted">
            {result.type === 'PROMO_CODE' ? 'Promo code for the till' : 'Gift card number'}
          </p>
          <p className="text-2xl font-mono font-bold tracking-widest text-hos-gold break-all">
            {result.promoCode || result.cardNumber}
          </p>
          <p className="text-hos-text-secondary">
            {result.currency} {result.amount.toFixed(2)} · {result.points} points burned
          </p>
          {result.type === 'PROMO_CODE' && (
            <p className="text-xs text-hos-text-muted">
              Staff should enter this as a discount code on the sale, not as a payment.
            </p>
          )}
          {countdown && (
            <p className="text-lg font-medium text-amber-400">Expires in {countdown}</p>
          )}
          {result.qrPayload && (
            <div className="flex flex-col items-center pt-2">
              <CustomerQr
                value={result.qrPayload}
                size={160}
                alt={result.type === 'PROMO_CODE' ? 'Promo code QR' : 'Gift card voucher QR'}
                showValue={false}
                className="flex flex-col items-center"
              />
            </div>
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
