'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function PaymentContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      // TODO: Fetch order details with seller information revealed
      // This should call the payments API which reveals seller info
      fetch(`/api/orders/${orderId}`)
        .then((res) => res.json())
        .then((data) => {
          setOrder(data);
          setLoading(false);
        })
        .catch((error) => {
          console.error('Error fetching order:', error);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <p>Loading order details...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold mb-8">Order Not Found</h1>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Complete Payment</h1>
        
        {/* Seller Information - Revealed at Payment Page */}
        {order.seller && (
          <div className="bg-gray-50 border rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Seller Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Store Name</p>
                <p className="font-medium">{order.seller.storeName}</p>
              </div>
              {order.seller.location && (
                <>
                  <div>
                    <p className="text-sm text-gray-600">Location</p>
                    <p className="font-medium">{order.seller.location.city}, {order.seller.location.country}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Order Summary */}
        <div className="bg-white border rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
          <div className="space-y-2">
            {order.items?.map((item: any, index: number) => (
              <div key={index} className="flex justify-between">
                <span>{item.product?.name || 'Product'} x {item.quantity}</span>
                <span>${item.price * item.quantity}</span>
              </div>
            ))}
          </div>
          <div className="border-t mt-4 pt-4">
            <div className="flex justify-between mb-2">
              <span>Subtotal</span>
              <span>${order.subtotal}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span>Tax</span>
              <span>${order.tax}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>${order.total}</span>
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Payment Details</h2>
          <p className="text-gray-600 mb-6">Payment integration coming soon...</p>
          <button className="w-full bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors">
            Complete Payment
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <p>Loading...</p>
        </main>
        <Footer />
      </div>
    }>
      <PaymentContent />
    </Suspense>
  );
}

