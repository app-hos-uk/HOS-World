'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { SafeImage } from '@/components/SafeImage';

type DuplicateGroup = {
  groupId: string;
  submissions: Array<{
    id: string;
    sellerId: string;
    sellerStoreName: string;
    sellerSlug: string;
    productName: string;
    productData: Record<string, unknown>;
    createdAt: string;
    status: string;
  }>;
  matchReasons: string[];
  suggestedPrimaryId: string;
};

export default function ProcurementSubmissionsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>}>
      <ProcurementSubmissionsContent />
    </Suspense>
  );
}

function ProcurementSubmissionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, effectiveRole } = useAuth();
  const currentRole = effectiveRole || user?.role;

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('SUBMITTED');
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Cross-seller duplicate groups (same product from multiple sellers)
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [duplicateGroupsLoading, setDuplicateGroupsLoading] = useState(false);
  const [showDuplicateGroups, setShowDuplicateGroups] = useState(false);
  const [rejectOthersLoading, setRejectOthersLoading] = useState<string | null>(null); // groupId when loading
  const toast = useToast();

  // Form state for approve/reject
  const [quantity, setQuantity] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [rejectReason, setRejectReason] = useState<string>('');

  // Layout reflects current user role: CATALOG users see Catalog context when on this shared page
  const isCatalogContext = currentRole === 'CATALOG';
  const layoutTitle = isCatalogContext ? 'Catalog' : 'Procurement';
  const layoutRole = isCatalogContext ? 'CATALOG' : 'PROCUREMENT';
  const menuItems = isCatalogContext
    ? [
        { title: 'Dashboard', href: '/catalog/dashboard', icon: '📊' },
        { title: 'Same product from multiple sellers', href: '/procurement/submissions?view=cross-seller', icon: '🔄', badge: duplicateGroups.length },
      ]
    : [
        { title: 'Dashboard', href: '/procurement/dashboard', icon: '📊' },
        { title: 'Review Submissions', href: '/procurement/submissions', icon: '📦', badge: submissions.filter(s => s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW').length },
      ];

  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchSubmissions();
    };
    const interval = setInterval(fetchSubmissions, 60_000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (searchParams.get('view') === 'cross-seller') setShowDuplicateGroups(true);
  }, [searchParams]);

  const fetchDuplicateGroups = useCallback(async () => {
    try {
      setDuplicateGroupsLoading(true);
      const response = await apiClient.getCrossSellerDuplicateGroups();
      if (response?.data) {
        setDuplicateGroups(Array.isArray(response.data) ? response.data : []);
      }
    } catch (err: any) {
      console.error('Error fetching cross-seller duplicate groups:', err);
      setDuplicateGroups([]);
    } finally {
      setDuplicateGroupsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showDuplicateGroups) fetchDuplicateGroups();
  }, [showDuplicateGroups, fetchDuplicateGroups]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getProcurementSubmissions(statusFilter);
      if (response?.data) {
        setSubmissions(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching submissions:', err);
      setError(err.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (submissionId: string) => {
    try {
      const response = await apiClient.getProcurementSubmission(submissionId);
      if (response?.data) {
        setSelectedSubmission(response.data);
        setActionType(null);
        setShowModal(true);
      }
    } catch (err: any) {
      console.error('Error fetching submission details:', err);
      setError(err.message || 'Failed to load submission details');
    }
  };

  const handleApprove = async () => {
    if (!selectedSubmission) return;

    try {
      setActionLoading(true);
      await apiClient.approveProcurementSubmission(selectedSubmission.id, {
        selectedQuantity: quantity ? parseInt(quantity) : undefined,
        notes: notes || undefined,
      });
      setShowModal(false);
      setSelectedSubmission(null);
      setQuantity('');
      setNotes('');
      toast.success('Submission approved successfully');
      await fetchSubmissions();
      if (showDuplicateGroups) await fetchDuplicateGroups();
    } catch (err: any) {
      console.error('Error approving submission:', err);
      toast.error(err.message || 'Failed to approve submission');
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
      await apiClient.rejectProcurementSubmission(selectedSubmission.id, {
        reason: rejectReason,
      });
      setShowModal(false);
      setSelectedSubmission(null);
      setRejectReason('');
      toast.success('Submission rejected');
      await fetchSubmissions();
      if (showDuplicateGroups) await fetchDuplicateGroups();
    } catch (err: any) {
      console.error('Error rejecting submission:', err);
      toast.error(err.message || 'Failed to reject submission');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return 'bg-blue-100 text-blue-800';
      case 'UNDER_REVIEW':
        return 'bg-yellow-100 text-yellow-800';
      case 'PROCUREMENT_APPROVED':
        return 'bg-green-100 text-green-800';
      case 'PROCUREMENT_REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <RouteGuard allowedRoles={['PROCUREMENT', 'CATALOG', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role={layoutRole} menuItems={menuItems} title={layoutTitle}>
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Review Submissions</h1>
          <p className="text-gray-600 mt-2">Review and approve product submissions from sellers</p>
        </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              <p className="font-semibold">Error</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Toggle: All submissions vs Same product from multiple sellers */}
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-gray-700">View:</span>
            <button
              onClick={() => setShowDuplicateGroups(false)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                !showDuplicateGroups ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All submissions
            </button>
            <button
              onClick={() => setShowDuplicateGroups(true)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                showDuplicateGroups ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Same product from multiple sellers
            </button>
          </div>

          {/* Cross-seller duplicate groups section */}
          {showDuplicateGroups && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Duplicate groups — approve one per product
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                These submissions represent the same product from different sellers/wholesalers. Approve only one per product.
              </p>
              {duplicateGroupsLoading && (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600"></div>
                </div>
              )}
              {!duplicateGroupsLoading && duplicateGroups.length === 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                  <p className="text-gray-500">No duplicate groups found. No same product submitted by multiple sellers.</p>
                </div>
              )}
              {!duplicateGroupsLoading && duplicateGroups.length > 0 && (
                <div className="space-y-6">
                  {duplicateGroups.map((group) => (
                    <div
                      key={group.groupId}
                      className="bg-amber-50 border border-amber-200 rounded-lg p-6"
                    >
                      <div className="flex flex-wrap gap-2 mb-3">
                        {group.matchReasons.map((r) => (
                          <span key={r} className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded text-xs font-medium">
                            {r}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm font-medium text-amber-900 mb-3">
                        Same product from {group.submissions.length} seller(s) — approve one, reject others
                      </p>
                      <div className="space-y-3">
                        {group.submissions.map((sub) => (
                          <div
                            key={sub.id}
                            className="bg-white border border-amber-100 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3"
                          >
                            <div>
                              <p className="font-medium text-gray-900">{sub.productName}</p>
                              <p className="text-sm text-gray-600">
                                Seller: {sub.sellerStoreName} · {new Date(sub.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleViewDetails(sub.id)}
                                className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                              >
                                View
                              </button>
                              {sub.id === group.suggestedPrimaryId && (
                                <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Suggested</span>
                              )}
                              {(sub.status === 'SUBMITTED' || sub.status === 'UNDER_REVIEW') && (
                                <>
                                  <button
                                    onClick={() => {
                                      setSelectedSubmission({ id: sub.id, productData: sub.productData, seller: { storeName: sub.sellerStoreName }, status: sub.status, createdAt: sub.createdAt });
                                      setActionType('approve');
                                      setShowModal(true);
                                      setQuantity('');
                                      setNotes('');
                                    }}
                                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedSubmission({ id: sub.id, productData: sub.productData, seller: { storeName: sub.sellerStoreName }, status: sub.status, createdAt: sub.createdAt });
                                      setActionType('reject');
                                      setShowModal(true);
                                      setRejectReason('Duplicate: another seller’s submission approved for this product.');
                                    }}
                                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                                  >
                                    Reject as duplicate
                                  </button>
                                  {group.submissions.filter((s) => s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW').length > 1 && (
                                    <button
                                      onClick={async () => {
                                        if (rejectOthersLoading) return;
                                        try {
                                          setRejectOthersLoading(group.groupId);
                                          await apiClient.rejectOthersInGroup(group.groupId, sub.id);
                                          toast.success('Others rejected — this submission kept');
                                          await fetchDuplicateGroups();
                                          await fetchSubmissions();
                                        } catch (err: any) {
                                          console.error('Reject others failed:', err);
                                          toast.error(err?.message || 'Failed to reject others');
                                        } finally {
                                          setRejectOthersLoading(null);
                                        }
                                      }}
                                      disabled={!!rejectOthersLoading}
                                      className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                                    >
                                      {rejectOthersLoading === group.groupId ? 'Rejecting…' : 'Keep this & reject others'}
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Status Filter (when not showing duplicate groups) */}
          {!showDuplicateGroups && (
          <div className="mb-6 flex gap-2 flex-wrap">
            {['SUBMITTED', 'UNDER_REVIEW', 'PROCUREMENT_APPROVED', 'PROCUREMENT_REJECTED'].map(
              (status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {status.replace(/_/g, ' ')}
                </button>
              )
            )}
          </div>
          )}

          {!showDuplicateGroups && loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          )}

          {!showDuplicateGroups && !loading && submissions.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-500 text-lg">No submissions found for this status</p>
            </div>
          )}

          {!showDuplicateGroups && !loading && submissions.length > 0 && (
            <div className="space-y-4">
              {submissions.map((submission) => {
                const productData = submission.productData || {};
                return (
                  <div
                    key={submission.id}
                    className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {productData.name || 'Untitled Product'}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                              Seller: {submission.seller?.storeName || 'Unknown'}
                            </p>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(
                              submission.status
                            )}`}
                          >
                            {submission.status.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                          {productData.description || 'No description'}
                        </p>

                        <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
                          {productData.sku && (
                            <span>
                              <strong>SKU:</strong> {productData.sku}
                            </span>
                          )}
                          {productData.price && (
                            <span>
                              <strong>Price:</strong> {productData.currency || 'GBP'}{' '}
                              {parseFloat(productData.price).toFixed(2)}
                            </span>
                          )}
                          {productData.stock !== undefined && (
                            <span>
                              <strong>Stock:</strong> {productData.stock}
                            </span>
                          )}
                          <span>
                            <strong>Submitted:</strong>{' '}
                            {new Date(submission.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {submission.duplicateProducts && submission.duplicateProducts.length > 0 && (
                          <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded">
                            <p className="text-sm font-medium text-orange-800">
                              ⚠️ {submission.duplicateProducts.length} potential duplicate(s) detected
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 sm:flex-col">
                        <button
                          onClick={() => handleViewDetails(submission.id)}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm whitespace-nowrap"
                        >
                          View Details
                        </button>
                        {submission.status === 'SUBMITTED' || submission.status === 'UNDER_REVIEW' ? (
                          <>
                            <button
                              onClick={() => {
                                setSelectedSubmission(submission);
                                setActionType('approve');
                                setShowModal(true);
                                setQuantity('');
                                setNotes('');
                              }}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm whitespace-nowrap"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setSelectedSubmission(submission);
                                setActionType('reject');
                                setShowModal(true);
                                setRejectReason('');
                              }}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm whitespace-nowrap"
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Modal for Details/Approve/Reject */}
          {showModal && selectedSubmission && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold">
                      {actionType === 'approve'
                        ? 'Approve Submission'
                        : actionType === 'reject'
                          ? 'Reject Submission'
                          : 'Submission Details'}
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
                          {selectedSubmission.productData?.name || 'Untitled Product'}
                        </h3>
                        <p className="text-gray-600">
                          {selectedSubmission.productData?.description || 'No description'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-500">Seller</p>
                          <p className="text-gray-900">{selectedSubmission.seller?.storeName || 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Status</p>
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusBadgeColor(
                              selectedSubmission.status
                            )}`}
                          >
                            {selectedSubmission.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {selectedSubmission.productData?.sku && (
                          <div>
                            <p className="text-sm font-medium text-gray-500">SKU</p>
                            <p className="text-gray-900">{selectedSubmission.productData.sku}</p>
                          </div>
                        )}
                        {selectedSubmission.productData?.price && (
                          <div>
                            <p className="text-sm font-medium text-gray-500">Price</p>
                            <p className="text-gray-900">
                              {selectedSubmission.productData.currency || 'GBP'}{' '}
                              {parseFloat(selectedSubmission.productData.price).toFixed(2)}
                            </p>
                          </div>
                        )}
                        {selectedSubmission.productData?.stock !== undefined && (
                          <div>
                            <p className="text-sm font-medium text-gray-500">Stock</p>
                            <p className="text-gray-900">{selectedSubmission.productData.stock}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-500">Submitted</p>
                          <p className="text-gray-900">
                            {selectedSubmission.createdAt
                              ? new Date(selectedSubmission.createdAt).toLocaleString()
                              : '—'}
                          </p>
                        </div>
                      </div>

                      {selectedSubmission.productData?.images &&
                        selectedSubmission.productData.images.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-500 mb-2">Images</p>
                            <div className="grid grid-cols-3 gap-2">
                              {selectedSubmission.productData.images.map((img: any, idx: number) => (
                                <div key={idx} className="relative w-full h-24">
                                  <SafeImage
                                    src={img.url}
                                    alt={img.alt || `Product image ${idx + 1}`}
                                    fill
                                    className="object-cover rounded"
                                    sizes="33vw"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      {selectedSubmission.procurementNotes && (
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-1">Procurement Notes</p>
                          <p className="text-gray-900 bg-gray-50 p-3 rounded">{selectedSubmission.procurementNotes}</p>
                        </div>
                      )}

                      <div className="flex gap-3 pt-4">
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

                  {actionType === 'approve' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Selected Quantity (Optional)
                        </label>
                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          min="1"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="Leave empty to use submitted quantity"
                        />
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
                          placeholder="Add notes about this approval..."
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

