'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

const LEDGER_TYPES = ['ALL', 'SALE', 'COMMISSION', 'REFUND', 'PAYOUT'] as const;

export default function AdminVendorLedgerPage() {
  const toast = useToast();

  // Sellers
  const [sellers, setSellers] = useState<any[]>([]);
  const [loadingSellers, setLoadingSellers] = useState(true);
  const [selectedSeller, setSelectedSeller] = useState('');

  // Summary
  const [summary, setSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Ledger entries
  const [entries, setEntries] = useState<any[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchSellers();
  }, []);

  useEffect(() => {
    if (selectedSeller) {
      fetchSummary(selectedSeller);
      setPage(1);
      fetchEntries(selectedSeller, typeFilter === 'ALL' ? undefined : typeFilter, 1);
    }
  }, [selectedSeller]);

  useEffect(() => {
    if (selectedSeller) {
      setPage(1);
      fetchEntries(selectedSeller, typeFilter === 'ALL' ? undefined : typeFilter, 1);
    }
  }, [typeFilter]);

  const fetchSellers = async () => {
    try {
      setLoadingSellers(true);
      const response = await apiClient.getAdminSellers({ limit: 200 });
      let sellerData: any[] = [];
      if (response && 'data' in response) {
        const responseData = response.data as any;
        if (Array.isArray(responseData)) {
          sellerData = responseData;
        } else if (responseData && typeof responseData === 'object') {
          if ('data' in responseData && Array.isArray(responseData.data)) {
            sellerData = responseData.data;
          } else if ('sellers' in responseData && Array.isArray(responseData.sellers)) {
            sellerData = responseData.sellers;
          }
        }
      }
      setSellers(sellerData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load sellers');
      setSellers([]);
    } finally {
      setLoadingSellers(false);
    }
  };

  const fetchSummary = async (sellerId: string) => {
    try {
      setLoadingSummary(true);
      const response = await apiClient.getVendorLedgerSummary(sellerId);
      if (response && 'data' in response) {
        setSummary(response.data);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load summary');
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchEntries = async (sellerId: string, type?: string, p?: number) => {
    try {
      setLoadingEntries(true);
      const currentPage = p || page;
      const response = await apiClient.getVendorLedger(sellerId, { type, page: currentPage, limit: 20 });
      if (response && 'data' in response) {
        const responseData = response.data as any;
        if (Array.isArray(responseData)) {
          setEntries(responseData);
        } else if (responseData && typeof responseData === 'object') {
          if ('data' in responseData && Array.isArray(responseData.data)) {
            setEntries(responseData.data);
          } else if ('entries' in responseData && Array.isArray(responseData.entries)) {
            setEntries(responseData.entries);
          }
          if ('totalPages' in responseData) setTotalPages(responseData.totalPages);
          else if ('meta' in responseData && responseData.meta?.totalPages) setTotalPages(responseData.meta.totalPages);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load ledger entries');
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchEntries(selectedSeller, typeFilter === 'ALL' ? undefined : typeFilter, newPage);
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'SALE': return 'bg-green-500/15 text-green-300';
      case 'COMMISSION': return 'bg-blue-500/15 text-blue-300';
      case 'REFUND': return 'bg-red-500/15 text-red-300';
      case 'PAYOUT': return 'bg-purple-500/15 text-purple-300';
      default: return 'bg-hos-bg-tertiary text-hos-text-secondary';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(amount || 0);
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-hos-text-secondary">Vendor Ledger</h1>

        {/* Seller Picker */}
        <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
          <label className="block text-sm font-medium text-hos-text-muted mb-2">Select Seller</label>
          {loadingSellers ? (
            <div className="text-hos-text-muted text-sm">Loading sellers...</div>
          ) : (
            <select
              value={selectedSeller}
              onChange={(e) => setSelectedSeller(e.target.value)}
              className="w-full max-w-md px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
            >
              <option value="">Choose a seller...</option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.businessName || seller.name || seller.email || seller.id}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedSeller && (
          <>
            {/* Summary Cards */}
            {loadingSummary ? (
              <div className="text-hos-text-muted">Loading summary...</div>
            ) : summary ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
                  <p className="text-sm text-hos-text-muted">Balance</p>
                  <p className="text-xl font-bold text-hos-gold">
                    {formatCurrency(summary.balance ?? summary.currentBalance ?? 0)}
                  </p>
                </div>
                {['SALE', 'COMMISSION', 'REFUND', 'PAYOUT'].map((type) => {
                  const typeData = summary.breakdown?.[type] || summary[type.toLowerCase()] || {};
                  return (
                    <div key={type} className="bg-hos-bg-secondary rounded-lg shadow p-4">
                      <p className="text-sm text-hos-text-muted">{type}</p>
                      <p className="text-lg font-semibold text-hos-text-secondary">
                        {formatCurrency(typeData.total ?? typeData.amount ?? 0)}
                      </p>
                      <p className="text-xs text-hos-text-muted">
                        {typeData.count ?? 0} entries
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-hos-text-muted">Filter:</span>
              {LEDGER_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                    typeFilter === type
                      ? 'bg-hos-gold text-black'
                      : 'bg-hos-bg-secondary text-hos-text-muted border border-hos-border hover:text-hos-text-secondary'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Entries Table */}
            <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
              {loadingEntries ? (
                <div className="p-6 text-hos-text-muted">Loading entries...</div>
              ) : entries.length === 0 ? (
                <div className="p-6 text-hos-text-muted">No ledger entries found</div>
              ) : (
                <>
                  <table className="min-w-full divide-y divide-hos-border">
                    <thead className="bg-hos-bg-secondary">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Order Ref</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-hos-text-muted uppercase">Amount</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-hos-text-muted uppercase">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hos-border">
                      {entries.map((entry, idx) => (
                        <tr key={entry.id || idx} className="hover:bg-hos-bg-tertiary">
                          <td className="px-6 py-4 text-sm text-hos-text-muted whitespace-nowrap">
                            {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${getTypeBadgeClass(entry.type)}`}>
                              {entry.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-hos-text-secondary whitespace-nowrap">
                            {entry.orderRef || entry.orderId || entry.reference || '—'}
                          </td>
                          <td className={`px-6 py-4 text-sm font-medium text-right whitespace-nowrap ${
                            (entry.amount ?? 0) >= 0 ? 'text-green-300' : 'text-red-300'
                          }`}>
                            {formatCurrency(entry.amount)}
                          </td>
                          <td className="px-6 py-4 text-sm text-hos-text-secondary text-right whitespace-nowrap">
                            {formatCurrency(entry.runningBalance ?? entry.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-3 border-t border-hos-border">
                      <button
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page <= 1}
                        className="px-3 py-1 text-sm bg-hos-bg-secondary border border-hos-border rounded text-hos-text-secondary disabled:opacity-50 hover:bg-hos-bg-tertiary"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-hos-text-muted">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page >= totalPages}
                        className="px-3 py-1 text-sm bg-hos-bg-secondary border border-hos-border rounded text-hos-text-secondary disabled:opacity-50 hover:bg-hos-bg-tertiary"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </RouteGuard>
  );
}
