import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { FandomsPageSearch } from './FandomsPageSearch';

export default function FandomsPage() {
  return (
    <div className="min-h-screen bg-hos-bg-secondary">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">Fandoms</h1>
        <p className="text-base sm:text-lg text-hos-text-secondary mb-6 sm:mb-8">
          Explore products from your favorite fandoms
        </p>
        <FandomsPageSearch />
      </main>
      <Footer />
    </div>
  );
}
