'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

export default function WholesalerSubmissionsPage() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const menuItems = [
    { title: 'Dashboard', href: '/wholesaler/dashboard', icon: '📊' },
    { title: 'Submit Product', href: '/seller/submit-product', icon: '➕' },
    { title: 'My Products', href: '/wholesaler/products', icon: '📦' },
    { title: 'Bulk Orders', href: '/wholesaler/orders', icon: '🛒' },
    { title: 'Submissions', href: '/wholesaler/submissions', icon: '📝' },
  ];

  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getWholesalerSubmissions(statusFilter || undefined);
      if (response?.data) {
        setSubmissions(Array.isArray(response.data) ? response.data : []);
      }
    } catch (err: any) {
      console.error('Error fetching submissions:', err);
      setError(err.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['WHOLESALER', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="WHOLESALER" menuItems={menuItems} title="Wholesaler">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Bulk Product Submissions</h1>
              <p className="text-gray-600 mt-2">Track your bulk product submission status</p>
            </div>
            <div className="flex gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Status</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="PROCUREMENT_APPROVED">Procurement Approved</option>
                <option value="PROCUREMENT_REJECTED">Procurement Rejected</option>
                <option value="CATALOG_COMPLETED">Catalog Completed</option>
                <option value="MARKETING_COMPLETED">Marketing Completed</option>
                <option value="FINANCE_APPROVED">Finance Approved</option>
              </select>
              <Link
                href="/seller/submit-product"
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                + New Submission
              </Link>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
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
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {submissions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No submissions found</p>
                <Link
                  href="/seller/submit-product"
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  Submit your first bulk product →
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Submitted
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {submissions.map((submission) => (
                      <tr key={submission.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {submission.productData?.name || 'Untitled Product'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {submission.productData?.description?.substring(0, 50)}...
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {submission.productData?.quantity || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              submission.status === 'PROCUREMENT_APPROVED' ||
                              submission.status === 'FINANCE_APPROVED'
                                ? 'bg-green-100 text-green-800'
                                : submission.status === 'PROCUREMENT_REJECTED'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {submission.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(submission.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link
                            href={`/seller/submit-product?id=${submission.id}`}
                            className="text-purple-600 hover:text-purple-900"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </DashboardLayout>
    </RouteGuard>
  );
}

