'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  items: any[];
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

interface Product {
  id: string;
  name: string;
  price: number;
  images: string[];
  slug?: string;
}

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const collectionId = params.id as string;
  const [collection, setCollection] = useState<Collection | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: false,
  });
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (collectionId) {
      fetchCollection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId]);

  const fetchCollection = async () => {
    try {
      setLoading(true);
      const [collectionRes, profileRes] = await Promise.all([
        apiClient.getCollection(collectionId),
        apiClient.getProfile().catch(() => null),
      ]);

      if (collectionRes?.data) {
        setCollection(collectionRes.data);
        setFormData({
          name: collectionRes.data.name,
          description: collectionRes.data.description || '',
          isPublic: collectionRes.data.isPublic,
        });
        
        // Check if current user is owner
        if (profileRes?.data && collectionRes.data.userId === profileRes.data.id) {
          setIsOwner(true);
        }

        // Fetch products from items
        const items = Array.isArray(collectionRes.data.items) ? collectionRes.data.items : [];
        if (items.length > 0) {
          // Fetch product details for each item
          const productPromises = items.map(async (item: any) => {
            try {
              const productRes = await apiClient.getProduct(item.productId);
              return productRes?.data;
            } catch {
              return null;
            }
          });
          const productResults = await Promise.all(productPromises);
          setProducts(productResults.filter((p) => p !== null));
        }
      }
    } catch (err: any) {
      console.error('Error fetching collection:', err);
      toast.error(err.message || 'Failed to load collection');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCollection = async () => {
    try {
      setSaving(true);
      const response = await apiClient.updateCollection(collectionId, {
        name: formData.name,
        description: formData.description || undefined,
        isPublic: formData.isPublic,
      });

      if (response?.data) {
        setCollection(response.data);
        setEditing(false);
        toast.success('Collection updated successfully');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update collection');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCollection = async () => {
    if (!confirm('Are you sure you want to delete this collection? This action cannot be undone.')) {
      return;
    }

    try {
      await apiClient.deleteCollection(collectionId);
      toast.success('Collection deleted successfully');
      router.push('/collections');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete collection');
    }
  };

  const handleRemoveProduct = async (productId: string) => {
    try {
      await apiClient.removeProductFromCollection(collectionId, productId);
      toast.success('Product removed from collection');
      await fetchCollection();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove product');
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

  if (!collection) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="text-center py-12">
            <p className="text-gray-600">Collection not found</p>
            <Link href="/collections" className="text-purple-600 hover:text-purple-800 mt-4 inline-block">
              ← Back to Collections
            </Link>
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
          <div className="mb-6">
            <Link href="/collections" className="text-purple-600 hover:text-purple-800 mb-4 inline-block">
              ← Back to Collections
            </Link>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                {editing ? (
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2 text-2xl font-bold"
                  />
                ) : (
                  <h1 className="text-3xl font-bold mb-2">{collection.name}</h1>
                )}
                {editing ? (
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2"
                    rows={3}
                    placeholder="Description..."
                  />
                ) : (
                  collection.description && (
                    <p className="text-gray-600 mb-4">{collection.description}</p>
                  )
                )}
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>{collection.itemCount} items</span>
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
              </div>
              {isOwner && (
                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <button
                        onClick={handleUpdateCollection}
                        disabled={saving}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setFormData({
                            name: collection.name,
                            description: collection.description || '',
                            isPublic: collection.isPublic,
                          });
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditing(true)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={handleDeleteCollection}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {editing && (
              <div className="flex items-center mb-4">
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
            )}
          </div>

          {products.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <div className="text-6xl mb-4">📦</div>
              <p className="text-gray-600">No products in this collection yet</p>
              <Link
                href="/products"
                className="mt-4 inline-block px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                Browse Products
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.map((product) => (
                <div key={product.id} className="bg-gray-50 rounded-lg p-4 hover:shadow-lg transition-shadow">
                  <Link href={`/products/${product.id}`}>
                    {product.images && product.images.length > 0 ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-48 object-cover rounded-lg mb-3"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gray-200 rounded-lg mb-3 flex items-center justify-center">
                        <span className="text-gray-400">No Image</span>
                      </div>
                    )}
                    <h3 className="font-semibold mb-2 line-clamp-2">{product.name}</h3>
                    <p className="text-purple-600 font-bold">£{product.price}</p>
                  </Link>
                  {isOwner && (
                    <button
                      onClick={() => handleRemoveProduct(product.id)}
                      className="mt-2 w-full px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
