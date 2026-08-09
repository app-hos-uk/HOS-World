'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AppShellLayout } from '@/components/AppShellLayout';
import { apiClient } from '@/lib/api';
import { getSellerMenuItems } from '@/lib/sellerMenu';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';
import { useDateTime } from '@/hooks/useDateTime';

function canSellerEditSubmission(status: string): boolean {
  return ['SUBMITTED', 'UNDER_REVIEW', 'PROCUREMENT_REJECTED'].includes(status);
}

function canSellerDeleteSubmission(status: string): boolean {
  return ['SUBMITTED', 'UNDER_REVIEW', 'PROCUREMENT_REJECTED', 'REJECTED'].includes(status);
}

export default function SellerSubmissionsPage() {
  const { formatDate } = useDateTime();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const toast = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description?: string;
    tone?: 'default' | 'danger';
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  const menuItems = getSellerMenuItems(false);

  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getSellerSubmissions(statusFilter || undefined);
      if (response?.data) {
        setSubmissions(Array.isArray(response.data) ? response.data : []);
      }
    } catch (err: any) {
      console.error('Error fetching submissions:', err);
      setError(err?.message || 'Failed to load submissions');
      toast.error(err?.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['B2C_SELLER', 'SELLER', 'WHOLESALER', 'ADMIN']} showAccessDenied={true}>
      <AppShellLayout role="SELLER" menuItems={menuItems} title="Seller" backToAdmin={{ title: 'Admin Dashboard', href: '/admin/dashboard' }} breadcrumbs="inline">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-hos-text-secondary">Product Submissions</h1>
              <p className="text-hos-text-secondary mt-2">Track your product submission status</p>
            </div>
            <div className="flex gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
              >
                <option value="">All Status</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="PROCUREMENT_APPROVED">Procurement Approved</option>
                <option value="PROCUREMENT_REJECTED">Procurement Rejected</option>
                <option value="CATALOG_COMPLETED">Catalog Completed</option>
                <option value="MARKETING_COMPLETED">Marketing Completed</option>
                <option value="CONTENT_COMPLETED">Content Completed</option>
                <option value="FINANCE_APPROVED">Finance Approved</option>
              </select>
              <Link
                href="/seller/submit-product"
                className="px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium"
              >
                + New Submission
              </Link>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded mb-6">
            Error: {error}
            <button
              onClick={fetchSubmissions}
              className="ml-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
            {submissions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-hos-text-muted mb-4">No submissions found</p>
                <Link
                  href="/seller/submit-product"
                  className="text-hos-gold hover:text-hos-gold-hover font-medium"
                >
                  Submit your first product →
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-hos-border">
                  <thead className="bg-hos-bg-secondary">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Submitted
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                    {submissions.map((submission) => (
                      <tr key={submission.id} className="hover:bg-hos-bg-tertiary">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-hos-text-secondary">
                            {submission.productData?.name || 'Untitled Product'}
                          </div>
                          <div className="text-sm text-hos-text-muted">
                            {submission.productData?.description?.substring(0, 50)}...
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              submission.status === 'PROCUREMENT_APPROVED' ||
                              submission.status === 'FINANCE_APPROVED' ||
                              submission.status === 'CATALOG_COMPLETED' ||
                              submission.status === 'MARKETING_COMPLETED' ||
                              submission.status === 'CONTENT_COMPLETED'
                                ? 'bg-green-500/15 text-green-300'
                                : submission.status === 'PROCUREMENT_REJECTED'
                                  ? 'bg-red-500/15 text-red-300'
                                  : 'bg-yellow-500/15 text-yellow-300'
                            }`}
                          >
                            {submission.status === 'CONTENT_COMPLETED'
                              ? 'Content Completed'
                              : submission.status === 'CATALOG_COMPLETED'
                                ? 'Catalog Completed'
                                : submission.status === 'MARKETING_COMPLETED'
                                  ? 'Marketing Completed'
                                  : submission.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                          {formatDate(submission.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex flex-wrap items-center gap-3">
                            <Link
                              href={`/seller/submit-product?id=${submission.id}`}
                              className="text-hos-gold hover:text-hos-gold"
                            >
                              View
                            </Link>
                            {canSellerEditSubmission(submission.status) && (
                              <Link
                                href={`/seller/submit-product?edit=${submission.id}`}
                                className="text-hos-text-secondary hover:text-hos-gold"
                              >
                                Edit
                              </Link>
                            )}
                            {canSellerDeleteSubmission(submission.status) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDialog({
                                    title: 'Remove this submission?',
                                    description: 'This cannot be undone.',
                                    tone: 'danger',
                                    confirmLabel: 'Delete',
                                    onConfirm: async () => {
                                      setConfirmDialog(null);
                                      try {
                                        await apiClient.deleteSubmission(submission.id);
                                        toast.success('Submission deleted');
                                        fetchSubmissions();
                                      } catch (err: unknown) {
                                        const msg =
                                          err instanceof Error ? err.message : 'Failed to delete submission';
                                        toast.error(msg);
                                      }
                                    },
                                  });
                                }}
                                className="text-red-400 hover:text-red-300"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
              {confirmDialog && (
          <ConfirmDialog
            open
            title={confirmDialog.title}
            description={confirmDialog.description}
            tone={confirmDialog.tone}
            confirmLabel={confirmDialog.confirmLabel}
            onCancel={() => setConfirmDialog(null)}
            onConfirm={confirmDialog.onConfirm}
          />
        )}
</AppShellLayout>
    </RouteGuard>
  );
}

