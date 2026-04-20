'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';

export default function QuizListPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .listQuizzes()
      .then((r) => setItems((r.data as any[]) || []))
      .catch((e: any) => setError(e?.message || 'Could not load quizzes'))
      .finally(() => setLoading(false));
  }, []);

  const fandoms = [...new Set(items.map((q) => q.fandom?.name).filter(Boolean))];
  const [filter, setFilter] = useState<string | null>(null);
  const visible = filter ? items.filter((q) => q.fandom?.name === filter) : items;

  return (
    <RouteGuard allowedRoles={['CUSTOMER']}>
      <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl">
          <Link href="/loyalty" className="text-amber-500 text-sm font-secondary mb-4 inline-block">
            ← Loyalty
          </Link>
          <h1 className="font-primary text-2xl text-amber-100 mb-4">Fandom quizzes</h1>

          {fandoms.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                type="button"
                onClick={() => setFilter(null)}
                className={`text-xs rounded-full px-3 py-1 font-secondary border ${!filter ? 'border-amber-600 text-amber-200 bg-amber-900/30' : 'border-stone-700 text-stone-400 hover:border-stone-500'}`}
              >
                All
              </button>
              {fandoms.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f!)}
                  className={`text-xs rounded-full px-3 py-1 font-secondary border ${filter === f ? 'border-amber-600 text-amber-200 bg-amber-900/30' : 'border-stone-700 text-stone-400 hover:border-stone-500'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <p className="font-secondary text-stone-500">Loading…</p>
          ) : error ? (
            <p className="font-secondary text-red-400">{error}</p>
          ) : visible.length === 0 ? (
            <p className="font-secondary text-stone-500">No quizzes available yet.</p>
          ) : (
            <ul className="space-y-3">
              {visible.map((q) => (
                <li key={q.id}>
                  <Link
                    href={`/quiz/${q.id}`}
                    className="block rounded-lg border border-stone-800 bg-stone-900/50 p-4 hover:border-amber-900/50"
                  >
                    <p className="font-primary text-amber-200">{q.title}</p>
                    <p className="text-sm text-stone-500 font-secondary">
                      {q.fandom?.name ?? 'Fandom'} · {q.difficulty} · {q.pointsReward} pts
                    </p>
                    {q.description && (
                      <p className="text-xs text-stone-600 font-secondary mt-1 line-clamp-2">{q.description}</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
