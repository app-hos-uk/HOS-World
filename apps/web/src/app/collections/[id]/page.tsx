'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Image from 'next/image';
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
      <div className="min-h-screen bg-hos-bg-secondary">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-hos-bg-secondary">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="text-center py-12">
            <p className="text-hos-text-secondary">Collection not found</p>
            <Link href="/collections" className="text-hos-gold hover:text-hos-gold-hover mt-4 inline-block">
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
      <div className="min-h-screen bg-hos-bg-secondary">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="mb-6">
            <Link href="/collections" className="text-hos-gold hover:text-hos-gold-hover mb-4 inline-block">
              ← Back to Collections
            </Link>
          </div>

          <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6 mb-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start sm:gap-6 mb-4">
              <div className="w-full min-w-0 flex-1 space-y-2">
                {editing ? (
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="block w-full max-w-full px-4 py-2 border border-hos-border rounded-lg text-2xl font-bold box-border"
                  />
                ) : (
                  <h1 className="text-3xl font-bold mb-2 break-words">{collection.name}</h1>
                )}
                {editing ? (
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="block w-full max-w-full px-4 py-2 border border-hos-border rounded-lg box-border"
                    rows={3}
                    placeholder="Description..."
                  />
                ) : (
                  collection.description && (
                    <p className="text-hos-text-secondary mb-4 break-words">{collection.description}</p>
                  )
                )}
                <div className="flex flex-wrap items-center gap-4 text-sm text-hos-text-secondary">
                  <span>{collection.itemCount} items</span>
                  <span
                    className={`px-2 py-1 rounded text-xs shrink-0 ${
                      collection.isPublic
                        ? 'bg-green-500/15 text-green-300'
                        : 'bg-hos-bg-tertiary text-white'
                    }`}
                  >
                    {collection.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
              </div>
              {isOwner && (
                <div className="flex flex-wrap gap-2 shrink-0 sm:justify-end sm:pt-1">
                  {editing ? (
                    <>
                      <button
                        onClick={handleUpdateCollection}
                        disabled={saving}
                        type="button"
                        className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium disabled:opacity-50 whitespace-nowrap"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(false);
                          setFormData({
                            name: collection.name,
                            description: collection.description || '',
                            isPublic: collection.isPublic,
                          });
                        }}
                        className="px-4 py-2 bg-hos-bg-tertiary text-white rounded-lg hover:bg-hos-bg-tertiary transition-colors font-medium whitespace-nowrap"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium whitespace-nowrap"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteCollection}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium whitespace-nowrap"
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
                <label htmlFor="isPublic" className="text-sm text-hos-text-secondary">
                  Make this collection public
                </label>
              </div>
            )}
          </div>

          {products.length === 0 ? (
            <div className="text-center py-12 bg-hos-bg-secondary rounded-lg">
              <div className="text-6xl mb-4">📦</div>
              <p className="text-hos-text-secondary">No products in this collection yet</p>
              <Link
                href="/products"
                className="mt-4 inline-block px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium"
              >
                Browse Products
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.map((product) => (
                <div key={product.id} className="bg-hos-bg-secondary rounded-lg p-4 hover:shadow-lg transition-shadow">
                  <Link href={`/products/${product.id}`}>
                    {product.images && product.images.length > 0 ? (
                      <div className="relative w-full h-48 mb-3 rounded-lg overflow-hidden">
                        <Image
                          src={product.images[0]}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-48 bg-hos-bg-tertiary rounded-lg mb-3 flex items-center justify-center">
                        <span className="text-hos-text-muted">No Image</span>
                      </div>
                    )}
                    <h3 className="font-semibold mb-2 line-clamp-2">{product.name}</h3>
                    <p className="text-hos-gold font-bold">${product.price}</p>
                  </Link>
                  {isOwner && (
                    <button
                      onClick={() => handleRemoveProduct(product.id)}
                      className="mt-2 w-full px-3 py-1 bg-red-500/15 text-red-300 rounded hover:bg-red-200 transition-colors text-sm"
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
