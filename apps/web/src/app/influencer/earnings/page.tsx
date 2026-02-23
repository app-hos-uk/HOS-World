'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';

interface Commission {
  id: string;
  orderId: string;
  orderTotal: number;
  rateSource: string;
  rateApplied: number;
  amount: number;
  status: string;
  currency: string;
  createdAt: string;
}

interface EarningsSummary {
  pending: number;
  approved: number;
  paid: number;
  cancelled: number;
  total: number;
  available: number;
}

export default function InfluencerEarningsPage() {
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [commissionsRes, earningsRes] = await Promise.all([
        apiClient.getMyCommissions({ status: statusFilter || undefined, limit: 100 }),
        apiClient.getMyEarnings(),
      ]);
      setCommissions(commissionsRes.data || []);
      setEarnings(earningsRes.data);
    } catch (err: any) {
      console.error('Error fetching earnings:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency = 'GBP') => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      PAID: 'bg-blue-100 text-blue-800',
      CANCELLED: 'bg-red-100 text-red-800',
      ADJUSTED: 'bg-purple-100 text-purple-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>
          <p className="text-gray-600 mt-1">
            Track your commission earnings and payment status
          </p>
        </div>

        {/* Earnings Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <p className="text-gray-500 text-sm">Pending</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">
              {formatCurrency(earnings?.pending || 0)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Awaiting order completion</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <p className="text-gray-500 text-sm">Available</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {formatCurrency(earnings?.available || 0)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Ready for payout</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <p className="text-gray-500 text-sm">Paid</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {formatCurrency(earnings?.paid || 0)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Total received</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <p className="text-gray-500 text-sm">Total Earned</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(earnings?.total || 0)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Lifetime earnings</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Commission History */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Commission History</h2>
          </div>
          
          {commissions.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500">No commissions yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {commissions.map((commission) => (
                    <tr key={commission.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(commission.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {commission.orderId.slice(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(commission.orderTotal, commission.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          {(commission.rateApplied * 100).toFixed(0)}%
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            commission.rateSource === 'CAMPAIGN' ? 'bg-purple-100 text-purple-700' :
                            commission.rateSource === 'CATEGORY' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {commission.rateSource}
                          </span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                        {formatCurrency(commission.amount, commission.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(commission.status)}`}>
                          {commission.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </div>
  );
}
