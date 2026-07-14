'use client';

import { useState, useEffect } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';

interface AgingBucket {
  label: string;
  count: number;
  totalAmount: number;
  items: Array<{ id: string; amount: number; createdAt: string; type: string; description?: string }>;
}

export default function AgingAnalysisPage() {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'transactions' | 'settlements' | 'disputes'>('transactions');

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getAgingReport();
        setReport(response?.data);
      } catch (err: any) {
        toast.error(err.message || 'Failed to load aging report');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [toast]);

  const renderBuckets = (buckets: AgingBucket[], summary: { totalCount: number; totalAmount: number }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-hos-bg-tertiary rounded-lg p-4">
          <p className="text-xs text-hos-text-muted uppercase">Total Items</p>
          <p className="text-2xl font-bold text-hos-text-secondary">{summary.totalCount}</p>
        </div>
        <div className="bg-hos-bg-tertiary rounded-lg p-4">
          <p className="text-xs text-hos-text-muted uppercase">Total Amount</p>
          <p className="text-2xl font-bold text-red-400">{formatPrice(summary.totalAmount)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {buckets.map((bucket, idx) => (
          <div key={bucket.label} className={`rounded-lg border p-4 ${idx >= 3 ? 'border-red-500/30 bg-red-500/5' : idx >= 2 ? 'border-orange-500/30 bg-orange-500/5' : 'border-hos-border bg-hos-bg-tertiary'}`}>
            <p className="text-sm font-medium text-hos-text-secondary">{bucket.label}</p>
            <p className="text-xl font-bold mt-1">{bucket.count}</p>
            <p className="text-sm text-hos-text-muted">{formatPrice(bucket.totalAmount)}</p>
          </div>
        ))}
      </div>

      {buckets.some((b) => b.items.length > 0) && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-hos-text-secondary mb-2">Oldest Items</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {buckets.flatMap((b) => b.items).slice(0, 15).map((item) => (
              <div key={item.id} className="flex justify-between items-center p-3 bg-hos-bg-tertiary rounded-lg text-sm">
                <div>
                  <span className="font-medium text-hos-text-secondary">{item.type}</span>
                  {item.description && <span className="text-hos-text-muted ml-2">— {item.description}</span>}
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatPrice(item.amount)}</p>
                  <p className="text-xs text-hos-text-muted">{new Date(item.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const tabs = [
    { id: 'transactions' as const, label: 'Transactions', icon: '💳' },
    { id: 'settlements' as const, label: 'Settlements', icon: '💸' },
    { id: 'disputes' as const, label: 'Disputes', icon: '⚠️' },
  ];

  return (
    <RouteGuard allowedRoles={['ADMIN', 'FINANCE']}>
              <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-hos-text-secondary">Aging Analysis</h1>
            <p className="text-hos-text-muted mt-1">Track overdue transactions, settlements, and disputes by age</p>
          </div>

          <div className="border-b border-hos-border">
            <nav className="flex space-x-6">
              {tabs.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 text-sm font-medium border-b-2 ${activeTab === tab.id ? 'border-hos-gold text-hos-gold' : 'border-transparent text-hos-text-muted hover:text-hos-text-secondary'}`}>
                  {tab.icon} {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold" /></div>
          ) : !report ? (
            <p className="text-hos-text-muted text-center py-8">No data available</p>
          ) : (
            <div className="bg-hos-bg-secondary rounded-lg border border-hos-border p-5">
              {activeTab === 'transactions' && report.transactions && renderBuckets(report.transactions.buckets, report.transactions.summary)}
              {activeTab === 'settlements' && report.settlements && renderBuckets(report.settlements.buckets, report.settlements.summary)}
              {activeTab === 'disputes' && report.disputes && renderBuckets(report.disputes.buckets, report.disputes.summary)}
            </div>
          )}
        </div>
          </RouteGuard>
  );
}
