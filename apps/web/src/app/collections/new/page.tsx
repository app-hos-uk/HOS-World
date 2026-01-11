'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';

export default function NewCollectionPage() {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: false,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Collection name is required');
      return;
    }

    try {
      setCreating(true);
      const response = await apiClient.createCollection({
        name: formData.name,
        description: formData.description || undefined,
        isPublic: formData.isPublic,
      });

      if (response?.data) {
        toast.success('Collection created successfully');
        router.push(`/collections/${response.data.id}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create collection');
    } finally {
      setCreating(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['CUSTOMER', 'ADMIN']} showAccessDenied={true}>
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <Link href="/collections" className="text-purple-600 hover:text-purple-800 mb-4 inline-block">
                ← Back to Collections
              </Link>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h1 className="text-3xl font-bold mb-6">Create New Collection</h1>
              
              <form onSubmit={handleCreate} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Collection Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="My Favorite Products"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    rows={4}
                    placeholder="Describe your collection..."
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={formData.isPublic}
                    onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="isPublic" className="text-sm text-gray-700">
                    Make this collection public (others can view it)
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Collection'}
                  </button>
                  <Link
                    href="/collections"
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium text-center"
                  >
                    Cancel
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
