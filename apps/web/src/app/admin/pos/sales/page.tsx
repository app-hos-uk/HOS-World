'use client';

import { useCallback, useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useMoney } from '@/hooks/useMoney';
import { useDateTime } from '@/hooks/useDateTime';
import Link from 'next/link';

type PosSale = {
  id: string;
  saleDate: string;
  externalSaleId: string;
  storeName?: string;
  storeId?: string;
  total: number;
  itemCount: number;
  status: string;
  importedAt: string;
  lineItems?: LineItem[];
  customer?: { name?: string; email?: string; phone?: string } | null;
};

type LineItem = {
  id?: string;
  productName?: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type Discrepancy = {
  id: string;
  type: string;
  description: string;
  saleId?: string;
  storeName?: string;
  severity?: string;
  createdAt?: string;
};

const STATUS_OPTIONS = ['', 'imported', 'matched', 'unmatched', 'error'];

const INPUT_CLS =
  'w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border';

const BADGE: Record<string, string> = {
  imported: 'bg-blue-500/20 text-blue-300',
  matched: 'bg-emerald-500/20 text-emerald-300',
  unmatched: 'bg-amber-500/20 text-amber-300',
  error: 'bg-red-500/20 text-red-300',
};

export default function AdminPosSalesPage() {
  const toast = useToast();
  const { formatMoney } = useMoney();
  const { formatDate } = useDateTime();
  const [sales, setSales] = useState<PosSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saleDetail, setSaleDetail] = useState<PosSale | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [loadingDisc, setLoadingDisc] = useState(true);

  const loadSales = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getPosSales({
        ...(storeFilter ? { storeId: storeFilter } : {}),
        ...(status ? { status } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        page,
        limit,
      });
      const body = res as { data?: PosSale[]; meta?: { total?: number } };
      setSales(Array.isArray(body.data) ? body.data : []);
      setTotalCount(body.meta?.total ?? body.data?.length ?? 0);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load POS sales');
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [storeFilter, status, dateFrom, dateTo, page, limit, toast]);

  const loadDiscrepancies = useCallback(async () => {
    try {
      setLoadingDisc(true);
      const res = await apiClient.getPosDiscrepancies();
      const data = (res as { data?: Discrepancy[] })?.data;
      setDiscrepancies(Array.isArray(data) ? data : []);
    } catch {
      setDiscrepancies([]);
    } finally {
      setLoadingDisc(false);
    }
  }, []);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  useEffect(() => {
    void loadDiscrepancies();
  }, [loadDiscrepancies]);

  const toggleExpand = async (sale: PosSale) => {
    if (expandedId === sale.id) {
      setExpandedId(null);
      setSaleDetail(null);
      return;
    }
    setExpandedId(sale.id);
    setSaleDetail(null);
    setLoadingDetail(true);
    try {
      const res = await apiClient.getPosSale(sale.id);
      const detail = (res as { data?: PosSale })?.data;
      setSaleDetail(detail ?? null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load sale detail');
    } finally {
      setLoadingDetail(false);
    }
  };

  const applyFilters = () => {
    setPage(1);
    void loadSales();
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setStatus('');
    setStoreFilter('');
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="space-y-6">
        <div>
          <Link href="/admin/pos" className="text-sm text-hos-gold hover:text-hos-gold">
            &larr; POS home
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-hos-text-secondary">POS Sales</h1>
          <p className="text-sm text-hos-text-muted mt-1">
            Browse imported POS sales, inspect line items, and review discrepancies.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-hos-text-muted mb-1">
                Date from
              </label>
              <input
                type="date"
                className={INPUT_CLS}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-hos-text-muted mb-1">Date to</label>
              <input
                type="date"
                className={INPUT_CLS}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-hos-text-muted mb-1">Status</label>
              <select
                className={INPUT_CLS}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.filter(Boolean).map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-hos-text-muted mb-1">
                Store ID
              </label>
              <input
                className={INPUT_CLS}
                placeholder="Filter by store ID"
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={applyFilters}
                className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover text-sm font-medium"
              >
                Filter
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2 border border-hos-border rounded-lg hover:bg-hos-bg-tertiary text-sm font-medium text-hos-text-secondary"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Sales table */}
        <div className="overflow-hidden rounded-lg border border-hos-border bg-hos-bg-secondary shadow">
          {loading ? (
            <div className="px-4 py-8 text-center text-hos-text-muted">Loading sales&hellip;</div>
          ) : (
            <>
              <table className="min-w-full divide-y divide-hos-border">
                <thead className="bg-hos-bg-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                      Sale date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                      External ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                      Store
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-hos-text-muted">
                      Total
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-hos-text-muted">
                      Items
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                      Imported
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hos-border bg-hos-bg-secondary">
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-hos-text-muted">
                        No POS sales found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    sales.map((sale) => (
                      <>
                        <tr
                          key={sale.id}
                          className="cursor-pointer hover:bg-hos-bg-tertiary transition-colors"
                          onClick={() => void toggleExpand(sale)}
                        >
                          <td className="px-4 py-3 text-sm text-hos-text-secondary">
                            {formatDate(sale.saleDate)}
                          </td>
                          <td className="px-4 py-3 text-sm text-hos-text-secondary font-mono text-xs">
                            {sale.externalSaleId || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-hos-text-secondary">
                            {sale.storeName || sale.storeId || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-hos-text-secondary text-right">
                            {formatMoney(sale.total)}
                          </td>
                          <td className="px-4 py-3 text-sm text-hos-text-secondary text-right">
                            {sale.itemCount}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${BADGE[sale.status] ?? 'bg-hos-bg-tertiary text-hos-text-muted'}`}
                            >
                              {sale.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-hos-text-muted">
                            {formatDate(sale.importedAt)}
                          </td>
                        </tr>

                        {expandedId === sale.id && (
                          <tr key={`${sale.id}-detail`}>
                            <td
                              colSpan={7}
                              className="px-6 py-4 bg-hos-bg-tertiary border-t border-hos-border"
                            >
                              {loadingDetail ? (
                                <p className="text-hos-text-muted text-sm">
                                  Loading detail&hellip;
                                </p>
                              ) : saleDetail ? (
                                <div className="space-y-4">
                                  {saleDetail.customer && (
                                    <div>
                                      <h4 className="text-xs font-semibold text-hos-text-muted uppercase mb-1">
                                        Customer
                                      </h4>
                                      <p className="text-sm text-hos-text-secondary">
                                        {saleDetail.customer.name || 'Unnamed'}
                                        {saleDetail.customer.email && (
                                          <span className="text-hos-text-muted ml-2">
                                            {saleDetail.customer.email}
                                          </span>
                                        )}
                                        {saleDetail.customer.phone && (
                                          <span className="text-hos-text-muted ml-2">
                                            {saleDetail.customer.phone}
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  )}
                                  <div>
                                    <h4 className="text-xs font-semibold text-hos-text-muted uppercase mb-1">
                                      Line items
                                    </h4>
                                    {saleDetail.lineItems && saleDetail.lineItems.length > 0 ? (
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="text-hos-text-muted text-xs">
                                            <th className="text-left py-1 pr-4">Product</th>
                                            <th className="text-left py-1 pr-4">SKU</th>
                                            <th className="text-right py-1 pr-4">Qty</th>
                                            <th className="text-right py-1 pr-4">Unit price</th>
                                            <th className="text-right py-1">Line total</th>
                                          </tr>
                                        </thead>
                                        <tbody className="text-hos-text-secondary">
                                          {saleDetail.lineItems.map((li, idx) => (
                                            <tr
                                              key={li.id ?? idx}
                                              className="border-t border-hos-border/50"
                                            >
                                              <td className="py-1 pr-4">
                                                {li.productName || '—'}
                                              </td>
                                              <td className="py-1 pr-4 font-mono text-xs">
                                                {li.sku || '—'}
                                              </td>
                                              <td className="py-1 pr-4 text-right">
                                                {li.quantity}
                                              </td>
                                              <td className="py-1 pr-4 text-right">
                                                {formatMoney(li.unitPrice)}
                                              </td>
                                              <td className="py-1 text-right">
                                                {formatMoney(li.total)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    ) : (
                                      <p className="text-hos-text-muted text-xs">
                                        No line items available.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-hos-text-muted text-sm">
                                  Could not load sale detail.
                                </p>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    ))
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-hos-border">
                  <p className="text-xs text-hos-text-muted">
                    Page {page} of {totalPages} ({totalCount} sale{totalCount !== 1 ? 's' : ''})
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 text-sm border border-hos-border rounded hover:bg-hos-bg-tertiary disabled:opacity-40 text-hos-text-secondary"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="px-3 py-1 text-sm border border-hos-border rounded hover:bg-hos-bg-tertiary disabled:opacity-40 text-hos-text-secondary"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Discrepancies */}
        <div>
          <h2 className="text-lg font-semibold text-hos-text-secondary mb-3">POS Discrepancies</h2>
          <div className="overflow-hidden rounded-lg border border-hos-border bg-hos-bg-secondary shadow">
            {loadingDisc ? (
              <div className="px-4 py-6 text-center text-hos-text-muted">
                Loading discrepancies&hellip;
              </div>
            ) : discrepancies.length === 0 ? (
              <div className="px-4 py-6 text-center text-hos-text-muted">
                No discrepancies found.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-hos-border">
                <thead className="bg-hos-bg-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                      Store
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                      Severity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hos-border bg-hos-bg-secondary">
                  {discrepancies.map((d) => (
                    <tr key={d.id}>
                      <td className="px-4 py-3 text-sm text-hos-text-secondary font-medium">
                        {d.type}
                      </td>
                      <td className="px-4 py-3 text-sm text-hos-text-secondary max-w-md truncate">
                        {d.description}
                      </td>
                      <td className="px-4 py-3 text-sm text-hos-text-secondary">
                        {d.storeName || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            d.severity === 'high'
                              ? 'bg-red-500/20 text-red-300'
                              : d.severity === 'medium'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-hos-bg-tertiary text-hos-text-muted'
                          }`}
                        >
                          {d.severity || 'low'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-hos-text-muted">
                        {formatDate(d.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
