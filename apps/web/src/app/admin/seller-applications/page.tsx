'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';

export default function AdminSellerApplicationsPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError(null);
      // For now, this would need a backend endpoint
      // Using placeholder data structure
      setApplications([]);
    } catch (err: any) {
      console.error('Error fetching seller applications:', err);
      setError(err.message || 'Failed to load seller applications');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['ADMIN']}>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading seller applications...</div>
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Seller Applications</h1>

          <div className="bg-white rounded-lg shadow p-6">
            {applications.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No seller applications found</p>
                <p className="text-sm text-gray-400 mt-2">
                  Seller applications will appear here when users apply to become sellers
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {applications.map((app) => (
                  <div key={app.id} className="border rounded-lg p-4">
                    <p className="font-medium">{app.email}</p>
                    <p className="text-sm text-gray-500">{app.status}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}

