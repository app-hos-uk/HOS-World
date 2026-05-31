'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { getSellerMenuItems } from '@/lib/sellerMenu';

interface PayoutRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  scheduledDate?: string;
  processedDate?: string;
  createdAt: string;
  reference?: string;
}

interface EarningsData {
  totalEarnings: number;
  pendingBalance: number;
  paidOut: number;
  nextPayout?: string;
  payouts: PayoutRecord[];
}

export default function SellerEarningsPage() {
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const menuItems = getSellerMenuItems(false);

  const fetchEarnings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const sellerRes = await apiClient.getSellerProfile();
      const sellerId = sellerRes?.data?.id;
      if (!sellerId) {
        setError('Seller profile not found. Complete onboarding first.');
        return;
      }

      const payoutRes = await apiClient.getSellerPayoutHistory(sellerId);
      const payouts: PayoutRecord[] = payoutRes?.data || [];

      const nonFailed = payouts.filter((p: PayoutRecord) => p.status !== 'FAILED');
      const totalEarnings = nonFailed.reduce((sum: number, p: PayoutRecord) => sum + (p.amount || 0), 0);
      const paidOut = nonFailed
        .filter((p: PayoutRecord) => p.status === 'COMPLETED' || p.status === 'PAID')
        .reduce((sum: number, p: PayoutRecord) => sum + (p.amount || 0), 0);
      const pendingBalance = totalEarnings - paidOut;

      setData({ totalEarnings, pendingBalance, paidOut, payouts });
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
      COMPLETED: 'bg-green-900/30 text-green-400',
      PAID: 'bg-green-900/30 text-green-400',
      PENDING: 'bg-yellow-900/30 text-yellow-400',
      SCHEDULED: 'bg-blue-900/30 text-blue-400',
      FAILED: 'bg-red-900/30 text-red-400',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-gray-800 text-gray-300'}`}>
        {status}
      </span>
    );
  };

  return (
    <RouteGuard allowedRoles={['SELLER', 'B2C_SELLER', 'WHOLESALER']}>
      <DashboardLayout role="SELLER" menuItems={menuItems} title="Earnings & Payouts">
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
            {/* Summary Cards */}
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

            {/* Payout History */}
            <div>
              <h2 className="text-xl font-display text-hos-text-secondary mb-4">Payout History</h2>
              {data.payouts.length === 0 ? (
                <div className="text-center py-12 bg-hos-bg-secondary border border-hos-border rounded-xl">
                  <p className="text-hos-text-muted">No payouts yet. Earnings from orders will appear here once processed.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-hos-border text-hos-text-muted text-left">
                        <th className="py-3 px-4 font-medium">Date</th>
                        <th className="py-3 px-4 font-medium">Amount</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                        <th className="py-3 px-4 font-medium">Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payouts.map((payout) => (
                        <tr key={payout.id} className="border-b border-hos-border/50 hover:bg-hos-bg-secondary/50">
                          <td className="py-3 px-4 text-hos-text-muted">
                            {new Date(payout.processedDate || payout.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-hos-text-secondary font-medium">
                            {formatPrice(payout.amount)}
                          </td>
                          <td className="py-3 px-4">{statusBadge(payout.status)}</td>
                          <td className="py-3 px-4 text-hos-text-muted text-xs font-mono">
                            {payout.reference || payout.id.slice(0, 8)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-hos-bg-secondary border border-hos-border rounded-xl p-6">
              <h3 className="text-hos-text-secondary font-semibold mb-2">How payouts work</h3>
              <ul className="text-hos-text-muted text-sm space-y-1 list-disc list-inside">
                <li>Earnings are accumulated from completed orders after the return window closes.</li>
                <li>Payouts are scheduled on a weekly cycle (every Friday).</li>
                <li>Minimum payout threshold: $25.00 USD.</li>
                <li>Funds are sent to your connected Stripe account.</li>
              </ul>
            </div>
          </div>
        ) : null}
      </DashboardLayout>
    </RouteGuard>
  );
}
