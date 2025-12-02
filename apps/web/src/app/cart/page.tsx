import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import Link from 'next/link';

export default function CartPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8 font-primary text-purple-900">Shopping Cart</h1>
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-lg text-gray-600 mb-4 font-secondary">Your cart is empty</p>
          <Link 
            href="/products" 
            className="inline-block px-6 py-3 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all duration-300 font-primary"
          >
            Browse Products
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

