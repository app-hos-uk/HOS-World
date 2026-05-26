'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function FinancePricingPage() {
  const searchParams = useSearchParams();
  const viewParam = searchParams.get('view');
  const submissionParam = searchParams.get('submission');
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>(viewParam === 'history' ? 'history' : 'pending');
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [pricingHistory, setPricingHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState<'set-pricing' | 'approve' | 'reject' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form state
  const [margin, setMargin] = useState<string>('');
  const [visibilityLevel, setVisibilityLevel] = useState<string>('STANDARD');
  const [notes, setNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const toast = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-open a specific submission when navigating from the dashboard
  useEffect(() => {
    if (!loading && submissionParam && pendingSubmissions.length > 0) {
      const match = pendingSubmissions.find((s) => s.id === submissionParam);
      if (match) {
        setActiveTab('pending');
        handleViewDetails(match);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, submissionParam, pendingSubmissions]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchData();
    };
    const interval = setInterval(fetchData, 60_000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [pendingResponse, historyResponse] = await Promise.all([
        apiClient.getFinancePending(),
        apiClient.getFinancePricingHistory(),
      ]);
      if (pendingResponse?.data) {
        setPendingSubmissions(pendingResponse.data);
      }
      if (historyResponse?.data) {
        setPricingHistory(historyResponse.data);
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (submission: any) => {
    setSelectedSubmission(submission);
    setActionType(null);
    setMargin('');
    setVisibilityLevel('STANDARD');
    setNotes('');
    setRejectReason('');
    setShowModal(true);
  };

  const handleSetPricing = async () => {
    const marginNum = parseFloat(margin);
    if (!selectedSubmission || margin === '' || !Number.isFinite(marginNum) || marginNum <= 0) {
      toast.error('Margin must be a number greater than 0');
      return;
    }

    const productData = selectedSubmission.productData || {};
    const basePrice = productData.price ? parseFloat(productData.price) : 0;
    const hosMargin = marginNum / 100; // Convert percentage to decimal

    try {
      setActionLoading(true);
      await apiClient.setFinancePricing(selectedSubmission.id, {
        basePrice,
        hosMargin,
        visibilityLevel: visibilityLevel,
      });
      toast.success(`Pricing set: ${hosMargin * 100}% margin on $${basePrice.toFixed(2)}`);
      setActionType(null);
      setMargin('');
      setNotes('');
      await fetchData();
    } catch (err: any) {
      console.error('Error setting pricing:', err);
      toast.error(err.message || 'Failed to set pricing');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedSubmission) return;

    try {
      setActionLoading(true);
      await apiClient.approveFinancePricing(selectedSubmission.id, {
        notes: notes || undefined,
      });
      setShowModal(false);
      setSelectedSubmission(null);
      setNotes('');
      toast.success('Pricing approved — product ready for publishing');
      await fetchData();
    } catch (err: any) {
      console.error('Error approving:', err);
      toast.error(err.message || 'Failed to approve pricing');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedSubmission || !rejectReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }

    try {
      setActionLoading(true);
      await apiClient.rejectFinancePricing(selectedSubmission.id, {
        reason: rejectReason,
      });
      setShowModal(false);
      setSelectedSubmission(null);
      setRejectReason('');
      toast.success('Pricing rejected');
      await fetchData();
    } catch (err: any) {
      console.error('Error rejecting:', err);
      toast.error(err.message || 'Failed to reject pricing');
    } finally {
      setActionLoading(false);
    }
  };

  const menuItems = [
    { title: 'Dashboard', href: '/finance/dashboard', icon: '📊' },
    { title: 'Pricing Approvals', href: '/finance/pricing', icon: '💰', badge: pendingSubmissions.length },
    { title: 'Payouts', href: '/finance/payouts', icon: '💸' },
    { title: 'Revenue Reports', href: '/finance/reports/revenue', icon: '📊' },
    { title: 'Fee Reports', href: '/finance/reports/fees', icon: '📋' },
  ];

  return (
    <RouteGuard allowedRoles={['FINANCE', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout
        role="FINANCE"
        menuItems={menuItems}
        title="Finance"
        backToHref={{ title: 'Admin Dashboard', href: '/admin/dashboard' }}
      >
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Pricing Management</h1>
          <p className="text-hos-text-secondary mt-2">Review pending approvals and view pricing history</p>
        </div>

        {/* Tab Switcher */}
        <div className="mb-6 flex gap-1 bg-hos-bg-tertiary rounded-lg p-1">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
              activeTab === 'pending'
                ? 'bg-hos-bg-secondary text-hos-gold-hover shadow-sm'
                : 'text-hos-text-secondary hover:text-hos-gold'
            }`}
          >
            Pending Approvals {pendingSubmissions.length > 0 && `(${pendingSubmissions.length})`}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-hos-bg-secondary text-hos-gold-hover shadow-sm'
                : 'text-hos-text-secondary hover:text-hos-gold'
            }`}
          >
            Pricing History {pricingHistory.length > 0 && `(${pricingHistory.length})`}
          </button>
        </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/15 border border-red-400 text-red-400 rounded-lg">
              <p className="font-semibold">Error</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
            </div>
          )}

          {/* Pending Approvals Tab */}
          {!loading && activeTab === 'pending' && pendingSubmissions.length === 0 && (
            <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-8 text-center">
              <p className="text-hos-text-muted text-lg">No pending pricing approvals</p>
              <p className="text-sm text-hos-text-muted mt-2">Products ready for pricing will appear here</p>
            </div>
          )}

          {!loading && activeTab === 'pending' && pendingSubmissions.length > 0 && (
            <div className="space-y-4">
              {pendingSubmissions.map((submission) => {
                const productData = submission.productData || {};
                const catalogEntry = submission.catalogEntry;
                return (
                  <div
                    key={submission.id}
                    className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-hos-text-secondary">
                          {catalogEntry?.title || submission.product?.name || productData.name || 'Untitled Product'}
                        </h3>
                        <p className="text-sm text-hos-text-muted mt-1">
                          Seller: {submission.seller?.storeName || 'Unknown'}
                        </p>
                        <div className="flex flex-wrap gap-4 mt-4 text-sm text-hos-text-secondary">
                          {productData.price && (
                            <span>
                              <strong>Price:</strong> {productData.currency || 'USD'}{' '}
                              {parseFloat(productData.price).toFixed(2)}
                            </span>
                          )}
                          {productData.tradePrice && (
                            <span>
                              <strong>Trade Price:</strong> {productData.currency || 'USD'}{' '}
                              {parseFloat(productData.tradePrice).toFixed(2)}
                            </span>
                          )}
                          {productData.rrp && (
                            <span>
                              <strong>RRP:</strong> {productData.currency || 'USD'}{' '}
                              {parseFloat(productData.rrp).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewDetails(submission)}
                          className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium text-sm whitespace-nowrap"
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pricing History Tab */}
          {!loading && activeTab === 'history' && pricingHistory.length === 0 && (
            <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-8 text-center">
              <p className="text-hos-text-muted text-lg">No pricing history</p>
              <p className="text-sm text-hos-text-muted mt-2">Approved pricing decisions will appear here</p>
            </div>
          )}

          {!loading && activeTab === 'history' && pricingHistory.length > 0 && (
            <div className="space-y-4">
              {pricingHistory.map((item: any) => (
                <div
                  key={item.id}
                  className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6"
                >
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-hos-text-secondary">
                        {item.product?.name || 'Unknown Product'}
                      </h3>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-hos-text-secondary">
                        <span>
                          <strong>Base Price:</strong> ${Number(item.basePrice || 0).toFixed(2)}
                        </span>
                        <span>
                          <strong>Final Price:</strong> ${Number(item.finalPrice || 0).toFixed(2)}
                        </span>
                        <span>
                          <strong>Margin:</strong> {((Number(item.hosMargin) || 0) * 100).toFixed(1)}%
                        </span>
                        <span>
                          <strong>Visibility:</strong> {item.visibilityLevel || 'STANDARD'}
                        </span>
                      </div>
                      <p className="text-xs text-hos-text-muted mt-2">
                        Approved: {item.approvedAt ? new Date(item.approvedAt).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                    <div className="flex items-start">
                      <span className="px-3 py-1 text-xs font-medium bg-green-500/15 text-green-300 rounded">
                        APPROVED
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Review Modal */}
          {showModal && selectedSubmission && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-hos-bg-secondary rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold">
                      {actionType === 'set-pricing'
                        ? 'Set Pricing'
                        : actionType === 'approve'
                          ? 'Approve Pricing'
                          : actionType === 'reject'
                            ? 'Reject Pricing'
                            : 'Review Pricing'}
                    </h2>
                    <button
                      onClick={() => {
                        setShowModal(false);
                        setSelectedSubmission(null);
                        setActionType(null);
                      }}
                      className="text-hos-text-muted hover:text-hos-text-secondary"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  {actionType === null && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold text-lg mb-2">
                          {selectedSubmission.catalogEntry?.title ||
                            selectedSubmission.product?.name ||
                            selectedSubmission.productData?.name ||
                            'Untitled Product'}
                        </h3>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          {selectedSubmission.productData?.price && (
                            <div>
                              <p className="text-sm font-medium text-hos-text-muted">Price</p>
                              <p className="text-hos-text-secondary">
                                {selectedSubmission.productData.currency || 'USD'}{' '}
                                {parseFloat(selectedSubmission.productData.price).toFixed(2)}
                              </p>
                            </div>
                          )}
                          {selectedSubmission.productData?.tradePrice && (
                            <div>
                              <p className="text-sm font-medium text-hos-text-muted">Trade Price</p>
                              <p className="text-hos-text-secondary">
                                {selectedSubmission.productData.currency || 'USD'}{' '}
                                {parseFloat(selectedSubmission.productData.tradePrice).toFixed(2)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={() => setActionType('set-pricing')}
                          className="px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium"
                        >
                          Set Pricing
                        </button>
                        <button
                          onClick={() => setActionType('approve')}
                          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setActionType('reject')}
                          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {actionType === 'set-pricing' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                          Margin (%) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          value={margin}
                          onChange={(e) => setMargin(e.target.value)}
                          min="0"
                          step="0.01"
                          required
                          className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                          placeholder="Enter margin percentage"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                          Visibility Level
                        </label>
                        <select
                          value={visibilityLevel}
                          onChange={(e) => setVisibilityLevel(e.target.value)}
                          className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                        >
                          <option value="STANDARD">Standard</option>
                          <option value="PREMIUM">Premium</option>
                          <option value="FEATURED">Featured</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                          Notes (Optional)
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={4}
                          className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                          placeholder="Add notes about pricing..."
                        />
                      </div>
                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={handleSetPricing}
                          disabled={actionLoading || !margin || parseFloat(margin) <= 0}
                          className="px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium disabled:opacity-50"
                        >
                          {actionLoading ? 'Setting...' : 'Set Pricing'}
                        </button>
                        <button
                          onClick={() => setActionType(null)}
                          disabled={actionLoading}
                          className="px-6 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-text-muted transition-colors font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {actionType === 'approve' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                          Notes (Optional)
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={4}
                          className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                          placeholder="Add approval notes..."
                        />
                      </div>
                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={handleApprove}
                          disabled={actionLoading}
                          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                        >
                          {actionLoading ? 'Approving...' : 'Confirm Approval'}
                        </button>
                        <button
                          onClick={() => setActionType(null)}
                          disabled={actionLoading}
                          className="px-6 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-text-muted transition-colors font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {actionType === 'reject' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                          Rejection Reason <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          rows={4}
                          required
                          className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                          placeholder="Please provide a reason for rejection..."
                        />
                      </div>
                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={handleReject}
                          disabled={actionLoading || !rejectReason.trim()}
                          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
                        >
                          {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                        </button>
                        <button
                          onClick={() => setActionType(null)}
                          disabled={actionLoading}
                          className="px-6 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-text-muted transition-colors font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
      </DashboardLayout>
    </RouteGuard>
  );
}

