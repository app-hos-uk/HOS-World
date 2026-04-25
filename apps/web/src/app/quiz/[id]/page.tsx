'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function QuizPlayPage() {
  const params = useParams();
  const id = params?.id as string;
  const toast = useToast();
  const [quiz, setQuiz] = useState<any>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const r = await apiClient.getQuiz(id);
      const d = r.data as any;
      setQuiz(d);
      setAnswers(new Array(d?.questions?.length ?? 0).fill(-1));
    } catch (e: any) {
      setError(e?.message || 'Could not load quiz');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!id || answers.some((a) => a < 0)) {
      toast.error('Answer all questions');
      return;
    }
    try {
      const r = await apiClient.submitQuiz(id, answers);
      setResult(r.data);
      toast.success((r.data as any)?.passed ? 'Quiz passed!' : 'Quiz completed');
    } catch (e: any) {
      toast.error(e?.message || 'Submit failed');
    }
  };

  return (
    <RouteGuard allowedRoles={['CUSTOMER']}>
      <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-10 max-w-2xl">
          <Link href="/quiz" className="text-amber-500 text-sm font-secondary mb-4 inline-block">
            ← All quizzes
          </Link>
          {loading ? (
            <p className="font-secondary text-stone-500">Loading…</p>
          ) : error ? (
            <p className="font-secondary text-red-400">{error}</p>
          ) : !quiz ? (
            <p className="font-secondary text-stone-500">Quiz not found.</p>
          ) : result ? (
            <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-6 font-secondary space-y-2">
              <h1 className="font-primary text-xl text-amber-100">{quiz.title}</h1>
              <p>
                Score: {result.score} / {result.totalQuestions}
              </p>
              <p>{result.passed ? 'Passed — points awarded!' : 'Below passing score. Try again next week!'}</p>
              {result.pointsAwarded ? <p className="text-amber-200">+{result.pointsAwarded} points</p> : null}
              {result.correctIndices && (
                <div className="pt-3 border-t border-stone-800 mt-3 space-y-2">
                  <p className="text-stone-500 text-sm">Correct answers:</p>
                  {quiz.questions?.map((q: any, idx: number) => {
                    const correct = result.correctIndices[idx];
                    const yours = answers[idx];
                    const isCorrect = yours === correct;
                    return (
                      <div key={idx} className="text-sm">
                        <p className={isCorrect ? 'text-green-400' : 'text-red-400'}>
                          {idx + 1}. {q.question} — {q.options?.[correct]}
                          {!isCorrect && yours >= 0 && (
                            <span className="text-stone-500 ml-1">(you: {q.options?.[yours]})</span>
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h1 className="font-primary text-2xl text-amber-100">{quiz.title}</h1>
                {quiz.description && <p className="font-secondary text-stone-400 mt-1">{quiz.description}</p>}
                <p className="font-secondary text-stone-500 text-sm mt-1">
                  {quiz.fandomName} · {quiz.difficulty} · {quiz.pointsReward} pts
                </p>
              </div>
              {quiz.questions?.map((q: any, idx: number) => (
                <div key={idx} className="rounded-lg border border-stone-800 bg-stone-900/40 p-4">
                  <p className="font-secondary mb-3">
                    <span className="text-stone-500 mr-2">{idx + 1}.</span>
                    {q.question}
                  </p>
                  <div className="space-y-2">
                    {q.options?.map((opt: string, oi: number) => (
                      <label key={oi} className="flex items-center gap-2 cursor-pointer font-secondary text-sm">
                        <input
                          type="radio"
                          name={`q-${idx}`}
                          checked={answers[idx] === oi}
                          onChange={() => {
                            const next = [...answers];
                            next[idx] = oi;
                            setAnswers(next);
                          }}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={submit}
                disabled={answers.some((a) => a < 0)}
                className="rounded-md bg-amber-600 px-4 py-2 text-stone-950 font-medium hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Submit
              </button>
            </div>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
