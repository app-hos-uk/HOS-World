'use client';

import { useCallback, useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

type QuizQuestion = { _key: string; question: string; options: string[]; correctIndex: number };

let _qSeq = 0;
function quid(): string {
  return `q${Date.now()}-${++_qSeq}`;
}

function newQuestion(): QuizQuestion {
  return { _key: quid(), question: '', options: ['', '', '', ''], correctIndex: 0 };
}

export default function AdminQuizPage() {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formFandomId, setFormFandomId] = useState('');
  const [formDifficulty, setFormDifficulty] = useState('EASY');
  const [formPoints, setFormPoints] = useState(25);
  const [formActive, setFormActive] = useState(true);
  const [formQuestions, setFormQuestions] = useState<QuizQuestion[]>([newQuestion()]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .adminListQuizzes()
      .then((r) => setRows((r.data as any[]) || []))
      .catch((e: any) => setErr(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setFormTitle('');
    setFormFandomId('');
    setFormDifficulty('EASY');
    setFormPoints(25);
    setFormActive(true);
    setFormQuestions([newQuestion()]);
  };

  const openEdit = (q: any) => {
    setEditingId(q.id);
    setFormTitle(q.title);
    setFormFandomId(q.fandomId || '');
    setFormDifficulty(q.difficulty || 'EASY');
    setFormPoints(q.pointsReward ?? 25);
    setFormActive(q.isActive ?? true);
    const qs: QuizQuestion[] = Array.isArray(q.questions)
      ? q.questions.map((qq: any) => ({
          _key: quid(),
          question: qq.question || '',
          options: Array.isArray(qq.options) ? [...qq.options] : ['', '', '', ''],
          correctIndex: qq.correctIndex ?? 0,
        }))
      : [newQuestion()];
    setFormQuestions(qs);
    setShowForm(true);
  };

  const addQuestion = () => {
    setFormQuestions((prev) => [...prev, newQuestion()]);
  };

  const removeQuestion = (idx: number) => {
    setFormQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, field: string, value: any) => {
    setFormQuestions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setFormQuestions((prev) => {
      const next = [...prev];
      const opts = [...next[qIdx].options];
      opts[oIdx] = value;
      next[qIdx] = { ...next[qIdx], options: opts };
      return next;
    });
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formFandomId.trim()) {
      toast.error('Title and Fandom ID are required');
      return;
    }
    if (formQuestions.some((q) => !q.question.trim() || q.options.some((o) => !o.trim()))) {
      toast.error('All questions and options must be filled in');
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: formTitle.trim(),
        fandomId: formFandomId.trim(),
        difficulty: formDifficulty,
        pointsReward: formPoints,
        isActive: formActive,
        questions: formQuestions.map(({ _key, ...rest }) => rest),
      };
      if (editingId) {
        await apiClient.adminUpdateQuiz(editingId, body);
        toast.success('Quiz updated');
      } else {
        await apiClient.adminCreateQuiz(body);
        toast.success('Quiz created');
      }
      setShowForm(false);
      resetForm();
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-5xl">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold text-stone-100">Fandom quizzes</h1>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="rounded-md bg-amber-600 px-4 py-2 text-stone-950 font-medium text-sm hover:bg-amber-500"
            >
              + New quiz
            </button>
          </div>
          {err && <p className="text-red-400 text-sm mb-4">{err}</p>}

          {showForm && (
            <div className="rounded-lg border border-stone-700 bg-stone-900/80 p-5 mb-6 space-y-4">
              <h2 className="font-semibold text-stone-200">{editingId ? 'Edit quiz' : 'Create quiz'}</h2>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100"
                  placeholder="Title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
                <input
                  className="bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100"
                  placeholder="Fandom ID (UUID)"
                  value={formFandomId}
                  onChange={(e) => setFormFandomId(e.target.value)}
                />
                <select
                  className="bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100"
                  value={formDifficulty}
                  onChange={(e) => setFormDifficulty(e.target.value)}
                >
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
                <input
                  type="number"
                  className="bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100"
                  placeholder="Points reward"
                  value={formPoints}
                  onChange={(e) => setFormPoints(Number(e.target.value))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-stone-300">
                <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} />
                Active
              </label>

              <div className="space-y-4">
                {formQuestions.map((q, qi) => (
                  <div key={q._key} className="rounded border border-stone-700 p-3 space-y-2 bg-stone-800/40">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-stone-500">Question {qi + 1}</span>
                      {formQuestions.length > 1 && (
                        <button
                          type="button"
                          className="text-xs text-red-400 hover:text-red-300"
                          onClick={() => removeQuestion(qi)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <input
                      className="w-full bg-stone-800 border border-stone-700 rounded px-3 py-1.5 text-sm text-stone-100"
                      placeholder="Question text"
                      value={q.question}
                      onChange={(e) => updateQuestion(qi, 'question', e.target.value)}
                    />
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${q._key}`}
                          checked={q.correctIndex === oi}
                          onChange={() => updateQuestion(qi, 'correctIndex', oi)}
                          title="Mark as correct"
                        />
                        <input
                          className="flex-1 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-100"
                          placeholder={`Option ${oi + 1}`}
                          value={opt}
                          onChange={(e) => updateOption(qi, oi, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addQuestion}
                  className="text-sm text-amber-400 hover:text-amber-300"
                >
                  + Add question
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-md bg-amber-600 px-4 py-2 text-stone-950 font-medium text-sm hover:bg-amber-500 disabled:opacity-40"
                >
                  {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="rounded-md border border-stone-600 px-4 py-2 text-stone-300 text-sm hover:bg-stone-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="font-secondary text-stone-500">Loading…</p>
          ) : (
            <div className="overflow-x-auto rounded border border-stone-800">
              <table className="w-full text-sm text-left text-stone-300">
                <thead className="bg-stone-900 text-stone-400">
                  <tr>
                    <th className="p-2">Title</th>
                    <th className="p-2">Fandom</th>
                    <th className="p-2">Points</th>
                    <th className="p-2">Attempts</th>
                    <th className="p-2">Active</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((q) => (
                    <tr key={q.id} className="border-t border-stone-800">
                      <td className="p-2">{q.title}</td>
                      <td className="p-2">{q.fandom?.name ?? '—'}</td>
                      <td className="p-2">{q.pointsReward}</td>
                      <td className="p-2">{q._count?.attempts ?? 0}</td>
                      <td className="p-2">{q.isActive ? 'Yes' : 'No'}</td>
                      <td className="p-2">
                        <button
                          type="button"
                          className="text-amber-400 hover:text-amber-300 text-xs"
                          onClick={() => openEdit(q)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
