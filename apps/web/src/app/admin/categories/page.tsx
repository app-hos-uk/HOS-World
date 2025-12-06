'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      // This would need a backend endpoint for categories
      // For now, placeholder
      setCategories([]);
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['ADMIN']}>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading categories...</div>
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Categories & Tags</h1>
            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              Add Category
            </button>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            {categories.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No categories found</p>
                <p className="text-sm text-gray-400 mt-2">
                  Categories and tags will be displayed here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {categories.map((category) => (
                  <div key={category.id} className="border rounded-lg p-4">
                    <h3 className="font-medium">{category.name}</h3>
                    <p className="text-sm text-gray-500">{category.description}</p>
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

