'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';

// Lazy load heavy form component
const ReturnRequestForm = dynamic(() => import('@/components/ReturnRequestForm').then(mod => ({ default: mod.ReturnRequestForm })), {
  loading: () => <div className="text-center py-4">Loading return form...</div>,
  ssr: false,
});

interface ReturnRequest {
  id: string;
  orderId: string;
  reason: string;
  status: string;
  createdAt: string;
  order?: {
    orderNumber: string;
    total: number;
  };
}

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    loadReturns();
  }, []);

  const loadReturns = async () => {
    try {
      const response = await apiClient.getReturns();
      setReturns(response.data || []);
    } catch (error) {
      console.error('Failed to load returns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReturnSuccess = () => {
    setShowForm(false);
    setSelectedOrderId(null);
    loadReturns();
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8">Returns & Refunds</h1>
        <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
          {showForm ? (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Request a Return</h2>
              <ReturnRequestForm
                orderId={selectedOrderId || ''}
                orderNumber="ORDER-123" // This should come from order selection
                onSuccess={handleReturnSuccess}
                onCancel={() => {
                  setShowForm(false);
                  setSelectedOrderId(null);
                }}
              />
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">My Return Requests</h2>
                <button
                  onClick={() => setShowForm(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Request a Return
                </button>
              </div>

              {loading ? (
                <div className="text-center py-8">Loading returns...</div>
              ) : returns.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>You haven&apos;t submitted any return requests yet.</p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-4 text-blue-600 hover:underline"
                  >
                    Request a return
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {returns.map((returnRequest) => (
                    <div
                      key={returnRequest.id}
                      className="bg-white border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">
                            Order: {returnRequest.order?.orderNumber || returnRequest.orderId}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">{returnRequest.reason}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            Status: <span className="capitalize">{returnRequest.status}</span>
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            returnRequest.status === 'COMPLETED'
                              ? 'bg-green-100 text-green-800'
                              : returnRequest.status === 'APPROVED'
                              ? 'bg-blue-100 text-blue-800'
                              : returnRequest.status === 'REJECTED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {returnRequest.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <section className="mt-8">
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Return Policy</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">
              We want you to be completely satisfied with your purchase. You can return most items
              within 30 days of delivery for a full refund.
            </p>
            <ul className="list-disc list-inside space-y-1.5 sm:space-y-2 text-sm sm:text-base text-gray-600">
              <li>Items must be in original condition with tags attached</li>
              <li>Returns must be initiated within 30 days of delivery</li>
              <li>Original shipping costs are non-refundable</li>
              <li>Custom or personalized items may not be returnable</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">How to Return</h2>
            <ol className="list-decimal list-inside space-y-1.5 sm:space-y-2 text-sm sm:text-base text-gray-600">
              <li>Log into your account and go to &quot;My Orders&quot;</li>
              <li>Select the item you want to return</li>
              <li>Click &quot;Request Return&quot; and follow the instructions</li>
              <li>Print the return label and ship the item back</li>
              <li>Once we receive your return, we&apos;ll process your refund</li>
            </ol>
          </section>
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Refund Processing</h2>
            <p className="text-sm sm:text-base text-gray-600">
              Refunds will be processed to your original payment method within 5-10 business days
              after we receive your return.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

