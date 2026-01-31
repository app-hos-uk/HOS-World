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
    
    // Validate before setting loading state (early return won't reach finally block)
    if (images.length === 0) {
      toast.error('Please upload at least 1 product image');
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
              <h1 className="text-2xl font-bold text-gray-900">Create Product</h1>
              <p className="text-gray-600 mt-2">Product creation interface for Catalog team. Products are created as DRAFT and require price management before activation.</p>
            </div>
            <button
              onClick={() => router.push('/admin/products')}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              Back to Products
            </button>
          </div>

          {/* Success Banner */}
          {lastCreatedProduct && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-green-600 text-xl">✓</span>
                  <div>
                    <p className="font-medium text-green-800">
                      Product "{lastCreatedProduct}" created successfully!
                    </p>
                    <p className="text-sm text-green-600">
                      Form has been reset. You can add another product or view all products.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLastCreatedProduct(null)}
                    className="px-3 py-1.5 text-sm text-green-700 hover:text-green-900"
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

          <div className="bg-white rounded-lg shadow p-6">
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  rows={4}
                  placeholder="Product description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
                <input
                  type="text"
                  value={formData.shortDescription}
                  onChange={(e) => setFormData((prev) => ({ ...prev, shortDescription: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Brief summary for listings and search"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="SKU"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData((prev) => ({ ...prev, barcode: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Barcode"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">EAN</label>
                  <input
                    type="text"
                    value={formData.ean}
                    onChange={(e) => setFormData((prev) => ({ ...prev, ean: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="EAN"
                  />
                </div>
              </div>
              <div>
                <FandomSelector
                  value={formData.fandom}
                  onChange={(fandomSlug) => setFormData((prev) => ({ ...prev, fandom: fandomSlug || '' }))}
                  label="Fandom"
                  placeholder="Select a fandom"
                />
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
                    {sellers.map((seller) => (
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
                    onChange={(categoryId) => setFormData((prev) => ({ ...prev, categoryId: categoryId || '' }))}
                    label="Fandom"
                    placeholder="Select a fandom"
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

              <div className="border-t border-gray-200 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Product type</h3>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="productType"
                      checked={formData.productType === 'SIMPLE'}
                      onChange={() => setFormData((prev) => ({ ...prev, productType: 'SIMPLE' }))}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Simple</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="productType"
                      checked={formData.productType === 'VARIANT'}
                      onChange={() => setFormData((prev) => ({ ...prev, productType: 'VARIANT' }))}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Variant (e.g. Size, Color)</span>
                  </label>
                </div>

                {formData.productType === 'VARIANT' && (
                  <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4">
                    <h4 className="text-sm font-medium text-gray-800">Product Variations</h4>
                    <p className="text-xs text-gray-600">
                      Add variation dimensions (e.g. Size, Color). For each dimension, add option values shown to customers. You can set optional price, stock, and image per option.
                    </p>

                    {formData.variations.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-gray-700">Added variations</p>
                        {formData.variations.map((v, varIdx) => (
                          <div key={varIdx} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                            <span className="font-medium text-gray-800">{v.name}</span>
                            <span className="text-xs text-gray-500">
                              {v.options.map((o) => o.value).join(', ')}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeVariation(varIdx)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="p-3 bg-white border border-gray-200 rounded space-y-3">
                      <p className="text-xs font-medium text-gray-700">Add a variation</p>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Variation name (e.g. Size, Color)</label>
                        <input
                          type="text"
                          value={currentVariation.name}
                          onChange={(e) => setCurrentVariation((prev) => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          placeholder="Size"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs text-gray-600">
                            Option values — the label shown to customers (e.g. S, M, L or Red, Blue)
                          </label>
                          <button
                            type="button"
                            onClick={addVariationOption}
                            className="text-xs text-purple-600 hover:text-purple-800"
                          >
                            + Add option
                          </button>
                        </div>
                        <div className="space-y-2">
                          {currentVariation.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex flex-wrap items-center gap-2 p-2 border border-gray-100 rounded bg-gray-50">
                              <input
                                type="text"
                                value={opt.value}
                                onChange={(e) => updateVariationOption(optIdx, 'value', e.target.value)}
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                                placeholder="Value"
                              />
                              <input
                                type="number"
                                value={opt.price ?? ''}
                                onChange={(e) => updateVariationOption(optIdx, 'price', e.target.value ? Number(e.target.value) : undefined)}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                placeholder="Price"
                                min={0}
                                step={0.01}
                              />
                              <input
                                type="number"
                                value={opt.stock ?? ''}
                                onChange={(e) => updateVariationOption(optIdx, 'stock', e.target.value ? Number(e.target.value) : undefined)}
                                className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                                placeholder="Stock"
                                min={0}
                              />
                              <label className="inline-flex items-center gap-1 text-xs text-purple-600 cursor-pointer">
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
                                  <img src={opt.imageUrl} alt="" className="w-8 h-8 object-cover rounded" />
                                  <button type="button" onClick={() => updateVariationOption(optIdx, 'imageUrl', undefined)} className="text-red-600 text-xs">Clear</button>
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => removeVariationOption(optIdx)}
                                className="text-red-600 hover:text-red-800 text-xs"
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
                        className="px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                      >
                        Add variation
                      </button>
                    </div>
                  </div>
                )}
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

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Products are created as DRAFT status. After creation, use the Price Management interface to set pricing, stock, and tax information before activating the product.
                </p>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Product (DRAFT)'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/admin/products')}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
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
