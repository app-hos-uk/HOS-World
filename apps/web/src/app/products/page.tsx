import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function ProductsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">All Products</h1>
        <p className="text-lg text-gray-600 mb-8">
          Browse our collection of magical items from your favorite fandoms
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Products will be loaded here */}
          <div className="text-center text-gray-500 py-12">
            Products coming soon...
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

