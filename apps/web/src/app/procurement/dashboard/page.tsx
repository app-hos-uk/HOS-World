'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';

export default function ProcurementDashboardPage() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getProcurementDashboardData();
        if (response?.data) {
          setDashboardData(response.data);
        } else {
          setError('Failed to load dashboard data');
        }
      } catch (err: any) {
        console.error('Error fetching procurement dashboard:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const pendingCount = dashboardData?.totalPending || 0;
  const duplicatesCount = dashboardData?.totalDuplicates || 0;
  const underReview = dashboardData?.statistics?.find((s: any) => s.status === 'UNDER_REVIEW')?._count || 0;

  return (
    <RouteGuard allowedRoles={['PROCUREMENT']} showAccessDenied={true}>
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-6 sm:mb-8">Procurement Dashboard</h1>
          
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:p-6 mb-6 sm:mb-8">
                <div className="bg-white border rounded-lg p-4 sm:p-6">
                  <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-2">Pending Submissions</h3>
                  <p className="text-2xl sm:text-3xl font-bold">{pendingCount.toLocaleString()}</p>
                </div>
                <div className="bg-white border rounded-lg p-4 sm:p-6">
                  <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-2">Duplicate Alerts</h3>
                  <p className="text-2xl sm:text-3xl font-bold text-orange-600">{duplicatesCount.toLocaleString()}</p>
                </div>
                <div className="bg-white border rounded-lg p-4 sm:p-6">
                  <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-2">Under Review</h3>
                  <p className="text-2xl sm:text-3xl font-bold">{underReview.toLocaleString()}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:p-6">
                <div className="bg-white border rounded-lg p-4 sm:p-6">
                  <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">New Submissions</h2>
                  {dashboardData?.pendingSubmissions && dashboardData.pendingSubmissions.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {dashboardData.pendingSubmissions.slice(0, 10).map((submission: any) => (
                        <div key={submission.id} className="text-sm text-gray-600 border-b pb-2">
                          <p className="font-medium">{submission.seller?.storeName || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{submission.status}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No pending submissions</p>
                  )}
                </div>
                <div className="bg-white border rounded-lg p-4 sm:p-6">
                  <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Duplicate Detection</h2>
                  {dashboardData?.duplicateAlerts && dashboardData.duplicateAlerts.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {dashboardData.duplicateAlerts.slice(0, 10).map((alert: any) => (
                        <div key={alert.id} className="text-sm text-orange-600 border-b pb-2">
                          <p className="font-medium">Similarity: {alert.similarityScore}%</p>
                          <p className="text-xs text-gray-500">{alert.submission?.seller?.storeName}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No duplicate alerts</p>
                  )}
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
