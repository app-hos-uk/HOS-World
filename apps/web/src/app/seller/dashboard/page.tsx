'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';

interface SellerDashboardData {
  totalSales: number;
  totalOrders: number;
  totalProducts: number;
  averageOrderValue: number;
  submissions?: any[];
  submissionsByStatus?: Array<{ status: string; _count: number }>;
}

export default function SellerDashboardPage() {
  const [dashboardData, setDashboardData] = useState<SellerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getSellerDashboardData();
        if (response?.data) {
          setDashboardData(response.data);
        } else {
          setError('Failed to load dashboard data');
        }
      } catch (err: any) {
        console.error('Error fetching seller dashboard:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const pendingApprovals = dashboardData?.submissionsByStatus?.find(
    (s) => s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW'
  )?._count || 0;

  return (
    <RouteGuard allowedRoles={['B2C_SELLER', 'SELLER']} showAccessDenied={true}>
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Seller Dashboard</h1>
            <a
              href="/seller/submit-product"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Submit New Product
            </a>
          </div>
          
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              Error: {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-4 sm:p-6 mb-6 sm:mb-6 sm:mb-8">
                <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
                  <h3 className="text-sm sm:text-base lg:text-sm sm:text-base lg:text-lg font-semibold mb-2">Total Sales</h3>
                  <p className="text-2xl sm:text-2xl sm:text-3xl font-bold">
                    ${dashboardData?.totalSales?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </p>
                </div>
                <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
                  <h3 className="text-sm sm:text-base lg:text-sm sm:text-base lg:text-lg font-semibold mb-2">Total Orders</h3>
                  <p className="text-2xl sm:text-2xl sm:text-3xl font-bold">{dashboardData?.totalOrders?.toLocaleString() || '0'}</p>
                </div>
                <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
                  <h3 className="text-sm sm:text-base lg:text-sm sm:text-base lg:text-lg font-semibold mb-2">Active Products</h3>
                  <p className="text-2xl sm:text-2xl sm:text-3xl font-bold">{dashboardData?.totalProducts?.toLocaleString() || '0'}</p>
                </div>
                <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
                  <h3 className="text-sm sm:text-base lg:text-sm sm:text-base lg:text-lg font-semibold mb-2">Pending Approvals</h3>
                  <p className="text-2xl sm:text-2xl sm:text-3xl font-bold">{pendingApprovals.toLocaleString()}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-4 sm:p-6">
                <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
                  <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Recent Submissions</h2>
                  {dashboardData?.submissions && dashboardData.submissions.length > 0 ? (
                    <div className="space-y-2">
                      {dashboardData.submissions.slice(0, 5).map((submission: any) => (
                        <div key={submission.id} className="text-sm text-gray-600 border-b pb-2">
                          <p className="font-medium">{submission.status}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(submission.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm sm:text-base text-gray-500">No recent submissions</p>
                  )}
                </div>
                <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
                  <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Average Order Value</h2>
                  <p className="text-3xl font-bold text-purple-600">
                    ${dashboardData?.averageOrderValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </p>
                </div>
              </div>
            </>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
