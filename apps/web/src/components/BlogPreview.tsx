'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

interface BlogPost {
  slug: string;
  title: string;
  publishedAt?: string;
  createdAt?: string;
  category?: { name: string; slug: string };
}

export default function BlogPreview() {
  const [posts, setPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    apiClient
      .getBlogPosts({ limit: 3 })
      .then((res) => {
        const items = res?.data?.posts ?? res?.data ?? [];
        if (Array.isArray(items) && items.length) setPosts(items.slice(0, 3));
      })
      .catch(() => { /* silent – section won't render */ });
  }, []);

  if (posts.length === 0) return null;

  return (
    <section className="bg-hos-bg py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-end justify-between mb-8 gap-4 section-head">
          <div>
            <h2 className="font-display text-hos-gold-hover text-2xl md:text-3xl">
              From the grimoire
            </h2>
            <p className="text-hos-text-muted text-sm mt-1 font-body">
              Guides, drops, and fandom essays from our team.
            </p>
          </div>
          <Link
            href="/blog"
            className="text-hos-gold text-sm font-ui font-semibold hover:text-hos-gold-hover transition-colors shrink-0"
          >
            View all stories →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {posts.map((post) => {
            const dateStr = post.publishedAt || post.createdAt;
            const formatted = dateStr
              ? new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
              : '';
            return (
              <article
                key={post.slug}
                className="bg-hos-bg-secondary border border-hos-border rounded-xl p-6 hover:border-hos-border-accent transition-colors duration-200"
              >
                <div className="flex flex-wrap items-center gap-y-1 text-hos-text-muted text-xs font-ui">
                  {formatted && <time dateTime={dateStr}>{formatted}</time>}
                  {post.category?.name && (
                    <span className="bg-hos-bg-tertiary text-hos-text-secondary px-2 py-0.5 rounded text-[11px] ml-2">
                      {post.category.name}
                    </span>
                  )}
                </div>
                <Link href={`/blog/${post.slug}`}>
                  <h3 className="text-hos-text-secondary text-base font-semibold font-ui mt-2 hover:text-hos-gold transition-colors duration-200 cursor-pointer">
                    {post.title}
                  </h3>
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
