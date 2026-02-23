'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';

interface KBArticle {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  category?: string;
  helpfulCount?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export default function KnowledgeBasePage() {
  const toast = useToast();
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const fetchArticles = useCallback(async (search?: string) => {
    try {
      setLoading(true);
      const response = await apiClient.getKBArticles(search || undefined);
      if (response?.data) {
        const data = Array.isArray(response.data) ? response.data : [];
        setArticles(data);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load articles');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => {
      fetchArticles(value.trim());
    }, 400);
    setSearchTimeout(timeout);
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Knowledge Base</h1>
            <p className="text-gray-600">Find answers to common questions and guides</p>
          </div>

          {/* Search */}
          <div className="relative mb-8">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search articles..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); fetchArticles(); }}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Articles */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <p className="text-gray-600 mb-2">
                {searchQuery ? 'No articles match your search' : 'No articles available yet'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); fetchArticles(); }}
                  className="text-purple-600 hover:text-purple-800 font-medium text-sm"
                >
                  Clear search
                </button>
              )}
              <div className="mt-6">
                <p className="text-sm text-gray-500 mb-2">Can&apos;t find what you need?</p>
                <Link
                  href="/support/new"
                  className="inline-block px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors"
                >
                  Contact Support
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/support/kb/${article.slug}`}
                  className="block bg-white border border-gray-200 rounded-lg p-5 hover:border-purple-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1 hover:text-purple-600">
                        {article.title}
                      </h3>
                      {article.excerpt && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{article.excerpt}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {article.category && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                            {article.category}
                          </span>
                        )}
                        {typeof article.helpfulCount === 'number' && article.helpfulCount > 0 && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                            </svg>
                            {article.helpfulCount} found helpful
                          </span>
                        )}
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Link to Help Center */}
          {!loading && (
            <div className="mt-8 text-center">
              <Link href="/help" className="text-purple-600 hover:text-purple-800 font-medium text-sm">
                &larr; Back to Help Center
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
