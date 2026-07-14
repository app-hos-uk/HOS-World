'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface Testimonial {
  id: string;
  quote: string;
  author: string;
  city?: string;
  rating: number;
  verified: boolean;
  order: number;
  isActive: boolean;
}

const EMPTY_FORM = {
  quote: '',
  author: '',
  city: '',
  rating: 5,
  verified: true,
  order: 0,
  isActive: true,
};

export default function AdminTestimonialsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getAllTestimonials();
      if (res?.data) setItems(res.data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load testimonials');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const sorted = [...items].sort((a, b) => a.order - b.order);

  const openNew = () => {
    setEditingId(null);
    setFormData({ ...EMPTY_FORM, order: items.length });
    setShowForm(true);
  };

  const openEdit = (t: Testimonial) => {
    setEditingId(t.id);
    setFormData({
      quote: t.quote,
      author: t.author,
      city: t.city || '',
      rating: t.rating,
      verified: t.verified,
      order: t.order,
      isActive: t.isActive,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.quote.trim() || !formData.author.trim()) {
      toast.error('Quote and author are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        city: formData.city || undefined,
      };
      if (editingId) {
        await apiClient.updateTestimonial(editingId, payload);
        toast.success('Testimonial updated');
      } else {
        await apiClient.createTestimonial(payload);
        toast.success('Testimonial created');
      }
      setShowForm(false);
      await fetchItems();
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this testimonial?')) return;
    try {
      await apiClient.deleteTestimonial(id);
      toast.success('Testimonial deleted');
      await fetchItems();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const toggleActive = async (t: Testimonial) => {
    try {
      await apiClient.updateTestimonial(t.id, { isActive: !t.isActive });
      await fetchItems();
    } catch (err: any) {
      toast.error(err.message || 'Toggle failed');
    }
  };

  const moveItem = async (idx: number, direction: -1 | 1) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[newIdx];
    try {
      await Promise.all([
        apiClient.updateTestimonial(a.id, { order: b.order }),
        apiClient.updateTestimonial(b.id, { order: a.order }),
      ]);
      await fetchItems();
    } catch (err: any) {
      toast.error(err.message || 'Reorder failed');
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
              <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-hos-text-primary">Testimonials</h1>
              <p className="text-sm text-hos-text-muted mt-1">
                Manage customer testimonials displayed on the storefront
              </p>
            </div>
            <button
              onClick={openNew}
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg font-medium hover:bg-hos-gold-hover transition-colors"
            >
              + Add Testimonial
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-12 text-hos-text-muted">
              No testimonials yet. Click &quot;Add Testimonial&quot; to create one.
            </div>
          ) : (
            <div className="grid gap-4">
              {sorted.map((t, idx) => (
                <div
                  key={t.id}
                  className={`bg-hos-bg-secondary border rounded-xl p-5 ${
                    t.isActive ? 'border-hos-border' : 'border-red-900/30 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <svg
                              key={i}
                              className={`w-3.5 h-3.5 ${i < t.rating ? 'text-hos-gold' : 'text-hos-text-muted/30'}`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        {t.verified && (
                          <span className="text-[10px] bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded">
                            Verified
                          </span>
                        )}
                        {!t.isActive && (
                          <span className="text-[10px] bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded">
                            Hidden
                          </span>
                        )}
                      </div>
                      <p className="text-hos-text-secondary text-sm italic mb-2">
                        &ldquo;{t.quote}&rdquo;
                      </p>
                      <p className="text-hos-gold text-xs">
                        — {t.author}{t.city ? `, ${t.city}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex gap-1">
                        <button
                          onClick={() => moveItem(idx, -1)}
                          disabled={idx === 0}
                          className="p-1 text-xs text-hos-text-muted disabled:opacity-20 hover:text-hos-gold"
                        >▲</button>
                        <button
                          onClick={() => moveItem(idx, 1)}
                          disabled={idx === sorted.length - 1}
                          className="p-1 text-xs text-hos-text-muted disabled:opacity-20 hover:text-hos-gold"
                        >▼</button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleActive(t)}
                          className="text-xs text-hos-text-muted hover:text-hos-gold"
                        >
                          {t.isActive ? 'Hide' : 'Show'}
                        </button>
                        <button
                          onClick={() => openEdit(t)}
                          className="text-xs text-hos-gold hover:text-hos-gold-hover"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal form */}
          {showForm && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-hos-bg-secondary border border-hos-border rounded-xl w-full max-w-lg p-6 space-y-4">
                <h2 className="text-lg font-bold text-hos-text-primary">
                  {editingId ? 'Edit Testimonial' : 'New Testimonial'}
                </h2>

                <div>
                  <label className="block text-sm text-hos-text-muted mb-1">Quote *</label>
                  <textarea
                    value={formData.quote}
                    onChange={(e) => setFormData({ ...formData, quote: e.target.value })}
                    rows={3}
                    className="w-full bg-hos-bg border border-hos-border rounded-lg px-3 py-2 text-sm text-hos-text-primary"
                    placeholder="Customer's testimonial..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-hos-text-muted mb-1">Author *</label>
                    <input
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      className="w-full bg-hos-bg border border-hos-border rounded-lg px-3 py-2 text-sm text-hos-text-primary"
                      placeholder="e.g. Jane D."
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-hos-text-muted mb-1">City</label>
                    <input
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full bg-hos-bg border border-hos-border rounded-lg px-3 py-2 text-sm text-hos-text-primary"
                      placeholder="e.g. New York"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-hos-text-muted mb-1">Rating</label>
                    <select
                      value={formData.rating}
                      onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })}
                      className="w-full bg-hos-bg border border-hos-border rounded-lg px-3 py-2 text-sm text-hos-text-primary"
                    >
                      {[5, 4, 3, 2, 1].map((r) => (
                        <option key={r} value={r}>{r} star{r !== 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col justify-end gap-2">
                    <label className="flex items-center gap-2 text-sm text-hos-text-secondary">
                      <input
                        type="checkbox"
                        checked={formData.verified}
                        onChange={(e) => setFormData({ ...formData, verified: e.target.checked })}
                        className="rounded"
                      />
                      Verified buyer
                    </label>
                    <label className="flex items-center gap-2 text-sm text-hos-text-secondary">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="rounded"
                      />
                      Active
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-sm text-hos-text-muted hover:text-hos-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg text-sm font-medium hover:bg-hos-gold-hover disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
          </RouteGuard>
  );
}
