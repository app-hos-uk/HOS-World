'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';

interface Collection {
  id: string;
  name: string;
  description?: string;
  itemCount: number;
  isPublic: boolean;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

export default function CollectionsPage() {
  const toast = useToast();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: false,
  });

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getCollections(true); // Include public collections
      if (response?.data) {
        setCollections(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching collections:', err);
      toast.error(err.message || 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async () => {
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
        setShowCreateModal(false);
        setFormData({ name: '', description: '', isPublic: false });
        await fetchCollections();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create collection');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <RouteGuard allowedRoles={['CUSTOMER', 'ADMIN']} showAccessDenied={true}>
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Collections</h1>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              + Create Collection
            </button>
          </div>

          {collections.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📚</div>
              <p className="text-gray-600 mb-4">No collections yet</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                Create Your First Collection
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {collections.map((collection) => (
                <Link
                  key={collection.id}
                  href={`/collections/${collection.id}`}
                  className="bg-gray-50 rounded-lg p-6 hover:shadow-lg transition-shadow block"
                >
                  <div className="text-4xl mb-3">📚</div>
                  <h3 className="text-lg font-semibold mb-2">{collection.name}</h3>
                  {collection.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{collection.description}</p>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{collection.itemCount} items</span>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        collection.isPublic
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {collection.isPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                  {collection.user && (
                    <p className="text-xs text-gray-500 mt-2">
                      by {collection.user.firstName || collection.user.email}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}

          {/* Create Collection Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h2 className="text-2xl font-bold mb-4">Create Collection</h2>
                <div className="space-y-4">
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
                      rows={3}
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
                      Make this collection public
                    </label>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleCreateCollection}
                    disabled={creating}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setFormData({ name: '', description: '', isPublic: false });
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
