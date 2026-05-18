'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminLoyaltyTransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.adminGetLoyaltyTransactions();
      if (res?.data) setTransactions(res.data as any[]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
      <AdminLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Points Transactions</h1>
          <p className="text-gray-600 mt-1">Recent loyalty point transactions across all members</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
          </div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Points</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Balance After</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          tx.type === 'EARN' ? 'bg-green-100 text-green-700' :
                          tx.type === 'BURN' || tx.type === 'REDEEM' ? 'bg-red-100 text-red-700' :
                          tx.type === 'ADJUST' ? 'bg-amber-100 text-amber-700' :
                          tx.type === 'EXPIRE' ? 'bg-gray-100 text-gray-600' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{tx.action || '—'}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${tx.points > 0 ? 'text-green-600' : tx.points < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {tx.points > 0 ? '+' : ''}{tx.points}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{tx.balanceAfter != null ? Number(tx.balanceAfter).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{tx.description || tx.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {transactions.length === 0 && (
              <div className="p-8 text-center text-gray-500">No transactions recorded yet.</div>
            )}
          </div>
        )}
      </AdminLayout>
    </RouteGuard>
  );
}
