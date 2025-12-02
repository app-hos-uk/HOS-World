import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function SellersPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Sellers</h1>
        <p className="text-lg text-gray-600 mb-8">
          Browse our marketplace sellers and their collections
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center text-gray-500 py-12">
            Sellers directory coming soon...
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

