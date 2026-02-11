'use client';

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { SafeImage } from '@/components/SafeImage';
import Link from 'next/link';

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
  productType?: 'SIMPLE' | 'VARIANT' | 'BUNDLED';
  variations?: Array<{ id?: string; name: string; options: any[] }>;
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

function AdminProductsContent() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [page, setPage] = useState(1);
  const [sellers, setSellers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [publishNow, setPublishNow] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  
  // Read seller filter from URL query param
  const sellerFilterFromUrl = searchParams.get('seller') || '';
  
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
    variations: [] as Array<{ name: string; options: Array<string | { value: string; price?: number; stock?: number; imageUrl?: string }> }>,
  });
  const [images, setImages] = useState<Array<{ url: string; alt?: string; order?: number; size?: number; width?: number; height?: number; format?: string; uploadedAt?: Date; isPrimary?: boolean }>>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<'publish' | 'unpublish' | 'inactive' | 'delete'>('publish');
  const [updatingProduct, setUpdatingProduct] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getAdminProducts({ 
        page, 
        limit: 100,
        sellerId: sellerFilterFromUrl || undefined,
      });
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
  }, [page, sellerFilterFromUrl]);

  const fetchSellers = useCallback(async () => {
    try {
      const response = await apiClient.getAdminSellers();
      const raw = response?.data;
      const list = Array.isArray(raw) ? raw : [];
      const mapped = list.map((s: any) => ({
        id: s.id,
        sellerId: s.id,
        storeName: s.storeName || '',
        email: s.user?.email || '',
        firstName: s.user?.firstName,
        lastName: s.user?.lastName,
      }));
      setSellers(mapped);
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
    const priceSum = productList.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
    const avgPrice = productList.length > 0 ? priceSum / productList.length : 0;

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

  const updateVariationOption = (varIdx: number, optIdx: number, field: 'value' | 'price' | 'stock', value: string) => {
    setFormData((prev) => {
      const vars = [...prev.variations];
      const opts = [...(vars[varIdx]?.options || [])];
      const current = opts[optIdx];
      const base: { value: string; price?: number; stock?: number } = typeof current === 'object' && current && typeof (current as any).value === 'string'
        ? { value: (current as any).value, price: (current as any).price, stock: (current as any).stock }
        : { value: String(current ?? '') };
      if (field === 'value') base.value = value;
      else if (field === 'price') base.price = value ? parseFloat(value) : undefined;
      else if (field === 'stock') base.stock = value ? parseInt(value, 10) : undefined;
      opts[optIdx] = base.value ? (base.price != null || base.stock != null ? base : base.value) : base.value;
      vars[varIdx] = { ...vars[varIdx], name: vars[varIdx].name, options: opts };
      return { ...prev, variations: vars };
    });
  };

  const removeVariationOption = (varIdx: number, optIdx: number) => {
    setFormData((prev) => ({
      ...prev,
      variations: prev.variations.map((v, i) => i === varIdx ? { ...v, options: v.options.filter((_, j) => j !== optIdx) } : v),
    }));
  };

  const addVariationOption = (varIdx: number) => {
    setFormData((prev) => ({
      ...prev,
      variations: prev.variations.map((v, i) => i === varIdx ? { ...v, options: [...(v.options || []), ''] } : v),
    }));
  };

  const addVariationDimension = () => {
    setFormData((prev) => ({ ...prev, variations: [...prev.variations, { name: '', options: [''] }] }));
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
      variations: (product.variations || []).map((v: any) => ({
        name: v.name,
        options: Array.isArray(v.options) ? v.options : [],
      })),
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
    if (!editingProduct || updatingProduct) return;

    try {
      setUpdatingProduct(true);
      await apiClient.updateAdminProduct(editingProduct.id, {
        name: formData.name,
        description: formData.description,
        shortDescription: formData.shortDescription || undefined,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock, 10),
        ...(formData.taxRate ? { taxRate: parseFloat(formData.taxRate) } : {}),
        ...(formData.taxClassId ? { taxClassId: formData.taxClassId } : {}),
        status: publishNow ? 'ACTIVE' : 'DRAFT',
        categoryId: formData.categoryId || undefined,
        tagIds: formData.tagIds.length > 0 ? formData.tagIds : undefined,
        variations: formData.variations.length > 0 ? formData.variations : undefined,
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
    } finally {
      setUpdatingProduct(false);
    }
  };

  const handleDuplicateProduct = async (product: Product) => {
    try {
      await apiClient.createAdminProduct({
        name: `${product.name} (Copy)`,
        description: product.description,
        price: product.price,
        stock: 0, // Start with 0 stock
        ...(product.taxClassId ? { taxClassId: product.taxClassId } : {}),
        ...(product.taxRate != null ? { taxRate: product.taxRate } : {}),
        isPlatformOwned: product.isPlatformOwned,
        sellerId: product.sellerId,
        status: 'DRAFT', // Always create as draft
        categoryId: product.categoryId || product.categoryRelation?.categoryId,
        tagIds: product.tagsRelation?.map(t => t.tagId) || product.tags?.map(t => t.id),
        attributes: product.attributes,
        images: product.images?.map(img => ({ url: img.url, alt: img.alt, order: img.order })),
      });
      toast.success('Product duplicated successfully');
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to duplicate product');
    }
  };

  const handleStatusChange = async (product: Product, newStatus: 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'OUT_OF_STOCK') => {
    try {
      await apiClient.updateAdminProduct(product.id, { status: newStatus });
      const labels: Record<string, string> = {
        ACTIVE: 'Published',
        DRAFT: 'Moved to Draft',
        INACTIVE: 'Set Inactive',
        OUT_OF_STOCK: 'Marked Out of Stock',
      };
      toast.success(`Product ${labels[newStatus] || newStatus}`);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to change product status');
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
        } else if (bulkAction === 'inactive') {
          await apiClient.updateAdminProduct(id, { status: 'INACTIVE' });
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

  const exportColumns = [
    { key: 'name', header: 'Name' },
    { key: 'sku', header: 'SKU' },
    { key: 'price', header: 'Price', format: (v: number, r: Product) => `${r.currency || 'GBP'} ${Number(v || 0).toFixed(2)}` },
    { key: 'stock', header: 'Stock' },
    { key: 'status', header: 'Status' },
    { key: 'category', header: 'Fandom', format: (v: any) => v?.name || '' },
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
              <Link
                href="/admin/products/create"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                + Create Product
              </Link>
            </div>
          </div>

          {/* Seller Filter Indicator */}
          {sellerFilterFromUrl && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-purple-700 font-medium">Filtered by Seller:</span>
                <span className="text-purple-600">
                  {(() => {
                    const seller = sellers.find(s => (s as any).sellerId === sellerFilterFromUrl || s.id === sellerFilterFromUrl);
                    return seller?.storeName || seller?.email || sellerFilterFromUrl.substring(0, 8) + '...';
                  })()}
                </span>
                <span className="text-xs text-purple-500">({filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''})</span>
              </div>
              <Link
                href="/admin/products"
                className="text-purple-600 hover:text-purple-800 text-sm font-medium underline"
              >
                Clear Filter
              </Link>
            </div>
          )}

          {/* Stats Cards — click to filter */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              <button
                onClick={() => { setStatusFilter('ALL'); setStockFilter('ALL'); }}
                className={`bg-white rounded-lg shadow p-4 text-left hover:ring-2 hover:ring-purple-300 transition ${statusFilter === 'ALL' && stockFilter === 'ALL' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-purple-600">{stats.totalProducts}</p>
              </button>
              <button
                onClick={() => { setStatusFilter('ACTIVE'); setStockFilter('ALL'); }}
                className={`bg-white rounded-lg shadow p-4 text-left hover:ring-2 hover:ring-green-300 transition ${statusFilter === 'ACTIVE' ? 'ring-2 ring-green-500' : ''}`}
              >
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeProducts}</p>
              </button>
              <button
                onClick={() => { setStatusFilter('DRAFT'); setStockFilter('ALL'); }}
                className={`bg-white rounded-lg shadow p-4 text-left hover:ring-2 hover:ring-yellow-300 transition ${statusFilter === 'DRAFT' ? 'ring-2 ring-yellow-500' : ''}`}
              >
                <p className="text-sm text-gray-600">Draft</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.draftProducts}</p>
              </button>
              <button
                onClick={() => { setStatusFilter('ALL'); setStockFilter('OUT'); }}
                className={`bg-white rounded-lg shadow p-4 text-left hover:ring-2 hover:ring-red-300 transition ${stockFilter === 'OUT' ? 'ring-2 ring-red-500' : ''}`}
              >
                <p className="text-sm text-gray-600">Out of Stock</p>
                <p className="text-2xl font-bold text-red-600">{stats.outOfStock}</p>
              </button>
              <button
                onClick={() => { setStatusFilter('ALL'); setStockFilter('LOW'); }}
                className={`bg-white rounded-lg shadow p-4 text-left hover:ring-2 hover:ring-orange-300 transition ${stockFilter === 'LOW' ? 'ring-2 ring-orange-500' : ''}`}
              >
                <p className="text-sm text-gray-600">Low Stock</p>
                <p className="text-2xl font-bold text-orange-600">{stats.lowStock}</p>
              </button>
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
                <option value="ALL">All Fandoms</option>
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
                  onClick={() => { setBulkAction('inactive'); setShowBulkModal(true); }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                >
                  Set Inactive
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
                              <SafeImage src={product.images[0].url} alt={product.name} width={40} height={40} className="rounded object-cover" fallback="📦" />
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
                          <div className="flex justify-end gap-1 items-center">
                            <button onClick={() => handleEdit(product)} className="px-2 py-1 text-sm text-purple-600 hover:bg-purple-50 rounded">
                              Edit
                            </button>
                            <button onClick={() => handleDuplicateProduct(product)} className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-50 rounded" title="Duplicate">
                              📋
                            </button>
                            <select
                              value={product.status}
                              onChange={(e) => handleStatusChange(product, e.target.value as 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'OUT_OF_STOCK')}
                              className={`px-2 py-1 text-xs border rounded cursor-pointer font-medium ${
                                product.status === 'ACTIVE' ? 'border-green-300 text-green-700 bg-green-50' :
                                product.status === 'DRAFT' ? 'border-yellow-300 text-yellow-700 bg-yellow-50' :
                                'border-gray-300 text-gray-700 bg-gray-50'
                              }`}
                              title="Change status"
                            >
                              <option value="ACTIVE">Active</option>
                              <option value="DRAFT">Draft</option>
                              <option value="INACTIVE">Inactive</option>
                            </select>
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
                          {editingProduct?.productType === 'VARIANT' && formData.variations.length > 0 && (
                            <p className="text-xs text-amber-600 mb-1">For variable products, set price per variation option in the Variations section below (or when creating). Base price here is fallback.</p>
                          )}
                          <input type="number" step="0.01" required value={formData.price} onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
                          {editingProduct?.productType === 'VARIANT' && formData.variations.length > 0 && (
                            <p className="text-xs text-amber-600 mb-1">For variable products, set stock per variation option in the Variations section below.</p>
                          )}
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
                      <input type="text" value={formData.shortDescription} onChange={(e) => setFormData(prev => ({ ...prev, shortDescription: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="Brief summary for listing/customer view" />
                    </div>

                    {/* Variations (editable) */}
                    {formData.variations.length === 0 && (
                      <div className="border-t pt-4">
                        <p className="text-sm text-gray-600 mb-2">No variations. Add dimensions (e.g. Size, Color) with options and optional price/stock per option.</p>
                        <button type="button" onClick={addVariationDimension} className="text-sm text-purple-600 hover:text-purple-800 font-medium">+ Add variation dimension</button>
                      </div>
                    )}
                    {formData.variations.length > 0 && (
                      <div className="border-t pt-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Variations (price/stock per option)</h3>
                        <p className="text-xs text-gray-500 mb-3">Set optional price and stock per option. Base price/stock above are fallback for simple products.</p>
                        <div className="space-y-4">
                          {formData.variations.map((variation, varIdx) => (
                            <div key={varIdx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-700">Dimension name</label>
                                <button type="button" onClick={() => setFormData(prev => ({ ...prev, variations: prev.variations.filter((_, i) => i !== varIdx) }))} className="text-red-600 hover:text-red-800 text-xs">Remove dimension</button>
                              </div>
                              <input type="text" value={variation.name} onChange={(e) => setFormData(prev => ({ ...prev, variations: prev.variations.map((v, i) => i === varIdx ? { ...v, name: e.target.value } : v) }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3" placeholder="e.g. Size, Color" />
                              <p className="text-xs font-medium text-gray-600 mb-2">Options (value, optional price, optional stock)</p>
                              <div className="space-y-2">
                                {(variation.options || []).map((opt: any, optIdx: number) => {
                                  const val = typeof opt === 'object' && opt?.value != null ? opt.value : String(opt ?? '');
                                  const price = typeof opt === 'object' && opt?.price != null ? String(opt.price) : '';
                                  const stock = typeof opt === 'object' && opt?.stock != null ? String(opt.stock) : '';
                                  return (
                                    <div key={optIdx} className="flex flex-wrap items-center gap-2">
                                      <input type="text" value={val} onChange={(e) => updateVariationOption(varIdx, optIdx, 'value', e.target.value)} className="w-28 px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="Value" />
                                      <input type="number" step="0.01" value={price} onChange={(e) => updateVariationOption(varIdx, optIdx, 'price', e.target.value)} className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="Price" />
                                      <input type="number" value={stock} onChange={(e) => updateVariationOption(varIdx, optIdx, 'stock', e.target.value)} className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="Stock" />
                                      <button type="button" onClick={() => removeVariationOption(varIdx, optIdx)} className="text-red-600 hover:text-red-800 text-sm">×</button>
                                    </div>
                                  );
                                })}
                                <button type="button" onClick={() => addVariationOption(varIdx)} className="text-sm text-purple-600 hover:text-purple-800">+ Add option</button>
                              </div>
                            </div>
                          ))}
                          <button type="button" onClick={addVariationDimension} className="text-sm text-purple-600 hover:text-purple-800 font-medium">+ Add variation dimension</button>
                        </div>
                      </div>
                    )}

                    {/* Taxonomy */}
                    <div className="border-t pt-4">
                      <CategorySelector value={formData.categoryId} onChange={(categoryId) => setFormData(prev => ({ ...prev, categoryId: categoryId || '' }))} label="Fandom" />
                      <div className="mt-4">
                        <TagSelector value={formData.tagIds} onChange={(tagIds) => setFormData(prev => ({ ...prev, tagIds }))} label="Tags" />
                      </div>
                      {formData.categoryId && (
                        <div className="mt-4">
                          <AttributeEditor categoryId={formData.categoryId} value={formData.attributes} onChange={(attributes) => setFormData(prev => ({ ...prev, attributes }))} label="Product Attributes" />
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
                              <SafeImage src={img.url} alt="" width={64} height={64} className="object-cover rounded" />
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
                      <button type="submit" disabled={updatingProduct} className="flex-1 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                        {updatingProduct ? 'Updating...' : 'Update Product'}
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
                  {bulkAction === 'publish' ? 'Publish Products' : 
                   bulkAction === 'unpublish' ? 'Unpublish Products' : 
                   bulkAction === 'inactive' ? 'Set Products Inactive' : 
                   'Delete Products'}
                </h2>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to {bulkAction === 'inactive' ? 'set inactive' : bulkAction} <strong>{selectedProducts.size}</strong> products?
                  {bulkAction === 'delete' && ' This cannot be undone.'}
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={handleBulkAction} 
                    className={`flex-1 px-6 py-2 text-white rounded-lg font-medium ${
                      bulkAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : 
                      bulkAction === 'inactive' ? 'bg-gray-600 hover:bg-gray-700' : 
                      'bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    {bulkAction === 'publish' ? 'Publish All' : 
                     bulkAction === 'unpublish' ? 'Unpublish All' : 
                     bulkAction === 'inactive' ? 'Set All Inactive' : 
                     'Delete All'}
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

export default function AdminProductsPage() {
  return (
    <Suspense fallback={
      <RouteGuard allowedRoles={['ADMIN']}>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        </AdminLayout>
      </RouteGuard>
    }>
      <AdminProductsContent />
    </Suspense>
  );
}
