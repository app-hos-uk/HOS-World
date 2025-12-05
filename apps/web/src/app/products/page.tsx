import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function ProductsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6 lg:mb-8">All Products</h1>
        <p className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8">
          Browse our collection of magical items from your favorite fandoms
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {/* Products will be loaded here */}
          <div className="text-center text-sm sm:text-base text-gray-500 py-8 sm:py-12">
            Products coming soon...
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

