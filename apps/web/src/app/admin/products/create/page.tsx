'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { CategorySelector } from '@/components/taxonomy/CategorySelector';
import { TagSelector } from '@/components/taxonomy/TagSelector';
import { AttributeEditor } from '@/components/taxonomy/AttributeEditor';
import { FandomSelector } from '@/components/taxonomy/FandomSelector';
import { SafeImage } from '@/components/SafeImage';
import { useRouter } from 'next/navigation';

/**
 * Product Creation Interface
 * 
 * This interface is for the Product/Catalog team to create products.
 * Products are always created as DRAFT status.
 * Price management is handled separately in the Price Management interface.
 * 
 * Access: CATALOG, ADMIN roles
 */
interface ProductVariationOptionForm {
  value: string;
  price?: number | string;
  stock?: number | string;
  imageUrl?: string;
}
interface ProductVariationForm {
  name: string;
  options: ProductVariationOptionForm[];
}

// Factory function to create fresh form data with new array instances each time
const getInitialFormData = () => ({
  name: '',
  description: '',
  shortDescription: '',
  sku: '',
  barcode: '',
  ean: '',
  isPlatformOwned: true,
  sellerId: '',
  categoryId: '',
  tagIds: [] as string[],
  attributes: [] as any[],
  fandom: '',
  productType: 'SIMPLE' as 'SIMPLE' | 'VARIANT',
  variations: [] as { name: string; options: ProductVariationOptionForm[] }[],
  metaTitle: '',
  metaDescription: '',
  weight: '',
  length: '',
  width: '',
  height: '',
});

