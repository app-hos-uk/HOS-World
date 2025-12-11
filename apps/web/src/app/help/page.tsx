'use client';

import dynamic from 'next/dynamic';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

// Lazy load heavy AI component
const AISupportChat = dynamic(() => import('@/components/AISupportChat').then(mod => ({ default: mod.AISupportChat })), {
  loading: () => <div className="text-center py-4">Loading AI support...</div>,
  ssr: false,
});

export default function HelpPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8">Help Center</h1>
        <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Frequently Asked Questions</h2>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <h3 className="text-lg sm:text-xl font-medium mb-2">How do I place an order?</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Browse our products, add items to your cart, and proceed to checkout.
                </p>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-medium mb-2">How can I track my order?</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Once your order ships, you&apos;ll receive a tracking number via email.
                </p>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-medium mb-2">What payment methods do you accept?</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  We accept all major credit cards and PayPal.
                </p>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-medium mb-2">How do I return a product?</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  You can initiate a return request through your order history or by contacting support.
                </p>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-medium mb-2">What is your shipping policy?</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  We offer standard and express shipping options. Shipping times vary by location.
                </p>
              </div>
            </div>
          </section>
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Get Support</h2>
            
            {/* AI Support Chat */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 mb-6">
              <h3 className="text-lg font-semibold mb-3">🤖 AI Support Assistant</h3>
              <p className="text-sm text-gray-600 mb-4">
                Get instant answers to your questions using our AI-powered support assistant, powered by Gemini AI.
              </p>
              <div className="h-[500px]">
                <AISupportChat
                  onEscalate={() => {
                    if (isAuthenticated) {
                      window.location.href = '/support';
                    } else {
                      window.location.href = '/login';
                    }
                  }}
                />
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 sm:p-6 mb-4">
              <h3 className="text-lg font-semibold mb-3">Create a Support Ticket</h3>
              <p className="text-sm sm:text-base text-gray-700 mb-4">
                {isAuthenticated 
                  ? 'Create a support ticket to get personalized help with your account, orders, or products.'
                  : 'Login to create a support ticket and track your requests.'}
              </p>
              {isAuthenticated ? (
                <Link
                  href="/support"
                  className="inline-block px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  Go to Support Center →
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="inline-block px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  Login to Get Support →
                </Link>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium mb-2">📧 Email Support</h3>
                <p className="text-sm text-gray-600">support@houseofspells.com</p>
                <p className="text-xs text-gray-500 mt-1">Response within 24 hours</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium mb-2">📞 Phone Support</h3>
                <p className="text-sm text-gray-600">1-800-HOS-HELP</p>
                <p className="text-xs text-gray-500 mt-1">Mon-Fri, 9 AM - 5 PM GMT</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium mb-2">💬 WhatsApp</h3>
                <p className="text-sm text-gray-600">Available 24/7</p>
                <p className="text-xs text-gray-500 mt-1">Quick response guaranteed</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium mb-2">📚 Help Articles</h3>
                <p className="text-sm text-gray-600">Browse our knowledge base</p>
                <p className="text-xs text-gray-500 mt-1">Self-service resources</p>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

