'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { CategorySelector } from '@/components/taxonomy/CategorySelector';
import { TagSelector } from '@/components/taxonomy/TagSelector';
import { AttributeEditor } from '@/components/taxonomy/AttributeEditor';
import { getPublicApiBaseUrl } from '@/lib/apiBaseUrl';

export default function AdminProductsPage() {
  const toast = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sellers, setSellers] = useState<any[]>([]);
  const [publishNow, setPublishNow] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    stock: '0',
    taxRate: '',
    taxClassId: '',
    isPlatformOwned: true,
    sellerId: '',
    categoryId: '',
    tagIds: [] as string[],
    attributes: [] as any[],
  });
  const [images, setImages] = useState<Array<{ url: string; alt?: string; order?: number; size?: number; width?: number; height?: number; format?: string; uploadedAt?: Date }>>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any | null>(null);

  useEffect(() => {
    fetchProducts();
    fetchSellers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getAdminProducts({ page, limit: 50 });
      const list = response?.data?.products || response?.data?.data || response?.data || [];
      setProducts(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError(err.message || 'Failed to load products');
      setProducts([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  };

  const fetchSellers = async () => {
    try {
      const response = await apiClient.getUsers();
      if (response?.data) {
        const users = Array.isArray(response.data) ? response.data : [];
        const sellerRoles = ['SELLER', 'B2C_SELLER', 'WHOLESALER'];
        const sellerUsers = users.filter((user: any) => 
          sellerRoles.includes(user.role)
        );
        setSellers(sellerUsers);
      } else {
        setSellers([]);
      }
    } catch (err: any) {
      console.error('Error fetching sellers:', err);
      setSellers([]); // Reset to empty array on error
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (images.length === 0) {
        toast.error('Please upload at least 1 product image');
        return;
      }
      await apiClient.createAdminProduct({
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock, 10),
        taxRate: formData.taxRate ? parseFloat(formData.taxRate) : undefined,
        isPlatformOwned: formData.isPlatformOwned,
        sellerId: formData.isPlatformOwned ? null : formData.sellerId || null,
        status: publishNow ? 'ACTIVE' : 'DRAFT',
        categoryId: formData.categoryId || undefined,
        tagIds: formData.tagIds.length > 0 ? formData.tagIds : undefined,
        attributes: formData.attributes.length > 0 ? formData.attributes : undefined,
        images: images.length > 0 ? images.map(img => ({ url: img.url, alt: img.alt, order: img.order })) : undefined,
      });
      toast.success('Product created successfully');
      setShowCreateForm(false);
      setFormData({ 
        name: '', 
        description: '', 
        price: '', 
        stock: '0',
        taxRate: '',
        taxClassId: '',
        isPlatformOwned: true, 
        sellerId: '',
        categoryId: '',
        tagIds: [],
        attributes: [],
      });
      setImages([]);
      setPublishNow(true);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create product');
    }
  };

  const uploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSizeBytes = 250 * 1024; // 250KB limit
    const fileArr = Array.from(files);
    const limited = fileArr.slice(0, 4);
    if (fileArr.length > 4) {
      toast.error('You can upload up to 4 images at a time');
      return;
    }

    for (const f of fileArr) {
      if (!allowedTypes.includes(f.type)) {
        toast.error('Only JPEG, PNG, GIF, and WebP images are allowed');
        return;
      }
      if (f.size > maxSizeBytes) {
        toast.error('Max image size is 250KB');
        return;
      }
    }

    try {
      setUploadingImages(true);
      const res = await apiClient.uploadMultipleFiles(limited, 'products');
      const urls = res?.data?.urls || [];
      if (urls.length === 0) throw new Error('Upload failed (no URLs returned)');
      
      // Capture image metadata for each uploaded file
      const newImages = await Promise.all(
        limited.map(async (file, idx) => {
          const url = urls[idx];
          
          // Get image dimensions using HTMLImageElement
          const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
            if (typeof window !== 'undefined') {
              const img = document.createElement('img');
              img.onload = () => {
                resolve({ width: img.naturalWidth, height: img.naturalHeight });
              };
              img.onerror = () => resolve({ width: 0, height: 0 });
              img.src = url;
            } else {
              resolve({ width: 0, height: 0 });
            }
          });
          
          // Get file format from MIME type
          const format = file.type.split('/')[1]?.toUpperCase() || 'UNKNOWN';
          
          return {
            url,
            alt: '',
            order: images.length + idx,
            size: file.size,
            width: dimensions.width,
            height: dimensions.height,
            format,
            uploadedAt: new Date(),
          };
        })
      );
      
      setImages((prev) => [...prev, ...newImages]);
    } catch (e: any) {
      toast.error(e.message || 'Failed to upload image');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx).map((img, i) => ({ ...img, order: i })));
  };

  const updateImageAlt = (idx: number, alt: string) => {
    setImages((prev) => prev.map((img, i) => (i === idx ? { ...img, alt } : img)));
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      description: product.description || '',
      price: product.price?.toString() || '',
      stock: product.stock?.toString() || '0',
      taxRate: product.taxRate?.toString() || '',
      taxClassId: product.taxClassId || '',
      isPlatformOwned: !product.sellerId || product.isPlatformOwned,
      sellerId: product.sellerId || '',
      categoryId: product.categoryId || product.categoryRelation?.categoryId || '',
      tagIds: product.tagsRelation?.map((t: any) => t.tagId) || product.tags?.map((t: any) => t.id) || [],
      attributes: product.attributes?.map((attr: any) => ({
        attributeId: attr.attributeId,
        attributeValueId: attr.attributeValueId,
        textValue: attr.textValue,
        numberValue: attr.numberValue,
        booleanValue: attr.booleanValue,
        dateValue: attr.dateValue,
      })) || [],
    });
    setImages(product.images?.map((img: any) => ({
      url: img.url,
      alt: img.alt || '',
      order: img.order || 0,
    })) || []);
    setPublishNow(product.status === 'ACTIVE');
    setShowEditModal(true);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    try {
      await apiClient.updateAdminProduct(editingProduct.id, {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock, 10),
        taxRate: formData.taxRate ? parseFloat(formData.taxRate) : undefined,
        status: publishNow ? 'ACTIVE' : 'DRAFT',
        categoryId: formData.categoryId || undefined,
        tagIds: formData.tagIds.length > 0 ? formData.tagIds : undefined,
        attributes: formData.attributes.length > 0 ? formData.attributes : undefined,
        images: images.length > 0 ? images.map(img => ({ url: img.url, alt: img.alt, order: img.order })) : undefined,
        sellerId: formData.isPlatformOwned ? null : formData.sellerId || null,
      });
      toast.success('Product updated successfully');
      setShowEditModal(false);
      setEditingProduct(null);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update product');
    }
  };

  const handleApprove = async (product: any) => {
    try {
      await apiClient.updateAdminProduct(product.id, {
        status: 'ACTIVE',
      });
      toast.success('Product approved and published');
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve product');
    }
  };

  const handleDeleteClick = (product: any) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;

    try {
      // Use admin products endpoint for deletion
      const token = localStorage.getItem('auth_token');
      const apiUrl = getPublicApiBaseUrl();
      const response = await fetch(
        `${apiUrl}/admin/products/${productToDelete.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete product');
      }
      
      toast.success('Product deleted successfully');
      setShowDeleteModal(false);
      setProductToDelete(null);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete product');
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          {loading && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              Loading products…
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
              <button
                onClick={fetchProducts}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">All Products</h1>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              {showCreateForm ? 'Cancel' : '+ Create Product'}
            </button>
          </div>

          {showCreateForm && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Create New Product</h2>
              <form onSubmit={handleCreateProduct} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Product name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    rows={3}
                    placeholder="Product description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.price}
                      onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                    <input
                      type="number"
                      required
                      value={formData.stock}
                      onChange={(e) => setFormData((prev) => ({ ...prev, stock: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.taxRate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, taxRate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="20.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tax Class</label>
                    <select
                      value={formData.taxClassId}
                      onChange={(e) => setFormData((prev) => ({ ...prev, taxClassId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select tax class</option>
                      <option value="STANDARD">Standard (20%)</option>
                      <option value="REDUCED">Reduced (5%)</option>
                      <option value="ZERO">Zero Rate (0%)</option>
                      <option value="EXEMPT">Exempt</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.isPlatformOwned}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, isPlatformOwned: e.target.checked, sellerId: '' }))
                      }
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Platform Owned (not assigned to seller)</span>
                  </label>
                </div>
                {!formData.isPlatformOwned && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Seller</label>
                    <select
                      value={formData.sellerId}
                      onChange={(e) => setFormData((prev) => ({ ...prev, sellerId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select a seller</option>
                      {(Array.isArray(sellers) ? sellers : []).map((seller) => (
                        <option key={seller.id} value={seller.id}>
                          {seller.email} ({seller.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Taxonomy</h3>
                  
                  <div className="space-y-4">
                    <CategorySelector
                      value={formData.categoryId}
                      onChange={(categoryId) => setFormData({ ...formData, categoryId: categoryId || '' })}
                      label="Category"
                      placeholder="Select a category"
                    />
                    
                    <TagSelector
                      value={formData.tagIds}
                      onChange={(tagIds) => setFormData({ ...formData, tagIds })}
                      label="Tags"
                      placeholder="Search and select tags..."
                    />
                    
                    {formData.categoryId && (
                      <AttributeEditor
                        categoryId={formData.categoryId}
                        value={formData.attributes}
                        onChange={(attributes) => setFormData({ ...formData, attributes })}
                        label="Product Attributes"
                      />
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Images</h3>
                  <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-medium text-gray-900">Upload product images</div>
                        <div className="text-xs text-gray-600">JPEG/PNG/GIF/WebP, max 250KB each, up to 4 images</div>
                      </div>
                      <label className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 cursor-pointer">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          multiple
                          className="hidden"
                          disabled={uploadingImages}
                          onChange={(e) => uploadImages(e.target.files)}
                        />
                        {uploadingImages ? 'Uploading…' : 'Choose Files'}
                      </label>
                    </div>

                    {images.length > 0 && (
                      <div className="mt-4 space-y-3">
                        {images.map((img, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg bg-white">
                            <img src={img.url} alt={img.alt || 'Product image'} className="w-20 h-20 object-cover rounded" />
                            <div className="flex-1">
                              <input
                                type="text"
                                value={img.alt || ''}
                                onChange={(e) => updateImageAlt(idx, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2"
                                placeholder="Alt text (optional)"
                              />
                              <div className="text-xs text-gray-500 space-y-1">
                                <p className="truncate">{img.url}</p>
                                {img.size && (
                                  <p>Size: {(img.size / 1024).toFixed(2)} KB</p>
                                )}
                                {img.width && img.height && (
                                  <p>Dimensions: {img.width} × {img.height} px</p>
                                )}
                                {img.format && (
                                  <p>Format: {img.format}</p>
                                )}
                                {img.uploadedAt && (
                                  <p>Uploaded: {img.uploadedAt.toLocaleString()}</p>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeImage(idx)}
                              className="px-3 py-1 text-red-600 hover:text-red-800 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="publishNow"
                    type="checkbox"
                    checked={publishNow}
                    onChange={(e) => setPublishNow(e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="publishNow" className="text-sm text-gray-700">
                    Publish to storefront immediately (sets status ACTIVE)
                  </label>
                </div>
                
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Create Product
                </button>
              </form>
            </div>
          )}

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      No products found
                    </td>
                  </tr>
                ) : (
                  (Array.isArray(products) ? products : []).map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {product.name}
                        </div>
                        <div className="text-sm text-gray-500">{product.slug}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.currency || 'GBP'} {Number(product.price || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            product.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-800'
                              : product.status === 'DRAFT'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {product.status || 'UNKNOWN'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.createdAt
                          ? new Date(product.createdAt).toLocaleDateString()
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(product)}
                            className="text-purple-600 hover:text-purple-900 px-2 py-1 rounded hover:bg-purple-50 transition-colors"
                          >
                            Edit
                          </button>
                          {product.status === 'DRAFT' && (
                            <button
                              onClick={() => handleApprove(product)}
                              className="text-green-600 hover:text-green-900 px-2 py-1 rounded hover:bg-green-50 transition-colors"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteClick(product)}
                            className="text-red-600 hover:text-red-900 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Edit Modal */}
          {showEditModal && editingProduct && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
              <div className="bg-white rounded-lg max-w-4xl w-full my-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold">Edit Product</h2>
                    <button
                      onClick={() => {
                        setShowEditModal(false);
                        setEditingProduct(null);
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>
                  <form onSubmit={handleUpdateProduct} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="Product name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        required
                        value={formData.description}
                        onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        rows={3}
                        placeholder="Product description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={formData.price}
                          onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                        <input
                          type="number"
                          required
                          value={formData.stock}
                          onChange={(e) => setFormData((prev) => ({ ...prev, stock: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={formData.taxRate}
                          onChange={(e) => setFormData((prev) => ({ ...prev, taxRate: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="20.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tax Class</label>
                        <select
                          value={formData.taxClassId}
                          onChange={(e) => setFormData((prev) => ({ ...prev, taxClassId: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="">Select tax class</option>
                          <option value="STANDARD">Standard (20%)</option>
                          <option value="REDUCED">Reduced (5%)</option>
                          <option value="ZERO">Zero Rate (0%)</option>
                          <option value="EXEMPT">Exempt</option>
                        </select>
                      </div>
                    </div>
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-4">Taxonomy</h3>
                      
                      <div className="space-y-4">
                        <CategorySelector
                          value={formData.categoryId}
                          onChange={(categoryId) => setFormData({ ...formData, categoryId: categoryId || '' })}
                          label="Category"
                          placeholder="Select a category"
                        />
                        
                        <TagSelector
                          value={formData.tagIds}
                          onChange={(tagIds) => setFormData({ ...formData, tagIds })}
                          label="Tags"
                          placeholder="Search and select tags..."
                        />
                        
                        {formData.categoryId && (
                          <AttributeEditor
                            categoryId={formData.categoryId}
                            value={formData.attributes}
                            onChange={(attributes) => setFormData({ ...formData, attributes })}
                            label="Product Attributes"
                          />
                        )}
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-4">Images</h3>
                      <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <div className="font-medium text-gray-900">Upload product images</div>
                            <div className="text-xs text-gray-600">JPEG/PNG/GIF/WebP, max 250KB each, up to 4 images</div>
                          </div>
                          <label className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 cursor-pointer">
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/gif,image/webp"
                              multiple
                              className="hidden"
                              disabled={uploadingImages}
                              onChange={(e) => uploadImages(e.target.files)}
                            />
                            {uploadingImages ? 'Uploading…' : 'Add Images'}
                          </label>
                        </div>

                        {images.length > 0 && (
                          <div className="mt-4 space-y-3">
                            {images.map((img, idx) => (
                              <div key={idx} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg bg-white">
                                <img src={img.url} alt={img.alt || 'Product image'} className="w-20 h-20 object-cover rounded" />
                                <div className="flex-1">
                                  <input
                                    type="text"
                                    value={img.alt || ''}
                                    onChange={(e) => updateImageAlt(idx, e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2"
                                    placeholder="Alt text (optional)"
                                  />
                                  <div className="text-xs text-gray-500 space-y-1">
                                    <p className="truncate">{img.url}</p>
                                    {img.size && (
                                      <p>Size: {(img.size / 1024).toFixed(2)} KB</p>
                                    )}
                                    {img.width && img.height && (
                                      <p>Dimensions: {img.width} × {img.height} px</p>
                                    )}
                                    {img.format && (
                                      <p>Format: {img.format}</p>
                                    )}
                                    {img.uploadedAt && (
                                      <p>Uploaded: {img.uploadedAt.toLocaleString()}</p>
                                    )}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeImage(idx)}
                                  className="px-3 py-1 text-red-600 hover:text-red-800 text-sm"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        id="publishNowEdit"
                        type="checkbox"
                        checked={publishNow}
                        onChange={(e) => setPublishNow(e.target.checked)}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <label htmlFor="publishNowEdit" className="text-sm text-gray-700">
                        Publish to storefront (sets status ACTIVE)
                      </label>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        type="submit"
                        className="flex-1 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                      >
                        Update Product
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditModal(false);
                          setEditingProduct(null);
                        }}
                        className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteModal && productToDelete && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full p-6">
                <h2 className="text-2xl font-bold mb-4">Delete Product</h2>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete <strong>{productToDelete.name}</strong>? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteConfirm}
                    className="flex-1 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setProductToDelete(null);
                    }}
                    className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}

