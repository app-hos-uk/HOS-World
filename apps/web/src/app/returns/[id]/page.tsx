'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';

export default function ReturnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const toast = useToast();
  const id = params?.id as string;
  const [returnRequest, setReturnRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchReturn = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getReturn(id);
        if (response?.data) {
          setReturnRequest(response.data);
        } else {
          setError('Return request not found');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load return request');
      } finally {
        setLoading(false);
      }
    };
    fetchReturn();
  }, [id]);

  const handleCancelReturn = async () => {
    if (!confirm('Are you sure you want to cancel this return request?')) return;
    try {
      setCancelLoading(true);
      await apiClient.cancelReturn(id);
      toast.success('Return request cancelled');
      router.push('/returns');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel return request');
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['CUSTOMER', 'ADMIN']}>
        <div className="min-h-screen bg-white">
          <Header />
          <main className="container mx-auto px-4 py-12">
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
            </div>
          </main>
          <Footer />
        </div>
      </RouteGuard>
    );
  }

  if (error || !returnRequest) {
    return (
      <RouteGuard allowedRoles={['CUSTOMER', 'ADMIN']}>
        <div className="min-h-screen bg-white">
          <Header />
          <main className="container mx-auto px-4 py-12">
            <div className="max-w-md mx-auto text-center">
              <p className="text-gray-600 mb-4">{error || 'Return request not found'}</p>
              <Link href="/returns" className="text-purple-600 hover:text-purple-800 font-medium">
                ← Back to Returns
              </Link>
            </div>
          </main>
          <Footer />
        </div>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['CUSTOMER', 'ADMIN']}>
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="max-w-2xl mx-auto">
            <Link href="/returns" className="text-purple-600 hover:text-purple-800 mb-4 inline-block">
              ← Back to Returns
            </Link>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h1 className="text-2xl font-bold mb-6">Return Request Details</h1>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                      {returnRequest.status || 'N/A'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Reason</dt>
                  <dd className="mt-1 text-gray-900">{returnRequest.reason || 'N/A'}</dd>
                </div>
                {returnRequest.notes && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Notes</dt>
                    <dd className="mt-1 text-gray-900">{returnRequest.notes}</dd>
                  </div>
                )}
                {returnRequest.refundAmount != null && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Refund Amount</dt>
                    <dd className="mt-1 text-lg font-semibold text-green-600">
                      {formatPrice(Number(returnRequest.refundAmount), returnRequest.currency || 'GBP')}
                    </dd>
                  </div>
                )}
                {returnRequest.refundMethod && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Refund Method</dt>
                    <dd className="mt-1 text-gray-900">{returnRequest.refundMethod}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-gray-900">
                    {returnRequest.createdAt
                      ? new Date(returnRequest.createdAt).toLocaleString()
                      : 'N/A'}
                  </dd>
                </div>
              </dl>

              {returnRequest.status === 'PENDING' && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={handleCancelReturn}
                    disabled={cancelLoading}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
                  >
                    {cancelLoading ? 'Cancelling...' : 'Cancel Return'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
