'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';

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

export default function SubmitProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [fandoms, setFandoms] = useState<any[]>([]);
  const [loadingFandoms, setLoadingFandoms] = useState(true);
  const [fandomsError, setFandomsError] = useState<string>('');

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
    category: '',
    tags: '',
  });

  const [images, setImages] = useState<ImageUpload[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [currentVariation, setCurrentVariation] = useState<Variation>({
    name: '',
    options: [],
  });
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionValue, setNewOptionValue] = useState('');

  useEffect(() => {
    const loadFandoms = async () => {
      try {
        setLoadingFandoms(true);
        setFandomsError('');
        const response = await apiClient.getFandoms();
        if (response?.data && Array.isArray(response.data)) {
          setFandoms(response.data);
          if (response.data.length === 0) {
            setFandomsError('No fandoms available. You can still submit without selecting a fandom.');
          }
        } else {
          setFandomsError('Unable to load fandoms. You can still submit without selecting a fandom.');
        }
      } catch (err: any) {
        console.error('Error loading fandoms:', err);
        setFandomsError('Unable to load fandoms. You can still submit without selecting a fandom.');
      } finally {
        setLoadingFandoms(false);
      }
    };

    loadFandoms();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
    setError('');
    setSuccess(false);
    setLoading(true);

    // Validation
    if (!formData.name.trim()) {
      setError('Product name is required');
      setLoading(false);
      return;
    }

    if (!formData.description.trim()) {
      setError('Product description is required');
      setLoading(false);
      return;
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      setError('Valid price is required');
      setLoading(false);
      return;
    }

    if (!formData.stock || parseInt(formData.stock) < 0) {
      setError('Valid stock quantity is required');
      setLoading(false);
      return;
    }

    if (images.length === 0) {
      setError('At least one product image is required');
      setLoading(false);
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
        category: formData.category.trim() || undefined,
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
        setTimeout(() => {
          router.push('/seller/dashboard');
        }, 2000);
      } else {
        throw new Error('Failed to create submission');
      }
    } catch (err: any) {
      console.error('Submission error:', err);
      setError(err.message || 'Failed to submit product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    { title: 'Dashboard', href: '/seller/dashboard', icon: '📊' },
    { title: 'Submit Product', href: '/seller/submit-product', icon: '➕' },
    { title: 'My Products', href: '/seller/products', icon: '📦' },
    { title: 'Orders', href: '/seller/orders', icon: '🛒' },
    { title: 'Submissions', href: '/seller/submissions', icon: '📝' },
  ];

  return (
    <RouteGuard allowedRoles={['SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="SELLER" menuItems={menuItems} title="Seller">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
              Submit New Product
            </h1>
            <p className="text-gray-600 mt-2">Submit a new product for review and approval</p>
          </div>

            {success && (
              <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                <p className="font-semibold">Product submitted successfully!</p>
                <p className="text-sm mt-1">Redirecting to dashboard...</p>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                <p className="font-semibold">Error</p>
                <p className="text-sm mt-1">{error}</p>
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
                        <option value="GBP">GBP</option>
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
                        Stock Quantity <span className="text-red-500">*</span>
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

                  <div>
                    <label
                      htmlFor="quantity"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Quantity (for wholesalers)
                    </label>
                    <input
                      type="number"
                      id="quantity"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      min="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Quantity to submit"
                    />
                  </div>
                </div>
              </div>

              {/* Categorization */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8">
                <h2 className="text-xl font-semibold mb-4 sm:mb-6">Categorization</h2>
                <div className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="fandom"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Fandom <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                      </label>
                      {loadingFandoms ? (
                        <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50">
                          Loading fandoms...
                        </div>
                      ) : (
                        <>
                          <select
                            id="fandom"
                            name="fandom"
                            value={formData.fandom}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="">Select a fandom (Optional)</option>
                            {fandoms.map((fandom) => (
                              <option key={fandom.id || fandom.slug} value={fandom.slug || fandom.name}>
                                {fandom.name}
                              </option>
                            ))}
                          </select>
                          {fandomsError && (
                            <p className="mt-1 text-xs text-amber-600">{fandomsError}</p>
                          )}
                          {fandoms.length === 0 && !loadingFandoms && !fandomsError && (
                            <p className="mt-1 text-xs text-gray-500">No fandoms available. This field is optional.</p>
                          )}
                        </>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="category"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Category <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        id="category"
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., Collectibles, Apparel, Accessories (Optional)"
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
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addImage();
                        }
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter image URL"
                    />
                    <button
                      type="button"
                      onClick={addImage}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Add Image
                    </button>
                  </div>

                  {images.length > 0 && (
                    <div className="space-y-3">
                      {images.map((image, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-4 p-3 border border-gray-200 rounded-lg"
                        >
                          <img
                            src={image.url}
                            alt={image.alt || 'Product image'}
                            className="w-20 h-20 object-cover rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://via.placeholder.com/100x100?text=Image+Error';
                            }}
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
        </div>
      </DashboardLayout>
    </RouteGuard>
  );
}

