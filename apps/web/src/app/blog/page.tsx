import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { BlogCard } from '@/components/blog/BlogCard';
import { BlogSearch } from '@/components/blog/BlogSearch';
import { getPublishedPosts, getBlogCategories } from '@/lib/blog';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Stories, guides, and news from the House of Spells fandom community.',
};

interface BlogPageProps {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = await searchParams;
  const search = params.q || '';
  const category = params.category || '';
  const page = params.page ? parseInt(params.page, 10) : 1;

  const [postsData, categories] = await Promise.all([
    getPublishedPosts({ search: search || undefined, category: category || undefined, page, limit: 12 }),
    getBlogCategories(),
  ]);

  const posts = postsData?.posts ?? [];
  const totalPages = postsData?.totalPages ?? 1;

  return (
    <div className="min-h-screen bg-hos-bg">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-hos-text-secondary mb-2">Blog</h1>
            <p className="text-hos-text-muted">Stories, guides, and fandom news from House of Spells.</p>
          </div>

          <div className="mb-8">
            <BlogSearch
              initialQuery={search}
              initialCategory={category}
              categories={categories ?? []}
            />
          </div>

          {posts.length === 0 ? (
            <div className="text-center py-16 text-hos-text-muted">
              <p className="text-lg">No articles found.</p>
              {search && <p className="text-sm mt-2">Try a different search term.</p>}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map((post) => (
                  <BlogCard key={post.id} post={post} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-10">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                    const qs = new URLSearchParams();
                    if (search) qs.set('q', search);
                    if (category) qs.set('category', category);
                    if (p > 1) qs.set('page', String(p));
                    const href = qs.toString() ? `/blog?${qs}` : '/blog';
                    return (
                      <a
                        key={p}
                        href={href}
                        className={`px-3 py-1.5 rounded text-sm ${
                          p === page
                            ? 'bg-hos-gold text-[#1a1406]'
                            : 'border border-hos-border text-hos-text-secondary hover:border-hos-gold'
                        }`}
                      >
                        {p}
                      </a>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
