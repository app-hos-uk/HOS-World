'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';

export default function AdminPlatformMetricsPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch multiple data sources
      const [usersRes, productsRes, ordersRes] = await Promise.all([
        apiClient.getUsers().catch(() => ({ data: [] })),
        apiClient.getProducts({ limit: 1000 }).catch(() => ({ data: { data: [] } })),
        apiClient.getOrders().catch(() => ({ data: [] })),
      ]);

      const users = usersRes?.data || [];
      const products = productsRes?.data?.data || [];
      const orders = ordersRes?.data || [];

      setMetrics({
        totalUsers: users.length,
        totalProducts: products.length,
        totalOrders: orders.length,
        totalRevenue: orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0),
        activeSellers: users.filter((u: any) => ['SELLER', 'B2C_SELLER', 'WHOLESALER'].includes(u.role)).length,
      });
    } catch (err: any) {
      console.error('Error fetching platform metrics:', err);
      setError(err.message || 'Failed to load platform metrics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['ADMIN']}>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading platform metrics...</div>
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Platform Metrics</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {metrics?.totalUsers || 0}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Total Products</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {metrics?.totalProducts || 0}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Total Orders</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {metrics?.totalOrders || 0}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
              <p className="text-3xl font-bold text-green-600 mt-2">
                £{metrics?.totalRevenue?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Active Sellers</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {metrics?.activeSellers || 0}
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}

