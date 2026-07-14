'use client';

import { useState, useEffect } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';

export default function RevenueRecognitionPage() {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [breakdown, setBreakdown] = useState<any>(null);
  const [monthly, setMonthly] = useState<any>(null);
  const [deferred, setDeferred] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [breakdownRes, monthlyRes, deferredRes] = await Promise.all([
          apiClient.getRevenueBreakdown(),
          apiClient.getMonthlyRevRecognition(selectedYear, selectedMonth),
          apiClient.getDeferredRevenue(1, 20),
        ]);
        setBreakdown(breakdownRes?.data);
        setMonthly(monthlyRes?.data);
        setDeferred(Array.isArray(deferredRes?.data) ? deferredRes.data : []);
      } catch (err: any) {
        toast.error(err.message || 'Failed to load revenue data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedYear, selectedMonth, toast]);

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <RouteGuard allowedRoles={['ADMIN', 'FINANCE']}>
              <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-hos-text-secondary">Revenue Recognition</h1>
              <p className="text-hos-text-muted mt-1">ASC 606 compliant revenue tracking — recognized on delivery</p>
            </div>
            <div className="flex gap-2">
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary text-sm">
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary text-sm">
                {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold" /></div>
          ) : (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-hos-bg-secondary rounded-lg border border-hos-border p-5">
                  <p className="text-xs text-hos-text-muted uppercase tracking-wide">Recognized Revenue</p>
                  <p className="text-2xl font-bold text-green-400 mt-1">{formatPrice(breakdown?.recognized || 0)}</p>
                  <p className="text-xs text-hos-text-muted mt-1">Delivered orders this period</p>
                </div>
                <div className="bg-hos-bg-secondary rounded-lg border border-hos-border p-5">
                  <p className="text-xs text-hos-text-muted uppercase tracking-wide">Deferred Revenue</p>
                  <p className="text-2xl font-bold text-yellow-400 mt-1">{formatPrice(breakdown?.deferred || 0)}</p>
                  <p className="text-xs text-hos-text-muted mt-1">Paid but not yet delivered</p>
                </div>
                <div className="bg-hos-bg-secondary rounded-lg border border-hos-border p-5">
                  <p className="text-xs text-hos-text-muted uppercase tracking-wide">Refund Provision (5%)</p>
                  <p className="text-2xl font-bold text-red-400 mt-1">{formatPrice(breakdown?.refundProvision || 0)}</p>
                  <p className="text-xs text-hos-text-muted mt-1">Based on historical rate</p>
                </div>
                <div className="bg-hos-bg-secondary rounded-lg border border-hos-border p-5">
                  <p className="text-xs text-hos-text-muted uppercase tracking-wide">Net Recognized</p>
                  <p className="text-2xl font-bold text-hos-text-secondary mt-1">{formatPrice(breakdown?.netRecognized || 0)}</p>
                  <p className="text-xs text-hos-text-muted mt-1">After provision</p>
                </div>
              </div>

              {/* Monthly Detail */}
              {monthly && (
                <div className="bg-hos-bg-secondary rounded-lg border border-hos-border p-5">
                  <h2 className="text-lg font-semibold mb-4">{MONTHS[selectedMonth - 1]} {selectedYear} Detail</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-hos-text-muted">Actual Refunds</p>
                      <p className="text-lg font-semibold text-red-400">{formatPrice(monthly.actualRefunds || 0)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-hos-text-muted">Provision Accuracy</p>
                      <p className="text-lg font-semibold">{monthly.provisionAccuracy || 0}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-hos-text-muted">Recognition Status</p>
                      <p className="text-lg font-semibold text-green-400">Active</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Deferred Revenue Detail */}
              <div className="bg-hos-bg-secondary rounded-lg border border-hos-border p-5">
                <h2 className="text-lg font-semibold mb-4">Deferred Revenue — Undelivered Orders</h2>
                {deferred.length === 0 ? (
                  <p className="text-hos-text-muted text-center py-4">No deferred revenue items</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-hos-border">
                          <th className="text-left py-2 text-hos-text-muted font-medium">Order</th>
                          <th className="text-left py-2 text-hos-text-muted font-medium">Amount</th>
                          <th className="text-left py-2 text-hos-text-muted font-medium">Status</th>
                          <th className="text-left py-2 text-hos-text-muted font-medium">Seller</th>
                          <th className="text-left py-2 text-hos-text-muted font-medium">Age</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deferred.map((order: any) => (
                          <tr key={order.id} className="border-b border-hos-border/50">
                            <td className="py-2 font-medium">{order.orderNumber || order.id.slice(0, 8)}</td>
                            <td className="py-2">{formatPrice(order.total)}</td>
                            <td className="py-2"><span className="px-2 py-0.5 text-xs rounded bg-yellow-500/20 text-yellow-400">{order.status}</span></td>
                            <td className="py-2 text-hos-text-muted">{order.seller?.storeName || '—'}</td>
                            <td className="py-2 text-hos-text-muted">{order.ageInDays}d</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
          </RouteGuard>
  );
}
