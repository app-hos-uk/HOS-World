'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { SafeImage } from '@/components/SafeImage';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { DataExport } from '@/components/DataExport';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts';

/** Submission images can be URL strings or objects with url (from seller submit form). */
function getImageUrl(img: string | { url: string; alt?: string; order?: number } | undefined): string | undefined {
  if (img == null) return undefined;
  return typeof img === 'string' ? img : img?.url;
}

interface DuplicateProduct {
  id: string;
  similarityScore: number;
  existingProduct?: {
    id: string;
    name: string;
    slug?: string;
    sku?: string;
    barcode?: string;
    ean?: string;
    price?: number;
    currency?: string;
    status?: string;
  };
}

interface Submission {
  id: string;
  status: string;
  productData?: {
    name?: string;
    description?: string;
    price?: number;
    currency?: string;
    sku?: string;
    stock?: number;
    images?: (string | { url: string; alt?: string; order?: number })[];
  };
  catalogEntry?: {
    title?: string;
    description?: string;
  };
  seller?: {
    id: string;
    email: string;
    storeName?: string;
  };
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  duplicateProducts?: DuplicateProduct[];
  procurementNotes?: string;
  catalogNotes?: string;
  marketingNotes?: string;
  financeNotes?: string;
  rejectionReason?: string;
  selectedQuantity?: number;
  procurementApprovedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

interface Stats {
  total: number;
  submitted: number;
  underReview: number;
  procurementApproved: number;
  catalogCompleted: number;
  marketingCompleted: number;
  financeApproved: number;
  published: number;
  rejected: number;
}

const STATUSES = [
  { value: 'SUBMITTED', label: 'Submitted', color: 'bg-gray-100 text-gray-800', chartColor: '#9ca3af' },
  { value: 'UNDER_REVIEW', label: 'Under Review', color: 'bg-yellow-100 text-yellow-800', chartColor: '#fbbf24' },
  { value: 'PROCUREMENT_APPROVED', label: 'Procurement OK', color: 'bg-blue-100 text-blue-800', chartColor: '#3b82f6' },
  { value: 'CATALOG_COMPLETED', label: 'Catalog Done', color: 'bg-indigo-100 text-indigo-800', chartColor: '#6366f1' },
  { value: 'MARKETING_COMPLETED', label: 'Marketing Done', color: 'bg-purple-100 text-purple-800', chartColor: '#8b5cf6' },
  { value: 'FINANCE_APPROVED', label: 'Finance OK', color: 'bg-cyan-100 text-cyan-800', chartColor: '#06b6d4' },
  { value: 'PUBLISHED', label: 'Published', color: 'bg-green-100 text-green-800', chartColor: '#10b981' },
  { value: 'REJECTED', label: 'Rejected', color: 'bg-red-100 text-red-800', chartColor: '#ef4444' },
];

const COLORS = ['#9ca3af', '#fbbf24', '#3b82f6', '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#ef4444'];

export default function AdminSubmissionsPage() {
  const toast = useToast();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'status' | 'seller'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Modals
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionNotes, setActionNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [publishLoading, setPublishLoading] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // No status = return ALL submissions (admin overview). Procurement uses status filter for their queue.
      const response = await apiClient.getProcurementSubmissions();
      const data = response?.data || [];
      const submissionList = Array.isArray(data) ? data : [];
      setSubmissions(submissionList);
      calculateStats(submissionList);
    } catch (err: any) {
      console.error('Error fetching submissions:', err);
      setError(err.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateStats = (submissionList: Submission[]) => {
    setStats({
      total: submissionList.length,
      submitted: submissionList.filter(s => s.status === 'SUBMITTED').length,
      underReview: submissionList.filter(s => s.status === 'UNDER_REVIEW').length,
      procurementApproved: submissionList.filter(s => s.status === 'PROCUREMENT_APPROVED').length,
      catalogCompleted: submissionList.filter(s => s.status === 'CATALOG_COMPLETED').length,
      marketingCompleted: submissionList.filter(s => s.status === 'MARKETING_COMPLETED').length,
      financeApproved: submissionList.filter(s => s.status === 'FINANCE_APPROVED').length,
      published: submissionList.filter(s => s.status === 'PUBLISHED').length,
      rejected: submissionList.filter(s => s.status === 'REJECTED').length,
    });
  };

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // Auto-refresh every 60 seconds and on window focus
  useEffect(() => {
    const interval = setInterval(fetchSubmissions, 60_000);
    const onFocus = () => fetchSubmissions();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchSubmissions]);

  // Filtered and sorted submissions
  const filteredSubmissions = useMemo(() => {
    let filtered = [...submissions];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.productData?.name?.toLowerCase().includes(term) ||
        s.catalogEntry?.title?.toLowerCase().includes(term) ||
        s.seller?.storeName?.toLowerCase().includes(term) ||
        s.seller?.email?.toLowerCase().includes(term) ||
        s.user?.email?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(s => s.status === statusFilter);
    }

    // Date filter
    if (dateFilter !== 'ALL') {
      const now = new Date();
      let startDate: Date;
      switch (dateFilter) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0);
      }
      filtered = filtered.filter(s => new Date(s.createdAt) >= startDate);
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'seller':
          comparison = (a.seller?.storeName || a.seller?.email || '').localeCompare(b.seller?.storeName || b.seller?.email || '');
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [submissions, searchTerm, statusFilter, dateFilter, sortBy, sortOrder]);

  // Chart data
  const chartData = useMemo(() => {
    return STATUSES.map(s => ({
      name: s.label,
      value: submissions.filter(sub => sub.status === s.value).length,
    })).filter(d => d.value > 0);
  }, [submissions]);

  const handleViewDetails = (submission: Submission) => {
    setSelectedSubmission(submission);
    setShowDetailModal(true);
  };

  const handleAction = (submission: Submission, action: 'approve' | 'reject') => {
    setSelectedSubmission(submission);
    setActionType(action);
    setActionNotes('');
    setRejectionReason('');
    setShowActionModal(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedSubmission || !actionType) return;

    if (actionType === 'reject' && !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setActionLoading(true);
      
      if (actionType === 'approve') {
        await apiClient.approveProcurementSubmission(selectedSubmission.id, {
          notes: actionNotes || undefined,
        });
        toast.success('Submission approved successfully');
      } else {
        await apiClient.rejectProcurementSubmission(selectedSubmission.id, {
          reason: rejectionReason,
        });
        toast.success('Submission rejected');
      }
      
      setShowActionModal(false);
      setShowDetailModal(false);
      fetchSubmissions();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${actionType} submission`);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async (submission: Submission) => {
    try {
      setPublishLoading(submission.id);
      await apiClient.publishSubmission(submission.id);
      toast.success('Product published successfully');
      setShowDetailModal(false);
      fetchSubmissions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish product');
    } finally {
      setPublishLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = STATUSES.find(s => s.value === status) || { label: status, color: 'bg-gray-100 text-gray-800' };
    return <span className={`px-2 py-0.5 text-xs rounded-full ${statusInfo.color}`}>{statusInfo.label}</span>;
  };

  const getWorkflowStep = (status: string): number => {
    const steps = ['SUBMITTED', 'UNDER_REVIEW', 'PROCUREMENT_APPROVED', 'CATALOG_COMPLETED', 'MARKETING_COMPLETED', 'FINANCE_APPROVED', 'PUBLISHED'];
    return steps.indexOf(status);
  };

  const exportColumns = [
    { key: 'productData', header: 'Product', format: (v: any) => v?.name || '' },
    { key: 'seller', header: 'Seller', format: (v: any) => v?.storeName || v?.email || '' },
    { key: 'status', header: 'Status' },
    { key: 'createdAt', header: 'Submitted', format: (v: string) => new Date(v).toLocaleDateString() },
    { key: 'productData', header: 'Price', format: (v: any) => v?.price ? `${v.currency || 'GBP'} ${Number(v.price).toFixed(2)}` : '' },
  ];

  return (
    <RouteGuard allowedRoles={['ADMIN', 'PROCUREMENT']}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Product Submissions</h1>
              <p className="text-gray-600 mt-1">Review and manage seller product submissions</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchSubmissions()}
                disabled={loading}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              <DataExport data={filteredSubmissions} columns={exportColumns} filename="submissions-export" />
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-3">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${statusFilter === 'ALL' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-xl font-bold text-gray-900">{stats.total}</p>
              </button>
              <button
                onClick={() => setStatusFilter('SUBMITTED')}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${statusFilter === 'SUBMITTED' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">New</p>
                <p className="text-xl font-bold text-gray-600">{stats.submitted}</p>
              </button>
              <button
                onClick={() => setStatusFilter('UNDER_REVIEW')}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${statusFilter === 'UNDER_REVIEW' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Review</p>
                <p className="text-xl font-bold text-yellow-600">{stats.underReview}</p>
              </button>
              <button
                onClick={() => setStatusFilter('PROCUREMENT_APPROVED')}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${statusFilter === 'PROCUREMENT_APPROVED' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Procurement</p>
                <p className="text-xl font-bold text-blue-600">{stats.procurementApproved}</p>
              </button>
              <button
                onClick={() => setStatusFilter('CATALOG_COMPLETED')}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${statusFilter === 'CATALOG_COMPLETED' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Catalog</p>
                <p className="text-xl font-bold text-indigo-600">{stats.catalogCompleted}</p>
              </button>
              <button
                onClick={() => setStatusFilter('MARKETING_COMPLETED')}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${statusFilter === 'MARKETING_COMPLETED' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Marketing</p>
                <p className="text-xl font-bold text-purple-600">{stats.marketingCompleted}</p>
              </button>
              <button
                onClick={() => setStatusFilter('FINANCE_APPROVED')}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${statusFilter === 'FINANCE_APPROVED' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Finance</p>
                <p className="text-xl font-bold text-cyan-600">{stats.financeApproved}</p>
              </button>
              <button
                onClick={() => setStatusFilter('PUBLISHED')}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${statusFilter === 'PUBLISHED' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Published</p>
                <p className="text-xl font-bold text-green-600">{stats.published}</p>
              </button>
              <button
                onClick={() => setStatusFilter('REJECTED')}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${statusFilter === 'REJECTED' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Rejected</p>
                <p className="text-xl font-bold text-red-600">{stats.rejected}</p>
              </button>
            </div>
          )}

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Submissions by Status</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
              <button onClick={fetchSubmissions} className="mt-2 text-red-600 hover:text-red-800 text-sm">Retry</button>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Product, seller..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ALL">All Status</option>
                  {STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ALL">All Time</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field as any);
                    setSortOrder(order as any);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="status-asc">Status A-Z</option>
                  <option value="seller-asc">Seller A-Z</option>
                </select>
              </div>
            </div>
          </div>

          {/* Submissions Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Submissions ({filteredSubmissions.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seller</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredSubmissions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                          No submissions found
                        </td>
                      </tr>
                    ) : (
                      filteredSubmissions.map((submission) => (
                        <tr key={submission.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {(() => {
                                const thumbUrl = getImageUrl(submission.productData?.images?.[0]);
                                return thumbUrl ? (
                                  <SafeImage
                                    src={thumbUrl}
                                    alt=""
                                    width={40}
                                    height={40}
                                    className="rounded object-cover bg-gray-100"
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-xs">No img</div>
                                );
                              })()}
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {submission.productData?.name || submission.catalogEntry?.title || 'Untitled'}
                                </p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {submission.productData?.sku && (
                                    <span className="text-xs text-gray-500">SKU: {submission.productData.sku}</span>
                                  )}
                                  {submission.duplicateProducts && submission.duplicateProducts.length > 0 && (
                                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                      submission.procurementNotes?.includes('[Duplicate acknowledged]')
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-red-100 text-red-700'
                                    }`}>
                                      {submission.duplicateProducts.length} dup{submission.duplicateProducts.length > 1 ? 's' : ''}
                                      {submission.procurementNotes?.includes('[Duplicate acknowledged]') && ' (ack)'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{submission.seller?.storeName || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">{submission.seller?.email || submission.user?.email}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {submission.productData?.price 
                              ? `${submission.productData.currency || 'GBP'} ${Number(submission.productData.price).toFixed(2)}`
                              : 'N/A'}
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(submission.status)}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(submission.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => handleViewDetails(submission)}
                                className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                              >
                                View
                              </button>
                              {['SUBMITTED', 'UNDER_REVIEW'].includes(submission.status) && (
                                <>
                                  <button
                                    onClick={() => handleAction(submission, 'approve')}
                                    className="px-2 py-1 text-sm text-green-600 hover:bg-green-50 rounded"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleAction(submission, 'reject')}
                                    className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {submission.status === 'FINANCE_APPROVED' && (
                                <button
                                  onClick={() => handlePublish(submission)}
                                  disabled={publishLoading === submission.id}
                                  className="px-2 py-1 text-sm text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
                                >
                                  {publishLoading === submission.id ? 'Publishing...' : 'Publish'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detail Modal */}
          {showDetailModal && selectedSubmission && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-2xl font-bold">Submission Details</h2>
                      <p className="text-sm text-gray-500">ID: {selectedSubmission.id}</p>
                    </div>
                    <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                  </div>

                  <div className="space-y-6">
                    {/* Workflow Progress */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold mb-3">Workflow Progress</h3>
                      <div className="flex items-center justify-between">
                        {['Submitted', 'Review', 'Procurement', 'Catalog', 'Marketing', 'Finance', 'Published'].map((step, index) => {
                          const currentStep = getWorkflowStep(selectedSubmission.status);
                          const isCompleted = index <= currentStep && selectedSubmission.status !== 'REJECTED';
                          const isCurrent = index === currentStep;
                          return (
                            <div key={step} className="flex flex-col items-center flex-1">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                isCompleted ? 'bg-green-500 text-white' : isCurrent ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-500'
                              }`}>
                                {isCompleted ? '✓' : index + 1}
                              </div>
                              <p className={`text-xs mt-1 ${isCurrent ? 'font-medium' : 'text-gray-500'}`}>{step}</p>
                            </div>
                          );
                        })}
                      </div>
                      {selectedSubmission.status === 'REJECTED' && (
                        <div className="mt-3 p-3 bg-red-50 rounded-lg">
                          <p className="text-sm text-red-800 font-medium">Rejected</p>
                          {selectedSubmission.rejectionReason && (
                            <p className="text-sm text-red-600 mt-1">{selectedSubmission.rejectionReason}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h3 className="font-semibold mb-2">Product Information</h3>
                        <div className="space-y-2 text-sm">
                          <div>
                            <p className="text-gray-500">Name</p>
                            <p className="font-medium">{selectedSubmission.productData?.name || selectedSubmission.catalogEntry?.title || 'N/A'}</p>
                          </div>
                          {selectedSubmission.productData?.sku && (
                            <div>
                              <p className="text-gray-500">SKU</p>
                              <p className="font-medium">{selectedSubmission.productData.sku}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-gray-500">Price</p>
                            <p className="font-medium">
                              {selectedSubmission.productData?.price 
                                ? `${selectedSubmission.productData.currency || 'GBP'} ${Number(selectedSubmission.productData.price).toFixed(2)}`
                                : 'Not set'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h3 className="font-semibold mb-2">Seller Information</h3>
                        <div className="space-y-2 text-sm">
                          <div>
                            <p className="text-gray-500">Store</p>
                            <p className="font-medium">{selectedSubmission.seller?.storeName || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Email</p>
                            <p className="font-medium">{selectedSubmission.seller?.email || selectedSubmission.user?.email}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {(selectedSubmission.productData?.description || selectedSubmission.catalogEntry?.description) && (
                      <div>
                        <h3 className="font-semibold mb-2">Description</h3>
                        <p className="text-sm text-gray-700">
                          {selectedSubmission.productData?.description || selectedSubmission.catalogEntry?.description}
                        </p>
                      </div>
                    )}

                    {/* Images */}
                    {selectedSubmission.productData?.images && selectedSubmission.productData.images.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">Images</h3>
                        <div className="flex gap-2 flex-wrap">
                          {selectedSubmission.productData.images.map((img, idx) => {
                            const url = getImageUrl(img);
                            return url ? (
                              <SafeImage
                                key={idx}
                                src={url}
                                alt={`Product ${idx + 1}`}
                                width={96}
                                height={96}
                                className="rounded object-cover bg-gray-100"
                              />
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}

                    {/* Duplicate Products */}
                    {selectedSubmission.duplicateProducts && selectedSubmission.duplicateProducts.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                          Duplicate Detection
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            selectedSubmission.procurementNotes?.includes('[Duplicate acknowledged]')
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {selectedSubmission.duplicateProducts.length} match{selectedSubmission.duplicateProducts.length > 1 ? 'es' : ''}
                          </span>
                        </h3>
                        <div className="space-y-2">
                          {selectedSubmission.duplicateProducts.map((dup) => {
                            const ep = dup.existingProduct;
                            const score = dup.similarityScore ?? 0;
                            return (
                              <div key={dup.id || ep?.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-gray-900 truncate">{ep?.name || 'Unknown product'}</p>
                                  <div className="flex flex-wrap gap-2 text-xs text-gray-500 mt-0.5">
                                    {ep?.sku && <span>SKU: {ep.sku}</span>}
                                    {ep?.barcode && <span>Barcode: {ep.barcode}</span>}
                                    {ep?.ean && <span>EAN: {ep.ean}</span>}
                                    {ep?.price != null && <span>Price: {ep.currency || 'GBP'} {Number(ep.price).toFixed(2)}</span>}
                                    {ep?.status && <span className="px-1 py-0.5 bg-gray-200 rounded">{ep.status}</span>}
                                  </div>
                                </div>
                                <div className="ml-3 shrink-0 text-right">
                                  <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                                    score >= 90 ? 'bg-red-100 text-red-800' : score >= 80 ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {score}%
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {selectedSubmission.procurementNotes?.includes('[Duplicate acknowledged]') && (
                          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-sm font-semibold text-amber-900">Approved with Duplicate Acknowledgement</p>
                            <p className="text-xs text-amber-700 mt-1">
                              {selectedSubmission.procurementNotes
                                .split('\n\n')
                                .filter((part: string) => part.startsWith('[Duplicate acknowledged]'))
                                .map((part: string) => part.replace('[Duplicate acknowledged] ', ''))
                                .join('; ') || 'No reason provided'}
                            </p>
                            {selectedSubmission.procurementApprovedAt && (
                              <p className="text-xs text-amber-600 mt-1">
                                Approved at: {new Date(selectedSubmission.procurementApprovedAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Procurement Approval Details */}
                    {selectedSubmission.status !== 'SUBMITTED' && selectedSubmission.status !== 'UNDER_REVIEW' && selectedSubmission.status !== 'REJECTED' && (
                      <div>
                        <h3 className="font-semibold mb-2">Procurement Approval Log</h3>
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 text-sm">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <p className="text-blue-700">Status:</p>
                            <p className="text-blue-900 font-medium">Approved</p>
                            {selectedSubmission.procurementApprovedAt && (
                              <>
                                <p className="text-blue-700">Approved at:</p>
                                <p className="text-blue-900">{new Date(selectedSubmission.procurementApprovedAt).toLocaleString()}</p>
                              </>
                            )}
                            {selectedSubmission.selectedQuantity != null && (
                              <>
                                <p className="text-blue-700">Approved qty:</p>
                                <p className="text-blue-900 font-medium">{selectedSubmission.selectedQuantity} units</p>
                              </>
                            )}
                            <p className="text-blue-700">Seller offered:</p>
                            <p className="text-blue-900">{(selectedSubmission.productData as any)?.stock ?? 'N/A'} units</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Review Notes */}
                    {(selectedSubmission.procurementNotes || selectedSubmission.catalogNotes || selectedSubmission.marketingNotes || selectedSubmission.financeNotes) && (
                      <div>
                        <h3 className="font-semibold mb-2">Review Notes</h3>
                        <div className="space-y-2 text-sm">
                          {selectedSubmission.procurementNotes && (
                            <div className="p-2 bg-blue-50 rounded">
                              <p className="text-blue-800 font-medium">Procurement:</p>
                              {selectedSubmission.procurementNotes.split('\n\n').map((part: string, i: number) => (
                                <p key={i} className={`mt-0.5 ${part.startsWith('[Duplicate acknowledged]') ? 'text-amber-700 font-medium' : 'text-blue-700'}`}>
                                  {part}
                                </p>
                              ))}
                            </div>
                          )}
                          {selectedSubmission.catalogNotes && (
                            <div className="p-2 bg-indigo-50 rounded">
                              <p className="text-indigo-800 font-medium">Catalog:</p>
                              <p className="text-indigo-700">{selectedSubmission.catalogNotes}</p>
                            </div>
                          )}
                          {selectedSubmission.marketingNotes && (
                            <div className="p-2 bg-purple-50 rounded">
                              <p className="text-purple-800 font-medium">Marketing:</p>
                              <p className="text-purple-700">{selectedSubmission.marketingNotes}</p>
                            </div>
                          )}
                          {selectedSubmission.financeNotes && (
                            <div className="p-2 bg-cyan-50 rounded">
                              <p className="text-cyan-800 font-medium">Finance:</p>
                              <p className="text-cyan-700">{selectedSubmission.financeNotes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-4 border-t">
                      {['SUBMITTED', 'UNDER_REVIEW'].includes(selectedSubmission.status) && (
                        <>
                          <button
                            onClick={() => handleAction(selectedSubmission, 'approve')}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction(selectedSubmission, 'reject')}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {selectedSubmission.status === 'FINANCE_APPROVED' && (
                        <button
                          onClick={() => handlePublish(selectedSubmission)}
                          disabled={publishLoading === selectedSubmission.id}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          {publishLoading === selectedSubmission.id ? 'Publishing...' : 'Publish Product'}
                        </button>
                      )}
                      <button
                        onClick={() => setShowDetailModal(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Modal */}
          {showActionModal && selectedSubmission && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full">
                <div className="p-6">
                  <h2 className="text-xl font-bold mb-4">
                    {actionType === 'approve' ? 'Approve Submission' : 'Reject Submission'}
                  </h2>

                  <div className="space-y-4">
                    {actionType === 'approve' ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                        <textarea
                          value={actionNotes}
                          onChange={(e) => setActionNotes(e.target.value)}
                          rows={3}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="Add any notes for this approval..."
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason *</label>
                        <textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          rows={3}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="Please provide a reason for rejection..."
                          required
                        />
                      </div>
                    )}

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleConfirmAction}
                        disabled={actionLoading}
                        className={`flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 ${
                          actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                        }`}
                      >
                        {actionLoading ? 'Processing...' : actionType === 'approve' ? 'Approve' : 'Reject'}
                      </button>
                      <button
                        onClick={() => setShowActionModal(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
