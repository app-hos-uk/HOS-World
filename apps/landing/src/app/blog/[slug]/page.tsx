import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { LandingShell } from '../../components/LandingShell';
import { LandingFooter } from '../../components/LandingFooter';
import { getBlogPost, getStrapiMediaUrl } from '@/lib/strapi';

const BLOG_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'a', 'code', 'pre', 'span', 'div', 'hr',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'img', 'figure', 'figcaption', 'video', 'source',
    'iframe', 'section', 'article',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'loading'],
    iframe: ['src', 'width', 'height', 'frameborder', 'allowfullscreen'],
    video: ['src', 'controls', 'width', 'height'],
    source: ['src', 'type'],
    '*': ['class', 'id'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedIframeHostnames: ['www.youtube.com', 'player.vimeo.com'],
};

function ensureHtml(content: string): string {
  const hasBlockTags = /<(p|h[1-6]|div|ul|ol|blockquote|table|figure)\b/i.test(content);
  const html = hasBlockTags ? content : (marked.parse(content, { async: false }) as string);
  return sanitizeHtml(html, BLOG_SANITIZE_OPTIONS);
}

export const revalidate = 60;

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
    <LandingShell nav="blog" mainId="pg-blog-post">
      <main id="pg-blog-post" className="hos-page blog-post-page" tabIndex={-1}>
        <article className="blog-article">
          <header className="blog-article-header rv">
            <Link href="/blog" className="blog-back-link">
              ← Back to Blog
            </Link>

            {post.attributes.category?.data && (
              <Link
                href={`/blog?category=${post.attributes.category.data.attributes.slug}`}
                className="blog-article-category"
              >
                {post.attributes.category.data.attributes.name}
              </Link>
            )}

            <h1 className="blog-article-title">{post.attributes.title}</h1>

            <div className="blog-article-meta">
              <span>By {post.attributes.author}</span>
              <span aria-hidden="true">•</span>
              <time dateTime={post.attributes.publishedAt}>
                {new Date(post.attributes.publishedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </time>
              {post.attributes.readingTime ? (
                <>
                  <span aria-hidden="true">•</span>
                  <span>{post.attributes.readingTime} min read</span>
                </>
              ) : null}
            </div>

            {coverUrl && (
              <div className="blog-article-cover">
                <img
                  src={getStrapiMediaUrl(coverUrl)}
                  alt={
                    post.attributes.coverImage?.data?.attributes?.alternativeText ||
                    post.attributes.title
                  }
                />
              </div>
            )}
          </header>

          <div
            className="blog-article-content rv"
            dangerouslySetInnerHTML={{ __html: ensureHtml(post.attributes.content) }}
          />

          <footer className="blog-article-footer rv">
            <Link href="/blog" className="btn-g">
              ← More Articles
            </Link>
            <Link href="/founding-members" className="btn-p">
              Join Founding Members
            </Link>
          </footer>
        </article>

        <LandingFooter />
      </main>
    </LandingShell>
  );
}
