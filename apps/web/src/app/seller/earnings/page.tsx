'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import { useCurrency } from '@/contexts/CurrencyContext';
import { getSellerMenuItems } from '@/lib/sellerMenu';

interface SettlementRecord {
  id: string;
  netAmount: number | string;
  totalSales?: number | string;
  platformFee?: number | string;
  currency: string;
  status: string;
  periodStart?: string;
  periodEnd?: string;
  paidAt?: string;
  createdAt: string;
  notes?: string;
}

interface EarningsData {
  totalEarnings: number;
  pendingBalance: number;
  paidOut: number;
  settlements: SettlementRecord[];
}

function toNumber(value: number | string | undefined): number {
  if (value == null) return 0;
  return typeof value === 'string' ? parseFloat(value) : Number(value);
}

export default function SellerEarningsPage() {
  const { formatPrice } = useCurrency();
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const menuItems = getSellerMenuItems(false);

  const fetchEarnings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const settlementRes = await apiClient.getSellerSettlements();
      const settlements: SettlementRecord[] = settlementRes?.data || [];

      const nonFailed = settlements.filter((s) => s.status !== 'FAILED' && s.status !== 'CANCELLED');
      const totalEarnings = nonFailed.reduce((sum, s) => sum + toNumber(s.netAmount), 0);
      const paidOut = nonFailed
        .filter((s) => s.status === 'PAID')
        .reduce((sum, s) => sum + toNumber(s.netAmount), 0);
      const pendingBalance = totalEarnings - paidOut;

      setData({ totalEarnings, pendingBalance, paidOut, settlements });
    } catch (err: any) {
      setError(err?.message || 'Failed to load earnings data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PAID: 'bg-green-900/30 text-green-400',
      PROCESSING: 'bg-blue-900/30 text-blue-400',
      PENDING: 'bg-yellow-900/30 text-yellow-400',
      FAILED: 'bg-red-900/30 text-red-400',
      CANCELLED: 'bg-gray-800 text-gray-400',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-gray-800 text-gray-300'}`}>
        {status}
      </span>
    );
  };

  return (
    <RouteGuard allowedRoles={['SELLER', 'B2C_SELLER', 'WHOLESALER']}>
      <DashboardLayout role="SELLER" menuItems={menuItems} title="Earnings & Payouts" backToHref={{ title: 'Admin Dashboard', href: '/admin/dashboard' }}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-hos-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-hos-text-muted text-lg">{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-hos-bg-secondary border border-hos-border rounded-xl p-6">
                <p className="text-hos-text-muted text-sm">Total Earnings</p>
                <p className="text-2xl font-bold text-hos-text-secondary mt-1">{formatPrice(data.totalEarnings)}</p>
              </div>
              <div className="bg-hos-bg-secondary border border-hos-border rounded-xl p-6">
                <p className="text-hos-text-muted text-sm">Pending Balance</p>
                <p className="text-2xl font-bold text-hos-gold mt-1">{formatPrice(data.pendingBalance)}</p>
              </div>
              <div className="bg-hos-bg-secondary border border-hos-border rounded-xl p-6">
                <p className="text-hos-text-muted text-sm">Total Paid Out</p>
                <p className="text-2xl font-bold text-green-400 mt-1">{formatPrice(data.paidOut)}</p>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-display text-hos-text-secondary mb-4">Settlement History</h2>
              {data.settlements.length === 0 ? (
                <div className="text-center py-12 bg-hos-bg-secondary border border-hos-border rounded-xl">
                  <p className="text-hos-text-muted">No settlements yet. Earnings from completed orders will appear here once processed.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-hos-border text-hos-text-muted text-left">
                        <th className="py-3 px-4 font-medium">Period</th>
                        <th className="py-3 px-4 font-medium">Net Amount</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                        <th className="py-3 px-4 font-medium">Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.settlements.map((settlement) => (
                        <tr key={settlement.id} className={`border-b border-hos-border/50 hover:bg-hos-bg-secondary/50${settlement.status === 'FAILED' ? ' opacity-60' : ''}`}>
                          <td className="py-3 px-4 text-hos-text-muted">
                            {settlement.periodStart && settlement.periodEnd
                              ? `${new Date(settlement.periodStart).toLocaleDateString()} – ${new Date(settlement.periodEnd).toLocaleDateString()}`
                              : new Date(settlement.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-hos-text-secondary font-medium">
                            {formatPrice(toNumber(settlement.netAmount), settlement.currency || 'USD')}
                          </td>
                          <td className="py-3 px-4">{statusBadge(settlement.status)}</td>
                          <td className="py-3 px-4 text-hos-text-muted text-xs">
                            {settlement.paidAt ? new Date(settlement.paidAt).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-hos-bg-secondary border border-hos-border rounded-xl p-6">
              <h3 className="text-hos-text-secondary font-semibold mb-2">How settlements work</h3>
              <ul className="text-hos-text-muted text-sm space-y-1 list-disc list-inside">
                <li>Earnings are accumulated from completed orders after the return window closes.</li>
                <li>Settlements are created on a weekly cycle for each seller.</li>
                <li>Platform fees are deducted before the net amount is paid out.</li>
                <li>Funds are sent to your connected Stripe account when status is PAID.</li>
              </ul>
            </div>
          </div>
        ) : null}
      </DashboardLayout>
    </RouteGuard>
  );
}
