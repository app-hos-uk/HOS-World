'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { SafeImage } from '@/components/SafeImage';

interface VendorProduct {
  id: string;
  sellerId: string;
  productId: string;
  status: string;
  vendorPrice: number;
  vendorCurrency: string;
  platformPrice?: number;
  costPrice?: number;
  marginPercent?: number;
  vendorStock: number;
  lowStockThreshold: number;
  fulfillmentMethod?: string;
  leadTimeDays: number;
  totalUnitsSold: number;
  totalRevenue: number;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  seller?: {
    id: string;
    storeName?: string;
    user?: { firstName?: string; lastName?: string; email?: string };
  };
  product?: {
    id: string;
    name: string;
    slug: string;
    sku?: string;
    price: number;
    stock: number;
    images?: Array<{ url: string }>;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Draft', color: 'text-hos-text-secondary', bg: 'bg-hos-bg-tertiary' },
  PENDING_APPROVAL: { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
  APPROVED: { label: 'Approved', color: 'text-hos-gold', bg: 'bg-hos-gold/20' },
  REJECTED: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-500/15' },
  ACTIVE: { label: 'Active', color: 'text-green-400', bg: 'bg-green-500/15' },
  INACTIVE: { label: 'Inactive', color: 'text-hos-text-secondary', bg: 'bg-hos-bg-tertiary' },
  OUT_OF_STOCK: { label: 'Out of Stock', color: 'text-orange-400', bg: 'bg-orange-500/15' },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, color: 'text-hos-text-secondary', bg: 'bg-hos-bg-tertiary' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
      {config.label}
    </span>
  );
}

function VendorProductsContent() {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [listings, setListings] = useState<VendorProduct[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, active: 0, rejected: 0, approved: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Approve modal
  const [approveModal, setApproveModal] = useState<VendorProduct | null>(null);
  const [approveForm, setApproveForm] = useState({ platformPrice: '', marginPercent: '' });

  // Reject modal
  const [rejectModal, setRejectModal] = useState<VendorProduct | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Detail panel
  const [selectedListing, setSelectedListing] = useState<VendorProduct | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const response = await apiClient.getVendorProducts({});
      const data = response?.data;
      const allListings: VendorProduct[] = Array.isArray(data)
        ? data
        : data?.data && Array.isArray(data.data)
          ? data.data
          : [];
      setStats({
        total: allListings.length,
        pending: allListings.filter((l) => l.status === 'PENDING_APPROVAL').length,
        active: allListings.filter((l) => l.status === 'ACTIVE').length,
        rejected: allListings.filter((l) => l.status === 'REJECTED').length,
        approved: allListings.filter((l) => l.status === 'APPROVED').length,
      });
    } catch {
      // keep previous stats on failure
    }
  }, []);

  const fetchListings = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;
      const response = await apiClient.getVendorProducts(params);
      const data = response?.data;
      if (Array.isArray(data)) {
        setListings(data);
      } else if (data?.data && Array.isArray(data.data)) {
        setListings(data.data);
      } else {
        setListings([]);
      }
    } catch (error) {
      toast.error('Failed to load vendor products');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchListings();
    fetchStats();
  }, [fetchListings, fetchStats]);

  const handleApprove = async () => {
    if (!approveModal) return;
    setActionLoading(approveModal.id);
    try {
      const data: Record<string, number> = {};
      if (approveForm.platformPrice) data.platformPrice = Number(approveForm.platformPrice);
      if (approveForm.marginPercent) data.marginPercent = Number(approveForm.marginPercent) / 100;
      await apiClient.approveVendorProduct(approveModal.id, data);
      toast.success('Vendor product approved');
      setApproveModal(null);
      setApproveForm({ platformPrice: '', marginPercent: '' });
      fetchListings();
      fetchStats();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) return;
    setActionLoading(rejectModal.id);
    try {
      await apiClient.rejectVendorProduct(rejectModal.id, rejectReason);
      toast.success('Vendor product rejected');
      setRejectModal(null);
      setRejectReason('');
      fetchListings();
      fetchStats();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = async (id: string) => {
    setActionLoading(id);
    try {
      await apiClient.activateVendorProduct(id);
      toast.success('Vendor product activated');
      fetchListings();
      fetchStats();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to activate');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredListings = useMemo(() => {
    if (!searchQuery) return listings;
    const q = searchQuery.toLowerCase();
    return listings.filter(l =>
      l.product?.name?.toLowerCase().includes(q) ||
      l.seller?.storeName?.toLowerCase().includes(q) ||
      l.seller?.user?.email?.toLowerCase().includes(q) ||
      l.product?.sku?.toLowerCase().includes(q)
    );
  }, [listings, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-hos-text-secondary">Vendor Products</h1>
          <p className="text-sm text-hos-text-muted mt-1">
            Manage vendor product listings, approvals, and activations
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.total, onClick: () => setStatusFilter('ALL'), active: statusFilter === 'ALL', color: 'bg-hos-bg-secondary border-hos-border' },
          { label: 'Pending Review', value: stats.pending, onClick: () => setStatusFilter('PENDING_APPROVAL'), active: statusFilter === 'PENDING_APPROVAL', color: 'bg-yellow-500/10 border-yellow-500/30' },
          { label: 'Approved', value: stats.approved, onClick: () => setStatusFilter('APPROVED'), active: statusFilter === 'APPROVED', color: 'bg-hos-gold/10 border-hos-border-accent' },
          { label: 'Active', value: stats.active, onClick: () => setStatusFilter('ACTIVE'), active: statusFilter === 'ACTIVE', color: 'bg-green-500/10 border-green-500/30' },
          { label: 'Rejected', value: stats.rejected, onClick: () => setStatusFilter('REJECTED'), active: statusFilter === 'REJECTED', color: 'bg-red-500/10 border-red-500/30' },
        ].map(card => (
          <button
            key={card.label}
            onClick={card.onClick}
            className={`p-4 rounded-xl border text-left transition-all ${card.color} ${card.active ? 'ring-2 ring-hos-gold/50 shadow-sm' : 'hover:shadow-sm'}`}
          >
            <div className="text-2xl font-bold text-hos-text-secondary">{card.value}</div>
            <div className="text-xs text-hos-text-secondary mt-1">{card.label}</div>
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hos-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by product name, vendor, SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-hos-border rounded-lg text-sm bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-hos-gold/50 focus:border-hos-gold"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 border border-hos-border rounded-lg text-sm bg-hos-bg-secondary focus:ring-hos-gold/50 focus:border-hos-gold"
        >
          <option value="ALL">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-hos-bg-secondary rounded-xl border border-hos-border p-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-hos-gold border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-hos-text-muted text-sm">Loading vendor products...</p>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="bg-hos-bg-secondary rounded-xl border border-hos-border p-12 text-center">
          <svg className="w-12 h-12 text-hos-text-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3 className="text-hos-text-secondary font-medium">No vendor products found</h3>
          <p className="text-hos-text-muted text-sm mt-1">
            {statusFilter !== 'ALL' ? 'Try changing the filter' : 'Vendor listings will appear here once vendors submit products'}
          </p>
        </div>
      ) : (
        <div className="bg-hos-bg-secondary rounded-xl border border-hos-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-hos-border">
              <thead className="bg-hos-bg-secondary">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">Vendor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-hos-text-muted uppercase tracking-wider">Vendor Price</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-hos-text-muted uppercase tracking-wider">Platform Price</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-hos-text-muted uppercase tracking-wider">Stock</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-hos-text-muted uppercase tracking-wider">Sales</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-hos-text-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hos-border">
                {filteredListings.map((listing) => (
                  <tr
                    key={listing.id}
                    className={`hover:bg-hos-bg-tertiary cursor-pointer transition-colors ${selectedListing?.id === listing.id ? 'bg-hos-gold/10' : ''}`}
                    onClick={() => setSelectedListing(selectedListing?.id === listing.id ? null : listing)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-hos-bg-tertiary rounded-lg overflow-hidden flex-shrink-0">
                          {listing.product?.images?.[0] ? (
                            <SafeImage
                              src={listing.product.images[0].url}
                              alt={listing.product.name}
                              width={40}
                              height={40}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-hos-text-muted text-xs">N/A</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-hos-text-secondary truncate max-w-[200px]">
                            {listing.product?.name || 'Unknown Product'}
                          </p>
                          <p className="text-xs text-hos-text-muted">{listing.product?.sku || listing.productId?.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-hos-text-secondary">{listing.seller?.storeName || 'Unknown Vendor'}</p>
                      <p className="text-xs text-hos-text-muted">{listing.seller?.user?.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={listing.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-hos-text-secondary">
                      {formatPrice(Number(listing.vendorPrice))}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-hos-text-secondary">
                      {listing.platformPrice ? formatPrice(Number(listing.platformPrice)) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-medium ${listing.vendorStock <= listing.lowStockThreshold ? 'text-orange-400' : 'text-hos-text-secondary'}`}>
                        {listing.vendorStock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-hos-text-secondary">
                      {listing.totalUnitsSold}
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {listing.status === 'PENDING_APPROVAL' && (
                          <>
                            <button
                              onClick={() => { setApproveModal(listing); setApproveForm({ platformPrice: String(listing.vendorPrice || ''), marginPercent: '' }); }}
                              disabled={actionLoading === listing.id}
                              className="px-2.5 py-1 text-xs font-medium text-hos-text-secondary bg-green-600 hover:bg-green-700 rounded-md transition-colors disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setRejectModal(listing)}
                              disabled={actionLoading === listing.id}
                              className="px-2.5 py-1 text-xs font-medium text-hos-text-secondary bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {listing.status === 'APPROVED' && (
                          <button
                            onClick={() => handleActivate(listing.id)}
                            disabled={actionLoading === listing.id}
                            className="px-2.5 py-1 text-xs font-medium text-[#1a1406] bg-hos-gold hover:bg-hos-gold-hover rounded-md transition-colors disabled:opacity-50"
                          >
                            Activate
                          </button>
                        )}
                        {listing.status === 'ACTIVE' && (
                          <span className="text-xs text-green-400 font-medium">Live</span>
                        )}
                        {listing.status === 'REJECTED' && (
                          <span className="text-xs text-red-500 italic truncate max-w-[120px]" title={listing.rejectionReason || ''}>
                            {listing.rejectionReason || 'Rejected'}
                          </span>
                        )}
                        {(listing.status === 'DRAFT' || listing.status === 'INACTIVE') && (
                          <span className="text-xs text-hos-text-muted">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {selectedListing && (
        <div className="bg-hos-bg-secondary rounded-xl border border-hos-border p-6">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg font-semibold text-hos-text-secondary">Listing Details</h3>
            <button onClick={() => setSelectedListing(null)} className="text-hos-text-muted hover:text-hos-text-secondary">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h4 className="text-xs font-medium text-hos-text-muted uppercase mb-2">Product Info</h4>
              <div className="space-y-1.5 text-sm">
                <p><span className="text-hos-text-muted">Name:</span> {selectedListing.product?.name}</p>
                <p><span className="text-hos-text-muted">SKU:</span> {selectedListing.product?.sku || '—'}</p>
                <p><span className="text-hos-text-muted">Catalog Price:</span> {formatPrice(Number(selectedListing.product?.price || 0))}</p>
                <p><span className="text-hos-text-muted">Catalog Stock:</span> {selectedListing.product?.stock}</p>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-medium text-hos-text-muted uppercase mb-2">Vendor Pricing</h4>
              <div className="space-y-1.5 text-sm">
                <p><span className="text-hos-text-muted">Vendor Price:</span> {formatPrice(Number(selectedListing.vendorPrice))}</p>
                <p><span className="text-hos-text-muted">Platform Price:</span> {selectedListing.platformPrice ? formatPrice(Number(selectedListing.platformPrice)) : '—'}</p>
                <p><span className="text-hos-text-muted">Cost Price:</span> {selectedListing.costPrice ? formatPrice(Number(selectedListing.costPrice)) : '—'}</p>
                <p><span className="text-hos-text-muted">Margin:</span> {selectedListing.marginPercent ? `${(Number(selectedListing.marginPercent) * 100).toFixed(1)}%` : '—'}</p>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-medium text-hos-text-muted uppercase mb-2">Fulfillment</h4>
              <div className="space-y-1.5 text-sm">
                <p><span className="text-hos-text-muted">Stock:</span> {selectedListing.vendorStock}</p>
                <p><span className="text-hos-text-muted">Low Stock Alert:</span> {selectedListing.lowStockThreshold}</p>
                <p><span className="text-hos-text-muted">Method:</span> {selectedListing.fulfillmentMethod || '—'}</p>
                <p><span className="text-hos-text-muted">Lead Time:</span> {selectedListing.leadTimeDays} days</p>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-medium text-hos-text-muted uppercase mb-2">Performance</h4>
              <div className="space-y-1.5 text-sm">
                <p><span className="text-hos-text-muted">Units Sold:</span> {selectedListing.totalUnitsSold}</p>
                <p><span className="text-hos-text-muted">Revenue:</span> {formatPrice(Number(selectedListing.totalRevenue))}</p>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-medium text-hos-text-muted uppercase mb-2">Timeline</h4>
              <div className="space-y-1.5 text-sm">
                <p><span className="text-hos-text-muted">Created:</span> {new Date(selectedListing.createdAt).toLocaleDateString()}</p>
                {selectedListing.submittedAt && <p><span className="text-hos-text-muted">Submitted:</span> {new Date(selectedListing.submittedAt).toLocaleDateString()}</p>}
                {selectedListing.approvedAt && <p><span className="text-hos-text-muted">Approved:</span> {new Date(selectedListing.approvedAt).toLocaleDateString()}</p>}
                {selectedListing.rejectedAt && <p><span className="text-hos-text-muted">Rejected:</span> {new Date(selectedListing.rejectedAt).toLocaleDateString()}</p>}
              </div>
            </div>
            {selectedListing.rejectionReason && (
              <div>
                <h4 className="text-xs font-medium text-hos-text-muted uppercase mb-2">Rejection Reason</h4>
                <p className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">{selectedListing.rejectionReason}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setApproveModal(null)} />
          <div className="relative bg-hos-bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-hos-text-secondary mb-1">Approve Vendor Product</h3>
            <p className="text-sm text-hos-text-muted mb-4">
              {approveModal.product?.name} by {approveModal.seller?.storeName}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Platform Selling Price (optional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={approveForm.platformPrice}
                  onChange={(e) => setApproveForm(prev => ({ ...prev, platformPrice: e.target.value }))}
                  placeholder={String(approveModal.vendorPrice)}
                  className="w-full px-3 py-2 border border-hos-border rounded-lg text-sm focus:ring-hos-gold/50 focus:border-hos-gold"
                />
                <p className="text-xs text-hos-text-muted mt-1">Defaults to vendor price if left blank</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Margin % (optional)</label>
                <input
                  type="number"
                  step="0.1"
                  value={approveForm.marginPercent}
                  onChange={(e) => setApproveForm(prev => ({ ...prev, marginPercent: e.target.value }))}
                  placeholder="e.g. 15"
                  className="w-full px-3 py-2 border border-hos-border rounded-lg text-sm focus:ring-hos-gold/50 focus:border-hos-gold"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setApproveModal(null)}
                className="px-4 py-2 text-sm text-hos-text-secondary bg-hos-bg-tertiary hover:bg-hos-bg-tertiary rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading === approveModal.id}
                className="px-4 py-2 text-sm text-hos-text-secondary bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {actionLoading === approveModal.id ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRejectModal(null)} />
          <div className="relative bg-hos-bg-secondary rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-hos-text-secondary mb-1">Reject Vendor Product</h3>
            <p className="text-sm text-hos-text-muted mb-4">
              {rejectModal.product?.name} by {rejectModal.seller?.storeName}
            </p>
            <div>
              <label className="block text-sm font-medium text-hos-text-secondary mb-1">Reason for Rejection</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Provide a reason for the vendor..."
                className="w-full px-3 py-2 border border-hos-border rounded-lg text-sm focus:ring-hos-gold/50 focus:border-hos-gold resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="px-4 py-2 text-sm text-hos-text-secondary bg-hos-bg-tertiary hover:bg-hos-bg-tertiary rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading === rejectModal.id}
                className="px-4 py-2 text-sm text-hos-text-secondary bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {actionLoading === rejectModal.id ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminVendorProductsPage() {
  return (
    <RouteGuard allowedRoles={['ADMIN', 'CATALOG', 'PROCUREMENT']}>
              <VendorProductsContent />
          </RouteGuard>
  );
}
