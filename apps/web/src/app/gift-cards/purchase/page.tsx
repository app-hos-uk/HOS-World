'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';
import Link from 'next/link';

const GIFT_CARD_AMOUNTS = [25, 50, 100, 250, 500];

export default function PurchaseGiftCardPage() {
  const router = useRouter();
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [formData, setFormData] = useState({
    type: 'digital' as 'digital' | 'physical',
    amount: 50,
    customAmount: '',
    currency: 'GBP',
    issuedToEmail: '',
    issuedToName: '',
    message: '',
    expiresAt: '',
  });

  const handleRequestConfirmation = (e: React.FormEvent) => {
    e.preventDefault();

    const amount = formData.customAmount ? parseFloat(formData.customAmount) : formData.amount;

    if (!amount || amount < 1) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (formData.type === 'digital' && !formData.issuedToEmail) {
      toast.error('Email is required for digital gift cards');
      return;
    }

    setShowConfirmation(true);
  };

  const handleConfirmedPurchase = async () => {
    const amount = formData.customAmount ? parseFloat(formData.customAmount) : formData.amount;

    try {
      setLoading(true);
      const response = await apiClient.createGiftCard({
        type: formData.type,
        amount,
        currency: formData.currency,
        issuedToEmail: formData.issuedToEmail || undefined,
        issuedToName: formData.issuedToName || undefined,
        message: formData.message || undefined,
        expiresAt: formData.expiresAt || undefined,
      });

      if (response?.data) {
        if (response.data.orderId) {
          toast.success('Gift card created! Redirecting to payment...');
          router.push(`/payment?orderId=${response.data.orderId}`);
        } else {
          toast.success('Gift card purchased successfully! The amount will be charged to your card on file.');
          router.push(`/gift-cards/${response.data.id}`);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create gift card');
    } finally {
      setLoading(false);
      setShowConfirmation(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['CUSTOMER', 'ADMIN']} showAccessDenied={true}>
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <Link href="/profile" className="text-purple-600 hover:text-purple-800 mb-4 inline-block">
                ← Back to Profile
              </Link>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h1 className="text-3xl font-bold mb-6">Purchase Gift Card</h1>
              
              <form onSubmit={handleRequestConfirmation} className="space-y-6">
                {/* Gift Card Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gift Card Type *
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      formData.type === 'digital' ? 'border-purple-600 bg-purple-50' : 'border-gray-300'
                    }`}>
                      <input
                        type="radio"
                        value="digital"
                        checked={formData.type === 'digital'}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as 'digital' | 'physical' })}
                        className="mr-2"
                      />
                      <div>
                        <div className="font-medium">Digital</div>
                        <div className="text-sm text-gray-600">Sent via email</div>
                      </div>
                    </label>
                    <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      formData.type === 'physical' ? 'border-purple-600 bg-purple-50' : 'border-gray-300'
                    }`}>
                      <input
                        type="radio"
                        value="physical"
                        checked={formData.type === 'physical'}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as 'physical' | 'digital' })}
                        className="mr-2"
                      />
                      <div>
                        <div className="font-medium">Physical</div>
                        <div className="text-sm text-gray-600">Shipped to address</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Amount Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount *
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-3">
                    {GIFT_CARD_AMOUNTS.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, amount, customAmount: '' });
                        }}
                        className={`px-4 py-2 border-2 rounded-lg font-medium transition-colors ${
                          formData.amount === amount && !formData.customAmount
                            ? 'border-purple-600 bg-purple-50 text-purple-700'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {formatPrice(amount, formData.currency)}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Or enter custom amount</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={formData.customAmount}
                      onChange={(e) => {
                        setFormData({ ...formData, customAmount: e.target.value, amount: 0 });
                      }}
                      placeholder="Enter amount"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                {/* Currency */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Currency *
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="GBP">£ GBP (British Pound)</option>
                    <option value="USD">$ USD (US Dollar)</option>
                    <option value="EUR">€ EUR (Euro)</option>
                    <option value="AED">د.إ AED (UAE Dirham)</option>
                  </select>
                </div>

                {/* Recipient Information (for digital) */}
                {formData.type === 'digital' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Recipient Email *
                      </label>
                      <input
                        type="email"
                        value={formData.issuedToEmail}
                        onChange={(e) => setFormData({ ...formData, issuedToEmail: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        placeholder="recipient@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Recipient Name
                      </label>
                      <input
                        type="text"
                        value={formData.issuedToName}
                        onChange={(e) => setFormData({ ...formData, issuedToName: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        placeholder="Recipient's name"
                      />
                    </div>
                  </>
                )}

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Personal Message
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="Add a personal message to your gift card..."
                  />
                </div>

                {/* Expiration Date (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expiration Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty for no expiration
                  </p>
                </div>

                {/* Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Gift Card Amount:</span>
                    <span className="text-xl font-bold text-purple-600">
                      {formatPrice(
                        formData.customAmount ? parseFloat(formData.customAmount) || 0 : formData.amount,
                        formData.currency
                      )}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {formData.type === 'digital' ? 'Digital gift card will be sent via email' : 'Physical gift card will be shipped'}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Purchase Gift Card'}
                  </button>
                  <Link
                    href="/profile"
                    className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium text-center"
                  >
                    Cancel
                  </Link>
                </div>
              </form>
            </div>

            {showConfirmation && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-md w-full p-6">
                  <h2 className="text-xl font-bold mb-4">Confirm Purchase</h2>
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium capitalize">{formData.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-medium text-purple-600">
                        {formatPrice(
                          formData.customAmount ? parseFloat(formData.customAmount) || 0 : formData.amount,
                          formData.currency
                        )}
                      </span>
                    </div>
                    {formData.issuedToEmail && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Recipient:</span>
                        <span className="font-medium">{formData.issuedToEmail}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-6">
                    This amount will be charged to your card on file. Please confirm to proceed.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowConfirmation(false)}
                      disabled={loading}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmedPurchase}
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                    >
                      {loading ? 'Processing...' : 'Confirm Purchase'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
