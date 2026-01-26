'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { CategorySelector } from '@/components/taxonomy/CategorySelector';
import { TagSelector } from '@/components/taxonomy/TagSelector';
import { AttributeEditor } from '@/components/taxonomy/AttributeEditor';
import { getPublicApiBaseUrl } from '@/lib/apiBaseUrl';
import { useCurrency } from '@/contexts/CurrencyContext';
import { DataExport } from '@/components/DataExport';
import Image from 'next/image';

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  price: number;
  stock: number;
  status: string;
  sku?: string;
  barcode?: string;
  currency?: string;
  taxRate?: number;
  taxClassId?: string;
  isPlatformOwned?: boolean;
  sellerId?: string;
  categoryId?: string;
  categoryRelation?: { categoryId: string };
  category?: { id: string; name: string };
  tagsRelation?: Array<{ tagId: string }>;
  tags?: Array<{ id: string; name: string }>;
  attributes?: any[];
  images?: Array<{ url: string; alt?: string; order?: number; isPrimary?: boolean }>;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  metaTitle?: string;
  metaDescription?: string;
  isFeatured?: boolean;
  isHidden?: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface Stats {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  outOfStock: number;
  lowStock: number;
  platformOwned: number;
  sellerProducts: number;
  avgPrice: number;
}

