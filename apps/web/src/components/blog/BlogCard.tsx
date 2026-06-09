import Link from 'next/link';
import Image from 'next/image';

interface BlogCardProps {
  post: {
    slug: string;
    title: string;
    excerpt: string;
    coverImage?: string | null;
    coverImageAlt?: string | null;
    author: string;
    publishedAt?: string | null;
    readingTime?: number | null;
    category?: { name: string; slug: string } | null;
  };
}

export function BlogCard({ post }: BlogCardProps) {
  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <article className="group flex flex-col bg-hos-bg-secondary border border-hos-border rounded-xl overflow-hidden hover:border-hos-gold-dim transition-colors">
      <Link href={`/blog/${post.slug}`} className="block relative aspect-[16/9] overflow-hidden">
        {post.coverImage ? (
          <Image
            src={post.coverImage}
            alt={post.coverImageAlt || post.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, 33vw"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-hos-bg-tertiary flex items-center justify-center text-hos-text-muted text-sm">
            No image
          </div>
        )}
      </Link>
      <div className="p-5 flex flex-col flex-1">
        {post.category && (
          <Link
            href={`/blog/category/${post.category.slug}`}
            className="text-xs text-hos-gold uppercase tracking-wide mb-2 hover:underline"
          >
            {post.category.name}
          </Link>
        )}
        <Link href={`/blog/${post.slug}`}>
          <h2 className="text-lg font-semibold text-hos-text-secondary group-hover:text-hos-gold transition-colors line-clamp-2">
            {post.title}
          </h2>
        </Link>
        <p className="text-sm text-hos-text-muted mt-2 line-clamp-3 flex-1">{post.excerpt}</p>
        <div className="flex items-center gap-3 mt-4 text-xs text-hos-text-muted">
          <span>{post.author}</span>
          {date && <span>{date}</span>}
          {post.readingTime && <span>{post.readingTime} min read</span>}
        </div>
      </div>
    </article>
  );
}
