import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { FandomCollection } from '@/components/FandomCollection';

export default function FandomsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6 lg:mb-8">Fandoms</h1>
        <p className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8">
          Explore products from your favorite fandoms
        </p>
        <FandomCollection />
      </main>
      <Footer />
    </div>
  );
}

