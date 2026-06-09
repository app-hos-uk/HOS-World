import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { TableOfContents, injectHeadingIds } from '@/components/blog/TableOfContents';
import { RelatedPosts } from '@/components/blog/RelatedPosts';
import { BlogStructuredData } from '@/components/blog/BlogStructuredData';
import { getPostBySlug } from '@/lib/blog';
import type { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hos-marketplaceweb-production.up.railway.app';

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPostBySlug(slug);
  if (!data?.post) return { title: 'Post Not Found' };

  const post = data.post;
  const title = post.seoTitle || post.title;
  const description = post.metaDescription || post.excerpt;
  const url = post.canonicalUrl || `${SITE_URL}/blog/${post.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: 'article',
      url,
      publishedTime: post.publishedAt || undefined,
      modifiedTime: post.updatedAt || undefined,
      authors: [post.author],
      images: post.coverImage ? [{ url: post.coverImage, alt: post.coverImageAlt || post.title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: post.coverImage ? [post.coverImage] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const data = await getPostBySlug(slug);
  if (!data?.post) notFound();

  const { post, related } = data;
  const contentWithIds = injectHeadingIds(post.contentHtml);
  const publishedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen bg-hos-bg">
      <BlogStructuredData post={post} siteUrl={SITE_URL.replace(/\/$/, '')} />
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <article className="max-w-3xl mx-auto">
          <nav className="text-sm text-hos-text-muted mb-6">
            <Link href="/blog" className="hover:text-hos-gold">Blog</Link>
            {post.category && (
              <>
                <span className="mx-2">/</span>
                <Link href={`/blog/category/${post.category.slug}`} className="hover:text-hos-gold">
                  {post.category.name}
                </Link>
              </>
            )}
          </nav>

          <header className="mb-8">
            {post.category && (
              <Link
                href={`/blog/category/${post.category.slug}`}
                className="text-xs text-hos-gold uppercase tracking-wide hover:underline"
              >
                {post.category.name}
              </Link>
            )}
            <h1 className="text-3xl lg:text-4xl font-bold text-hos-text-secondary mt-2 leading-tight">
              {post.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-4 text-sm text-hos-text-muted">
              <span>By {post.author}</span>
              {publishedDate && <span>{publishedDate}</span>}
              {post.readingTime && <span>{post.readingTime} min read</span>}
            </div>
          </header>

          {post.coverImage && (
            <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden mb-8 border border-hos-border">
              <Image
                src={post.coverImage}
                alt={post.coverImageAlt || post.title}
                title={post.coverImageTitle || undefined}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 768px"
              />
            </div>
          )}

          <TableOfContents contentHtml={post.contentHtml} />

          <div
            className="prose prose-invert max-w-none prose-headings:text-hos-text-secondary prose-p:text-hos-text-muted prose-a:text-hos-gold prose-img:rounded-lg"
            dangerouslySetInnerHTML={{ __html: contentWithIds }}
          />

          <RelatedPosts posts={related ?? []} />
        </article>
      </main>
      <Footer />
    </div>
  );
}
