'use client';

import { useCallback, useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminLoyaltyLiabilityPage() {
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.adminGetLoyaltyLiabilityReport({
        from: from || undefined,
        to: to || undefined,
      });
      setData(res?.data ?? null);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [from, to, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0);

  return (
    <RouteGuard allowedRoles={['ADMIN', 'FINANCE']} showAccessDenied>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-hos-text-primary">Loyalty & GC Liability</h1>
        <p className="text-hos-text-secondary mt-1 text-sm font-ui">
          HOS system-of-record report. Xero export is optional and not required for these figures.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="px-3 py-2 bg-hos-bg border border-hos-border-input rounded text-hos-text-primary text-sm"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="px-3 py-2 bg-hos-bg border border-hos-border-input rounded text-hos-text-primary text-sm"
        />
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded font-semibold text-sm"
        >
          Refresh
        </button>
      </div>

      {loading || !data ? (
        <p className="text-hos-text-secondary">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            ['Points outstanding', `${data.pointsOutstanding} pts`],
            ['Points liability value', fmt(data.pointsOutstandingValue)],
            ['Period earn', `${data.periodEarnPoints} pts`],
            ['Period burn', `${data.periodBurnPoints} pts`],
            ['Period breakage value', fmt(data.periodBreakageValue)],
            ['HOS GC liability', fmt(data.hosGiftCardLiability)],
            ['Period GC issued', fmt(data.periodGcIssued)],
            ['Period GC redeemed', fmt(data.periodGcRedeemed)],
            ['Period GC refunded', fmt(data.periodGcRefunded)],
            ['Period POS vouchers issued', fmt(data.periodPosVouchersIssued)],
            ['Redeem £/pt', String(data.redeemValuePerPoint)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="p-4 rounded-lg border border-hos-border bg-hos-bg-secondary"
            >
              <p className="text-xs text-hos-text-secondary font-ui uppercase tracking-wide">
                {label}
              </p>
              <p className="text-xl text-hos-text-primary mt-1 font-ui font-semibold">{value}</p>
            </div>
          ))}
        </div>
      )}
    </RouteGuard>
  );
}
