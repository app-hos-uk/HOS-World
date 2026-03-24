'use client';

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

interface Variation {
  name: string;
  options: VariationOption[];
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'PROCUREMENT_APPROVED':
    case 'FINANCE_APPROVED':
    case 'CATALOG_COMPLETED':
    case 'MARKETING_COMPLETED':
    case 'CONTENT_COMPLETED':
      return 'bg-green-100 text-green-800';
    case 'PROCUREMENT_REJECTED':
      return 'bg-red-100 text-red-800';
    case 'UNDER_REVIEW':
      return 'bg-blue-100 text-blue-800';
    case 'SUBMITTED':
    default:
      return 'bg-yellow-100 text-yellow-800';
  }
}

function SubmissionViewMode({ submissionId }: { submissionId: string }) {
  const { user, effectiveRole } = useAuth();
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const currentRole = effectiveRole || user?.role;
  const isWholesaler = currentRole === 'WHOLESALER';
  const menuItems = useMemo(() => getSellerMenuItems(isWholesaler), [isWholesaler]);

  useEffect(() => {
    const fetchSubmission = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getSubmission(submissionId);
        if (response?.data) {
          setSubmission(response.data);
        } else {
          setError('Submission not found');
        }
      } catch (err: any) {
        console.error('Error fetching submission:', err);
        setError(err.message || 'Failed to load submission');
      } finally {
        setLoading(false);
      }
    };
    fetchSubmission();
  }, [submissionId]);

  const productData = submission?.productData || {};
  const images: any[] = productData.images || [];
  const variations: any[] = productData.variations || [];
  const tags: string[] = productData.tags || [];

  return (
    <RouteGuard allowedRoles={['SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout
        role={isWholesaler ? 'WHOLESALER' : 'SELLER'}
        menuItems={menuItems}
        title={isWholesaler ? 'Wholesaler' : 'Seller'}
      >
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Link
              href={isWholesaler ? '/wholesaler/submissions' : '/seller/submissions'}
              className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4"
            >
              ← Back to Submissions
            </Link>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
              Submission Details
            </h1>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              <p className="font-semibold">Error</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {!loading && !error && submission && (
            <div className="space-y-6">
              {/* Status */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Status</h2>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusBadgeClass(submission.status)}`}>
                    {submission.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Submitted on {new Date(submission.createdAt).toLocaleString()}
                </p>
                {submission.updatedAt && submission.updatedAt !== submission.createdAt && (
                  <p className="text-sm text-gray-500 mt-1">
                    Last updated {new Date(submission.updatedAt).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Reviewer Notes */}
              {(submission.notes || submission.reviewNotes || submission.rejectionReason) && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-3">Reviewer Notes</h2>
                  {submission.notes && (
                    <div className="p-3 bg-gray-50 rounded-lg mb-2">
                      <p className="text-sm text-gray-700">{submission.notes}</p>
                    </div>
                  )}
                  {submission.reviewNotes && (
                    <div className="p-3 bg-blue-50 rounded-lg mb-2">
                      <p className="text-sm text-blue-700">{submission.reviewNotes}</p>
                    </div>
                  )}
                  {submission.rejectionReason && (
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-sm font-medium text-red-700 mb-1">Rejection Reason:</p>
                      <p className="text-sm text-red-700">{submission.rejectionReason}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Basic Information */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Product Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Product Name</label>
                    <p className="mt-1 text-gray-900 font-medium text-lg">{productData.name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Description</label>
                    <p className="mt-1 text-gray-700 whitespace-pre-wrap">{productData.description || 'N/A'}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {productData.sku && (
                      <div>
                        <label className="block text-sm font-medium text-gray-500">SKU</label>
                        <p className="mt-1 text-gray-900">{productData.sku}</p>
                      </div>
                    )}
                    {productData.barcode && (
                      <div>
                        <label className="block text-sm font-medium text-gray-500">Barcode</label>
                        <p className="mt-1 text-gray-900">{productData.barcode}</p>
                      </div>
                    )}
                    {productData.ean && (
                      <div>
                        <label className="block text-sm font-medium text-gray-500">EAN</label>
                        <p className="mt-1 text-gray-900">{productData.ean}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Pricing & Stock</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Price</label>
                    <p className="mt-1 text-gray-900 font-semibold text-lg">
                      {productData.currency || 'USD'} {Number(productData.price || 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Stock</label>
                    <p className="mt-1 text-gray-900 font-semibold text-lg">{productData.stock ?? 'N/A'}</p>
                  </div>
                  {productData.tradePrice && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Trade Price</label>
                      <p className="mt-1 text-gray-900">{productData.currency || 'USD'} {Number(productData.tradePrice).toFixed(2)}</p>
                    </div>
                  )}
                  {productData.rrp && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">RRP</label>
                      <p className="mt-1 text-gray-900">{productData.currency || 'USD'} {Number(productData.rrp).toFixed(2)}</p>
                    </div>
                  )}
                  {productData.taxRate !== undefined && productData.taxRate !== null && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Tax Rate</label>
                      <p className="mt-1 text-gray-900">{productData.taxRate}%</p>
                    </div>
                  )}
                  {productData.quantity && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Quantity</label>
                      <p className="mt-1 text-gray-900">{productData.quantity}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Images */}
              {images.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Product Images</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {images.map((image: any, index: number) => (
                      <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                        <Image
                          src={image.url || image}
                          alt={image.alt || `Product image ${index + 1}`}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Categorization */}
              {(productData.categoryId || productData.fandom || tags.length > 0) && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Categorization</h2>
                  <div className="space-y-3">
                    {productData.categoryId && (
                      <div>
                        <label className="block text-sm font-medium text-gray-500">Category ID</label>
                        <p className="mt-1 text-gray-900">{productData.categoryId}</p>
                      </div>
                    )}
                    {productData.fandom && (
                      <div>
                        <label className="block text-sm font-medium text-gray-500">Fandom</label>
                        <p className="mt-1 text-gray-900">{productData.fandom}</p>
                      </div>
                    )}
                    {tags.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-500">Tags</label>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {tags.map((tag: string, index: number) => (
                            <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Variations */}
              {variations.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Variations</h2>
                  <div className="space-y-3">
                    {variations.map((variation: any, index: number) => (
                      <div key={index} className="p-3 border border-gray-200 rounded-lg">
                        <p className="font-medium text-gray-900">{variation.name}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {variation.options?.map((option: any, optIdx: number) => (
                            <span key={optIdx} className="px-2 py-1 bg-purple-50 text-purple-700 text-sm rounded">
                              {option.name}: {option.value}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DashboardLayout>
    </RouteGuard>
  );
}

function SubmitProductContent() {
  const searchParams = useSearchParams();
  const submissionId = searchParams.get('id');

  if (submissionId) {
    return <SubmissionViewMode submissionId={submissionId} />;
  }

  return <SubmitProductForm />;
}

function SubmitProductForm() {
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
  });

  const [images, setImages] = useState<ImageUpload[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploadingImages, setUploadingImages] = useState(false);
  const [currentVariation, setCurrentVariation] = useState<Variation>({
    name: '',
    options: [],
  });
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionValue, setNewOptionValue] = useState('');

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
    if (newImageUrl.trim()) {
      setImages([
        ...images,
        {
          url: newImageUrl.trim(),
          alt: '',
          order: images.length,
        },
      ]);
      setNewImageUrl('');
    }
  };

  const uploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB (matches backend multer limit)

    const fileArr = Array.from(files);
    const limited = fileArr.slice(0, 4);
    if (fileArr.length > 4) {
      setError('You can upload up to 4 images at a time');
      return;
    }
    for (const f of fileArr) {
      if (!allowedTypes.includes(f.type)) {
        setError('Only JPEG, PNG, GIF, and WebP images are allowed');
        return;
      }
      if (f.size > maxSizeBytes) {
        setError('Max image size is 10MB');
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
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
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
    if (newOptionName.trim() && newOptionValue.trim()) {
      setCurrentVariation({
        ...currentVariation,
        options: [
          ...currentVariation.options,
          { name: newOptionName.trim(), value: newOptionValue.trim() },
        ],
      });
      setNewOptionName('');
      setNewOptionValue('');
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
        stock: parseInt(formData.stock),
        quantity: formData.quantity ? parseInt(formData.quantity) : undefined,
        fandom: formData.fandom || undefined,
        categoryId: formData.categoryId || undefined,
        tags: formData.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0),
        images: images,
        variations:
          variations.length > 0
            ? variations.map((v) => ({
                name: v.name,
                options: v.options,
              }))
            : undefined,
      };

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
              Submit Product
            </h1>
            <p className="text-gray-600 mt-2">Browse existing catalog or submit a new product for review</p>
          </div>

            {/* Tab Switcher */}
            <div className="mb-6 flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setActiveTab('browse')}
                className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'browse'
                    ? 'bg-white text-purple-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Browse Catalog
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('submit')}
                className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'submit'
                    ? 'bg-white text-purple-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Submit New Product
              </button>
            </div>

            {/* Browse Catalog Tab */}
            {activeTab === 'browse' && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Browse first:</strong> Check if the product you want to sell already exists in our catalog.
                    If it does, you can list it instantly with your own price and stock — no approval process needed.
                  </p>
                </div>

                {/* Search & Filter */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <form onSubmit={handleCatalogSearchSubmit} className="flex flex-col sm:flex-row gap-3">
                    <select
                      value={selectedFandom}
                      onChange={(e) => { setSelectedFandom(e.target.value); setCatalogPage(1); }}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                    >
                      Search
                    </button>
                  </form>
                </div>

                {/* Product Grid */}
                {catalogLoading ? (
                  <div className="flex justify-center py-12">
                    <svg className="animate-spin h-8 w-8 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                  </div>
                ) : catalogProducts.length === 0 ? (
                  <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
                    <p className="text-gray-500 mb-2">No catalog products found</p>
                    <p className="text-sm text-gray-400">Try a different search or fandom filter, or submit a new product below</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('submit')}
                      className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                    >
                      Submit New Product
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-gray-500 mb-2 flex items-center gap-2">
                      <span>{catalogTotal} products found</span>
                      {searchMeta?.processingTimeMs != null && (
                        <span className="text-xs text-gray-400">({searchMeta.processingTimeMs}ms)</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {catalogProducts.map((product: any) => (
                        <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex gap-3">
                            {product.imageUrl && (
                              <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <h3 className="text-sm font-semibold text-gray-900 truncate">{product.name}</h3>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {product.sku ? `SKU: ${product.sku}` : ''}{product.fandom ? ` · ${product.fandom}` : ''}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm font-bold text-gray-900">${Number(product.price || 0).toFixed(2)}</span>
                                <span className="text-xs text-gray-400">·</span>
                                <span className="text-xs text-gray-500">{product.vendorCount} vendor{product.vendorCount !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            {product.alreadyListed ? (
                              <span className="flex-1 text-center py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium border border-green-200">
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
                                className="flex-1 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors"
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
                          className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="px-3 py-1.5 text-sm text-gray-600">
                          Page {catalogPage} of {Math.ceil(catalogTotal / 20)}
                        </span>
                        <button
                          type="button"
                          disabled={catalogPage >= Math.ceil(catalogTotal / 20)}
                          onClick={() => setCatalogPage((p) => p + 1)}
                          className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}

                <div className="text-center pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500 mb-2">Can&apos;t find your product?</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('submit')}
                    className="px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                  >
                    Submit a New Product
                  </button>
                </div>
              </div>
            )}

            {/* List as Vendor Modal */}
            {listAsVendorModal && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                  <h3 className="text-lg font-bold mb-1">List as Vendor</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Sell &ldquo;{listAsVendorModal.name}&rdquo; with your own pricing and stock.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Your Price ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={vendorPrice}
                        onChange={(e) => setVendorPrice(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                        placeholder="Enter your selling price"
                      />
                      <p className="text-xs text-gray-400 mt-1">Catalog price: ${Number(listAsVendorModal.price || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Your Stock</label>
                      <input
                        type="number"
                        min="1"
                        value={vendorStock}
                        onChange={(e) => setVendorStock(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                        placeholder="Quantity available"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-5">
                    <button
                      type="button"
                      onClick={() => setListAsVendorModal(null)}
                      className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleListAsVendor}
                      disabled={vendorSubmitting || !vendorPrice || !vendorStock}
                      className="flex-1 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
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

            {success && (
              <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                <p className="font-semibold">Product submitted successfully!</p>
                <p className="text-sm mt-1">Redirecting to My Products…</p>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                <p className="font-semibold">Error</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}

            {duplicateWarnings && (
              <div className="mb-6 border border-amber-300 rounded-lg overflow-hidden">
                <div className="bg-amber-50 px-4 py-3 border-b border-amber-200">
                  <h3 className="font-semibold text-amber-900">Potential Duplicates Detected</h3>
                  <p className="text-xs text-amber-700 mt-0.5">Review matches below. If a product already exists, use &ldquo;Browse Catalog&rdquo; tab to list it as your vendor product instead.</p>
                </div>
                <div className="p-4 space-y-3 bg-white">
                  {duplicateWarnings.sellerActiveMatches?.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-red-800 mb-1.5">Your Active Products</p>
                      <p className="text-xs text-red-600 mb-2">You already have these products listed. Consider updating stock/price instead of submitting again.</p>
                      {duplicateWarnings.sellerActiveMatches.slice(0, 3).map((m: any) => (
                        <div key={m.id} className="flex items-center justify-between p-2.5 bg-red-50 rounded-lg mb-1.5 border border-red-200">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                            <p className="text-xs text-gray-500">{m.sku ? `SKU: ${m.sku}` : ''} {m.reasons?.[0] || ''}</p>
                          </div>
                          <span className="ml-2 shrink-0 px-2 py-0.5 bg-red-200 text-red-900 rounded text-xs font-bold">{m.similarityScore}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {duplicateWarnings.sellerPendingMatches?.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-orange-800 mb-1.5">Your Pending Submissions</p>
                      <p className="text-xs text-orange-600 mb-2">You already have pending submissions for similar products.</p>
                      {duplicateWarnings.sellerPendingMatches.slice(0, 3).map((m: any) => (
                        <div key={m.id} className="flex items-center justify-between p-2.5 bg-orange-50 rounded-lg mb-1.5 border border-orange-200">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                            <p className="text-xs text-gray-500">Status: {m.status?.replace(/_/g, ' ')} &middot; {m.reasons?.[0] || ''}</p>
                          </div>
                          <span className="ml-2 shrink-0 px-2 py-0.5 bg-orange-200 text-orange-900 rounded text-xs font-bold">{m.similarityScore}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {duplicateWarnings.catalogueMatches?.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-amber-800 mb-1.5">Existing Catalogue Products</p>
                      <p className="text-xs text-amber-600 mb-2">Similar products already exist. Consider using &ldquo;Browse Catalog&rdquo; to list them as vendor products instead.</p>
                      {duplicateWarnings.catalogueMatches.slice(0, 3).map((m: any) => (
                        <div key={m.id} className="flex items-center justify-between p-2.5 bg-amber-50 rounded-lg mb-1.5 border border-amber-200">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                            <p className="text-xs text-gray-500">{m.sku ? `SKU: ${m.sku}` : ''} {m.reasons?.[0] || ''}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-2 shrink-0">
                            <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded text-xs font-bold">{m.similarityScore}%</span>
                            <button
                              type="button"
                              onClick={() => {
                                setListAsVendorModal({ id: m.id, name: m.name, price: m.price });
                                setVendorPrice(String(m.price || ''));
                                setVendorStock('');
                              }}
                              className="px-2 py-0.5 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700"
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
              <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
                <svg className="animate-spin h-4 w-4 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Checking for duplicates...
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
              {/* Basic Information */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8">
                <h2 className="text-xl font-semibold mb-4 sm:mb-6">Basic Information</h2>
                <div className="space-y-4 sm:space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter product name"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="description"
                      className="block text-sm font-medium text-gray-700 mb-1"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter product description"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-1">
                        SKU
                      </label>
                      <input
                        type="text"
                        id="sku"
                        name="sku"
                        value={formData.sku}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="SKU"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="barcode"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Barcode
                      </label>
                      <input
                        type="text"
                        id="barcode"
                        name="barcode"
                        value={formData.barcode}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Barcode"
                      />
                    </div>

                    <div>
                      <label htmlFor="ean" className="block text-sm font-medium text-gray-700 mb-1">
                        EAN
                      </label>
                      <input
                        type="text"
                        id="ean"
                        name="ean"
                        value={formData.ean}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="EAN"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8">
                <h2 className="text-xl font-semibold mb-4 sm:mb-6">Pricing</h2>
                <div className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="price"
                        className="block text-sm font-medium text-gray-700 mb-1"
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="currency"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Currency
                      </label>
                      <select
                        id="currency"
                        name="currency"
                        value={formData.currency}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="tradePrice"
                        className="block text-sm font-medium text-gray-700 mb-1"
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label htmlFor="rrp" className="block text-sm font-medium text-gray-700 mb-1">
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="stock"
                        className="block text-sm font-medium text-gray-700 mb-1"
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="0"
                      />
                      <p className="text-xs text-gray-500 mt-1">Total units you have available to supply</p>
                    </div>

                    <div>
                      <label
                        htmlFor="taxRate"
                        className="block text-sm font-medium text-gray-700 mb-1"
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {isWholesaler && (
                  <div>
                    <label
                      htmlFor="quantity"
                      className="block text-sm font-medium text-gray-700 mb-1"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Minimum order quantity for bulk buyers"
                    />
                    <p className="text-xs text-gray-500 mt-1">Minimum units a buyer must order at wholesale price</p>
                  </div>
                  )}
                </div>
              </div>

              {/* Categorization */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8">
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
                    <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      id="tags"
                      name="tags"
                      value={formData.tags}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="tag1, tag2, tag3"
                    />
                  </div>
                </div>
              </div>

              {/* Product Images */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8">
                <h2 className="text-xl font-semibold mb-4 sm:mb-6">
                  Product Images <span className="text-red-500">*</span>
                </h2>
                <div className="space-y-4">
                  <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-medium text-gray-900">Upload images</div>
                        <div className="text-xs text-gray-600">JPEG/PNG/GIF/WebP, max 10MB each</div>
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

                    <div className="mt-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">Or paste an image URL</div>
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
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                          placeholder="https://example.com/image.jpg"
                        />
                        <button
                          type="button"
                          onClick={addImage}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
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
                          className="flex items-start gap-4 p-3 border border-gray-200 rounded-lg"
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
                              className="w-full px-3 py-1 border border-gray-300 rounded text-sm mb-2"
                              placeholder="Image alt text"
                            />
                            <p className="text-xs text-gray-500 truncate">{image.url}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
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

              {/* Variations */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8">
                <h2 className="text-xl font-semibold mb-4 sm:mb-6">Product Variations (Optional)</h2>
                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={currentVariation.name}
                        onChange={(e) =>
                          setCurrentVariation({ ...currentVariation, name: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Variation name (e.g., Size, Color)"
                      />

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newOptionName}
                          onChange={(e) => setNewOptionName(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Option name"
                        />
                        <input
                          type="text"
                          value={newOptionValue}
                          onChange={(e) => setNewOptionValue(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Option value"
                        />
                        <button
                          type="button"
                          onClick={addVariationOption}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                        >
                          Add Option
                        </button>
                      </div>

                      {currentVariation.options.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-700">Options:</p>
                          {currentVariation.options.map((option, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 bg-gray-50 rounded"
                            >
                              <span className="text-sm">
                                {option.name}: {option.value}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeVariationOption(idx)}
                                className="text-red-600 hover:text-red-800 text-sm"
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
                        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        Add Variation
                      </button>
                    </div>
                  </div>

                  {variations.length > 0 && (
                    <div className="space-y-3">
                      <p className="font-medium text-gray-700">Added Variations:</p>
                      {variations.map((variation, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                        >
                          <div>
                            <p className="font-medium">{variation.name}</p>
                            <p className="text-sm text-gray-500">
                              {variation.options.length} option(s)
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeVariation(index)}
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

              {/* Submit Button */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Submit Product'}
                </button>
              </div>
            </form>
            </>
            )}
        </div>
      </DashboardLayout>
    </RouteGuard>
  );
}

export default function SubmitProductPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      }
    >
      <SubmitProductContent />
    </Suspense>
  );
}
