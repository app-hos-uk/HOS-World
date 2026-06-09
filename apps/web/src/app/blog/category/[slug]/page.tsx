import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { BlogCard } from '@/components/blog/BlogCard';
import { getCategoryBySlug } from '@/lib/blog';
import type { Metadata } from 'next';

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCategoryBySlug(slug);
  if (!data?.category) return { title: 'Category Not Found' };

  return {
    title: `${data.category.name} — Blog`,
    description: data.category.description || `Articles in the ${data.category.name} category.`,
  };
}

export default async function BlogCategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const data = await getCategoryBySlug(slug);
  if (!data?.category) notFound();

  const { category, posts: postsResult } = data;
  const posts = postsResult?.posts ?? [];

  return (
    <div className="min-h-screen bg-hos-bg">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="max-w-6xl mx-auto">
          <nav className="text-sm text-hos-text-muted mb-4">
            <Link href="/blog" className="hover:text-hos-gold">Blog</Link>
            <span className="mx-2">/</span>
            <span>{category.name}</span>
          </nav>

          <h1 className="text-3xl lg:text-4xl font-bold text-hos-text-secondary mb-2">{category.name}</h1>
          {category.description && (
            <p className="text-hos-text-muted mb-8">{category.description}</p>
          )}

          {posts.length === 0 ? (
            <div className="text-center py-16 text-hos-text-muted">
              <p>No articles in this category yet.</p>
              <Link href="/blog" className="text-hos-gold hover:underline text-sm mt-2 inline-block">
                Browse all articles
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
