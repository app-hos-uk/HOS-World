'use client';

import Link from 'next/link';

const POSTS = [
  {
    date: 'February 18, 2026',
    category: 'Collecting',
    title: 'How to light your display case without damaging delicate paints',
  },
  {
    date: 'February 4, 2026',
    category: 'Events',
    title: 'Convention checklist: packing prints, pins, and panic-free backups',
  },
  {
    date: 'January 22, 2026',
    category: 'Franchises',
    title: 'Starter lines for every fandom on your gift list this term',
  },
];

export default function BlogPreview() {
  return (
    <section className="bg-hos-bg py-16">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="font-display text-white text-2xl md:text-3xl font-bold italic">
              From the grimoire
            </h2>
            <p className="text-hos-text-secondary text-sm mt-1">
              Guides, drops, and fandom essays — starter titles for this demo.
            </p>
          </div>
          <Link
            href="/help"
            className="text-hos-gold text-sm hover:text-hos-gold-hover transition-colors duration-200 shrink-0"
          >
            View all stories →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {POSTS.map((post) => (
            <article
              key={post.title}
              className="bg-hos-bg-secondary border border-hos-border rounded-xl p-6 hover:border-hos-border-accent transition-colors duration-200"
            >
              <div className="flex flex-wrap items-center gap-y-1 text-hos-text-muted text-xs font-ui">
                <time dateTime={post.date}>{post.date}</time>
                <span className="bg-hos-bg-tertiary text-hos-text-secondary px-2 py-0.5 rounded text-[11px] ml-2">
                  {post.category}
                </span>
              </div>
              <Link href="/help">
                <h3 className="text-white text-base font-semibold font-ui mt-2 hover:text-hos-gold transition-colors duration-200 cursor-pointer">
                  {post.title}
                </h3>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
