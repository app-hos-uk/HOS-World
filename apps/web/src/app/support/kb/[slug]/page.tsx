'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';

interface KBArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  category?: string;
  helpfulCount?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  relatedArticles?: Array<{
    id: string;
    title: string;
    slug: string;
    excerpt?: string;
  }>;
}

function sanitizeHtml(html: string): string {
  let cleaned = html.replace(/<\s*(script|iframe|object|embed|form|input|textarea|button|select|applet|base|link|meta)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '');
  cleaned = cleaned.replace(/<\s*(script|iframe|object|embed|form|input|textarea|button|select|applet|base|link|meta)\b[^>]*\/?>/gi, '');
  cleaned = cleaned.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  cleaned = cleaned.replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '');
  return cleaned;
}

export default function KBArticlePage() {
  const params = useParams();
  const slug = params.slug as string;
  const toast = useToast();
  const [article, setArticle] = useState<KBArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [markedHelpful, setMarkedHelpful] = useState(false);
  const [helpfulSubmitting, setHelpfulSubmitting] = useState(false);

  useEffect(() => {
    if (slug) fetchArticle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const fetchArticle = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getKBArticleBySlug(slug);
      if (response?.data) {
        setArticle(response.data);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load article');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkHelpful = async () => {
    if (!article || markedHelpful || helpfulSubmitting) return;
    try {
      setHelpfulSubmitting(true);
      await apiClient.markKBArticleHelpful(article.id);
      setMarkedHelpful(true);
      setArticle((prev) => prev ? { ...prev, helpfulCount: (prev.helpfulCount || 0) + 1 } : prev);
      toast.success('Thanks for your feedback!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit feedback');
    } finally {
      setHelpfulSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="max-w-3xl mx-auto">
          <Link href="/support/kb" className="text-purple-600 hover:text-purple-800 mb-6 inline-flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Knowledge Base
          </Link>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          ) : !article ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-600 mb-4">Article not found</p>
              <Link href="/support/kb" className="text-purple-600 hover:text-purple-800 font-medium">
                Browse all articles
              </Link>
            </div>
          ) : (
            <>
              {/* Article Header */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  {article.category && (
                    <span className="px-2.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                      {article.category}
                    </span>
                  )}
                  {article.updatedAt && (
                    <span className="text-xs text-gray-500">
                      Updated {new Date(article.updatedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
                  {article.title}
                </h1>
              </div>

              {/* Article Content */}
              <div
                className="prose prose-gray prose-lg max-w-none mb-8
                  prose-headings:text-gray-900
                  prose-a:text-purple-600 prose-a:no-underline hover:prose-a:underline
                  prose-img:rounded-lg
                  prose-code:text-purple-700 prose-code:bg-purple-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content) }}
              />

              {/* Helpful Section */}
              <div className="border-t border-gray-200 pt-6 mb-8">
                <div className="bg-gray-50 rounded-xl p-6 text-center">
                  <p className="text-gray-700 font-medium mb-3">Was this article helpful?</p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={handleMarkHelpful}
                      disabled={markedHelpful || helpfulSubmitting}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
                        markedHelpful
                          ? 'bg-green-100 text-green-700 cursor-default'
                          : 'bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50'
                      }`}
                    >
                      <svg className="w-5 h-5" fill={markedHelpful ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                      </svg>
                      {markedHelpful ? 'Thanks!' : helpfulSubmitting ? 'Submitting...' : 'Yes, helpful'}
                    </button>
                    <Link
                      href="/support/new"
                      className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors"
                    >
                      Still need help?
                    </Link>
                  </div>
                  {typeof article.helpfulCount === 'number' && article.helpfulCount > 0 && (
                    <p className="text-sm text-gray-500 mt-3">
                      {article.helpfulCount} {article.helpfulCount === 1 ? 'person' : 'people'} found this helpful
                    </p>
                  )}
                </div>
              </div>

              {/* Related Articles */}
              {article.relatedArticles && article.relatedArticles.length > 0 && (
                <div className="border-t border-gray-200 pt-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Related Articles</h2>
                  <div className="space-y-3">
                    {article.relatedArticles.map((related) => (
                      <Link
                        key={related.id}
                        href={`/support/kb/${related.slug}`}
                        className="block bg-gray-50 border border-gray-200 rounded-lg p-4 hover:border-purple-300 hover:bg-purple-50 transition-all"
                      >
                        <h3 className="font-medium text-gray-900">{related.title}</h3>
                        {related.excerpt && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-1">{related.excerpt}</p>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
