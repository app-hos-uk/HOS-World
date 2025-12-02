import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { FandomCollection } from '@/components/FandomCollection';

export default function FandomsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Fandoms</h1>
        <p className="text-lg text-gray-600 mb-8">
          Explore products from your favorite fandoms
        </p>
        <FandomCollection />
      </main>
      <Footer />
    </div>
  );
}

