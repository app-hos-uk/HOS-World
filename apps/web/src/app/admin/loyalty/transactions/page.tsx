'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
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
              <div className="mb-6">
          <h1 className="text-2xl font-bold text-hos-text-secondary">Points Transactions</h1>
          <p className="text-hos-text-secondary mt-1">Recent loyalty point transactions across all members</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-hos-gold" />
          </div>
        ) : (
          <div className="bg-hos-bg-secondary border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-hos-bg-secondary border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-hos-text-secondary">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-hos-text-secondary">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-hos-text-secondary">Action</th>
                    <th className="text-right px-4 py-3 font-medium text-hos-text-secondary">Points</th>
                    <th className="text-right px-4 py-3 font-medium text-hos-text-secondary">Balance After</th>
                    <th className="text-left px-4 py-3 font-medium text-hos-text-secondary">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-hos-bg-tertiary">
                      <td className="px-4 py-3 text-hos-text-muted text-xs whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          tx.type === 'EARN' ? 'bg-green-500/15 text-green-400' :
                          tx.type === 'BURN' || tx.type === 'REDEEM' ? 'bg-red-500/15 text-red-400' :
                          tx.type === 'ADJUST' ? 'bg-amber-500/15 text-amber-400' :
                          tx.type === 'EXPIRE' ? 'bg-hos-bg-tertiary text-hos-text-secondary' :
                          'bg-hos-gold/20 text-hos-gold'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-hos-text-secondary">{tx.source || tx.action || '—'}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${tx.points > 0 ? 'text-green-400' : tx.points < 0 ? 'text-red-400' : 'text-hos-text-secondary'}`}>
                        {tx.points > 0 ? '+' : ''}{tx.points}
                      </td>
                      <td className="px-4 py-3 text-right text-hos-text-secondary">{tx.balanceAfter != null ? Number(tx.balanceAfter).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-hos-text-muted text-xs max-w-[200px] truncate">{tx.description || tx.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {transactions.length === 0 && (
              <div className="p-8 text-center text-hos-text-muted">No transactions recorded yet.</div>
            )}
          </div>
        )}
          </RouteGuard>
  );
}