export default function ProductCreationPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [sellers, setSellers] = useState<any[]>([]);
  const [formData, setFormData] = useState(getInitialFormData());
  const [images, setImages] = useState<Array<{ url: string; alt?: string; order?: number; size?: number; width?: number; height?: number; format?: string; uploadedAt?: Date }>>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [lastCreatedProduct, setLastCreatedProduct] = useState<string | null>(null);
  const [currentVariation, setCurrentVariation] = useState<ProductVariationForm>({ name: '', options: [{ value: '' }] });
  const [uploadingVariationImage, setUploadingVariationImage] = useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = useState('');

  useEffect(() => {
    fetchSellers();
  }, []);

  const fetchSellers = async () => {
    try {
      const response = await apiClient.getUsers();
      // Handle paginated { data: { data: [...] } } or flat { data: [...] }
      const raw = response?.data as { data?: unknown[] } | unknown[] | undefined;
      const userData = Array.isArray(raw) ? raw : (raw as { data?: unknown[] })?.data ?? [];
      const users = Array.isArray(userData) ? userData : [];
      const sellerRoles = ['SELLER', 'B2C_SELLER', 'WHOLESALER'];
      const sellerUsers = users.filter((user: any) => 
        sellerRoles.includes(user.role)
      );
      setSellers(sellerUsers);
    } catch (err: any) {
      console.error('Error fetching sellers:', err);
      setSellers([]); // Reset to empty array on error
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationErrors: string[] = [];
    if (!formData.name.trim()) validationErrors.push('Product name is required');
    if (formData.description.trim().length < 10) validationErrors.push('Description must be at least 10 characters');
    if (images.length === 0) validationErrors.push('At least one product image is required');
    if (!formData.categoryId && !formData.fandom) validationErrors.push('A fandom or category must be selected');

    if (validationErrors.length > 0) {
      validationErrors.forEach((err) => toast.error(err));
      return;
    }
    
    try {
      setLoading(true);
      
      const productType = formData.productType || 'SIMPLE';
      const variationsPayload =
        productType === 'VARIANT' && formData.variations.length > 0
          ? formData.variations.map((v) => ({
              name: v.name,
              options: v.options.map((o) => ({
                value: o.value,
                ...(o.price != null && o.price !== '' ? { price: Number(o.price) } : {}),
                ...(o.stock != null && o.stock !== '' ? { stock: Number(o.stock) } : {}),
                ...(o.imageUrl ? { imageUrl: o.imageUrl } : {}),
              })),
            }))
          : undefined;

      // Create product as DRAFT (no price/stock - those are managed separately for SIMPLE)
      const response = await apiClient.createAdminProduct({
        name: formData.name,
        description: formData.description,
        shortDescription: formData.shortDescription?.trim() || undefined,
        sku: formData.sku || undefined,
        barcode: formData.barcode || undefined,
        ean: formData.ean || undefined,
        price: 0, // Price will be set in Price Management interface
        stock: 0, // Stock will be set in Price Management interface
        isPlatformOwned: formData.isPlatformOwned,
        sellerId: formData.isPlatformOwned ? null : formData.sellerId || null,
        status: 'DRAFT', // Always DRAFT - requires price management before activation
        categoryId: formData.categoryId || undefined,
        tagIds: formData.tagIds.length > 0 ? formData.tagIds : undefined,
        attributes: formData.attributes.length > 0 ? formData.attributes : undefined,
        images: images.length > 0 ? images.map(img => ({ url: img.url, alt: img.alt, order: img.order })) : undefined,
        fandom: formData.fandom || undefined,
        metaTitle: formData.metaTitle?.trim() || undefined,
        metaDescription: formData.metaDescription?.trim() || undefined,
        ...(formData.weight ? { weight: parseFloat(formData.weight) } : {}),
        ...(formData.length ? { length: parseFloat(formData.length) } : {}),
        ...(formData.width ? { width: parseFloat(formData.width) } : {}),
        ...(formData.height ? { height: parseFloat(formData.height) } : {}),
        productType,
        variations: variationsPayload,
      });
      
      // Store created product name for success message
      const createdProductName = formData.name;
      setLastCreatedProduct(createdProductName);
      
      // Reset form for adding another product (call function to get fresh object with new array instances)
      setFormData(getInitialFormData());
      setImages([]);
      setCurrentVariation({ name: '', options: [{ value: '' }] });

      toast.success(`"${createdProductName}" created successfully! Form reset for next product.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  const uploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSizeBytes = 5 * 1024 * 1024; // 5MB (matches backend limit)
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
      
      // Capture image metadata
      const newImages = await Promise.all(
        limited.map(async (file, idx) => {
          const url = urls[idx];
          
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
      { url, alt: '', order: prev.length },
    ]);
    setNewImageUrl('');
  };

  const addVariationOption = () => {
    setCurrentVariation((prev) => ({ ...prev, options: [...prev.options, { value: '' }] }));
  };

  const updateVariationOption = (optIdx: number, field: keyof ProductVariationOptionForm, val: string | number | undefined) => {
    setCurrentVariation((prev) => ({
      ...prev,
      options: prev.options.map((opt, i) => (i === optIdx ? { ...opt, [field]: val } : opt)),
    }));
  };

  const removeVariationOption = (optIdx: number) => {
    setCurrentVariation((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== optIdx),
    }));
  };

  const addVariation = () => {
    const name = currentVariation.name.trim();
    const opts = currentVariation.options.filter((o) => o.value.trim());
    if (!name || opts.length === 0) {
      toast.error('Variation name and at least one option value are required');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      variations: [...prev.variations, { name, options: opts }],
    }));
    setCurrentVariation({ name: '', options: [{ value: '' }] });
  };

  const removeVariation = (varIdx: number) => {
    setFormData((prev) => ({ ...prev, variations: prev.variations.filter((_, i) => i !== varIdx) }));
  };

  return (
    <RouteGuard allowedRoles={['ADMIN', 'CATALOG']} showAccessDenied={true}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-hos-text-secondary">Create Product</h1>
              <p className="text-hos-text-secondary mt-2">Product creation interface for Catalog team. Products are created as DRAFT and require price management before activation.</p>
            </div>
            <button
              onClick={() => router.push('/admin/products')}
              className="px-4 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-text-muted"
            >
              Back to Products
            </button>
          </div>

          {/* Success Banner */}
          {lastCreatedProduct && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-green-400 text-xl">✓</span>
                  <div>
                    <p className="font-medium text-green-300">
                      Product &ldquo;{lastCreatedProduct}&rdquo; created successfully!
                    </p>
                    <p className="text-sm text-green-400">
                      Form has been reset. You can add another product or view all products.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLastCreatedProduct(null)}
                    className="px-3 py-1.5 text-sm text-green-400 hover:text-green-300"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => router.push('/admin/products')}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    View All Products
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                  placeholder="Product name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Description *</label>
                <textarea
                  required
                  minLength={10}
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                  rows={4}
                  placeholder="Product description (minimum 10 characters)"
                />
                <p className="text-xs text-hos-text-muted mt-1">{formData.description.length}/10 minimum characters</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Short Description</label>
                <input
                  type="text"
                  value={formData.shortDescription}
                  onChange={(e) => setFormData((prev) => ({ ...prev, shortDescription: e.target.value }))}
                  className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                  placeholder="Brief summary for listings and search"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">SKU</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                    placeholder="SKU"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Barcode</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData((prev) => ({ ...prev, barcode: e.target.value }))}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                    placeholder="Barcode"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">EAN</label>
                  <input
                    type="text"
                    value={formData.ean}
                    onChange={(e) => setFormData((prev) => ({ ...prev, ean: e.target.value }))}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                    placeholder="EAN"
                  />
                </div>
              </div>
              <div>
                <FandomSelector
                  value={formData.fandom}
                  onChange={(fandomSlug) => setFormData((prev) => ({ ...prev, fandom: fandomSlug || '' }))}
                  label="Fandom *"
                  placeholder="Select a fandom"
                  required={!formData.categoryId}
                />
                {!formData.fandom && !formData.categoryId && (
                  <p className="text-xs text-red-500 mt-1">A fandom or category is required</p>
                )}
              </div>
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.isPlatformOwned}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, isPlatformOwned: e.target.checked, sellerId: '' }))
                    }
                    className="rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
                  />
                  <span className="text-sm text-hos-text-secondary">Platform Owned (not assigned to seller)</span>
                </label>
              </div>
              {!formData.isPlatformOwned && (
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Assign to Seller</label>
                  <select
                    value={formData.sellerId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sellerId: e.target.value }))}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                  >
                    <option value="">Select a seller</option>
                    {sellers.map((seller) => (
                      <option key={seller.id} value={seller.id}>
                        {seller.email} ({seller.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="border-t border-hos-border pt-4 mt-4">
                <h3 className="text-sm font-semibold text-hos-text-secondary mb-4">Taxonomy</h3>
                
                <div className="space-y-4">
                  <CategorySelector
                    value={formData.categoryId}
                    onChange={(categoryId) => setFormData((prev) => ({ ...prev, categoryId: categoryId || '' }))}
                    label="Category *"
                    placeholder="Select a category"
                    required={!formData.fandom}
                  />
                  
                  <TagSelector
                    value={formData.tagIds}
                    onChange={(tagIds) => setFormData((prev) => ({ ...prev, tagIds }))}
                    label="Tags"
                    placeholder="Search and select tags..."
                  />
                  
                  {formData.categoryId && (
                    <AttributeEditor
                      categoryId={formData.categoryId}
                      value={formData.attributes}
                      onChange={(attributes) => setFormData((prev) => ({ ...prev, attributes }))}
                      label="Product Attributes"
                    />
                  )}
                </div>
              </div>

              <div className="border-t border-hos-border pt-4 mt-4">
                <h3 className="text-sm font-semibold text-hos-text-secondary mb-2">Product type</h3>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="productType"
                      checked={formData.productType === 'SIMPLE'}
                      onChange={() => setFormData((prev) => ({ ...prev, productType: 'SIMPLE' }))}
                      className="rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
                    />
                    <span className="text-sm text-hos-text-secondary">Simple</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="productType"
                      checked={formData.productType === 'VARIANT'}
                      onChange={() => setFormData((prev) => ({ ...prev, productType: 'VARIANT' }))}
                      className="rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
                    />
                    <span className="text-sm text-hos-text-secondary">Variant (e.g. Size, Color)</span>
                  </label>
                </div>

                {formData.productType === 'VARIANT' && (
                  <div className="mt-4 p-4 border border-hos-border rounded-lg bg-hos-bg-secondary space-y-4">
                    <h4 className="text-sm font-medium text-hos-text-secondary">Product Variations</h4>
                    <p className="text-xs text-hos-text-secondary">
                      Add variation dimensions (e.g. Size, Color). For each dimension, add option values shown to customers. You can set optional price, stock, and image per option.
                    </p>

                    {formData.variations.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-hos-text-secondary">Added variations</p>
                        {formData.variations.map((v, varIdx) => (
                          <div key={varIdx} className="flex items-center justify-between p-3 bg-hos-bg-secondary border border-hos-border rounded">
                            <span className="font-medium text-hos-text-secondary">{v.name}</span>
                            <span className="text-xs text-hos-text-muted">
                              {v.options.map((o) => o.value).join(', ')}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeVariation(varIdx)}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="p-3 bg-hos-bg-secondary border border-hos-border rounded space-y-3">
                      <p className="text-xs font-medium text-hos-text-secondary">Add a variation</p>
                      <div>
                        <label className="block text-xs text-hos-text-secondary mb-1">Variation name (e.g. Size, Color)</label>
                        <input
                          type="text"
                          value={currentVariation.name}
                          onChange={(e) => setCurrentVariation((prev) => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3 py-2 border border-hos-border rounded text-sm"
                          placeholder="Size"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs text-hos-text-secondary">
                            Option values — the label shown to customers (e.g. S, M, L or Red, Blue)
                          </label>
                          <button
                            type="button"
                            onClick={addVariationOption}
                            className="text-xs text-hos-gold hover:text-hos-gold-hover"
                          >
                            + Add option
                          </button>
                        </div>
                        <div className="space-y-2">
                          {currentVariation.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex flex-wrap items-center gap-2 p-2 border border-hos-border rounded bg-hos-bg-secondary">
                              <input
                                type="text"
                                value={opt.value}
                                onChange={(e) => updateVariationOption(optIdx, 'value', e.target.value)}
                                className="w-24 px-2 py-1 border border-hos-border rounded text-sm"
                                placeholder="Value"
                              />
                              <input
                                type="number"
                                value={opt.price ?? ''}
                                onChange={(e) => updateVariationOption(optIdx, 'price', e.target.value ? Number(e.target.value) : undefined)}
                                className="w-20 px-2 py-1 border border-hos-border rounded text-sm"
                                placeholder="Price"
                                min={0}
                                step={0.01}
                              />
                              <input
                                type="number"
                                value={opt.stock ?? ''}
                                onChange={(e) => updateVariationOption(optIdx, 'stock', e.target.value ? Number(e.target.value) : undefined)}
                                className="w-16 px-2 py-1 border border-hos-border rounded text-sm"
                                placeholder="Stock"
                                min={0}
                              />
                              <label className="inline-flex items-center gap-1 text-xs text-hos-gold cursor-pointer">
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={!!uploadingVariationImage}
                                  onChange={(e) => {
                                    const key = `new-${optIdx}`;
                                    if (uploadingVariationImage) return;
                                    const files = e.target.files;
                                    if (!files?.length) return;
                                    setUploadingVariationImage(key);
                                    apiClient.uploadMultipleFiles([files[0]], 'products').then((res) => {
                                      const url = res?.data?.urls?.[0];
                                      if (url) updateVariationOption(optIdx, 'imageUrl', url);
                                    }).catch((err: any) => toast.error(err.message || 'Upload failed')).finally(() => setUploadingVariationImage(null));
                                    e.target.value = '';
                                  }}
                                />
                                {opt.imageUrl ? '✓ Image' : (uploadingVariationImage === `new-${optIdx}` ? 'Uploading…' : 'Image')}
                              </label>
                              {opt.imageUrl && (
                                <span className="inline-flex items-center gap-1">
                                  <SafeImage src={opt.imageUrl} alt="" width={32} height={32} className="object-cover rounded" />
                                  <button type="button" onClick={() => updateVariationOption(optIdx, 'imageUrl', undefined)} className="text-red-400 text-xs">Clear</button>
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => removeVariationOption(optIdx)}
                                className="text-red-400 hover:text-red-300 text-xs"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={addVariation}
                        className="px-3 py-2 bg-hos-gold text-[#1a1406] rounded text-sm hover:bg-hos-gold-hover"
                      >
                        Add variation
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-hos-border pt-4 mt-4">
                <h3 className="text-sm font-semibold text-hos-text-secondary mb-3">SEO & Search</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-hos-text-secondary mb-1">Meta Title</label>
                    <input
                      type="text"
                      value={formData.metaTitle}
                      onChange={(e) => setFormData((prev) => ({ ...prev, metaTitle: e.target.value }))}
                      className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 text-sm"
                      placeholder="SEO title for search engine results"
                      maxLength={70}
                    />
                    <p className="text-xs text-hos-text-muted mt-1">{formData.metaTitle.length}/70 characters</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-hos-text-secondary mb-1">Meta Description</label>
                    <textarea
                      value={formData.metaDescription}
                      onChange={(e) => setFormData((prev) => ({ ...prev, metaDescription: e.target.value }))}
                      className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 text-sm"
                      placeholder="SEO description for search engine results"
                      rows={2}
                      maxLength={160}
                    />
                    <p className="text-xs text-hos-text-muted mt-1">{formData.metaDescription.length}/160 characters</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-hos-border pt-4 mt-4">
                <h3 className="text-sm font-semibold text-hos-text-secondary mb-3">Shipping Dimensions</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-hos-text-secondary mb-1">Weight (kg)</label>
                    <input type="number" step="0.001" min="0" value={formData.weight} onChange={(e) => setFormData((prev) => ({ ...prev, weight: e.target.value }))} className="w-full px-3 py-2 border border-hos-border rounded-lg text-sm" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-hos-text-secondary mb-1">Length (cm)</label>
                    <input type="number" step="0.1" min="0" value={formData.length} onChange={(e) => setFormData((prev) => ({ ...prev, length: e.target.value }))} className="w-full px-3 py-2 border border-hos-border rounded-lg text-sm" placeholder="0.0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-hos-text-secondary mb-1">Width (cm)</label>
                    <input type="number" step="0.1" min="0" value={formData.width} onChange={(e) => setFormData((prev) => ({ ...prev, width: e.target.value }))} className="w-full px-3 py-2 border border-hos-border rounded-lg text-sm" placeholder="0.0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-hos-text-secondary mb-1">Height (cm)</label>
                    <input type="number" step="0.1" min="0" value={formData.height} onChange={(e) => setFormData((prev) => ({ ...prev, height: e.target.value }))} className="w-full px-3 py-2 border border-hos-border rounded-lg text-sm" placeholder="0.0" />
                  </div>
                </div>
              </div>

              <div className="border-t border-hos-border pt-4 mt-4">
                <h3 className="text-sm font-semibold text-hos-text-secondary mb-4">Images <span className="text-red-500">*</span></h3>
                <div className="p-4 border border-hos-border rounded-lg bg-hos-bg-secondary">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-medium text-hos-text-secondary">Upload product images</div>
                      <div className="text-xs text-hos-text-secondary">JPEG/PNG/GIF/WebP, max 5MB each, up to 4 images</div>
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
                    <div className="text-sm font-medium text-hos-text-secondary mb-2">Or add image by URL</div>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={newImageUrl}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addImageByUrl();
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-transparent bg-hos-bg-secondary text-sm"
                        placeholder="https://example.com/product-image.jpg"
                      />
                      <button
                        type="button"
                        onClick={addImageByUrl}
                        disabled={!newImageUrl.trim()}
                        className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors text-sm disabled:opacity-50"
                      >
                        Add URL
                      </button>
                    </div>
                  </div>

                  {images.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {images.map((img, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 border border-hos-border rounded-lg bg-hos-bg-secondary">
                          <SafeImage src={img.url} alt={img.alt || 'Product image'} width={80} height={80} className="object-cover rounded" />
                          <div className="flex-1">
                            <input
                              type="text"
                              value={img.alt || ''}
                              onChange={(e) => updateImageAlt(idx, e.target.value)}
                              className="w-full px-3 py-2 border border-hos-border rounded text-sm mb-2"
                              placeholder="Alt text (optional)"
                            />
                            <div className="text-xs text-hos-text-muted space-y-1">
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

              {/* Creation Readiness Checklist */}
              <div className="border-t border-hos-border pt-4 mt-4">
                <h3 className="text-sm font-semibold text-hos-text-secondary mb-3">Creation Checklist</h3>
                <div className="bg-hos-bg-secondary rounded-lg p-4 space-y-2">
                  {[
                    { label: 'Product name', ok: !!formData.name.trim(), required: true },
                    { label: 'Description (min 10 chars)', ok: formData.description.trim().length >= 10, required: true },
                    { label: 'At least one image', ok: images.length > 0, required: true },
                    { label: 'Fandom or category assigned', ok: !!formData.categoryId || !!formData.fandom, required: true },
                    { label: 'Short description', ok: !!formData.shortDescription.trim(), required: false },
                    { label: 'SKU', ok: !!formData.sku.trim(), required: false },
                    { label: 'SEO title', ok: !!formData.metaTitle.trim(), required: false },
                    { label: 'SEO description', ok: !!formData.metaDescription.trim(), required: false },
                  ].map((check) => (
                    <div key={check.label} className="flex items-center gap-2 text-sm">
                      <span className={check.ok ? 'text-green-400' : check.required ? 'text-red-500' : 'text-amber-500'}>
                        {check.ok ? '✓' : check.required ? '✗' : '○'}
                      </span>
                      <span className={check.ok ? 'text-hos-text-secondary' : check.required ? 'text-red-400' : 'text-amber-400'}>
                        {check.label}{check.required ? '' : ' (recommended)'}
                      </span>
                    </div>
                  ))}
                </div>
                {(() => {
                  const missingCount = [
                    !formData.name.trim(),
                    formData.description.trim().length < 10,
                    images.length === 0,
                    !formData.categoryId && !formData.fandom,
                  ].filter(Boolean).length;
                  if (missingCount > 0) {
                    return (
                      <p className="text-xs text-red-400 mt-2">
                        {missingCount} required item{missingCount > 1 ? 's' : ''} missing — fix before creating.
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="bg-hos-gold/10 border border-hos-border-accent rounded-lg p-4">
                <p className="text-sm text-hos-gold">
                  <strong>Note:</strong> Products are created as DRAFT. After creation, set pricing and stock in the Price Management interface, then publish.
                </p>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Product (DRAFT)'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/admin/products')}
                  className="px-6 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-text-muted transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
