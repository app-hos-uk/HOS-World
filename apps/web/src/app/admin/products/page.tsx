'use client';

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { CategorySelector } from '@/components/taxonomy/CategorySelector';
import { FandomSelector } from '@/components/taxonomy/FandomSelector';
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
    fandom: '',
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
  const [newImageUrl, setNewImageUrl] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<'publish' | 'unpublish' | 'inactive' | 'delete'>('publish');
  const [updatingProduct, setUpdatingProduct] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch the first page to discover the total count
      const firstResponse = await apiClient.getAdminProducts({
        page: 1,
        limit: 100,
        sellerId: sellerFilterFromUrl || undefined,
      });
      const firstPayload = firstResponse?.data;
      const firstList = firstPayload?.products || firstPayload?.data || firstPayload || [];
      let productList: Product[] = Array.isArray(firstList) ? firstList : [];
      const totalFromApi = typeof firstPayload?.pagination?.total === 'number'
        ? firstPayload.pagination.total
        : undefined;

      // If there are more products beyond the first page, fetch remaining pages
      if (totalFromApi && totalFromApi > productList.length) {
        const totalPages = Math.ceil(totalFromApi / 100);
        const remaining = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            apiClient.getAdminProducts({
              page: i + 2,
              limit: 100,
              sellerId: sellerFilterFromUrl || undefined,
            }),
          ),
        );
        for (const res of remaining) {
          const p = res?.data;
          const items = p?.products || p?.data || p || [];
          if (Array.isArray(items)) productList = productList.concat(items);
        }
      }

      setProducts(productList);
      calculateStats(productList, totalFromApi ?? productList.length);
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError(err.message || 'Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [sellerFilterFromUrl]);

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

  const calculateStats = (productList: Product[], totalFromApi?: number) => {
    const active = productList.filter(p => p.status === 'ACTIVE');
    const draft = productList.filter(p => p.status === 'DRAFT');
    const outOfStock = productList.filter(p => p.stock === 0);
    const lowStock = productList.filter(p => p.stock > 0 && p.stock <= 10);
    const platform = productList.filter(p => p.isPlatformOwned);
    const seller = productList.filter(p => !p.isPlatformOwned && p.sellerId);
    const priceSum = productList.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
    const avgPrice = productList.length > 0 ? priceSum / productList.length : 0;

    setStats({
      totalProducts: typeof totalFromApi === 'number' ? totalFromApi : productList.length,
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

  const addImageByUrl = () => {
    const url = newImageUrl.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }
    setImages((prev) => [
      ...prev,
      { url, alt: '', order: prev.length, isPrimary: prev.length === 0 },
    ]);
    setNewImageUrl('');
  };

  const uploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSizeBytes = 5 * 1024 * 1024;
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
        toast.error('Max image size is 5MB');
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
      fandom: (product as any).fandom || '',
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
        fandom: formData.fandom || undefined,
        tagIds: formData.tagIds.length > 0 ? formData.tagIds : undefined,
        variations: formData.variations.length > 0 ? formData.variations : undefined,
        attributes: formData.attributes.length > 0 ? formData.attributes : undefined,
        images: images.length > 0 ? images.map(img => ({ 
          url: img.url, 
          alt: img.alt, 
          order: img.order,
        })) : undefined,
        sellerId: formData.isPlatformOwned ? null : formData.sellerId || null,
        metaTitle: formData.metaTitle || undefined,
        metaDescription: formData.metaDescription || undefined,
        ...(formData.weight ? { weight: parseFloat(formData.weight) } : {}),
        ...(formData.length ? { length: parseFloat(formData.length) } : {}),
        ...(formData.width ? { width: parseFloat(formData.width) } : {}),
        ...(formData.height ? { height: parseFloat(formData.height) } : {}),
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
      const parsed = typeof err.message === 'string' ? err.message : 'Failed to change product status';
      if (parsed.includes('not ready to publish') || parsed.includes('errors')) {
        try {
          const body = JSON.parse(err.message);
          const errorList = body.errors?.join(', ') || parsed;
          toast.error(`Cannot publish: ${errorList}`);
        } catch {
          toast.error(parsed);
        }
      } else {
        toast.error(parsed);
      }
    }
  };

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;

    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const apiUrl = getPublicApiBaseUrl();
      const response = await fetch(
        `${apiUrl}/admin/products/${productToDelete.id}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        }
      );
      
      const data = await response.json().catch(() => ({}));
      const errorMessage = data.message || (Array.isArray(data.message) ? data.message[0] : 'Failed to delete product');
      
      if (!response.ok) {
        setDeleteError(errorMessage);
        return;
      }
      
      toast.success('Product deleted successfully');
      setShowDeleteModal(false);
      setProductToDelete(null);
      setDeleteError(null);
      fetchProducts();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete product');
      toast.error(err.message || 'Failed to delete product');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSetInactiveFromDeleteModal = async () => {
    if (!productToDelete) return;
    try {
      setDeleteLoading(true);
      await apiClient.updateAdminProduct(productToDelete.id, { status: 'INACTIVE' });
      toast.success('Product set to Inactive');
      setShowDeleteModal(false);
      setProductToDelete(null);
      setDeleteError(null);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to set product inactive');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkAction = async () => {
    if (selectedProducts.size === 0) return;

    let success = 0;
    let failed = 0;

    const failedNames: string[] = [];
    for (const id of selectedProducts) {
      try {
        if (bulkAction === 'publish') {
          await apiClient.updateAdminProduct(id, { status: 'ACTIVE' });
        } else if (bulkAction === 'unpublish') {
          await apiClient.updateAdminProduct(id, { status: 'DRAFT' });
        } else if (bulkAction === 'inactive') {
          await apiClient.updateAdminProduct(id, { status: 'INACTIVE' });
        } else if (bulkAction === 'delete') {
          const apiUrl = getPublicApiBaseUrl();
          await fetch(`${apiUrl}/admin/products/${id}`, {
            method: 'DELETE',
            credentials: 'include',
          });
        }
        success++;
      } catch (err: any) {
        failed++;
        const p = products.find((pr) => pr.id === id);
        failedNames.push(p?.name || id);
      }
    }

    if (failed > 0 && bulkAction === 'publish') {
      toast.error(`${failed} product${failed > 1 ? 's' : ''} could not be published (missing required fields: images, price, category, or description). Updated ${success} successfully.`);
    } else {
      toast.success(`${bulkAction === 'delete' ? 'Deleted' : 'Updated'} ${success} products${failed > 0 ? `, ${failed} failed` : ''}`);
    }
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
    { key: 'price', header: 'Price', format: (v: number, r: Product) => `${r.currency || 'USD'} ${Number(v || 0).toFixed(2)}` },
    { key: 'stock', header: 'Stock' },
    { key: 'status', header: 'Status' },
    { key: 'category', header: 'Fandom', format: (v: any) => v?.name || '' },
  ];

  const getStockBadge = (stock: number) => {
    if (stock === 0)
      return (
        <span className="inline-flex min-w-[3.25rem] justify-center px-2 py-0.5 text-xs rounded bg-red-500/15 text-red-400 tabular-nums">
          Out
        </span>
      );
    if (stock <= 10)
      return (
        <span className="inline-flex min-w-[3.25rem] justify-center px-2 py-0.5 text-xs rounded bg-yellow-500/15 text-yellow-400 tabular-nums">
          Low
        </span>
      );
    return (
      <span className="inline-flex min-w-[3.25rem] justify-center px-2 py-0.5 text-xs rounded bg-green-500/15 text-green-400 tabular-nums">
        {stock}
      </span>
    );
  };

  if (loading && products.length === 0) {
    return (
      <RouteGuard allowedRoles={['ADMIN']}>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
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
              <h1 className="text-2xl font-bold text-hos-text-secondary">Products</h1>
              <p className="text-hos-text-secondary mt-1">Manage all products in the catalog</p>
            </div>
            <div className="flex gap-2">
              <DataExport data={filteredProducts} columns={exportColumns} filename="products-export" />
              <Link
                href="/admin/products/create"
                className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover"
              >
                + Create Product
              </Link>
            </div>
          </div>

          {/* Seller Filter Indicator */}
          {sellerFilterFromUrl && (
            <div className="bg-hos-gold/10 border border-hos-border-accent rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-hos-gold-hover font-medium">Filtered by Seller:</span>
                <span className="text-hos-gold">
                  {(() => {
                    const seller = sellers.find(s => (s as any).sellerId === sellerFilterFromUrl || s.id === sellerFilterFromUrl);
                    return seller?.storeName || seller?.email || sellerFilterFromUrl.substring(0, 8) + '...';
                  })()}
                </span>
                <span className="text-xs text-hos-gold">({filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''})</span>
              </div>
              <Link
                href="/admin/products"
                className="text-hos-gold hover:text-hos-gold-hover text-sm font-medium underline"
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
                className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left hover:ring-2 hover:ring-hos-gold/30 transition ${statusFilter === 'ALL' && stockFilter === 'ALL' ? 'ring-2 ring-hos-gold/50' : ''}`}
              >
                <p className="text-sm text-hos-text-secondary">Total</p>
                <p className="text-2xl font-bold text-hos-gold">{stats.totalProducts}</p>
              </button>
              <button
                onClick={() => { setStatusFilter('ACTIVE'); setStockFilter('ALL'); }}
                className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left hover:ring-2 hover:ring-green-300 transition ${statusFilter === 'ACTIVE' && stockFilter === 'ALL' ? 'ring-2 ring-green-500' : ''}`}
              >
                <p className="text-sm text-hos-text-secondary">Active</p>
                <p className="text-2xl font-bold text-green-400">{stats.activeProducts}</p>
              </button>
              <button
                onClick={() => { setStatusFilter('DRAFT'); setStockFilter('ALL'); }}
                className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left hover:ring-2 hover:ring-yellow-300 transition ${statusFilter === 'DRAFT' && stockFilter === 'ALL' ? 'ring-2 ring-yellow-500' : ''}`}
              >
                <p className="text-sm text-hos-text-secondary">Draft</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.draftProducts}</p>
              </button>
              <button
                onClick={() => { setStatusFilter('ALL'); setStockFilter('OUT'); }}
                className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left hover:ring-2 hover:ring-red-300 transition ${stockFilter === 'OUT' && statusFilter === 'ALL' ? 'ring-2 ring-red-500' : ''}`}
              >
                <p className="text-sm text-hos-text-secondary">Out of Stock</p>
                <p className="text-2xl font-bold text-red-400">{stats.outOfStock}</p>
              </button>
              <button
                onClick={() => { setStatusFilter('ALL'); setStockFilter('LOW'); }}
                className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left hover:ring-2 hover:ring-orange-300 transition ${stockFilter === 'LOW' && statusFilter === 'ALL' ? 'ring-2 ring-orange-500' : ''}`}
              >
                <p className="text-sm text-hos-text-secondary">Low Stock</p>
                <p className="text-2xl font-bold text-orange-400">{stats.lowStock}</p>
              </button>
              <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
                <p className="text-sm text-hos-text-secondary">Platform</p>
                <p className="text-2xl font-bold text-hos-gold">{stats.platformOwned}</p>
              </div>
              <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
                <p className="text-sm text-hos-text-secondary">Seller</p>
                <p className="text-2xl font-bold text-hos-gold">{stats.sellerProducts}</p>
              </div>
              <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
                <p className="text-sm text-hos-text-secondary">Avg Price</p>
                <p className="text-xl font-bold text-pink-400">{formatPrice(stats.avgPrice)}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-300">Error: {error}</p>
              <button onClick={fetchProducts} className="mt-2 text-red-400 hover:text-red-300 text-sm">Retry</button>
            </div>
          )}

          {/* Filters */}
          <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-hos-border rounded-lg"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="DRAFT">Draft</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-2 border border-hos-border rounded-lg"
              >
                <option value="ALL">All Fandoms</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{'  '.repeat(cat.level || 0)}{cat.name}</option>
                ))}
              </select>
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                className="px-4 py-2 border border-hos-border rounded-lg"
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
                className="px-4 py-2 border border-hos-border rounded-lg"
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
                <span className="text-sm text-hos-text-secondary">{selectedProducts.size} selected</span>
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
                  className="px-4 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-bg-secondary text-sm"
                >
                  Set Inactive
                </button>
                <button
                  onClick={() => { setBulkAction('delete'); setShowBulkModal(true); }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                >
                  Delete
                </button>
                <button onClick={clearSelection} className="text-sm text-hos-text-muted hover:text-hos-text-secondary">
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Products Table */}
          <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Products ({filteredProducts.length}{stats && filteredProducts.length < stats.totalProducts ? ` of ${stats.totalProducts}` : ''})</h2>
              <button onClick={selectAllVisible} className="text-sm text-hos-gold hover:text-hos-gold-hover">
                Select All Visible
              </button>
            </div>
            <div className="overflow-auto max-h-[500px] overflow-x-auto">
              <table className="w-full min-w-[900px] table-fixed border-collapse divide-y divide-hos-border">
                <colgroup>
                  <col style={{ width: '2.75rem' }} />
                  <col />
                  <col style={{ width: '7rem' }} />
                  <col style={{ width: '5.5rem' }} />
                  <col style={{ width: '6.5rem' }} />
                  <col style={{ width: '6.5rem' }} />
                  <col style={{ width: '10rem' }} />
                </colgroup>
                <thead className="bg-hos-bg-secondary sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-hos-text-muted uppercase align-middle">
                      <input
                        type="checkbox"
                        checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                        onChange={() => selectedProducts.size === filteredProducts.length ? clearSelection() : selectAllVisible()}
                        className="rounded border-hos-border text-hos-gold"
                        aria-label="Select all products"
                      />
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase align-middle">
                      Product
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-hos-text-muted uppercase align-middle">
                      Price
                    </th>
                    <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-hos-text-muted uppercase align-middle">
                      Stock
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase align-middle">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase align-middle whitespace-nowrap">
                      Created
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-hos-text-muted uppercase align-middle">
                      Actions
                    </th>
                  </tr>
                </thead>
                {filteredProducts.length === 0 ? (
                  <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-hos-text-muted">
                        No products found
                      </td>
                    </tr>
                  </tbody>
                ) : (
                  <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                    {filteredProducts.map((product) => (
                      <tr
                        key={product.id}
                        className={`hover:bg-hos-bg-tertiary ${selectedProducts.has(product.id) ? 'bg-hos-gold/10' : ''}`}
                      >
                        <td className="px-3 py-3 align-middle">
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(product.id)}
                            onChange={() => toggleProductSelection(product.id)}
                            className="rounded border-hos-border text-hos-gold"
                            aria-label={`Select ${product.name}`}
                          />
                        </td>
                        <td className="px-4 py-3 align-middle min-w-0">
                          <div className="flex items-center gap-3 min-w-0">
                            {product.images?.[0]?.url ? (
                              <SafeImage
                                src={product.images[0].url}
                                alt={product.name}
                                width={40}
                                height={40}
                                className="h-10 w-10 shrink-0 rounded object-cover"
                                fallback="📦"
                              />
                            ) : (
                              <div className="h-10 w-10 shrink-0 rounded bg-hos-bg-tertiary flex items-center justify-center text-hos-text-muted text-sm">
                                📦
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-hos-text-secondary truncate">
                                {product.isFeatured && <span className="text-yellow-500 mr-1">★</span>}
                                {product.name}
                              </div>
                              <div className="text-xs text-hos-text-muted truncate">{product.sku || product.slug}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle text-right text-sm text-hos-text-secondary tabular-nums whitespace-nowrap">
                          {formatPrice(Number(product.price) || 0, product.currency || 'USD')}
                        </td>
                        <td className="px-4 py-3 align-middle text-center">{getStockBadge(product.stock)}</td>
                        <td className="px-4 py-3 align-middle">
                          <span
                            className={`inline-flex max-w-full px-2 py-0.5 text-xs rounded truncate ${
                              product.status === 'ACTIVE'
                                ? 'bg-green-500/15 text-green-400'
                                : product.status === 'DRAFT'
                                  ? 'bg-yellow-500/15 text-yellow-400'
                                  : 'bg-hos-bg-tertiary text-hos-text-secondary'
                            }`}
                          >
                            {product.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle text-sm text-hos-text-muted whitespace-nowrap tabular-nums">
                          {new Date(product.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 align-middle text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEdit(product)}
                              className="px-2 py-1.5 text-xs text-hos-gold hover:bg-hos-gold/10 rounded whitespace-nowrap"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateProduct(product)}
                              className="px-1.5 py-1.5 text-xs text-hos-text-secondary hover:bg-hos-bg-tertiary rounded"
                              title="Duplicate"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            </button>
                            <select
                              value={product.status}
                              onChange={(e) =>
                                handleStatusChange(product, e.target.value as 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'OUT_OF_STOCK')
                              }
                              className={`px-2 py-1.5 text-xs border rounded cursor-pointer font-medium ${
                                product.status === 'ACTIVE'
                                  ? 'border-green-500/40 text-green-400 bg-green-500/10'
                                  : product.status === 'DRAFT'
                                    ? 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10'
                                    : 'border-hos-border text-hos-text-secondary bg-hos-bg-secondary'
                              }`}
                              title="Change status"
                            >
                              <option value="ACTIVE">Active</option>
                              <option value="DRAFT">Draft</option>
                              <option value="INACTIVE">Inactive</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleDeleteClick(product)}
                              className="px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded whitespace-nowrap"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
            </div>
          </div>

          {/* Edit Modal - Simplified for brevity, uses same form structure */}
          {showEditModal && editingProduct && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-product-modal-title"
              onKeyDown={(e) => e.key === 'Escape' && (setShowEditModal(false), setEditingProduct(null))}
            >
              <div className="bg-hos-bg-secondary rounded-lg max-w-4xl w-full my-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 id="edit-product-modal-title" className="text-2xl font-bold">Edit Product</h2>
                    <button onClick={() => { setShowEditModal(false); setEditingProduct(null); }} className="text-hos-text-muted hover:text-hos-text-secondary text-2xl">
                      ×
                    </button>
                  </div>
                  <form onSubmit={handleUpdateProduct} className="space-y-4">
                    {/* Same form fields as create form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">Product Name *</label>
                        <input type="text" required value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-hos-text-secondary mb-1">Price *</label>
                          {editingProduct?.productType === 'VARIANT' && formData.variations.length > 0 && (
                            <p className="text-xs text-amber-400 mb-1">For variable products, set price per variation option in the Variations section below (or when creating). Base price here is fallback.</p>
                          )}
                          <input type="number" step="0.01" required value={formData.price} onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))} className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-hos-text-secondary mb-1">Stock *</label>
                          {editingProduct?.productType === 'VARIANT' && formData.variations.length > 0 && (
                            <p className="text-xs text-amber-400 mb-1">For variable products, set stock per variation option in the Variations section below.</p>
                          )}
                          <input type="number" required value={formData.stock} onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))} className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Description *</label>
                      <textarea required value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold" rows={3} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Short Description</label>
                      <input type="text" value={formData.shortDescription} onChange={(e) => setFormData(prev => ({ ...prev, shortDescription: e.target.value }))} className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold" placeholder="Brief summary for listing/customer view" />
                    </div>

                    {/* Variations (editable) */}
                    {formData.variations.length === 0 && (
                      <div className="border-t pt-4">
                        <p className="text-sm text-hos-text-secondary mb-2">No variations. Add dimensions (e.g. Size, Color) with options and optional price/stock per option.</p>
                        <button type="button" onClick={addVariationDimension} className="text-sm text-hos-gold hover:text-hos-gold-hover font-medium">+ Add variation dimension</button>
                      </div>
                    )}
                    {formData.variations.length > 0 && (
                      <div className="border-t pt-4">
                        <h3 className="text-sm font-semibold text-hos-text-secondary mb-2">Variations (price/stock per option)</h3>
                        <p className="text-xs text-hos-text-muted mb-3">Set optional price and stock per option. Base price/stock above are fallback for simple products.</p>
                        <div className="space-y-4">
                          {formData.variations.map((variation, varIdx) => (
                            <div key={varIdx} className="bg-hos-bg-secondary rounded-lg p-4 border border-hos-border">
                              <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-hos-text-secondary">Dimension name</label>
                                <button type="button" onClick={() => setFormData(prev => ({ ...prev, variations: prev.variations.filter((_, i) => i !== varIdx) }))} className="text-red-400 hover:text-red-300 text-xs">Remove dimension</button>
                              </div>
                              <input type="text" value={variation.name} onChange={(e) => setFormData(prev => ({ ...prev, variations: prev.variations.map((v, i) => i === varIdx ? { ...v, name: e.target.value } : v) }))} className="w-full px-3 py-2 border border-hos-border rounded-lg text-sm mb-3" placeholder="e.g. Size, Color" />
                              <p className="text-xs font-medium text-hos-text-secondary mb-2">Options (value, optional price, optional stock)</p>
                              <div className="space-y-2">
                                {(variation.options || []).map((opt: any, optIdx: number) => {
                                  const val = typeof opt === 'object' && opt?.value != null ? opt.value : String(opt ?? '');
                                  const price = typeof opt === 'object' && opt?.price != null ? String(opt.price) : '';
                                  const stock = typeof opt === 'object' && opt?.stock != null ? String(opt.stock) : '';
                                  return (
                                    <div key={optIdx} className="flex flex-wrap items-center gap-2">
                                      <input type="text" value={val} onChange={(e) => updateVariationOption(varIdx, optIdx, 'value', e.target.value)} className="w-28 px-2 py-1.5 border border-hos-border rounded text-sm" placeholder="Value" />
                                      <input type="number" step="0.01" value={price} onChange={(e) => updateVariationOption(varIdx, optIdx, 'price', e.target.value)} className="w-20 px-2 py-1.5 border border-hos-border rounded text-sm" placeholder="Price" />
                                      <input type="number" value={stock} onChange={(e) => updateVariationOption(varIdx, optIdx, 'stock', e.target.value)} className="w-16 px-2 py-1.5 border border-hos-border rounded text-sm" placeholder="Stock" />
                                      <button type="button" onClick={() => removeVariationOption(varIdx, optIdx)} className="text-red-400 hover:text-red-300 text-sm">×</button>
                                    </div>
                                  );
                                })}
                                <button type="button" onClick={() => addVariationOption(varIdx)} className="text-sm text-hos-gold hover:text-hos-gold-hover">+ Add option</button>
                              </div>
                            </div>
                          ))}
                          <button type="button" onClick={addVariationDimension} className="text-sm text-hos-gold hover:text-hos-gold-hover font-medium">+ Add variation dimension</button>
                        </div>
                      </div>
                    )}

                    {/* Taxonomy */}
                    <div className="border-t pt-4">
                      <FandomSelector
                        value={formData.fandom}
                        onChange={(fandomSlug) => setFormData(prev => ({ ...prev, fandom: fandomSlug || '' }))}
                        label="Fandom *"
                        placeholder="Select a fandom"
                        required={!formData.categoryId}
                      />
                      {!formData.fandom && !formData.categoryId && (
                        <p className="text-xs text-red-500 mt-1">A fandom or category is required</p>
                      )}
                      <div className="mt-4">
                        <CategorySelector value={formData.categoryId} onChange={(categoryId) => setFormData(prev => ({ ...prev, categoryId: categoryId || '' }))} label="Category" />
                      </div>
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
                      <h3 className="text-sm font-semibold text-hos-text-secondary mb-4">Images</h3>
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="inline-flex items-center px-4 py-2 bg-hos-gold text-[#1a1406] rounded hover:bg-hos-gold-hover cursor-pointer">
                          <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple className="hidden" disabled={uploadingImages} onChange={(e) => uploadImages(e.target.files)} />
                          {uploadingImages ? 'Uploading…' : 'Upload Files'}
                        </label>
                        <span className="text-xs text-hos-text-muted">or</span>
                        <div className="flex gap-2 flex-1 min-w-[200px]">
                          <input
                            type="url"
                            value={newImageUrl}
                            onChange={(e) => setNewImageUrl(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addImageByUrl(); } }}
                            className="flex-1 px-3 py-2 border border-hos-border rounded-lg text-sm focus:ring-2 focus:ring-hos-gold/50 focus:border-transparent"
                            placeholder="Paste image URL"
                          />
                          <button type="button" onClick={addImageByUrl} disabled={!newImageUrl.trim()} className="px-3 py-2 bg-hos-gold text-[#1a1406] rounded-lg text-sm hover:bg-hos-gold-hover disabled:opacity-50">
                            Add
                          </button>
                        </div>
                      </div>
                      {images.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {images.map((img, idx) => (
                            <div key={idx} className={`relative ${img.isPrimary ? 'ring-2 ring-hos-gold/50' : ''}`}>
                              <SafeImage src={img.url} alt={img.alt || `Product image ${idx + 1}`} width={64} height={64} className="object-cover rounded" />
                              {img.isPrimary && <span className="absolute -top-1 -right-1 bg-hos-gold text-[#1a1406] text-xs px-1 rounded">★</span>}
                              <button type="button" onClick={() => removeImage(idx)} className="absolute -bottom-1 -right-1 bg-red-500/10 text-white text-xs w-5 h-5 rounded-full">×</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* SEO */}
                    <div className="border-t pt-4">
                      <h3 className="text-sm font-semibold text-hos-text-secondary mb-3">SEO & Search</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-hos-text-secondary mb-1">Meta Title</label>
                          <input type="text" value={formData.metaTitle} onChange={(e) => setFormData(prev => ({ ...prev, metaTitle: e.target.value }))} className="w-full px-3 py-2 border border-hos-border rounded-lg text-sm focus:ring-2 focus:ring-hos-gold/50" placeholder="SEO title (shown in search engine results)" maxLength={70} />
                          <p className="text-xs text-hos-text-muted mt-1">{formData.metaTitle.length}/70 characters</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-hos-text-secondary mb-1">Meta Description</label>
                          <textarea value={formData.metaDescription} onChange={(e) => setFormData(prev => ({ ...prev, metaDescription: e.target.value }))} className="w-full px-3 py-2 border border-hos-border rounded-lg text-sm focus:ring-2 focus:ring-hos-gold/50" placeholder="SEO description (shown in search engine results)" rows={2} maxLength={160} />
                          <p className="text-xs text-hos-text-muted mt-1">{formData.metaDescription.length}/160 characters</p>
                        </div>
                      </div>
                    </div>

                    {/* Shipping Dimensions */}
                    <div className="border-t pt-4">
                      <h3 className="text-sm font-semibold text-hos-text-secondary mb-3">Shipping Dimensions</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-hos-text-secondary mb-1">Weight (kg)</label>
                          <input type="number" step="0.001" min="0" value={formData.weight} onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))} className="w-full px-3 py-2 border border-hos-border rounded-lg text-sm" placeholder="0.00" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-hos-text-secondary mb-1">Length (cm)</label>
                          <input type="number" step="0.1" min="0" value={formData.length} onChange={(e) => setFormData(prev => ({ ...prev, length: e.target.value }))} className="w-full px-3 py-2 border border-hos-border rounded-lg text-sm" placeholder="0.0" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-hos-text-secondary mb-1">Width (cm)</label>
                          <input type="number" step="0.1" min="0" value={formData.width} onChange={(e) => setFormData(prev => ({ ...prev, width: e.target.value }))} className="w-full px-3 py-2 border border-hos-border rounded-lg text-sm" placeholder="0.0" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-hos-text-secondary mb-1">Height (cm)</label>
                          <input type="number" step="0.1" min="0" value={formData.height} onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value }))} className="w-full px-3 py-2 border border-hos-border rounded-lg text-sm" placeholder="0.0" />
                        </div>
                      </div>
                    </div>

                    {/* Publish Readiness Checklist */}
                    <div className="border-t pt-4">
                      <h3 className="text-sm font-semibold text-hos-text-secondary mb-3">Publish Readiness</h3>
                      <div className="bg-hos-bg-secondary rounded-lg p-4 space-y-2">
                        {[
                          { label: 'Product name', ok: !!formData.name.trim() },
                          { label: 'Description (min 10 chars)', ok: formData.description.trim().length >= 10 },
                          { label: 'Price > $0', ok: parseFloat(formData.price) > 0 },
                          { label: 'At least one image', ok: images.length > 0 },
                          { label: 'Fandom or category assigned', ok: !!formData.categoryId || !!formData.fandom },
                          { label: 'SEO title', ok: !!formData.metaTitle.trim(), optional: true },
                          { label: 'SEO description', ok: !!formData.metaDescription.trim(), optional: true },
                          { label: 'Short description', ok: !!formData.shortDescription.trim(), optional: true },
                          { label: 'SKU assigned', ok: !!(editingProduct?.sku), optional: true },
                        ].map((check) => (
                          <div key={check.label} className="flex items-center gap-2 text-sm">
                            <span className={check.ok ? 'text-green-400' : check.optional ? 'text-amber-500' : 'text-red-500'}>
                              {check.ok ? '✓' : check.optional ? '○' : '✗'}
                            </span>
                            <span className={check.ok ? 'text-hos-text-secondary' : check.optional ? 'text-amber-400' : 'text-red-400'}>
                              {check.label}{check.optional ? ' (recommended)' : ' *'}
                            </span>
                          </div>
                        ))}
                        {(() => {
                          const requiredMissing = [
                            !formData.name.trim(),
                            formData.description.trim().length < 10,
                            !(parseFloat(formData.price) > 0),
                            images.length === 0,
                            !formData.categoryId && !formData.fandom,
                          ].filter(Boolean).length;
                          if (requiredMissing > 0 && publishNow) {
                            return (
                              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
                                {requiredMissing} required item{requiredMissing > 1 ? 's' : ''} missing. The product cannot be published until all required items are complete.
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>

                    {/* Visibility */}
                    <div className="border-t pt-4 flex flex-wrap gap-4">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} className="rounded border-hos-border text-hos-gold" />
                        <span className="text-sm">Published</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={formData.isFeatured} onChange={(e) => setFormData(prev => ({ ...prev, isFeatured: e.target.checked }))} className="rounded border-hos-border text-hos-gold" />
                        <span className="text-sm">Featured</span>
                      </label>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button type="submit" disabled={updatingProduct} className="flex-1 px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                        {updatingProduct ? 'Updating...' : 'Update Product'}
                      </button>
                      <button type="button" onClick={() => { setShowEditModal(false); setEditingProduct(null); }} className="px-6 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-text-muted font-medium">
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
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-product-modal-title"
              onKeyDown={(e) => e.key === 'Escape' && (setShowDeleteModal(false), setProductToDelete(null), setDeleteError(null))}
            >
              <div className="bg-hos-bg-secondary rounded-lg max-w-md w-full p-6">
                <h2 id="delete-product-modal-title" className="text-2xl font-bold mb-4">Delete Product</h2>
                {deleteError ? (
                  <>
                    <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <p className="text-amber-300 text-sm">{deleteError}</p>
                    </div>
                    <p className="text-hos-text-secondary mb-4">
                      Use <strong>Set to Inactive</strong> to hide the product from the marketplace while keeping order history intact.
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleSetInactiveFromDeleteModal}
                        disabled={deleteLoading}
                        className="w-full px-6 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-bg-secondary font-medium disabled:opacity-50"
                      >
                        {deleteLoading ? 'Updating...' : 'Set to Inactive'}
                      </button>
                      <button
                        onClick={() => { setShowDeleteModal(false); setProductToDelete(null); setDeleteError(null); }}
                        className="w-full px-6 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-hos-text-secondary mb-6">
                      Are you sure you want to delete <strong>{productToDelete.name}</strong>? This cannot be undone.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleDeleteConfirm}
                        disabled={deleteLoading}
                        className="flex-1 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
                      >
                        {deleteLoading ? 'Deleting...' : 'Delete'}
                      </button>
                      <button
                        onClick={() => { setShowDeleteModal(false); setProductToDelete(null); setDeleteError(null); }}
                        className="px-6 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-text-muted font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Bulk Action Modal */}
          {showBulkModal && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
              role="dialog"
              aria-modal="true"
              aria-labelledby="bulk-action-modal-title"
              onKeyDown={(e) => e.key === 'Escape' && setShowBulkModal(false)}
            >
              <div className="bg-hos-bg-secondary rounded-lg max-w-md w-full p-6">
                <h2 id="bulk-action-modal-title" className="text-2xl font-bold mb-4">
                  {bulkAction === 'publish' ? 'Publish Products' : 
                   bulkAction === 'unpublish' ? 'Unpublish Products' : 
                   bulkAction === 'inactive' ? 'Set Products Inactive' : 
                   'Delete Products'}
                </h2>
                <p className="text-hos-text-secondary mb-6">
                  Are you sure you want to {bulkAction === 'inactive' ? 'set inactive' : bulkAction} <strong>{selectedProducts.size}</strong> products?
                  {bulkAction === 'delete' && ' This cannot be undone.'}
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={handleBulkAction} 
                    className={`flex-1 px-6 py-2 text-hos-text-secondary rounded-lg font-medium ${
                      bulkAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : 
                      bulkAction === 'inactive' ? 'bg-hos-bg-tertiary hover:bg-hos-bg-secondary' : 
                      'bg-hos-gold hover:bg-hos-gold-hover'
                    }`}
                  >
                    {bulkAction === 'publish' ? 'Publish All' : 
                     bulkAction === 'unpublish' ? 'Unpublish All' : 
                     bulkAction === 'inactive' ? 'Set All Inactive' : 
                     'Delete All'}
                  </button>
                  <button onClick={() => setShowBulkModal(false)} className="px-6 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-text-muted font-medium">
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
          </div>
        </AdminLayout>
      </RouteGuard>
    }>
      <AdminProductsContent />
    </Suspense>
  );
}
