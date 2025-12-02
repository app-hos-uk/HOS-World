import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface FandomDetailPageProps {
  params: {
    slug: string;
  };
}

// Fandom data - in production, this would come from an API
const fandoms: Record<string, { name: string; description: string; slug: string }> = {
  'harry-potter': {
    name: 'Harry Potter',
    description: 'Discover magical items from the wizarding world of Harry Potter',
    slug: 'harry-potter',
  },
  'lord-of-the-rings': {
    name: 'Lord of the Rings',
    description: 'Authentic replicas and collectibles from Middle-earth',
    slug: 'lord-of-the-rings',
  },
  'game-of-thrones': {
    name: 'Game of Thrones',
    description: 'Premium collectibles and merchandise from the Seven Kingdoms',
    slug: 'game-of-thrones',
  },
  'marvel': {
    name: 'Marvel',
    description: 'Superhero merchandise and collectibles from the Marvel Universe',
    slug: 'marvel',
  },
  'star-wars': {
    name: 'Star Wars',
    description: 'Items from a galaxy far, far away',
    slug: 'star-wars',
  },
  'dc-comics': {
    name: 'DC Comics',
    description: 'Superhero collectibles from the DC Universe',
    slug: 'dc-comics',
  },
};

export default function FandomDetailPage({ params }: FandomDetailPageProps) {
  const fandom = fandoms[params.slug];

  if (!fandom) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 py-12">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm">
          <Link href="/" className="text-purple-700 hover:text-amber-600 font-secondary">
            Home
          </Link>
          <span className="mx-2 text-gray-500">/</span>
          <Link href="/fandoms" className="text-purple-700 hover:text-amber-600 font-secondary">
            Fandoms
          </Link>
          <span className="mx-2 text-gray-500">/</span>
          <span className="text-gray-600 font-secondary">{fandom.name}</span>
        </nav>

        {/* Fandom Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 font-primary text-purple-900">
            {fandom.name}
          </h1>
          <p className="text-lg text-purple-700 font-secondary max-w-3xl">
            {fandom.description}
          </p>
        </div>

        {/* Products Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold font-primary text-purple-900">
              Products from {fandom.name}
            </h2>
            <Link
              href={`/products?fandom=${fandom.slug}`}
              className="text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors"
            >
              View All →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Products will be loaded here */}
            <div className="text-center text-gray-500 py-12 col-span-full">
              Products for {fandom.name} coming soon...
            </div>
          </div>
        </div>

        {/* Back to Fandoms */}
        <div className="mt-8">
          <Link
            href="/fandoms"
            className="inline-flex items-center text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors"
          >
            ← Back to All Fandoms
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

// Generate static params for known fandoms
export async function generateStaticParams() {
  return Object.keys(fandoms).map((slug) => ({
    slug,
  }));
}

