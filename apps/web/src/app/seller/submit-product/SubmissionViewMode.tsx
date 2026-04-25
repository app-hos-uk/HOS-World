'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { getSellerMenuItems } from '@/lib/sellerMenu';
import Image from 'next/image';

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

export function SubmissionViewMode({ submissionId }: { submissionId: string }) {
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
