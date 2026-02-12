'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function FinancePricingPage() {
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
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
    fetchPending();
  }, []);

  const fetchPending = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getFinancePending();
      if (response?.data) {
        setPendingSubmissions(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching pending:', err);
      setError(err.message || 'Failed to load pending approvals');
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
      toast.success(`Pricing set: ${hosMargin * 100}% margin on £${basePrice.toFixed(2)}`);
      setActionType(null);
      setMargin('');
      setNotes('');
      await fetchPending();
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
      await fetchPending();
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
      await fetchPending();
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
  ];

  return (
    <RouteGuard allowedRoles={['FINANCE', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="FINANCE" menuItems={menuItems} title="Finance">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Pricing Approvals</h1>
          <p className="text-gray-600 mt-2">Review and approve product pricing</p>
        </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              <p className="font-semibold">Error</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          )}

          {!loading && pendingSubmissions.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-500 text-lg">No pending pricing approvals</p>
            </div>
          )}

          {!loading && pendingSubmissions.length > 0 && (
            <div className="space-y-4">
              {pendingSubmissions.map((submission) => {
                const productData = submission.productData || {};
                const catalogEntry = submission.catalogEntry;
                return (
                  <div
                    key={submission.id}
                    className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {catalogEntry?.title || productData.name || 'Untitled Product'}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Seller: {submission.seller?.storeName || 'Unknown'}
                        </p>
                        <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
                          {productData.price && (
                            <span>
                              <strong>Price:</strong> {productData.currency || 'GBP'}{' '}
                              {parseFloat(productData.price).toFixed(2)}
                            </span>
                          )}
                          {productData.tradePrice && (
                            <span>
                              <strong>Trade Price:</strong> {productData.currency || 'GBP'}{' '}
                              {parseFloat(productData.tradePrice).toFixed(2)}
                            </span>
                          )}
                          {productData.rrp && (
                            <span>
                              <strong>RRP:</strong> {productData.currency || 'GBP'}{' '}
                              {parseFloat(productData.rrp).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewDetails(submission)}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm whitespace-nowrap"
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

          {/* Review Modal */}
          {showModal && selectedSubmission && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
                      className="text-gray-500 hover:text-gray-700"
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
                            selectedSubmission.productData?.name ||
                            'Untitled Product'}
                        </h3>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          {selectedSubmission.productData?.price && (
                            <div>
                              <p className="text-sm font-medium text-gray-500">Price</p>
                              <p className="text-gray-900">
                                {selectedSubmission.productData.currency || 'GBP'}{' '}
                                {parseFloat(selectedSubmission.productData.price).toFixed(2)}
                              </p>
                            </div>
                          )}
                          {selectedSubmission.productData?.tradePrice && (
                            <div>
                              <p className="text-sm font-medium text-gray-500">Trade Price</p>
                              <p className="text-gray-900">
                                {selectedSubmission.productData.currency || 'GBP'}{' '}
                                {parseFloat(selectedSubmission.productData.tradePrice).toFixed(2)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={() => setActionType('set-pricing')}
                          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Margin (%) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          value={margin}
                          onChange={(e) => setMargin(e.target.value)}
                          min="0"
                          step="0.01"
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="Enter margin percentage"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Visibility Level
                        </label>
                        <select
                          value={visibilityLevel}
                          onChange={(e) => setVisibilityLevel(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="STANDARD">Standard</option>
                          <option value="PREMIUM">Premium</option>
                          <option value="FEATURED">Featured</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Notes (Optional)
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={4}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="Add notes about pricing..."
                        />
                      </div>
                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={handleSetPricing}
                          disabled={actionLoading || !margin || parseFloat(margin) <= 0}
                          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                        >
                          {actionLoading ? 'Setting...' : 'Set Pricing'}
                        </button>
                        <button
                          onClick={() => setActionType(null)}
                          disabled={actionLoading}
                          className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {actionType === 'approve' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Notes (Optional)
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={4}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
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
                          className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {actionType === 'reject' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Rejection Reason <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          rows={4}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
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
                          className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
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

