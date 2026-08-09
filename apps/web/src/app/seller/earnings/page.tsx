'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AppShellLayout } from '@/components/AppShellLayout';
import { apiClient } from '@/lib/api';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { getSellerMenuItems } from '@/lib/sellerMenu';
import { useDateTime } from '@/hooks/useDateTime';
import { DEFAULT_CURRENCY } from '@/lib/regionConfig';

interface SettlementOrderRow {
  id: string;
  orderNumber?: string;
  total?: number | string;
  createdAt?: string;
  status?: string;
  items?: Array<{ quantity?: number; product?: { name?: string } }>;
}

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
  orderSettlements?: Array<{
    order?: SettlementOrderRow;
    amount?: number | string;
    platformFee?: number | string;
  }>;
}

interface EarningsData {
  totalEarnings: number;
  pendingBalance: number;
  paidOut: number;
  settlements: SettlementRecord[];
}

interface PayoutAccountInfo {
  connected: boolean;
  accountIdMasked?: string | null;
  payoutsEnabled?: boolean;
}

function toNumber(value: number | string | undefined): number {
  if (value == null) return 0;
  return typeof value === 'string' ? parseFloat(value) : Number(value);
}

export default function SellerEarningsPage() {
  const { formatDate } = useDateTime();
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const isWholesaler = user?.role === 'WHOLESALER';
  const [data, setData] = useState<EarningsData | null>(null);
  const [payoutAccount, setPayoutAccount] = useState<PayoutAccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailSettlement, setDetailSettlement] = useState<SettlementRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const menuItems = getSellerMenuItems(isWholesaler);

  const fetchEarnings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [settlementRes, profileRes] = await Promise.allSettled([
        apiClient.getSellerSettlements(),
        apiClient.getSellerProfile(),
      ]);

      const settlements: SettlementRecord[] =
        settlementRes.status === 'fulfilled' ? settlementRes.value?.data || [] : [];

      const nonFailed = settlements.filter((s) => s.status !== 'FAILED' && s.status !== 'CANCELLED');
      const totalEarnings = nonFailed.reduce((sum, s) => sum + toNumber(s.netAmount), 0);
      const paidOut = nonFailed
        .filter((s) => s.status === 'PAID')
        .reduce((sum, s) => sum + toNumber(s.netAmount), 0);
      const pendingBalance = totalEarnings - paidOut;

      setData({ totalEarnings, pendingBalance, paidOut, settlements });

      if (profileRes.status === 'fulfilled' && profileRes.value?.data) {
        const profile = profileRes.value.data;
        const accountId = profile.stripeConnectAccountId as string | undefined;
        setPayoutAccount({
          connected: Boolean(profile.stripeConnectOnboarded || accountId),
          accountIdMasked: accountId ? `•••• ${accountId.slice(-4)}` : null,
          payoutsEnabled: Boolean(profile.stripeConnectPayoutsEnabled),
        });
      } else {
        setPayoutAccount(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load earnings data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const openSettlementDetails = async (settlement: SettlementRecord) => {
    setDetailLoading(true);
    setDetailSettlement(settlement);
    try {
      const res = await apiClient.getSettlement(settlement.id);
      if (res?.data) {
        setDetailSettlement(res.data);
      }
    } catch {
      // Fall back to list-row data already set
    } finally {
      setDetailLoading(false);
    }
  };

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
      <AppShellLayout role={isWholesaler ? 'WHOLESALER' : 'SELLER'} menuItems={menuItems} title="Earnings & Payouts" backToAdmin={{ title: 'Admin Dashboard', href: '/admin/dashboard' }} breadcrumbs="inline">
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

            <div className="bg-hos-bg-secondary border border-hos-border rounded-xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-hos-text-secondary font-semibold mb-1">Payout Account</h3>
                  {payoutAccount?.connected ? (
                    <p className="text-sm text-hos-text-secondary">
                      Stripe {payoutAccount.accountIdMasked || 'connected'}
                      {' · '}
                      <span className={payoutAccount.payoutsEnabled ? 'text-green-400' : 'text-yellow-400'}>
                        {payoutAccount.payoutsEnabled ? 'Payouts enabled' : 'Connected — payouts pending'}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-hos-text-muted">
                      No Stripe payout account connected yet.
                    </p>
                  )}
                </div>
                <Link
                  href={isWholesaler ? '/wholesaler/onboarding' : '/seller/onboarding'}
                  className="text-sm text-hos-gold hover:text-hos-gold-hover font-medium"
                >
                  Manage payout account →
                </Link>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-display text-hos-text-secondary mb-4">Settlement History</h2>
              {data.settlements.length === 0 ? (
                <div className="text-center py-12 bg-hos-bg-secondary border border-hos-border rounded-xl">
                  <p className="text-hos-text-muted">No settlements yet. Earnings from completed orders will appear here once processed.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-hos-border rounded-xl">
                  <table className="w-full min-w-[720px] text-sm table-fixed">
                    <colgroup>
                      <col className="w-[32%]" />
                      <col className="w-[18%]" />
                      <col className="w-[16%]" />
                      <col className="w-[18%]" />
                      <col className="w-[16%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-hos-border text-hos-text-muted text-left bg-hos-bg-secondary">
                        <th className="py-3 px-4 font-medium">Period</th>
                        <th className="tabular-nums text-right py-3 px-4 font-medium">Net Amount</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                        <th className="py-3 px-4 font-medium">Paid Date</th>
                        <th className="py-3 px-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.settlements.map((settlement) => (
                        <tr
                          key={settlement.id}
                          className={`border-b border-hos-border/50 hover:bg-hos-bg-secondary/50${
                            settlement.status === 'FAILED' ? ' opacity-60' : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-hos-text-secondary">
                            {settlement.periodStart && settlement.periodEnd
                              ? `${formatDate(settlement.periodStart)} – ${formatDate(settlement.periodEnd)}`
                              : formatDate(settlement.createdAt)}
                          </td>
                          <td className="tabular-nums text-right py-3 px-4 text-hos-text-secondary font-medium">
                            {formatPrice(toNumber(settlement.netAmount), settlement.currency || DEFAULT_CURRENCY)}
                          </td>
                          <td className="py-3 px-4">{statusBadge(settlement.status)}</td>
                          <td className="py-3 px-4 text-hos-text-muted text-xs">
                            {settlement.paidAt ? formatDate(settlement.paidAt) : '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => openSettlementDetails(settlement)}
                              className="text-hos-gold hover:text-hos-gold-hover text-sm font-medium"
                            >
                              View Details
                            </button>
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

        {detailSettlement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-hos-bg-secondary border border-hos-border rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-hos-text-secondary">Settlement Details</h3>
                  <p className="text-sm text-hos-text-muted mt-1">
                    {detailSettlement.periodStart && detailSettlement.periodEnd
                      ? `${formatDate(detailSettlement.periodStart)} – ${formatDate(detailSettlement.periodEnd)}`
                      : formatDate(detailSettlement.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailSettlement(null)}
                  className="text-hos-text-muted hover:text-hos-text-secondary"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 text-sm">
                <div className="rounded-lg border border-hos-border p-3">
                  <p className="text-hos-text-muted">Net Amount</p>
                  <p className="font-semibold text-hos-text-secondary">
                    {formatPrice(toNumber(detailSettlement.netAmount), detailSettlement.currency || DEFAULT_CURRENCY)}
                  </p>
                </div>
                <div className="rounded-lg border border-hos-border p-3">
                  <p className="text-hos-text-muted">Platform Fee</p>
                  <p className="font-semibold text-hos-text-secondary">
                    {formatPrice(toNumber(detailSettlement.platformFee), detailSettlement.currency || DEFAULT_CURRENCY)}
                  </p>
                </div>
                <div className="rounded-lg border border-hos-border p-3">
                  <p className="text-hos-text-muted">Status</p>
                  <div className="mt-1">{statusBadge(detailSettlement.status)}</div>
                </div>
              </div>

              {detailLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-hos-gold border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (detailSettlement.orderSettlements || []).length === 0 ? (
                <p className="text-sm text-hos-text-muted py-4">No order-level breakdown available for this settlement.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-hos-border text-hos-text-muted text-left">
                        <th className="py-2 px-2 font-medium">Order</th>
                        <th className="py-2 px-2 font-medium">Product</th>
                        <th className="tabular-nums text-right py-2 px-2 font-medium">Order Amount</th>
                        <th className="tabular-nums text-right py-2 px-2 font-medium">Fee</th>
                        <th className="tabular-nums text-right py-2 px-2 font-medium">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailSettlement.orderSettlements || []).map((row, idx) => {
                        const order = row.order;
                        const orderAmount = toNumber(row.amount ?? order?.total);
                        const fee = toNumber(row.platformFee);
                        const net = orderAmount - fee;
                        const productLabel =
                          (order?.items || [])
                            .map((item) => item.product?.name)
                            .filter(Boolean)
                            .join(', ') || '—';
                        return (
                          <tr key={order?.id || idx} className="border-b border-hos-border/40">
                            <td className="py-2 px-2 text-hos-text-secondary">
                              {order?.orderNumber || order?.id?.slice(0, 8) || '—'}
                            </td>
                            <td className="py-2 px-2 text-hos-text-muted truncate max-w-[12rem]" title={productLabel}>
                              {productLabel}
                            </td>
                            <td className="tabular-nums text-right py-2 px-2 text-hos-text-secondary">
                              {formatPrice(orderAmount, detailSettlement.currency || DEFAULT_CURRENCY)}
                            </td>
                            <td className="tabular-nums text-right py-2 px-2 text-hos-text-muted">
                              {formatPrice(fee, detailSettlement.currency || DEFAULT_CURRENCY)}
                            </td>
                            <td className="tabular-nums text-right py-2 px-2 text-hos-text-secondary font-medium">
                              {formatPrice(net, detailSettlement.currency || DEFAULT_CURRENCY)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </AppShellLayout>
    </RouteGuard>
  );
}
