'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface BlogSearchProps {
  initialQuery?: string;
  initialCategory?: string;
  categories?: Array<{ slug: string; name: string }>;
}

export function BlogSearch({ initialQuery = '', initialCategory = '', categories = [] }: BlogSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (category) params.set('category', category);
    const qs = params.toString();
    router.push(qs ? `/blog?${qs}` : '/blog');
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search articles..."
        className="flex-1 px-4 py-2.5 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
      />
      {categories.length > 0 && (
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-4 py-2.5 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:outline-none focus:border-hos-gold"
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat.slug} value={cat.slug}>{cat.name}</option>
          ))}
        </select>
      )}
      <button
        type="submit"
        className="px-6 py-2.5 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover font-medium"
      >
        Search
      </button>
    </form>
  );
}
