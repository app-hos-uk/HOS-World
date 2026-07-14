'use client';

import { useState, useEffect, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function FinancialPeriodsPage() {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const fetchPeriods = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getFinancialPeriods({ year: selectedYear });
      setPeriods(Array.isArray(response?.data) ? response.data : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load periods');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, toast]);

  useEffect(() => { fetchPeriods(); }, [fetchPeriods]);

  const handleClose = async (year: number, month: number) => {
    const notes = window.prompt('Close notes (optional):') || undefined;
    try {
      setClosing(true);
      await apiClient.closeFinancialPeriod(year, month, notes);
      toast.success(`Period ${MONTHS[month - 1]} ${year} closed`);
      fetchPeriods();
    } catch (err: any) {
      toast.error(err.message || 'Failed to close period');
    } finally {
      setClosing(false);
    }
  };

  const handleReopen = async (year: number, month: number) => {
    if (!confirm(`Reopen ${MONTHS[month - 1]} ${year}? This allows new transactions in that period.`)) return;
    try {
      await apiClient.reopenFinancialPeriod(year, month);
      toast.success(`Period ${MONTHS[month - 1]} ${year} reopened`);
      fetchPeriods();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reopen period');
    }
  };

  const getPeriodForMonth = (month: number) => periods.find((p: any) => p.month === month);

  return (
    <RouteGuard allowedRoles={['ADMIN', 'FINANCE']}>
              <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-hos-text-secondary">Financial Period Close</h1>
              <p className="text-hos-text-muted mt-1">Manage monthly accounting periods</p>
            </div>
            <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary">
              {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MONTHS.map((monthName, idx) => {
                const month = idx + 1;
                const period = getPeriodForMonth(month);
                const isClosed = period?.status === 'CLOSED';
                const isPast = new Date(selectedYear, month, 0) < new Date();

                return (
                  <div key={month} className={`bg-hos-bg-secondary rounded-lg border p-5 ${isClosed ? 'border-green-500/30' : isPast ? 'border-orange-500/30' : 'border-hos-border'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-semibold text-hos-text-secondary">{monthName} {selectedYear}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${isClosed ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {isClosed ? 'CLOSED' : 'OPEN'}
                      </span>
                    </div>

                    {isClosed && period && (
                      <div className="space-y-1 text-sm mb-3">
                        <div className="flex justify-between"><span className="text-hos-text-muted">Revenue</span><span className="text-green-400">{formatPrice(Number(period.totalRevenue || 0))}</span></div>
                        <div className="flex justify-between"><span className="text-hos-text-muted">Refunds</span><span className="text-red-400">-{formatPrice(Number(period.totalRefunds || 0))}</span></div>
                        <div className="flex justify-between"><span className="text-hos-text-muted">Payouts</span><span className="text-orange-400">-{formatPrice(Number(period.totalPayouts || 0))}</span></div>
                        <div className="flex justify-between"><span className="text-hos-text-muted">Fees</span><span className="text-blue-400">{formatPrice(Number(period.totalFees || 0))}</span></div>
                        <div className="flex justify-between border-t border-hos-border pt-1 mt-1"><span className="font-medium">Net Income</span><span className="font-bold">{formatPrice(Number(period.netIncome || 0))}</span></div>
                      </div>
                    )}

                    {isClosed && period?.closedBy && (
                      <p className="text-xs text-hos-text-muted mb-3">Closed by {period.closedBy.email} on {new Date(period.closedAt).toLocaleDateString()}</p>
                    )}

                    <div className="flex gap-2">
                      {!isClosed && isPast && (
                        <button onClick={() => handleClose(selectedYear, month)} disabled={closing} className="flex-1 px-3 py-2 bg-hos-gold text-[#1a1406] rounded-lg text-sm font-medium disabled:opacity-50">
                          Close Period
                        </button>
                      )}
                      {isClosed && (
                        <button onClick={() => handleReopen(selectedYear, month)} className="flex-1 px-3 py-2 border border-hos-border rounded-lg text-sm text-hos-text-muted hover:bg-hos-bg-tertiary">
                          Reopen
                        </button>
                      )}
                      {!isPast && !isClosed && (
                        <span className="text-xs text-hos-text-muted">Current/future period</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
          </RouteGuard>
  );
}
