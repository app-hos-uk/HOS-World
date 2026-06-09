import { BlogCard } from './BlogCard';

interface RelatedPostsProps {
  posts: Array<{
    slug: string;
    title: string;
    excerpt: string;
    coverImage?: string | null;
    coverImageAlt?: string | null;
    author: string;
    publishedAt?: string | null;
    readingTime?: number | null;
    category?: { name: string; slug: string } | null;
  }>;
}

export function RelatedPosts({ posts }: RelatedPostsProps) {
  if (!posts.length) return null;

  return (
    <section className="mt-12 pt-8 border-t border-hos-border">
      <h2 className="text-xl font-semibold text-hos-text-secondary mb-6">Related Articles</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {posts.map((post) => (
          <BlogCard key={post.slug} post={post} />
        ))}
      </div>
    </section>
  );
}