export default function AdminProductsPage() {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [page, setPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sellers, setSellers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [publishNow, setPublishNow] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    shortDescription: '',
    price: '',
    stock: '0',
    taxRate: '',
    taxClassId: '',
    isPlatformOwned: true,
    sellerId: '',
    categoryId: '',
    tagIds: [] as string[],
    attributes: [] as any[],
    // Shipping dimensions
    weight: '',
    length: '',
    width: '',
    height: '',
    // SEO
    metaTitle: '',
    metaDescription: '',
    // Visibility
    isFeatured: false,
    isHidden: false,
  });
  const [images, setImages] = useState<Array<{ url: string; alt?: string; order?: number; size?: number; width?: number; height?: number; format?: string; uploadedAt?: Date; isPrimary?: boolean }>>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<'publish' | 'unpublish' | 'delete'>('publish');

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getAdminProducts({ page, limit: 100 });
      const list = response?.data?.products || response?.data?.data || response?.data || [];
      const productList = Array.isArray(list) ? list : [];
      setProducts(productList);
      calculateStats(productList);
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError(err.message || 'Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  const fetchSellers = useCallback(async () => {
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
      setSellers([]);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await apiClient.getCategoryTree();
      if (response?.data) {
        // Flatten the tree for filter dropdown
        const flatten = (cats: any[], result: any[] = []): any[] => {
          for (const cat of cats) {
            result.push(cat);
            if (cat.children) flatten(cat.children, result);
          }
          return result;
        };
        setCategories(flatten(response.data));
      }
    } catch {
      setCategories([]);
    }
  }, []);

  const calculateStats = (productList: Product[]) => {
    const active = productList.filter(p => p.status === 'ACTIVE');
    const draft = productList.filter(p => p.status === 'DRAFT');
    const outOfStock = productList.filter(p => p.stock === 0);
    const lowStock = productList.filter(p => p.stock > 0 && p.stock <= 10);
    const platform = productList.filter(p => p.isPlatformOwned);
    const seller = productList.filter(p => !p.isPlatformOwned && p.sellerId);
    const avgPrice = productList.length > 0 
      ? productList.reduce((sum, p) => sum + (p.price || 0), 0) / productList.length 
      : 0;

    setStats({
      totalProducts: productList.length,
      activeProducts: active.length,
      draftProducts: draft.length,
      outOfStock: outOfStock.length,
      lowStock: lowStock.length,
      platformOwned: platform.length,
      sellerProducts: seller.length,
      avgPrice,
    });
  };

  useEffect(() => {
    fetchProducts();
    fetchSellers();
    fetchCategories();
  }, [fetchProducts, fetchSellers, fetchCategories]);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.sku?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    // Category filter
    if (categoryFilter !== 'ALL') {
      filtered = filtered.filter(p => 
        p.categoryId === categoryFilter || 
        p.categoryRelation?.categoryId === categoryFilter ||
        p.category?.id === categoryFilter
      );
    }

    // Stock filter
    if (stockFilter === 'OUT') {
      filtered = filtered.filter(p => p.stock === 0);
    } else if (stockFilter === 'LOW') {
      filtered = filtered.filter(p => p.stock > 0 && p.stock <= 10);
    } else if (stockFilter === 'IN') {
      filtered = filtered.filter(p => p.stock > 10);
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'price':
          comparison = (a.price || 0) - (b.price || 0);
          break;
        case 'stock':
          comparison = (a.stock || 0) - (b.stock || 0);
          break;
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [products, searchTerm, statusFilter, categoryFilter, stockFilter, sortBy, sortOrder]);

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
        images: images.length > 0 ? images.map(img => ({ 
          url: img.url, 
          alt: img.alt, 
          order: img.order,
        })) : undefined,
      });
      toast.success('Product created successfully');
      resetForm();
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create product');
    }
  };

  const uploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSizeBytes = 250 * 1024;
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
      
      const newImages = await Promise.all(
        limited.map(async (file, idx) => {
          const url = urls[idx];
          
          const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
            if (typeof window !== 'undefined') {
              const img = document.createElement('img');
              img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
              img.onerror = () => resolve({ width: 0, height: 0 });
              img.src = url;
            } else {
              resolve({ width: 0, height: 0 });
            }
          });
          
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
            isPrimary: images.length === 0 && idx === 0, // First image is primary
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
    setImages((prev) => {
      const newImages = prev.filter((_, i) => i !== idx).map((img, i) => ({ ...img, order: i }));
      // If we removed the primary image, make the first one primary
      if (prev[idx]?.isPrimary && newImages.length > 0) {
        newImages[0].isPrimary = true;
      }
      return newImages;
    });
  };

  const updateImageAlt = (idx: number, alt: string) => {
    setImages((prev) => prev.map((img, i) => (i === idx ? { ...img, alt } : img)));
  };

  const setPrimaryImage = (idx: number) => {
    setImages((prev) => prev.map((img, i) => ({ ...img, isPrimary: i === idx })));
  };

  const moveImage = (idx: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= images.length) return;
    
    setImages((prev) => {
      const newImages = [...prev];
      [newImages[idx], newImages[newIdx]] = [newImages[newIdx], newImages[idx]];
      return newImages.map((img, i) => ({ ...img, order: i }));
    });
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      description: product.description || '',
      shortDescription: product.shortDescription || '',
      price: product.price?.toString() || '',
      stock: product.stock?.toString() || '0',
      taxRate: product.taxRate?.toString() || '',
      taxClassId: product.taxClassId || '',
      isPlatformOwned: !product.sellerId || product.isPlatformOwned || false,
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
      weight: product.weight?.toString() || '',
      length: product.length?.toString() || '',
      width: product.width?.toString() || '',
      height: product.height?.toString() || '',
      metaTitle: product.metaTitle || '',
      metaDescription: product.metaDescription || '',
      isFeatured: product.isFeatured || false,
      isHidden: product.isHidden || false,
    });
    setImages(product.images?.map((img: any) => ({
      url: img.url,
      alt: img.alt || '',
      order: img.order || 0,
      isPrimary: img.isPrimary || false,
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
        images: images.length > 0 ? images.map(img => ({ 
          url: img.url, 
          alt: img.alt, 
          order: img.order,
        })) : undefined,
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

  const handleDuplicateProduct = async (product: Product) => {
    try {
      await apiClient.createAdminProduct({
        name: `${product.name} (Copy)`,
        description: product.description,
        shortDescription: product.shortDescription,
        price: product.price,
        stock: 0, // Start with 0 stock
        taxRate: product.taxRate,
        isPlatformOwned: product.isPlatformOwned,
        sellerId: product.sellerId,
        status: 'DRAFT', // Always create as draft
        categoryId: product.categoryId || product.categoryRelation?.categoryId,
        tagIds: product.tagsRelation?.map(t => t.tagId) || product.tags?.map(t => t.id),
        attributes: product.attributes,
        images: product.images,
        weight: product.weight,
        length: product.length,
        width: product.width,
        height: product.height,
        metaTitle: product.metaTitle,
        metaDescription: product.metaDescription,
        isFeatured: false,
        isHidden: false,
      });
      toast.success('Product duplicated successfully');
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to duplicate product');
    }
  };

  const handleApprove = async (product: Product) => {
    try {
      await apiClient.updateAdminProduct(product.id, { status: 'ACTIVE' });
      toast.success('Product approved and published');
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve product');
    }
  };

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;

    try {
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

  const handleBulkAction = async () => {
    if (selectedProducts.size === 0) return;

    let success = 0;
    let failed = 0;

    for (const id of selectedProducts) {
      try {
        if (bulkAction === 'publish') {
          await apiClient.updateAdminProduct(id, { status: 'ACTIVE' });
        } else if (bulkAction === 'unpublish') {
          await apiClient.updateAdminProduct(id, { status: 'DRAFT' });
        } else if (bulkAction === 'delete') {
          const token = localStorage.getItem('auth_token');
          const apiUrl = getPublicApiBaseUrl();
          await fetch(`${apiUrl}/admin/products/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
          });
        }
        success++;
      } catch {
        failed++;
      }
    }

    toast.success(`${bulkAction === 'delete' ? 'Deleted' : 'Updated'} ${success} products${failed > 0 ? `, ${failed} failed` : ''}`);
    setShowBulkModal(false);
    setSelectedProducts(new Set());
    fetchProducts();
  };

  const toggleProductSelection = (id: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
  };

  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  const resetForm = () => {
    setShowCreateForm(false);
    setFormData({ 
      name: '', description: '', shortDescription: '', price: '', stock: '0',
      taxRate: '', taxClassId: '', isPlatformOwned: true, sellerId: '',
      categoryId: '', tagIds: [], attributes: [],
      weight: '', length: '', width: '', height: '',
      metaTitle: '', metaDescription: '', isFeatured: false, isHidden: false,
    });
    setImages([]);
    setPublishNow(true);
  };

  const exportColumns = [
    { key: 'name', header: 'Name' },
    { key: 'sku', header: 'SKU' },
    { key: 'price', header: 'Price', format: (v: number, r: Product) => `${r.currency || 'GBP'} ${Number(v || 0).toFixed(2)}` },
    { key: 'stock', header: 'Stock' },
    { key: 'status', header: 'Status' },
    { key: 'category', header: 'Category', format: (v: any) => v?.name || '' },
  ];

  const getStockBadge = (stock: number) => {
    if (stock === 0) return <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700">Out</span>;
    if (stock <= 10) return <span className="px-2 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700">Low</span>;
    return <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">{stock}</span>;
  };

  if (loading && products.length === 0) {
    return (
      <RouteGuard allowedRoles={['ADMIN']}>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Products</h1>
              <p className="text-gray-600 mt-1">Manage all products in the catalog</p>
            </div>
            <div className="flex gap-2">
              <DataExport data={filteredProducts} columns={exportColumns} filename="products-export" />
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                {showCreateForm ? 'Cancel' : '+ Create Product'}
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-purple-600">{stats.totalProducts}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeProducts}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Draft</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.draftProducts}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Out of Stock</p>
                <p className="text-2xl font-bold text-red-600">{stats.outOfStock}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Low Stock</p>
                <p className="text-2xl font-bold text-orange-600">{stats.lowStock}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Platform</p>
                <p className="text-2xl font-bold text-blue-600">{stats.platformOwned}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Seller</p>
                <p className="text-2xl font-bold text-indigo-600">{stats.sellerProducts}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Avg Price</p>
                <p className="text-xl font-bold text-pink-600">{formatPrice(stats.avgPrice)}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
              <button onClick={fetchProducts} className="mt-2 text-red-600 hover:text-red-800 text-sm">Retry</button>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="DRAFT">Draft</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="ALL">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{'  '.repeat(cat.level || 0)}{cat.name}</option>
                ))}
              </select>
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="ALL">All Stock</option>
                <option value="OUT">Out of Stock</option>
                <option value="LOW">Low Stock</option>
                <option value="IN">In Stock</option>
              </select>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field as any);
                  setSortOrder(order as any);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="price-asc">Price Low-High</option>
                <option value="price-desc">Price High-Low</option>
                <option value="stock-asc">Stock Low-High</option>
              </select>
            </div>

            {/* Bulk Actions */}
            {selectedProducts.size > 0 && (
              <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                <span className="text-sm text-gray-600">{selectedProducts.size} selected</span>
                <button
                  onClick={() => { setBulkAction('publish'); setShowBulkModal(true); }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                >
                  Publish
                </button>
                <button
                  onClick={() => { setBulkAction('unpublish'); setShowBulkModal(true); }}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
                >
                  Unpublish
                </button>
                <button
                  onClick={() => { setBulkAction('delete'); setShowBulkModal(true); }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                >
                  Delete
                </button>
                <button onClick={clearSelection} className="text-sm text-gray-500 hover:text-gray-700">
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Create Form */}
          {showCreateForm && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Create New Product</h2>
              <form onSubmit={handleCreateProduct} className="space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="Product name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.price}
                        onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
                      <input
                        type="number"
                        required
                        value={formData.stock}
                        onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    rows={3}
                    placeholder="Full product description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
                  <input
                    type="text"
                    value={formData.shortDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, shortDescription: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Brief summary for listings"
                  />
                </div>

                {/* Tax */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.taxRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, taxRate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="20.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tax Class</label>
                    <select
                      value={formData.taxClassId}
                      onChange={(e) => setFormData(prev => ({ ...prev, taxClassId: e.target.value }))}
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

                {/* Shipping Dimensions */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Shipping Dimensions</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Weight (kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.weight}
                        onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="0.5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Length (cm)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.length}
                        onChange={(e) => setFormData(prev => ({ ...prev, length: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Width (cm)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.width}
                        onChange={(e) => setFormData(prev => ({ ...prev, width: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="15"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Height (cm)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.height}
                        onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="10"
                      />
                    </div>
                  </div>
                </div>

                {/* SEO */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">SEO</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Meta Title</label>
                      <input
                        type="text"
                        value={formData.metaTitle}
                        onChange={(e) => setFormData(prev => ({ ...prev, metaTitle: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="SEO title (defaults to product name)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Meta Description</label>
                      <input
                        type="text"
                        value={formData.metaDescription}
                        onChange={(e) => setFormData(prev => ({ ...prev, metaDescription: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="SEO description"
                      />
                    </div>
                  </div>
                </div>

                {/* Ownership */}
                <div className="border-t pt-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.isPlatformOwned}
                      onChange={(e) => setFormData(prev => ({ ...prev, isPlatformOwned: e.target.checked, sellerId: '' }))}
                      className="rounded border-gray-300 text-purple-600"
                    />
                    <span className="text-sm text-gray-700">Platform Owned (not assigned to seller)</span>
                  </label>
                </div>
                {!formData.isPlatformOwned && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Seller</label>
                    <select
                      value={formData.sellerId}
                      onChange={(e) => setFormData(prev => ({ ...prev, sellerId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select a seller</option>
                      {sellers.map((seller) => (
                        <option key={seller.id} value={seller.id}>{seller.email} ({seller.role})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Taxonomy */}
                <div className="border-t pt-4">
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

                {/* Images */}
                <div className="border-t pt-4">
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
                          <div key={idx} className={`flex items-start gap-3 p-3 border rounded-lg bg-white ${img.isPrimary ? 'border-purple-400 ring-2 ring-purple-100' : 'border-gray-200'}`}>
                            <div className="relative">
                              <img src={img.url} alt={img.alt || 'Product image'} className="w-20 h-20 object-cover rounded" />
                              {img.isPrimary && (
                                <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-xs px-1 rounded">★</span>
                              )}
                            </div>
                            <div className="flex-1">
                              <input
                                type="text"
                                value={img.alt || ''}
                                onChange={(e) => updateImageAlt(idx, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2"
                                placeholder="Alt text (optional)"
                              />
                              <div className="flex gap-2 text-xs">
                                {!img.isPrimary && (
                                  <button type="button" onClick={() => setPrimaryImage(idx)} className="text-purple-600 hover:text-purple-800">
                                    Set as Primary
                                  </button>
                                )}
                                <button type="button" onClick={() => moveImage(idx, 'up')} disabled={idx === 0} className="text-gray-500 hover:text-gray-700 disabled:opacity-30">
                                  ↑ Up
                                </button>
                                <button type="button" onClick={() => moveImage(idx, 'down')} disabled={idx === images.length - 1} className="text-gray-500 hover:text-gray-700 disabled:opacity-30">
                                  ↓ Down
                                </button>
                              </div>
                            </div>
                            <button type="button" onClick={() => removeImage(idx)} className="px-3 py-1 text-red-600 hover:text-red-800 text-sm">
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Visibility Options */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Visibility</h3>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <input
                        type="checkbox"
                        checked={publishNow}
                        onChange={(e) => setPublishNow(e.target.checked)}
                        className="rounded border-gray-300 text-purple-600"
                      />
                      <span className="text-sm text-gray-700">Publish immediately</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <input
                        type="checkbox"
                        checked={formData.isFeatured}
                        onChange={(e) => setFormData(prev => ({ ...prev, isFeatured: e.target.checked }))}
                        className="rounded border-gray-300 text-purple-600"
                      />
                      <span className="text-sm text-gray-700">Featured Product</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <input
                        type="checkbox"
                        checked={formData.isHidden}
                        onChange={(e) => setFormData(prev => ({ ...prev, isHidden: e.target.checked }))}
                        className="rounded border-gray-300 text-purple-600"
                      />
                      <span className="text-sm text-gray-700">Hide from search</span>
                    </label>
                  </div>
                </div>
                
                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                  Create Product
                </button>
              </form>
            </div>
          )}

          {/* Products Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Products ({filteredProducts.length})</h2>
              <button onClick={selectAllVisible} className="text-sm text-purple-600 hover:text-purple-800">
                Select All Visible
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <input
                        type="checkbox"
                        checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                        onChange={() => selectedProducts.size === filteredProducts.length ? clearSelection() : selectAllVisible()}
                        className="rounded border-gray-300 text-purple-600"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        No products found
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => (
                      <tr key={product.id} className={`hover:bg-gray-50 ${selectedProducts.has(product.id) ? 'bg-purple-50' : ''}`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(product.id)}
                            onChange={() => toggleProductSelection(product.id)}
                            className="rounded border-gray-300 text-purple-600"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {product.images?.[0]?.url ? (
                              <img src={product.images[0].url} alt={product.name} className="w-10 h-10 rounded object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center text-gray-400">📦</div>
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                                {product.isFeatured && <span className="text-yellow-500 mr-1">★</span>}
                                {product.name}
                              </div>
                              <div className="text-xs text-gray-500">{product.sku || product.slug}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatPrice(product.price)}
                        </td>
                        <td className="px-4 py-3">
                          {getStockBadge(product.stock)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            product.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                            product.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {product.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(product.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => handleEdit(product)} className="px-2 py-1 text-sm text-purple-600 hover:bg-purple-50 rounded">
                              Edit
                            </button>
                            <button onClick={() => handleDuplicateProduct(product)} className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-50 rounded" title="Duplicate">
                              📋
                            </button>
                            {product.status === 'DRAFT' && (
                              <button onClick={() => handleApprove(product)} className="px-2 py-1 text-sm text-green-600 hover:bg-green-50 rounded">
                                Publish
                              </button>
                            )}
                            <button onClick={() => handleDeleteClick(product)} className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded">
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
          </div>

          {/* Edit Modal - Simplified for brevity, uses same form structure */}
          {showEditModal && editingProduct && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
              <div className="bg-white rounded-lg max-w-4xl w-full my-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold">Edit Product</h2>
                    <button onClick={() => { setShowEditModal(false); setEditingProduct(null); }} className="text-gray-500 hover:text-gray-700 text-2xl">
                      ×
                    </button>
                  </div>
                  <form onSubmit={handleUpdateProduct} className="space-y-4">
                    {/* Same form fields as create form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                        <input type="text" required value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                          <input type="number" step="0.01" required value={formData.price} onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
                          <input type="number" required value={formData.stock} onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                      <textarea required value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" rows={3} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
                      <input type="text" value={formData.shortDescription} onChange={(e) => setFormData(prev => ({ ...prev, shortDescription: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                    </div>

                    {/* Taxonomy */}
                    <div className="border-t pt-4">
                      <CategorySelector value={formData.categoryId} onChange={(categoryId) => setFormData({ ...formData, categoryId: categoryId || '' })} label="Category" />
                      <div className="mt-4">
                        <TagSelector value={formData.tagIds} onChange={(tagIds) => setFormData({ ...formData, tagIds })} label="Tags" />
                      </div>
                      {formData.categoryId && (
                        <div className="mt-4">
                          <AttributeEditor categoryId={formData.categoryId} value={formData.attributes} onChange={(attributes) => setFormData({ ...formData, attributes })} label="Product Attributes" />
                        </div>
                      )}
                    </div>

                    {/* Images */}
                    <div className="border-t pt-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-4">Images</h3>
                      <label className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 cursor-pointer">
                        <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple className="hidden" disabled={uploadingImages} onChange={(e) => uploadImages(e.target.files)} />
                        {uploadingImages ? 'Uploading…' : 'Add Images'}
                      </label>
                      {images.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {images.map((img, idx) => (
                            <div key={idx} className={`relative ${img.isPrimary ? 'ring-2 ring-purple-500' : ''}`}>
                              <img src={img.url} alt="" className="w-16 h-16 object-cover rounded" />
                              {img.isPrimary && <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-xs px-1 rounded">★</span>}
                              <button type="button" onClick={() => removeImage(idx)} className="absolute -bottom-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full">×</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Visibility */}
                    <div className="border-t pt-4 flex flex-wrap gap-4">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} className="rounded border-gray-300 text-purple-600" />
                        <span className="text-sm">Published</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={formData.isFeatured} onChange={(e) => setFormData(prev => ({ ...prev, isFeatured: e.target.checked }))} className="rounded border-gray-300 text-purple-600" />
                        <span className="text-sm">Featured</span>
                      </label>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button type="submit" className="flex-1 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">
                        Update Product
                      </button>
                      <button type="button" onClick={() => { setShowEditModal(false); setEditingProduct(null); }} className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Delete Modal */}
          {showDeleteModal && productToDelete && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full p-6">
                <h2 className="text-2xl font-bold mb-4">Delete Product</h2>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete <strong>{productToDelete.name}</strong>? This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button onClick={handleDeleteConfirm} className="flex-1 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">
                    Delete
                  </button>
                  <button onClick={() => { setShowDeleteModal(false); setProductToDelete(null); }} className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Action Modal */}
          {showBulkModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full p-6">
                <h2 className="text-2xl font-bold mb-4">
                  {bulkAction === 'publish' ? 'Publish Products' : bulkAction === 'unpublish' ? 'Unpublish Products' : 'Delete Products'}
                </h2>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to {bulkAction} <strong>{selectedProducts.size}</strong> products?
                  {bulkAction === 'delete' && ' This cannot be undone.'}
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={handleBulkAction} 
                    className={`flex-1 px-6 py-2 text-white rounded-lg font-medium ${
                      bulkAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    {bulkAction === 'publish' ? 'Publish All' : bulkAction === 'unpublish' ? 'Unpublish All' : 'Delete All'}
                  </button>
                  <button onClick={() => setShowBulkModal(false)} className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium">
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
