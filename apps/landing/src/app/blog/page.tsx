import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getBlogPosts, getBlogCategories, getStrapiMediaUrl } from '@/lib/strapi';
import { LandingNav } from '../components/LandingNav';
import { LandingFooter } from '../components/LandingFooter';

export const metadata: Metadata = {
  title: 'Blog | House of Spells',
  description: 'Stories, guides, and news from the House of Spells fandom universe.',
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string }>;
}) {
  const params = await searchParams;
  const page = params.page ? parseInt(params.page, 10) : 1;
  const category = params.category || undefined;

  const [postsResponse, categoriesResponse] = await Promise.all([
    getBlogPosts({ page, pageSize: 12, category }),
    getBlogCategories(),
  ]);

  const posts = postsResponse?.data || [];
  const categories = categoriesResponse?.data || [];
  const pagination = postsResponse?.meta?.pagination;

  return (
    <>
      <LandingNav active="blog" />
      <main className="min-h-screen bg-[#05050D] pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <header className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              The Spellbook
            </h1>
            <p className="text-[#b8a87a] text-lg max-w-2xl mx-auto">
              Stories, guides, and news from the multi-fandom universe
            </p>
          </header>

          {categories.length > 0 && (
            <nav className="flex flex-wrap justify-center gap-3 mb-12">
              <Link
                href="/blog"
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
                  !category
                    ? 'bg-[#c9a84c] text-[#1a1406]'
                    : 'border border-[#c9a84c]/30 text-[#c9a84c] hover:border-[#c9a84c]'
                }`}
              >
                All Posts
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/blog?category=${cat.attributes.slug}`}
                  className={`px-4 py-2 rounded-full text-sm transition-colors ${
                    category === cat.attributes.slug
                      ? 'bg-[#c9a84c] text-[#1a1406]'
                      : 'border border-[#c9a84c]/30 text-[#c9a84c] hover:border-[#c9a84c]'
                  }`}
                >
                  {cat.attributes.name}
                </Link>
              ))}
            </nav>
          )}

          {posts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[#b8a87a] text-lg">No articles yet. Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => {
                const coverUrl = post.attributes.coverImage?.data?.attributes?.url;
                return (
                  <article
                    key={post.id}
                    className="bg-[#0a0a14] border border-[#c9a84c]/20 rounded-lg overflow-hidden hover:border-[#c9a84c]/50 transition-colors group"
                  >
                    <Link href={`/blog/${post.attributes.slug}`}>
                      {coverUrl ? (
                        <div className="relative h-48 overflow-hidden">
                          <Image
                            src={getStrapiMediaUrl(coverUrl)}
                            alt={post.attributes.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      ) : (
                        <div className="h-48 bg-gradient-to-br from-[#c9a84c]/20 to-[#0a0a14] flex items-center justify-center">
                          <span className="text-4xl">✨</span>
                        </div>
                      )}
                      <div className="p-6">
                        {post.attributes.category?.data && (
                          <span className="text-xs text-[#c9a84c] uppercase tracking-wider">
                            {post.attributes.category.data.attributes.name}
                          </span>
                        )}
                        <h2 className="text-xl font-semibold text-white mt-2 mb-3 line-clamp-2 group-hover:text-[#c9a84c] transition-colors">
                          {post.attributes.title}
                        </h2>
                        <p className="text-[#8a8a9a] text-sm line-clamp-3">
                          {post.attributes.excerpt}
                        </p>
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#c9a84c]/10">
                          <span className="text-xs text-[#6a6a7a]">
                            {new Date(post.attributes.publishedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          {post.attributes.readingTime && (
                            <span className="text-xs text-[#6a6a7a]">
                              {post.attributes.readingTime} min read
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </article>
                );
              })}
            </div>
          )}

          {pagination && pagination.pageCount > 1 && (
            <nav className="flex justify-center gap-2 mt-12">
              {Array.from({ length: pagination.pageCount }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/blog?page=${p}${category ? `&category=${category}` : ''}`}
                  className={`px-4 py-2 rounded text-sm ${
                    p === page
                      ? 'bg-[#c9a84c] text-[#1a1406]'
                      : 'border border-[#c9a84c]/30 text-[#c9a84c] hover:border-[#c9a84c]'
                  }`}
                >
                  {p}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
