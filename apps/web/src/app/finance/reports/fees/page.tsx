'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

export default function FinanceFeesPage() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(getDefaultDateRange);

  const menuItems = [
    { title: 'Dashboard', href: '/finance/dashboard', icon: '📊' },
    { title: 'Pricing Approvals', href: '/finance/pricing', icon: '💰' },
    { title: 'Payouts', href: '/finance/payouts', icon: '💸' },
    { title: 'Revenue Reports', href: '/finance/reports/revenue', icon: '📊' },
    { title: 'Fee Reports', href: '/finance/reports/fees', icon: '📋' },
  ];

  const fetchReport = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) {
          setLoading(true);
          setError(null);
        }
        const response = await apiClient.getPlatformFeesReport(
          dateRange.startDate,
          dateRange.endDate
        );
        if (response?.data) {
          setReportData(response.data);
        } else if (showLoading) {
          setError('Failed to load fees report');
        }
      } catch (err: any) {
        console.error('Error fetching fees report:', err);
        if (showLoading) {
          setError(err.message || 'Failed to load fees report');
          toast.error(err.message || 'Failed to load fees report');
        }
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [dateRange.startDate, dateRange.endDate]
  );

  useEffect(() => {
    fetchReport(true);
  }, [fetchReport]);

  const periods: any[] = reportData?.periods || reportData?.rows || [];
  const totalFees =
    reportData?.totalFees ??
    periods.reduce((sum: number, p: any) => sum + (p.platformFees || p.fees || 0), 0);
  const totalTransactions =
    reportData?.totalTransactions ??
    periods.reduce((sum: number, p: any) => sum + (p.transactionCount || p.transactions || 0), 0);
  const avgFeeRate =
    reportData?.averageFeeRate ?? (totalTransactions > 0 ? totalFees / totalTransactions : 0);

  return (
    <RouteGuard allowedRoles={['FINANCE', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout
        role="FINANCE"
        menuItems={menuItems}
        title="Finance"
        backToHref={{ title: 'Admin Dashboard', href: '/admin/dashboard' }}
      >
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Platform Fees</h1>
          <p className="text-hos-text-secondary mt-2">View platform fee details and reports</p>
        </div>

        {/* Date range filter */}
        <div className="bg-hos-bg-secondary border rounded-lg p-4 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-hos-text-secondary mb-1">Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, startDate: e.target.value }))
                }
                className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-transparent"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-hos-text-secondary mb-1">End Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, endDate: e.target.value }))
                }
                className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => fetchReport(true)}
              disabled={loading}
              className="px-6 py-2 text-sm font-medium text-white bg-hos-gold rounded-lg hover:bg-hos-gold-hover disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Apply'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <p className="font-semibold">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-hos-bg-secondary border rounded-lg p-6 animate-pulse">
                  <div className="h-3 bg-hos-bg-tertiary rounded w-1/2 mb-3"></div>
                  <div className="h-8 bg-hos-bg-tertiary rounded w-2/3"></div>
                </div>
              ))}
            </div>
            <div className="bg-hos-bg-secondary border rounded-lg p-6 animate-pulse">
              <div className="h-4 bg-hos-bg-tertiary rounded w-1/4 mb-4"></div>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-3 bg-hos-bg-tertiary rounded w-full mb-3"></div>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-hos-bg-secondary border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-hos-text-secondary mb-1">Total Fees</h3>
                    <p className="text-3xl font-bold text-hos-gold">
                      ${totalFees.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="text-4xl">💰</div>
                </div>
              </div>
              <div className="bg-hos-bg-secondary border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-hos-text-secondary mb-1">Transaction Count</h3>
                    <p className="text-3xl font-bold text-green-600">
                      {totalTransactions.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-4xl">🔄</div>
                </div>
              </div>
              <div className="bg-hos-bg-secondary border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-hos-text-secondary mb-1">Average Fee Rate</h3>
                    <p className="text-3xl font-bold text-hos-gold">
                      ${avgFeeRate.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="text-4xl">📋</div>
                </div>
              </div>
            </div>

            {/* Fees data table */}
            {periods.length === 0 ? (
              <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-12 text-center">
                <div className="text-4xl mb-4">📋</div>
                <p className="text-hos-text-muted text-lg">No fee data for this period</p>
                <p className="text-sm text-hos-text-muted mt-2">
                  Try adjusting the date range
                </p>
              </div>
            ) : (
              <div className="bg-hos-bg-secondary border rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-hos-bg-secondary border-b">
                        <th className="text-left px-6 py-3 text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                          Period
                        </th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                          Platform Fees
                        </th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                          Transaction Count
                        </th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                          Average Fee
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hos-border">
                      {periods.map((row: any, idx: number) => {
                        const fees = row.platformFees || row.fees || 0;
                        const txCount = row.transactionCount || row.transactions || 0;
                        const avgFee = row.averageFee ?? (txCount > 0 ? fees / txCount : 0);
                        return (
                          <tr key={row.period || idx} className="hover:bg-hos-bg-tertiary transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                              {row.period || row.date || `Period ${idx + 1}`}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                              ${fees.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                              {txCount.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                              ${avgFee.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </DashboardLayout>
    </RouteGuard>
  );
}
