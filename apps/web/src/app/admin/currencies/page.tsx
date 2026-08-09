'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useDateTime } from '@/hooks/useDateTime';

interface CurrencyData {
  supported: string[];
  rates: Record<string, number>;
  lastUpdated?: string;
}

export default function AdminCurrenciesPage() {
  const { formatDateTime } = useDateTime();
  const toast = useToast();
  const [data, setData] = useState<CurrencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCurrencies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.adminGetCurrencies();
      if (res.data) {
        setData(res.data as CurrencyData);
      }
    } catch {
      toast.error('Failed to load currencies');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCurrencies();
  }, [fetchCurrencies]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const res = await apiClient.adminRefreshCurrencies();
      if (res.data) {
        const refreshed = res.data as { rates: Record<string, number> };
        setData((prev) =>
          prev ? { ...prev, rates: refreshed.rates, lastUpdated: new Date().toISOString() } : prev
        );
        toast.success('Exchange rates refreshed successfully');
      }
    } catch {
      toast.error('Failed to refresh exchange rates');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Multi-Currency Management</h1>
            <p className="text-hos-text-muted text-sm mt-1">
              Supported currencies are configured via the <code className="bg-hos-bg-secondary px-1.5 py-0.5 rounded text-xs">GLOBAL_SUPPORTED_CURRENCIES</code> environment variable.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-hos-gold text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {refreshing ? 'Refreshing...' : 'Refresh Rates'}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold" />
          </div>
        ) : !data ? (
          <div className="text-center py-20 text-hos-text-muted">No currency data available.</div>
        ) : (
          <div className="bg-hos-bg-secondary border border-hos-border rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-hos-border">
                  <th className="px-6 py-4 text-xs font-semibold uppercase text-hos-text-muted">Currency Code</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase text-hos-text-muted">Exchange Rate (USD Base)</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase text-hos-text-muted">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.supported.map((code) => (
                  <tr key={code} className="border-b border-hos-border last:border-b-0 hover:bg-hos-bg-secondary/50">
                    <td className="px-6 py-4">
                      <span className="font-mono font-semibold text-hos-text-secondary">{code}</span>
                    </td>
                    <td className="px-6 py-4 text-hos-text-secondary">
                      {data.rates[code] !== undefined ? data.rates[code].toFixed(4) : '—'}
                    </td>
                    <td className="px-6 py-4 text-hos-text-muted text-sm">
                      {data.lastUpdated
                        ? formatDateTime(data.lastUpdated)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
