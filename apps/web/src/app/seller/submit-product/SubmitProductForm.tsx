'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { CategorySelector } from '@/components/taxonomy/CategorySelector';
import { FandomSelector } from '@/components/taxonomy/FandomSelector';
import { apiClient } from '@/lib/api';
import { getSellerMenuItems } from '@/lib/sellerMenu';
import { useToast } from '@/hooks/useToast';
import Image from 'next/image';
import Link from 'next/link';

interface ImageUpload {
  url: string;
  alt?: string;
  order?: number;
}

interface VariationOption {
  name: string;
  value: string;
}

/** Build a display label for a variation option (handles legacy name/value split). */
function variationOptionLabel(opt: VariationOption): string {
  return opt.name || opt.value;
}

interface Variation {
  name: string;
  options: VariationOption[];
}

/** Loose URL validation for remote product images */
function isValidHttpProductImageUrl(urlString: string): boolean {
  const s = urlString.trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (!u.hostname) return false;
    return true;
  } catch {
    return false;
  }
}

export function SubmitProductForm({ editSubmissionId }: { editSubmissionId?: string }) {
  const router = useRouter();
  const { user, effectiveRole } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const submittingRef = useRef(false);
  const [duplicateWarnings, setDuplicateWarnings] = useState<any>(null);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const duplicateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Browse Catalog state
  const [activeTab, setActiveTab] = useState<'browse' | 'submit'>('browse');
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [catalogFandoms, setCatalogFandoms] = useState<{ name: string; count: number }[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedFandom, setSelectedFandom] = useState('');
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [searchMeta, setSearchMeta] = useState<{ processingTimeMs?: number; engine?: string } | null>(null);
  const [listAsVendorModal, setListAsVendorModal] = useState<any>(null);
  const [vendorPrice, setVendorPrice] = useState('');
  const [vendorStock, setVendorStock] = useState('');
  const [vendorSubmitting, setVendorSubmitting] = useState(false);

  const fetchCatalog = useCallback(async (fandom?: string, search?: string, page = 1) => {
    try {
      setCatalogLoading(true);
      const res = await apiClient.browseCatalogForVendor({
        fandom: fandom || undefined,
        search: search || undefined,
        page,
        limit: 20,
      });
      const d = res?.data;
      if (d) {
        setCatalogProducts(d.products || []);
        setCatalogTotal(d.pagination?.total || 0);
        setSearchMeta(d.searchMeta || null);
        if (d.fandoms?.length > 0 && catalogFandoms.length === 0) {
          setCatalogFandoms(d.fandoms);
        }
      }
    } catch {
      // silent
    } finally {
      setCatalogLoading(false);
    }
  }, [catalogFandoms.length]);

  useEffect(() => {
    if (activeTab === 'browse') {
      fetchCatalog(selectedFandom, catalogSearch, catalogPage);
    }
  }, [activeTab, selectedFandom, catalogPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced auto-search as user types (300ms delay)
  useEffect(() => {
    if (activeTab !== 'browse') return;
    const timer = setTimeout(() => {
      setCatalogPage(1);
      fetchCatalog(selectedFandom, catalogSearch, 1);
    }, 300);
    return () => clearTimeout(timer);
  }, [catalogSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCatalogSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCatalogPage(1);
    fetchCatalog(selectedFandom, catalogSearch, 1);
  };

  const handleListAsVendor = async () => {
    if (!listAsVendorModal || !vendorPrice || !vendorStock) return;
    try {
      setVendorSubmitting(true);
      await apiClient.createVendorProduct({
        productId: listAsVendorModal.id,
        vendorPrice: parseFloat(vendorPrice),
        vendorStock: parseInt(vendorStock),
        vendorCurrency: 'USD',
      });
      toast.success(`Successfully listed "${listAsVendorModal.name}" as your vendor product!`);
      setListAsVendorModal(null);
      setVendorPrice('');
      setVendorStock('');
      fetchCatalog(selectedFandom, catalogSearch, catalogPage);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create vendor listing');
    } finally {
      setVendorSubmitting(false);
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    barcode: '',
    ean: '',
    price: '',
    tradePrice: '',
    rrp: '',
    currency: 'USD',
    taxRate: '0',
    stock: '',
    quantity: '',
    fandom: '',
    categoryId: '',
    tags: '',
    metaTitle: '',
    metaDescription: '',
    weight: '',
    length: '',
    width: '',
    height: '',
    brandAuthorization: false,
    ageRestriction: '',
    complianceNotes: '',
  });

  const [images, setImages] = useState<ImageUpload[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploadingImages, setUploadingImages] = useState(false);
  const [currentVariation, setCurrentVariation] = useState<Variation>({
    name: '',
    options: [],
  });
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const submitFeedbackRef = useRef<HTMLDivElement | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    if (error && submitFeedbackRef.current) {
      submitFeedbackRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [error]);

  useEffect(() => {
    if (!editSubmissionId) return;
    let cancelled = false;
    (async () => {
      try {
        setEditLoading(true);
        setError('');
        const res = await apiClient.getSubmission(editSubmissionId);
        const sub = res?.data;
        if (!sub || cancelled) return;
        const pd = sub.productData || {};
        setFormData({
          name: pd.name ?? '',
          description: pd.description ?? '',
          sku: pd.sku ?? '',
          barcode: pd.barcode ?? '',
          ean: pd.ean ?? '',
          price: pd.price != null ? String(pd.price) : '',
          tradePrice: pd.tradePrice != null ? String(pd.tradePrice) : '',
          rrp: pd.rrp != null ? String(pd.rrp) : '',
          currency: pd.currency ?? 'USD',
          taxRate: pd.taxRate != null ? String(pd.taxRate) : '0',
          stock: pd.stock != null ? String(pd.stock) : '',
          quantity: pd.quantity != null ? String(pd.quantity) : '',
          fandom: pd.fandom ?? '',
          categoryId: pd.categoryId ?? '',
          tags: Array.isArray(pd.tags) ? pd.tags.join(', ') : '',
          metaTitle: pd.metaTitle ?? '',
          metaDescription: pd.metaDescription ?? '',
          weight: pd.weight != null ? String(pd.weight) : '',
          length: pd.length != null ? String(pd.length) : '',
          width: pd.width != null ? String(pd.width) : '',
          height: pd.height != null ? String(pd.height) : '',
          brandAuthorization: Boolean(pd.brandAuthorization),
          ageRestriction: pd.ageRestriction ?? '',
          complianceNotes: pd.complianceNotes ?? '',
        });
        const imgList = Array.isArray(pd.images) ? pd.images : [];
        setImages(
          imgList
            .map((img: unknown, i: number) =>
              typeof img === 'string'
                ? { url: img, alt: '', order: i }
                : {
                    url: String((img as { url?: string }).url || ''),
                    alt: (img as { alt?: string }).alt || '',
                    order: (img as { order?: number }).order ?? i,
                  },
            )
            .filter((x: ImageUpload) => x.url),
        );
        const vars = Array.isArray(pd.variations) ? pd.variations : [];
        setVariations(
          vars.map((v: Record<string, unknown>) => ({
            name: String(v.name || ''),
            options: Array.isArray(v.options)
              ? v.options.map((o: unknown) =>
                  typeof o === 'object' && o !== null && 'name' in o && 'value' in o
                    ? {
                        name: String((o as { name?: string }).name),
                        value: String((o as { value?: string }).value),
                      }
                    : { name: 'Option', value: String(o) },
                )
              : [],
          })),
        );
        setActiveTab('submit');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load submission';
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setEditLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editSubmissionId]);

  const runDuplicateCheck = useCallback(async (data: typeof formData) => {
    const hasIdentifier = data.name.trim().length >= 3 || data.sku.trim() || data.barcode.trim() || data.ean.trim();
    if (!hasIdentifier) {
      setDuplicateWarnings(null);
      return;
    }
    try {
      setCheckingDuplicates(true);
      const res = await apiClient.checkSubmissionDuplicates({
        name: data.name.trim() || undefined,
        sku: data.sku.trim() || undefined,
        barcode: data.barcode.trim() || undefined,
        ean: data.ean.trim() || undefined,
      });
      const d = res?.data;
      const total = (d?.catalogueMatches?.length || 0) + (d?.sellerPendingMatches?.length || 0) + (d?.sellerActiveMatches?.length || 0);
      setDuplicateWarnings(total > 0 ? d : null);
    } catch {
      // Silently ignore check errors
    } finally {
      setCheckingDuplicates(false);
    }
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (['name', 'sku', 'barcode', 'ean'].includes(name)) {
        if (duplicateTimerRef.current) clearTimeout(duplicateTimerRef.current);
        duplicateTimerRef.current = setTimeout(() => runDuplicateCheck(next), 800);
      }
      return next;
    });
  };

  const addImage = () => {
    const trimmed = newImageUrl.trim();
    if (!trimmed) return;
    if (!isValidHttpProductImageUrl(trimmed)) {
      const msg = 'Enter a valid image URL (must start with http:// or https://)';
      setError(msg);
      toast.error(msg);
      return;
    }
    setError('');
    setImages([
      ...images,
      {
        url: trimmed,
        alt: '',
        order: images.length,
      },
    ]);
    setNewImageUrl('');
  };

  const uploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB (matches backend multer limit)

    const fileArr = Array.from(files);
    if (fileArr.length > 4) {
      const msg = 'You can upload up to 4 images at a time';
      setError(msg);
      toast.error(msg);
      return;
    }
    const limited = fileArr.slice(0, 4);
    for (const f of limited) {
      if (!allowedTypes.includes(f.type)) {
        const msg = 'Only JPEG, PNG, GIF, and WebP images are allowed';
        setError(msg);
        toast.error(msg);
        return;
      }
      if (f.size > maxSizeBytes) {
        const msg = 'Max image size is 10MB';
        setError(msg);
        toast.error(msg);
        return;
      }
    }

    try {
      setError('');
      setUploadingImages(true);

      const res = await apiClient.uploadMultipleFiles(limited, 'products');
      const urls = res?.data?.urls || [];
      if (urls.length === 0) throw new Error('Upload failed (no URLs returned)');
      setImages((prev) => [
        ...prev,
        ...urls.map((url: string, idx: number) => ({
          url,
          alt: '',
          order: prev.length + idx,
        })),
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload image';
      setError(msg);
      toast.error(msg);
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index).map((img, i) => ({ ...img, order: i })));
  };

  const updateImageAlt = (index: number, alt: string) => {
    const updated = [...images];
    updated[index].alt = alt;
    setImages(updated);
  };

  const addVariationOption = () => {
    const label = newOptionLabel.trim();
    if (label) {
      setCurrentVariation({
        ...currentVariation,
        options: [
          ...currentVariation.options,
          { name: label, value: label },
        ],
      });
      setNewOptionLabel('');
    }
  };

  const removeVariationOption = (index: number) => {
    setCurrentVariation({
      ...currentVariation,
      options: currentVariation.options.filter((_, i) => i !== index),
    });
  };

  const addVariation = () => {
    if (currentVariation.name.trim() && currentVariation.options.length > 0) {
      setVariations([...variations, { ...currentVariation }]);
      setCurrentVariation({ name: '', options: [] });
    }
  };

  const removeVariation = (index: number) => {
    setVariations(variations.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError('');
    setSuccess(false);
    setLoading(true);

    if (!formData.name.trim()) {
      setError('Product name is required');
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    if (!formData.description.trim()) {
      setError('Product description is required');
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      setError('Valid price is required');
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    if (!formData.stock || parseInt(formData.stock) < 0) {
      setError('Valid stock quantity is required');
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    if (images.length === 0) {
      setError('At least one product image is required');
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    for (const img of images) {
      if (!isValidHttpProductImageUrl(img.url)) {
        setError('Every product image must use a valid http(s) URL');
        setLoading(false);
        submittingRef.current = false;
        return;
      }
    }

    const variationRows =
      currentVariation.name.trim() && currentVariation.options.length > 0
        ? [...variations, { ...currentVariation }]
        : variations;

    const normalizedVariations =
      variationRows.length > 0
        ? variationRows
            .map((v) => ({
              name: v.name.trim(),
              options: v.options
                .map((o) => {
                  const label = (o.name || o.value || '').trim();
                  return { name: label, value: label };
                })
                .filter((o) => o.name.length > 0),
            }))
            .filter((v) => v.name.length > 0 && v.options.length > 0)
        : undefined;

    try {
      const submissionData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        sku: formData.sku.trim() || undefined,
        barcode: formData.barcode.trim() || undefined,
        ean: formData.ean.trim() || undefined,
        price: parseFloat(formData.price),
        tradePrice: formData.tradePrice ? parseFloat(formData.tradePrice) : undefined,
        rrp: formData.rrp ? parseFloat(formData.rrp) : undefined,
        currency: formData.currency,
        taxRate: formData.taxRate ? parseFloat(formData.taxRate) : undefined,
        stock: parseInt(formData.stock, 10),
        quantity: formData.quantity ? parseInt(formData.quantity, 10) : undefined,
        fandom: formData.fandom || undefined,
        categoryId: formData.categoryId || undefined,
        tags: formData.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0),
        images: images,
        variations:
          normalizedVariations && normalizedVariations.length > 0 ? normalizedVariations : undefined,
        metaTitle: formData.metaTitle.trim() || undefined,
        metaDescription: formData.metaDescription.trim() || undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        length: formData.length ? parseFloat(formData.length) : undefined,
        width: formData.width ? parseFloat(formData.width) : undefined,
        height: formData.height ? parseFloat(formData.height) : undefined,
        brandAuthorization: formData.brandAuthorization || undefined,
        ageRestriction: formData.ageRestriction || undefined,
        complianceNotes: formData.complianceNotes.trim() || undefined,
      };

      if (editSubmissionId) {
        const response = await apiClient.updateSubmission(editSubmissionId, {
          productData: submissionData as Record<string, unknown>,
        });
        if (response?.data) {
          setSuccess(true);
          toast.success('Changes saved.');
          const roleAfterSave = effectiveRole || user?.role;
          const submitViewBase =
            roleAfterSave === 'WHOLESALER' ? '/wholesaler/submit-product' : '/seller/submit-product';
          router.push(`${submitViewBase}?id=${editSubmissionId}`);
        } else {
          throw new Error('Failed to update submission');
        }
      } else {
        const response = await apiClient.createSubmission(submissionData);

        if (response?.data) {
          setSuccess(true);
          toast.success('Product submitted for review!');
          const role = effectiveRole || user?.role;
          const redirectPath = role === 'WHOLESALER' ? '/wholesaler/submissions' : '/seller/submissions';
          setTimeout(() => {
            router.push(redirectPath);
          }, 2000);
        } else {
          throw new Error('Failed to create submission');
        }
      }
    } catch (err: any) {
      console.error('Submission error:', err);
      const msg = err.message || 'Failed to submit product. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const currentRole = effectiveRole || user?.role;
  const isWholesaler = currentRole === 'WHOLESALER';
  const menuItems = useMemo(() => getSellerMenuItems(isWholesaler), [isWholesaler]);

  return (
    <RouteGuard allowedRoles={['SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout
        role={isWholesaler ? 'WHOLESALER' : 'SELLER'}
        menuItems={menuItems}
        title={isWholesaler ? 'Wholesaler' : 'Seller'}
      >
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
              {editSubmissionId ? 'Edit product submission' : 'Submit Product'}
            </h1>
            <p className="text-hos-text-secondary mt-2">Browse existing catalog or submit a new product for review</p>
          </div>

            {/* Tab Switcher */}
            <div className="mb-6 flex gap-1 bg-hos-bg-tertiary rounded-lg p-1">
              <button
                type="button"
                onClick={() => setActiveTab('browse')}
                className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'browse'
                    ? 'bg-hos-bg-secondary text-hos-gold-hover shadow-sm'
                    : 'text-hos-text-secondary hover:text-hos-gold'
                }`}
              >
                Browse Catalog
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('submit')}
                className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'submit'
                    ? 'bg-hos-bg-secondary text-hos-gold-hover shadow-sm'
                    : 'text-hos-text-secondary hover:text-hos-gold'
                }`}
              >
                Submit New Product
              </button>
            </div>

            {/* Browse Catalog Tab */}
            {activeTab === 'browse' && (
              <div className="space-y-4">
                <div className="bg-hos-gold/10 border border-hos-border-accent rounded-lg p-4">
                  <p className="text-sm text-hos-gold">
                    <strong>Browse first:</strong> Check if the product you want to sell already exists in our catalog.
                    If it does, you can list it instantly with your own price and stock — no approval process needed.
                  </p>
                </div>

                {/* Search & Filter */}
                <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-4">
                  <form onSubmit={handleCatalogSearchSubmit} className="flex flex-col sm:flex-row gap-3">
                    <select
                      value={selectedFandom}
                      onChange={(e) => { setSelectedFandom(e.target.value); setCatalogPage(1); }}
                      className="px-3 py-2 border border-hos-border rounded-lg text-sm bg-hos-bg-secondary text-hos-text-secondary focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                    >
                      <option value="">All Fandoms</option>
                      {catalogFandoms.map((f) => (
                        <option key={f.name} value={f.name}>{f.name} ({f.count})</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Search products (typo-tolerant)..."
                      className="flex-1 px-3 py-2 border border-hos-border rounded-lg text-sm bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg text-sm font-medium hover:bg-hos-gold-hover"
                    >
                      Search
                    </button>
                  </form>
                </div>

                {/* Product Grid */}
                {catalogLoading ? (
                  <div className="flex justify-center py-12">
                    <svg className="animate-spin h-8 w-8 text-hos-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                  </div>
                ) : catalogProducts.length === 0 ? (
                  <div className="text-center py-12 bg-hos-bg-secondary border border-hos-border rounded-lg">
                    <p className="text-hos-text-muted mb-2">No catalog products found</p>
                    <p className="text-sm text-hos-text-muted">Try a different search or fandom filter, or submit a new product below</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('submit')}
                      className="mt-4 px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg text-sm font-medium hover:bg-hos-gold-hover"
                    >
                      Submit New Product
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-hos-text-muted mb-2 flex items-center gap-2">
                      <span>{catalogTotal} products found</span>
                      {searchMeta?.processingTimeMs != null && (
                        <span className="text-xs text-hos-text-muted">({searchMeta.processingTimeMs}ms)</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {catalogProducts.map((product: any) => (
                        <div key={product.id} className="bg-hos-bg-secondary border border-hos-border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex gap-3">
                            {product.imageUrl && (
                              <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-hos-bg-tertiary shrink-0">
                                <Image
                                  src={product.imageUrl}
                                  alt={product.name}
                                  fill
                                  className="object-cover"
                                  sizes="64px"
                                  unoptimized
                                />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <h3 className="text-sm font-semibold text-hos-text-secondary truncate">{product.name}</h3>
                              <p className="text-xs text-hos-text-muted mt-0.5">
                                {product.sku ? `SKU: ${product.sku}` : ''}{product.fandom ? ` · ${product.fandom}` : ''}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm font-bold text-hos-text-secondary">${Number(product.price || 0).toFixed(2)}</span>
                                <span className="text-xs text-hos-text-muted">·</span>
                                <span className="text-xs text-hos-text-muted">{product.vendorCount} vendor{product.vendorCount !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            {product.alreadyListed ? (
                              <span className="flex-1 text-center py-1.5 bg-green-500/10 text-green-400 rounded-lg text-xs font-medium border border-green-500/30">
                                Already Listed (${Number(product.myListing?.vendorPrice || 0).toFixed(2)})
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setListAsVendorModal(product);
                                  setVendorPrice(String(product.price || ''));
                                  setVendorStock('');
                                }}
                                className="flex-1 py-1.5 bg-hos-gold text-[#1a1406] rounded-lg text-xs font-medium hover:bg-hos-gold-hover transition-colors"
                              >
                                List as Vendor
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {catalogTotal > 20 && (
                      <div className="flex justify-center gap-2 mt-4">
                        <button
                          type="button"
                          disabled={catalogPage <= 1}
                          onClick={() => setCatalogPage((p) => Math.max(1, p - 1))}
                          className="px-3 py-1.5 border border-hos-border rounded text-sm disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="px-3 py-1.5 text-sm text-hos-text-secondary">
                          Page {catalogPage} of {Math.ceil(catalogTotal / 20)}
                        </span>
                        <button
                          type="button"
                          disabled={catalogPage >= Math.ceil(catalogTotal / 20)}
                          onClick={() => setCatalogPage((p) => p + 1)}
                          className="px-3 py-1.5 border border-hos-border rounded text-sm disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}

                <div className="text-center pt-4 border-t border-hos-border">
                  <p className="text-sm text-hos-text-muted mb-2">Can&apos;t find your product?</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('submit')}
                    className="px-6 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg text-sm font-medium hover:bg-hos-bg-secondary"
                  >
                    Submit a New Product
                  </button>
                </div>
              </div>
            )}

            {/* List as Vendor Modal */}
            {listAsVendorModal && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                <div className="bg-hos-bg-secondary rounded-xl shadow-xl max-w-md w-full p-6">
                  <h3 className="text-lg font-bold mb-1">List as Vendor</h3>
                  <p className="text-sm text-hos-text-muted mb-4">
                    Sell &ldquo;{listAsVendorModal.name}&rdquo; with your own pricing and stock.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Your Price ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={vendorPrice}
                        onChange={(e) => setVendorPrice(e.target.value)}
                        className="w-full px-3 py-2 border border-hos-border rounded-lg text-sm focus:ring-2 focus:ring-hos-gold/50"
                        placeholder="Enter your selling price"
                      />
                      <p className="text-xs text-hos-text-muted mt-1">Catalog price: ${Number(listAsVendorModal.price || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Your Stock</label>
                      <input
                        type="number"
                        min="1"
                        value={vendorStock}
                        onChange={(e) => setVendorStock(e.target.value)}
                        className="w-full px-3 py-2 border border-hos-border rounded-lg text-sm focus:ring-2 focus:ring-hos-gold/50"
                        placeholder="Quantity available"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-5">
                    <button
                      type="button"
                      onClick={() => setListAsVendorModal(null)}
                      className="flex-1 py-2 border border-hos-border rounded-lg text-sm font-medium text-hos-text-secondary hover:bg-hos-bg-tertiary"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleListAsVendor}
                      disabled={vendorSubmitting || !vendorPrice || !vendorStock}
                      className="flex-1 py-2 bg-hos-gold text-[#1a1406] rounded-lg text-sm font-medium hover:bg-hos-gold-hover disabled:opacity-50"
                    >
                      {vendorSubmitting ? 'Listing...' : 'List Product'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Submit New Product Tab */}
            {activeTab === 'submit' && (
            <>
            {editSubmissionId && editLoading && (
              <div className="flex flex-col items-center justify-center py-16 text-hos-text-secondary">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold mb-4" />
                <p className="text-sm">Loading submission…</p>
              </div>
            )}

            {(!editSubmissionId || !editLoading) && (
            <>

            {success && (
              <div className="mb-6 p-4 bg-green-500/15 border border-green-400 text-green-400 rounded-lg">
                <p className="font-semibold">{editSubmissionId ? 'Submission updated!' : 'Product submitted successfully!'}</p>
                <p className="text-sm mt-1">{editSubmissionId ? 'Redirecting…' : 'Redirecting to My Submissions…'}</p>
              </div>
            )}

            {error && (
              <div
                ref={submitFeedbackRef}
                className="sticky top-20 z-40 mb-6 scroll-mt-24 p-4 bg-red-500/15 border border-red-400 text-red-400 rounded-lg shadow-md"
              >
                <p className="font-semibold">Error</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}

            {duplicateWarnings && (
              <div className="mb-6 border border-amber-500/40 rounded-lg overflow-hidden">
                <div className="bg-amber-500/10 px-4 py-3 border-b border-amber-500/30">
                  <h3 className="font-semibold text-amber-300">Potential Duplicates Detected</h3>
                  <p className="text-xs text-amber-400 mt-0.5">Review matches below. If a product already exists, use &ldquo;Browse Catalog&rdquo; tab to list it as your vendor product instead.</p>
                </div>
                <div className="p-4 space-y-3 bg-hos-bg-secondary">
                  {duplicateWarnings.sellerActiveMatches?.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-red-300 mb-1.5">Your Active Products</p>
                      <p className="text-xs text-red-400 mb-2">You already have these products listed. Consider updating stock/price instead of submitting again.</p>
                      {duplicateWarnings.sellerActiveMatches.slice(0, 3).map((m: any) => (
                        <div key={m.id} className="flex items-center justify-between p-2.5 bg-red-500/10 rounded-lg mb-1.5 border border-red-500/30">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-hos-text-secondary truncate">{m.name}</p>
                            <p className="text-xs text-hos-text-muted">{m.sku ? `SKU: ${m.sku}` : ''} {m.reasons?.[0] || ''}</p>
                          </div>
                          <span className="ml-2 shrink-0 px-2 py-0.5 bg-red-200 text-red-300 rounded text-xs font-bold">{m.similarityScore}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {duplicateWarnings.sellerPendingMatches?.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-orange-300 mb-1.5">Your Pending Submissions</p>
                      <p className="text-xs text-orange-400 mb-2">You already have pending submissions for similar products.</p>
                      {duplicateWarnings.sellerPendingMatches.slice(0, 3).map((m: any) => (
                        <div key={m.id} className="flex items-center justify-between p-2.5 bg-orange-500/10 rounded-lg mb-1.5 border border-orange-500/30">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-hos-text-secondary truncate">{m.name}</p>
                            <p className="text-xs text-hos-text-muted">Status: {m.status?.replace(/_/g, ' ')} &middot; {m.reasons?.[0] || ''}</p>
                          </div>
                          <span className="ml-2 shrink-0 px-2 py-0.5 bg-orange-200 text-orange-300 rounded text-xs font-bold">{m.similarityScore}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {duplicateWarnings.catalogueMatches?.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-amber-300 mb-1.5">Existing Catalogue Products</p>
                      <p className="text-xs text-amber-400 mb-2">Similar products already exist. Consider using &ldquo;Browse Catalog&rdquo; to list them as vendor products instead.</p>
                      {duplicateWarnings.catalogueMatches.slice(0, 3).map((m: any) => (
                        <div key={m.id} className="flex items-center justify-between p-2.5 bg-amber-500/10 rounded-lg mb-1.5 border border-amber-500/30">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-hos-text-secondary truncate">{m.name}</p>
                            <p className="text-xs text-hos-text-muted">{m.sku ? `SKU: ${m.sku}` : ''} {m.reasons?.[0] || ''}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-2 shrink-0">
                            <span className="px-2 py-0.5 bg-amber-200 text-amber-300 rounded text-xs font-bold">{m.similarityScore}%</span>
                            <button
                              type="button"
                              onClick={() => {
                                setListAsVendorModal({ id: m.id, name: m.name, price: m.price });
                                setVendorPrice(String(m.price || ''));
                                setVendorStock('');
                              }}
                              className="px-2 py-0.5 bg-hos-gold text-[#1a1406] rounded text-xs font-medium hover:bg-hos-gold-hover"
                            >
                              List as Vendor
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {checkingDuplicates && (
              <div className="mb-4 flex items-center gap-2 text-sm text-hos-text-muted">
                <svg className="animate-spin h-4 w-4 text-hos-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Checking for duplicates...
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
              {/* Basic Information */}
              <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6 sm:p-8">
                <h2 className="text-xl font-semibold mb-4 sm:mb-6">Basic Information</h2>
                <div className="space-y-4 sm:space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                      placeholder="Enter product name"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="description"
                      className="block text-sm font-medium text-hos-text-secondary mb-1"
                    >
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      required
                      rows={6}
                      className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                      placeholder="Enter product description"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="sku" className="block text-sm font-medium text-hos-text-secondary mb-1">
                        SKU
                      </label>
                      <input
                        type="text"
                        id="sku"
                        name="sku"
                        value={formData.sku}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                        placeholder="SKU"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="barcode"
                        className="block text-sm font-medium text-hos-text-secondary mb-1"
                      >
                        Barcode
                      </label>
                      <input
                        type="text"
                        id="barcode"
                        name="barcode"
                        value={formData.barcode}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                        placeholder="Barcode"
                      />
                    </div>

                    <div>
                      <label htmlFor="ean" className="block text-sm font-medium text-hos-text-secondary mb-1">
                        EAN
                      </label>
                      <input
                        type="text"
                        id="ean"
                        name="ean"
                        value={formData.ean}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                        placeholder="EAN"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6 sm:p-8">
                <h2 className="text-xl font-semibold mb-4 sm:mb-6">Pricing</h2>
                <div className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="price"
                        className="block text-sm font-medium text-hos-text-secondary mb-1"
                      >
                        Price <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        id="price"
                        name="price"
                        value={formData.price}
                        onChange={handleInputChange}
                        required
                        min="0"
                        step="0.01"
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="currency"
                        className="block text-sm font-medium text-hos-text-secondary mb-1"
                      >
                        Currency
                      </label>
                      <select
                        id="currency"
                        name="currency"
                        value={formData.currency}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="AED">AED</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="tradePrice"
                        className="block text-sm font-medium text-hos-text-secondary mb-1"
                      >
                        Trade Price
                      </label>
                      <input
                        type="number"
                        id="tradePrice"
                        name="tradePrice"
                        value={formData.tradePrice}
                        onChange={handleInputChange}
                        min="0"
                        step="0.01"
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label htmlFor="rrp" className="block text-sm font-medium text-hos-text-secondary mb-1">
                        RRP (Recommended Retail Price)
                      </label>
                      <input
                        type="number"
                        id="rrp"
                        name="rrp"
                        value={formData.rrp}
                        onChange={handleInputChange}
                        min="0"
                        step="0.01"
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="stock"
                        className="block text-sm font-medium text-hos-text-secondary mb-1"
                      >
                        Available Stock <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        id="stock"
                        name="stock"
                        value={formData.stock}
                        onChange={handleInputChange}
                        required
                        min="0"
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                        placeholder="0"
                      />
                      <p className="text-xs text-hos-text-muted mt-1">Total units you have available to supply</p>
                    </div>

                    <div>
                      <label
                        htmlFor="taxRate"
                        className="block text-sm font-medium text-hos-text-secondary mb-1"
                      >
                        Tax Rate (%)
                      </label>
                      <input
                        type="number"
                        id="taxRate"
                        name="taxRate"
                        value={formData.taxRate}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        step="0.01"
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {isWholesaler && (
                  <div>
                    <label
                      htmlFor="quantity"
                      className="block text-sm font-medium text-hos-text-secondary mb-1"
                    >
                      Minimum Order Quantity
                    </label>
                    <input
                      type="number"
                      id="quantity"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                      placeholder="Minimum order quantity for bulk buyers"
                    />
                    <p className="text-xs text-hos-text-muted mt-1">Minimum units a buyer must order at wholesale price</p>
                  </div>
                  )}
                </div>
              </div>

              <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-4 sm:p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">SEO & Shipping</h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="metaTitle" className="block text-sm font-medium text-hos-text-secondary mb-1">Meta title</label>
                    <input id="metaTitle" name="metaTitle" maxLength={60} value={formData.metaTitle} onChange={handleInputChange} className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary" placeholder="Max 60 characters" />
                  </div>
                  <div>
                    <label htmlFor="metaDescription" className="block text-sm font-medium text-hos-text-secondary mb-1">Meta description</label>
                    <textarea id="metaDescription" name="metaDescription" maxLength={160} rows={2} value={formData.metaDescription} onChange={handleInputChange} className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary" placeholder="Max 160 characters" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <label htmlFor="weight" className="block text-sm font-medium text-hos-text-secondary mb-1">Weight (kg)</label>
                      <input type="number" id="weight" name="weight" min="0" step="0.01" value={formData.weight} onChange={handleInputChange} className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary" />
                    </div>
                    <div>
                      <label htmlFor="length" className="block text-sm font-medium text-hos-text-secondary mb-1">Length (cm)</label>
                      <input type="number" id="length" name="length" min="0" step="0.1" value={formData.length} onChange={handleInputChange} className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary" />
                    </div>
                    <div>
                      <label htmlFor="width" className="block text-sm font-medium text-hos-text-secondary mb-1">Width (cm)</label>
                      <input type="number" id="width" name="width" min="0" step="0.1" value={formData.width} onChange={handleInputChange} className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary" />
                    </div>
                    <div>
                      <label htmlFor="height" className="block text-sm font-medium text-hos-text-secondary mb-1">Height (cm)</label>
                      <input type="number" id="height" name="height" min="0" step="0.1" value={formData.height} onChange={handleInputChange} className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary" />
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm text-hos-text-secondary">
                      <input type="checkbox" checked={formData.brandAuthorization} onChange={(e) => setFormData((p) => ({ ...p, brandAuthorization: e.target.checked }))} />
                      I have brand authorization for this product
                    </label>
                  </div>
                  <div>
                    <label htmlFor="ageRestriction" className="block text-sm font-medium text-hos-text-secondary mb-1">Age restriction</label>
                    <select id="ageRestriction" name="ageRestriction" value={formData.ageRestriction} onChange={handleInputChange} className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary">
                      <option value="">None</option>
                      <option value="12+">12+</option>
                      <option value="16+">16+</option>
                      <option value="18+">18+</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="complianceNotes" className="block text-sm font-medium text-hos-text-secondary mb-1">Compliance notes</label>
                    <textarea id="complianceNotes" name="complianceNotes" rows={3} value={formData.complianceNotes} onChange={handleInputChange} className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary" placeholder="Licenses, certifications, or regulatory details" />
                  </div>
                </div>
              </div>

              {/* Categorization */}
              <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6 sm:p-8">
                <h2 className="text-xl font-semibold mb-4 sm:mb-6">Categorization</h2>
                <div className="space-y-4 sm:space-y-6 min-h-[200px]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="min-h-[140px]">
                      <CategorySelector
                        value={formData.categoryId}
                        onChange={(categoryId) => setFormData((prev) => ({ ...prev, categoryId: categoryId || '' }))}
                        label="Fandom (category)"
                        placeholder="Select a fandom"
                        refetchOnVisible={true}
                      />
                    </div>
                    <div className="min-h-[140px]">
                      <FandomSelector
                        value={formData.fandom}
                        onChange={(fandomSlug) => setFormData((prev) => ({ ...prev, fandom: fandomSlug || '' }))}
                        label="Fandom (theme, optional)"
                        placeholder="Select a fandom"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="tags" className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      id="tags"
                      name="tags"
                      value={formData.tags}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                      placeholder="tag1, tag2, tag3"
                    />
                  </div>
                </div>
              </div>

              {/* Product Images */}
              <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6 sm:p-8">
                <h2 className="text-xl font-semibold mb-4 sm:mb-6">
                  Product Images <span className="text-red-500">*</span>
                </h2>
                {error &&
                  /upload|image|URL|JPEG|PNG|GIF|WebP|10MB|size/i.test(error) && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg text-sm">
                      {error}
                    </div>
                  )}
                <div className="space-y-4">
                  <div className="p-4 border border-hos-border rounded-lg bg-hos-bg-secondary">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-medium text-hos-text-secondary">Upload images</div>
                        <div className="text-xs text-hos-text-secondary">JPEG/PNG/GIF/WebP, max 10MB each</div>
                      </div>
                      <label className="inline-flex items-center px-4 py-2 bg-hos-gold text-[#1a1406] rounded hover:bg-hos-gold-hover cursor-pointer">
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

                    <div className="mt-4">
                      <div className="text-sm font-medium text-hos-text-secondary mb-2">Or paste an image URL</div>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={newImageUrl}
                          onChange={(e) => setNewImageUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addImage();
                            }
                          }}
                          className="flex-1 px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                          placeholder="https://example.com/image.jpg"
                        />
                        <button
                          type="button"
                          onClick={addImage}
                          className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors"
                        >
                          Add URL
                        </button>
                      </div>
                    </div>
                  </div>

                  {images.length > 0 && (
                    <div className="space-y-3">
                      {images.map((image, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-4 p-3 border border-hos-border rounded-lg"
                        >
                          <Image
                            src={image.url}
                            alt={image.alt || 'Product image'}
                            width={80}
                            height={80}
                            className="object-cover rounded"
                          />
                          <div className="flex-1">
                            <input
                              type="text"
                              value={image.alt}
                              onChange={(e) => updateImageAlt(index, e.target.value)}
                              className="w-full px-3 py-1 border border-hos-border rounded text-sm mb-2"
                              placeholder="Image alt text"
                            />
                            <p className="text-xs text-hos-text-muted truncate">{image.url}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="px-3 py-1 text-red-400 hover:text-red-300 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Variations */}
              <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6 sm:p-8">
                <h2 className="text-xl font-semibold mb-4 sm:mb-6">Product Variations (Optional)</h2>
                <div className="space-y-4">
                  <div className="border border-hos-border rounded-lg p-4">
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={currentVariation.name}
                        onChange={(e) =>
                          setCurrentVariation({ ...currentVariation, name: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                        placeholder="Variation name (e.g., Size, Color)"
                      />

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newOptionLabel}
                          onChange={(e) => setNewOptionLabel(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVariationOption(); } }}
                          className="flex-1 px-3 py-2 border border-hos-border rounded-lg text-sm"
                          placeholder="Option label (e.g. S, M, L or Red, Blue)"
                        />
                        <button
                          type="button"
                          onClick={addVariationOption}
                          className="px-4 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary text-sm"
                        >
                          Add Option
                        </button>
                      </div>

                      {currentVariation.options.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-hos-text-secondary">Options:</p>
                          {currentVariation.options.map((option, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 bg-hos-bg-secondary rounded"
                            >
                              <span className="text-sm">
                                {variationOptionLabel(option)}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeVariationOption(idx)}
                                className="text-red-400 hover:text-red-300 text-sm"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={addVariation}
                        className="w-full px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors"
                      >
                        Add Variation
                      </button>
                    </div>
                  </div>

                  {variations.length > 0 && (
                    <div className="space-y-3">
                      <p className="font-medium text-hos-text-secondary">Added Variations:</p>
                      {variations.map((variation, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 border border-hos-border rounded-lg"
                        >
                          <div>
                            <p className="font-medium">{variation.name}</p>
                            <p className="text-sm text-hos-text-muted">
                              {variation.options.length} option(s)
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeVariation(index)}
                            className="px-3 py-1 text-red-400 hover:text-red-300 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex flex-col gap-3">
                {error && !/upload|image|URL|JPEG|PNG|GIF|WebP|10MB|size/i.test(error) && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg text-sm">
                    {error}
                  </div>
                )}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-6 py-3 border border-hos-border text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-hos-gold text-[#1a1406] rounded-lg font-semibold hover:bg-hos-gold-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (editSubmissionId ? 'Saving…' : 'Submitting…') : editSubmissionId ? 'Save changes' : 'Submit Product'}
                </button>
              </div>
              </div>
            </form>
            </>
            )}
            </>
            )}
        </div>
      </DashboardLayout>
    </RouteGuard>
  );
}
