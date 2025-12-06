'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCurrency } from '@/contexts/CurrencyContext';

function PaymentContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { formatPrice } = useCurrency();

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
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <p className="text-sm sm:text-base">Loading order details...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8">Order Not Found</h1>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 max-w-4xl">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8">Complete Payment</h1>
        
        {/* Seller Information - Revealed at Payment Page */}
        {order.seller && (
          <div className="bg-gray-50 border rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Seller Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
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
        <div className="bg-white border rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Order Summary</h2>
          <div className="space-y-2">
            {order.items?.map((item: any, index: number) => (
              <div key={index} className="flex justify-between">
                <span>{item.product?.name || 'Product'} x {item.quantity}</span>
                <span>{formatPrice(item.price * item.quantity, order.currency || 'GBP')}</span>
              </div>
            ))}
          </div>
          <div className="border-t mt-4 pt-4">
            <div className="flex justify-between mb-2">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotal, order.currency || 'GBP')}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span>Tax</span>
              <span>{formatPrice(order.tax, order.currency || 'GBP')}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>{formatPrice(order.total, order.currency || 'GBP')}</span>
            </div>
            {order.currency && order.currency !== 'GBP' && (
              <p className="text-xs text-gray-500 mt-2">
                Original amount: £{order.total.toFixed(2)} GBP
              </p>
            )}
          </div>
        </div>

        {/* Payment Form */}
        <div className="bg-white border rounded-lg p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Payment Details</h2>
          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">Payment integration coming soon...</p>
          <button className="w-full bg-purple-600 text-white py-2.5 sm:py-3 text-sm sm:text-base rounded-lg font-medium hover:bg-purple-700 transition-colors">
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
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <p className="text-sm sm:text-base">Loading...</p>
        </main>
        <Footer />
      </div>
    }>
      <PaymentContent />
    </Suspense>
  );
}

