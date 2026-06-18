import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getBlogPost, getBlogPosts, getStrapiMediaUrl } from '@/lib/strapi';
import { LandingNav } from '../../components/LandingNav';
import { LandingFooter } from '../../components/LandingFooter';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const response = await getBlogPost(slug);
  const post = response?.data?.[0];

  if (!post) {
    return { title: 'Post Not Found | House of Spells' };
  }

  return {
    title: post.attributes.seoTitle || `${post.attributes.title} | House of Spells`,
    description: post.attributes.metaDescription || post.attributes.excerpt,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const response = await getBlogPost(slug);
  const post = response?.data?.[0];

  if (!post) {
    notFound();
  }

  const coverUrl = post.attributes.coverImage?.data?.attributes?.url;

  return (
    <>
      <LandingNav active="blog" />
      <main className="min-h-screen bg-[#05050D] pt-24 pb-16">
        <article className="container mx-auto px-4 max-w-4xl">
          <header className="mb-8">
            <Link
              href="/blog"
              className="inline-flex items-center text-[#c9a84c] hover:text-[#d4b85c] mb-6 text-sm"
            >
              <span className="mr-2">←</span> Back to Blog
            </Link>

            {post.attributes.category?.data && (
              <Link
                href={`/blog?category=${post.attributes.category.data.attributes.slug}`}
                className="inline-block text-xs text-[#c9a84c] uppercase tracking-wider mb-4 hover:underline"
              >
                {post.attributes.category.data.attributes.name}
              </Link>
            )}

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
              {post.attributes.title}
            </h1>

            <div className="flex items-center gap-4 text-sm text-[#8a8a9a] mb-8">
              <span>By {post.attributes.author}</span>
              <span>•</span>
              <time dateTime={post.attributes.publishedAt}>
                {new Date(post.attributes.publishedAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </time>
              {post.attributes.readingTime && (
                <>
                  <span>•</span>
                  <span>{post.attributes.readingTime} min read</span>
                </>
              )}
            </div>

            {coverUrl && (
              <div className="relative aspect-[16/9] rounded-lg overflow-hidden mb-8">
                <Image
                  src={getStrapiMediaUrl(coverUrl)}
                  alt={post.attributes.coverImage?.data?.attributes?.alternativeText || post.attributes.title}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            )}
          </header>

          <div
            className="prose prose-invert prose-lg max-w-none
              prose-headings:text-white prose-headings:font-semibold
              prose-p:text-[#c8c8d8] prose-p:leading-relaxed
              prose-a:text-[#c9a84c] prose-a:no-underline hover:prose-a:underline
              prose-strong:text-white
              prose-blockquote:border-l-[#c9a84c] prose-blockquote:text-[#a8a8b8]
              prose-code:text-[#c9a84c] prose-code:bg-[#1a1a24] prose-code:px-1 prose-code:rounded
              prose-pre:bg-[#0a0a14] prose-pre:border prose-pre:border-[#c9a84c]/20
              prose-img:rounded-lg
              prose-hr:border-[#c9a84c]/20"
            dangerouslySetInnerHTML={{ __html: post.attributes.content }}
          />

          <footer className="mt-12 pt-8 border-t border-[#c9a84c]/20">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Link
                href="/blog"
                className="inline-flex items-center px-6 py-3 border border-[#c9a84c] text-[#c9a84c] rounded-lg hover:bg-[#c9a84c] hover:text-[#1a1406] transition-colors"
              >
                <span className="mr-2">←</span> More Articles
              </Link>
              <Link
                href="/founding-members"
                className="inline-flex items-center px-6 py-3 bg-[#c9a84c] text-[#1a1406] rounded-lg hover:bg-[#d4b85c] transition-colors"
              >
                Join Founding Members
              </Link>
            </div>
          </footer>
        </article>
      </main>
      <LandingFooter />
    </>
  );
}
