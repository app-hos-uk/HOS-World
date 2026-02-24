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
  const [compareProduct, setCompareProduct] = useState<any | null>(null);
  const [compareSubmissionData, setCompareSubmissionData] = useState<any | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
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
      setCompareProduct(null);
      setCompareSubmissionData(null);
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
      setCompareProduct(null);
      setCompareSubmissionData(null);
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
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-amber-900">
                          Same product from {group.submissions.length} seller(s) — approve one, reject others
                        </p>
                        <button
                          onClick={() => setExpandedGroupId(expandedGroupId === group.groupId ? null : group.groupId)}
                          className="px-3 py-1.5 text-xs bg-white border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-100 font-medium"
                        >
                          {expandedGroupId === group.groupId ? 'Hide Comparison' : 'Compare All'}
                        </button>
                      </div>

                      {expandedGroupId === group.groupId && (
                        <div className="mb-4 overflow-x-auto border border-amber-200 rounded-lg bg-white">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-amber-50">
                                <th className="px-3 py-2 text-left text-xs font-semibold text-amber-800 border-r border-amber-200 w-24">Field</th>
                                {group.submissions.map((s) => (
                                  <th key={s.id} className={`px-3 py-2 text-left text-xs font-semibold border-r last:border-r-0 border-amber-200 ${s.id === group.suggestedPrimaryId ? 'text-green-800 bg-green-50' : 'text-gray-700'}`}>
                                    {s.sellerStoreName}
                                    {s.id === group.suggestedPrimaryId && <span className="ml-1 text-[10px] bg-green-200 text-green-900 px-1 rounded">Primary</span>}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {['name', 'sku', 'barcode', 'ean', 'price', 'stock', 'category'].map((field) => {
                                const vals = group.submissions.map((s) => {
                                  const pd = s.productData as Record<string, any>;
                                  if (field === 'price' && pd?.price != null) return `${pd.currency || 'GBP'} ${parseFloat(pd.price).toFixed(2)}`;
                                  return pd?.[field]?.toString() || '—';
                                });
                                const allSame = vals.every((v) => v === vals[0]);
                                return (
                                  <tr key={field}>
                                    <td className="px-3 py-2 font-medium text-gray-600 border-r border-gray-200 capitalize">{field}</td>
                                    {vals.map((v, i) => (
                                      <td key={i} className={`px-3 py-2 border-r last:border-r-0 border-gray-100 ${allSame && v !== '—' ? 'bg-green-50 text-green-800' : !allSame && v !== '—' ? 'bg-amber-50 text-amber-800' : 'text-gray-500'}`}>
                                        {v}
                                      </td>
                                    ))}
                                  </tr>
                                );
                              })}
                              <tr>
                                <td className="px-3 py-2 font-medium text-gray-600 border-r border-gray-200">Submitted</td>
                                {group.submissions.map((s) => (
                                  <td key={s.id} className="px-3 py-2 border-r last:border-r-0 border-gray-100 text-gray-600">
                                    {new Date(s.createdAt).toLocaleDateString()}
                                  </td>
                                ))}
                              </tr>
                              <tr>
                                <td className="px-3 py-2 font-medium text-gray-600 border-r border-gray-200">Status</td>
                                {group.submissions.map((s) => (
                                  <td key={s.id} className="px-3 py-2 border-r last:border-r-0 border-gray-100">
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusBadgeColor(s.status)}`}>{s.status.replace(/_/g, ' ')}</span>
                                  </td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}

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

                        {submission.duplicateProducts && submission.duplicateProducts.length > 0 && (() => {
                          const topMatch = submission.duplicateProducts[0];
                          const score = topMatch.similarityScore ?? 0;
                          const isHigh = score >= 90;
                          return (
                            <div
                              className={`mt-3 p-3 rounded cursor-pointer ${isHigh ? 'bg-red-50 border border-red-300' : 'bg-orange-50 border border-orange-200'}`}
                              onClick={() => handleViewDetails(submission.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium ${isHigh ? 'text-red-800' : 'text-orange-800'}`}>
                                    {submission.duplicateProducts.length} duplicate(s) found
                                  </p>
                                  <p className={`text-xs mt-0.5 truncate ${isHigh ? 'text-red-600' : 'text-orange-600'}`}>
                                    Top match: &ldquo;{topMatch.existingProduct?.name}&rdquo;
                                    {topMatch.existingProduct?.sku ? ` (SKU: ${topMatch.existingProduct.sku})` : ''}
                                  </p>
                                </div>
                                <span className={`ml-3 shrink-0 px-2 py-1 rounded text-xs font-bold ${isHigh ? 'bg-red-200 text-red-900' : 'bg-orange-200 text-orange-900'}`}>
                                  {score}% match
                                </span>
                              </div>
                            </div>
                          );
                        })()}
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
                        setCompareProduct(null);
                        setCompareSubmissionData(null);
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

                      {selectedSubmission.duplicateProducts && selectedSubmission.duplicateProducts.length > 0 && (
                        <div className="border border-orange-300 rounded-lg overflow-hidden">
                          <div className="bg-orange-50 px-4 py-3 border-b border-orange-200">
                            <h4 className="font-semibold text-orange-900">
                              {selectedSubmission.duplicateProducts.length} Similar Product(s) Found
                            </h4>
                            <p className="text-xs text-orange-700 mt-0.5">Compare the submitted product against existing catalogue matches</p>
                          </div>
                          <div className="divide-y divide-orange-100">
                            {selectedSubmission.duplicateProducts.map((dup: any) => {
                              const ep = dup.existingProduct;
                              const score = dup.similarityScore ?? 0;
                              const isHigh = score >= 90;
                              return (
                                <div key={dup.id || ep?.id} className="p-4 bg-white">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-gray-900 truncate">{ep?.name || 'Unknown'}</p>
                                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                                        {ep?.sku && <span>SKU: {ep.sku}</span>}
                                        {ep?.barcode && <span>Barcode: {ep.barcode}</span>}
                                        {ep?.ean && <span>EAN: {ep.ean}</span>}
                                        {ep?.price && <span>Price: {ep.currency || 'GBP'} {parseFloat(ep.price).toFixed(2)}</span>}
                                        {ep?.status && <span className="px-1.5 py-0.5 bg-gray-100 rounded">{ep.status}</span>}
                                      </div>
                                      {ep?.images && ep.images.length > 0 && (
                                        <div className="flex gap-1 mt-2">
                                          {ep.images.slice(0, 3).map((img: any, i: number) => (
                                            <div key={i} className="relative w-10 h-10 shrink-0">
                                              <SafeImage src={img.url} alt={img.alt || ''} fill className="object-cover rounded" sizes="40px" />
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                      <div className="text-right">
                                        <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${isHigh ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                                          {score}% match
                                        </span>
                                        <div className="w-20 h-1.5 bg-gray-200 rounded-full mt-1">
                                          <div className={`h-full rounded-full ${isHigh ? 'bg-red-500' : score >= 80 ? 'bg-orange-400' : 'bg-yellow-400'}`} style={{ width: `${score}%` }} />
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => {
                                          setCompareProduct(ep);
                                          setCompareSubmissionData(selectedSubmission.productData);
                                        }}
                                        className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                                      >
                                        Compare Side-by-Side
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
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
          {/* Side-by-Side Comparison Modal */}
          {compareProduct && compareSubmissionData && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[60]">
              <div className="bg-white rounded-lg max-w-5xl w-full max-h-[92vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                  <h2 className="text-xl font-bold text-gray-900">Side-by-Side Comparison</h2>
                  <button
                    onClick={() => { setCompareProduct(null); setCompareSubmissionData(null); }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="text-center">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold mb-3">Submitted Product</span>
                    </div>
                    <div className="text-center">
                      <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold mb-3">Existing Product</span>
                    </div>
                  </div>

                  {(() => {
                    const sub = compareSubmissionData;
                    const ex = compareProduct;
                    const fields: Array<{ label: string; subVal: string; exVal: string }> = [
                      { label: 'Name', subVal: sub?.name || '—', exVal: ex?.name || '—' },
                      { label: 'SKU', subVal: sub?.sku || '—', exVal: ex?.sku || '—' },
                      { label: 'Barcode', subVal: sub?.barcode || '—', exVal: ex?.barcode || '—' },
                      { label: 'EAN', subVal: sub?.ean || '—', exVal: ex?.ean || '—' },
                      { label: 'Price', subVal: sub?.price ? `${sub.currency || 'GBP'} ${parseFloat(sub.price).toFixed(2)}` : '—', exVal: ex?.price ? `${ex.currency || 'GBP'} ${parseFloat(ex.price).toFixed(2)}` : '—' },
                      { label: 'Stock', subVal: sub?.stock?.toString() ?? '—', exVal: ex?.stock?.toString() ?? '—' },
                      { label: 'Category', subVal: sub?.category || '—', exVal: ex?.category || '—' },
                      { label: 'Status', subVal: 'Submission', exVal: ex?.status || '—' },
                    ];

                    return (
                      <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                        {fields.map((f, i) => {
                          const match = f.subVal === f.exVal && f.subVal !== '—';
                          const bothEmpty = f.subVal === '—' && f.exVal === '—';
                          return (
                            <div key={f.label} className={`grid grid-cols-[120px_1fr_1fr] ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                              <div className="px-4 py-3 font-medium text-sm text-gray-600 border-r border-gray-200">{f.label}</div>
                              <div className={`px-4 py-3 text-sm border-r border-gray-200 ${match ? 'bg-green-50 text-green-800' : bothEmpty ? '' : f.subVal !== '—' && f.exVal !== '—' && f.subVal !== f.exVal ? 'bg-amber-50 text-amber-800' : ''}`}>
                                {f.subVal}
                              </div>
                              <div className={`px-4 py-3 text-sm ${match ? 'bg-green-50 text-green-800' : bothEmpty ? '' : f.subVal !== '—' && f.exVal !== '—' && f.subVal !== f.exVal ? 'bg-amber-50 text-amber-800' : ''}`}>
                                {f.exVal}
                              </div>
                            </div>
                          );
                        })}

                        <div className="grid grid-cols-[120px_1fr_1fr] bg-white border-t border-gray-200">
                          <div className="px-4 py-3 font-medium text-sm text-gray-600 border-r border-gray-200">Description</div>
                          <div className="px-4 py-3 text-sm border-r border-gray-200">
                            <p className="line-clamp-4 text-gray-700">{sub?.description || '—'}</p>
                          </div>
                          <div className="px-4 py-3 text-sm">
                            <p className="line-clamp-4 text-gray-700">{ex?.description || '—'}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-[120px_1fr_1fr] bg-gray-50 border-t border-gray-200">
                          <div className="px-4 py-3 font-medium text-sm text-gray-600 border-r border-gray-200">Images</div>
                          <div className="px-4 py-3 border-r border-gray-200">
                            <div className="flex gap-1 flex-wrap">
                              {(sub?.images || []).slice(0, 4).map((img: any, i: number) => (
                                <div key={i} className="relative w-16 h-16">
                                  <SafeImage src={img.url || img} alt={img.alt || ''} fill className="object-cover rounded" sizes="64px" />
                                </div>
                              ))}
                              {(!sub?.images || sub.images.length === 0) && <span className="text-xs text-gray-400">No images</span>}
                            </div>
                          </div>
                          <div className="px-4 py-3">
                            <div className="flex gap-1 flex-wrap">
                              {(ex?.images || []).slice(0, 4).map((img: any, i: number) => (
                                <div key={i} className="relative w-16 h-16">
                                  <SafeImage src={img.url || img} alt={img.alt || ''} fill className="object-cover rounded" sizes="64px" />
                                </div>
                              ))}
                              {(!ex?.images || ex.images.length === 0) && <span className="text-xs text-gray-400">No images</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => { setCompareProduct(null); setCompareSubmissionData(null); }}
                      className="px-5 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-sm"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
      </DashboardLayout>
    </RouteGuard>
  );
}

