'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { AdminLayout } from '@/components/AdminLayout';
import { RouteGuard } from '@/components/RouteGuard';

type Rule = {
  id: string;
  productId: string | null;
  categoryId: string | null;
  brandName: string | null;
  commissionRate: number | string;
  priority: number;
  isActive: boolean;
};

export default function InfluencerCommissionSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const influencerId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [influencerName, setInfluencerName] = useState('');
  const [basePercent, setBasePercent] = useState('10');
  const [cookieDays, setCookieDays] = useState('30');
  const [savingBase, setSavingBase] = useState(false);

  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [productHits, setProductHits] = useState<{ id: string; name: string }[]>([]);

  const [scopeType, setScopeType] = useState<'product' | 'category' | 'brand'>('product');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [brandInput, setBrandInput] = useState('');
  const [rulePercent, setRulePercent] = useState('');
  const [rulePriority, setRulePriority] = useState('0');
  const [addingRule, setAddingRule] = useState(false);

  const load = useCallback(async () => {
    if (!influencerId) return;
    try {
      setLoading(true);
      const [infRes, rulesRes, catRes] = await Promise.all([
        apiClient.getInfluencer(influencerId),
        apiClient.getInfluencerCommissionRules(influencerId),
        apiClient.getCategories(),
      ]);
      const inf = infRes?.data;
      if (inf) {
        setInfluencerName(inf.displayName || '');
        const br = inf.baseCommissionRate != null ? Number(inf.baseCommissionRate) * 100 : 10;
        setBasePercent(String(Math.round(br * 100) / 100));
        setCookieDays(String(inf.cookieDuration ?? 30));
      }
      const r = rulesRes?.data;
      setRules(Array.isArray(r) ? r : []);
      const cats = catRes?.data;
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [influencerId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const searchProducts = async () => {
    const q = productQuery.trim();
    if (q.length < 2) {
      setProductHits([]);
      return;
    }
    try {
      const res = await apiClient.getProducts({ query: q, limit: 15 });
      const raw = res?.data;
      const list = raw?.data ?? [];
      setProductHits(
        Array.isArray(list)
          ? list.map((p: any) => ({ id: p.id, name: p.name }))
          : [],
      );
    } catch {
      setProductHits([]);
    }
  };

  const saveBase = async () => {
    if (!influencerId) return;
    const pct = parseFloat(basePercent);
    const days = parseInt(cookieDays, 10);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      toast.error('Base commission must be 0–100%');
      return;
    }
    if (Number.isNaN(days) || days < 1) {
      toast.error('Cookie duration must be at least 1 day');
      return;
    }
    try {
      setSavingBase(true);
      await apiClient.updateInfluencerCommission(influencerId, {
        baseCommissionRate: pct / 100,
        cookieDuration: days,
      });
      toast.success('Base commission settings saved');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSavingBase(false);
    }
  };

  const addRule = async () => {
    if (!influencerId) return;
    const pct = parseFloat(rulePercent);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      toast.error('Rule rate must be 0–100%');
      return;
    }
    const priority = parseInt(rulePriority, 10) || 0;
    const body: any = { commissionRate: pct / 100, priority };
    if (scopeType === 'product') {
      if (!selectedProductId) {
        toast.error('Select a product');
        return;
      }
      body.productId = selectedProductId;
    } else if (scopeType === 'category') {
      if (!selectedCategoryId) {
        toast.error('Select a category');
        return;
      }
      body.categoryId = selectedCategoryId;
    } else {
      if (!brandInput.trim()) {
        toast.error('Enter a brand name');
        return;
      }
      body.brandName = brandInput.trim();
    }
    try {
      setAddingRule(true);
      await apiClient.createInfluencerCommissionRule(influencerId, body);
      toast.success('Rule added');
      setRulePercent('');
      setBrandInput('');
      setSelectedProductId('');
      setSelectedCategoryId('');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add rule');
    } finally {
      setAddingRule(false);
    }
  };

  const toggleRule = async (rule: Rule) => {
    if (!influencerId) return;
    try {
      await apiClient.updateInfluencerCommissionRule(influencerId, rule.id, {
        isActive: !rule.isActive,
      });
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Update failed');
    }
  };

  const removeRule = async (ruleId: string) => {
    if (!influencerId || !confirm('Delete this rule?')) return;
    try {
      await apiClient.deleteInfluencerCommissionRule(influencerId, ruleId);
      toast.success('Rule deleted');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    }
  };

  const ruleLabel = (r: Rule) => {
    if (r.productId) return `Product · ${r.productId.slice(0, 8)}…`;
    if (r.categoryId) {
      const c = categories.find((x) => x.id === r.categoryId);
      return `Category · ${c?.name || r.categoryId}`;
    }
    if (r.brandName) return `Brand · ${r.brandName}`;
    return '—';
  };

  return (
    <RouteGuard allowedRoles={['ADMIN', 'MARKETING']} showAccessDenied={true}>
      <AdminLayout>
        <div className="space-y-6 max-w-5xl">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push(`/admin/influencers/${influencerId}`)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              ←
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Commission settings</h1>
              <p className="text-gray-600">{influencerName || 'Influencer'}</p>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-gray-500">Loading…</div>
          ) : (
            <>
              <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
                <h2 className="text-lg font-semibold">Base rate & attribution</h2>
                <p className="text-sm text-gray-500">
                  Default commission when no campaign override or rule matches. Category JSON on the influencer is still
                  supported; rules below take precedence per line item (product → brand → category rule → legacy JSON →
                  base).
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Base commission (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={basePercent}
                      onChange={(e) => setBasePercent(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cookie duration (days)</label>
                    <input
                      type="number"
                      min={1}
                      value={cookieDays}
                      onChange={(e) => setCookieDays(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={saveBase}
                  disabled={savingBase}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {savingBase ? 'Saving…' : 'Save base settings'}
                </button>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
                <h2 className="text-lg font-semibold">Add rule</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                    <select
                      value={scopeType}
                      onChange={(e) => setScopeType(e.target.value as any)}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="product">Specific product</option>
                      <option value="category">Category / fandom (taxonomy)</option>
                      <option value="brand">Brand name (matches Product.brand)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Commission (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={rulePercent}
                      onChange={(e) => setRulePercent(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="e.g. 12.5"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority (higher wins)</label>
                  <input
                    type="number"
                    value={rulePriority}
                    onChange={(e) => setRulePriority(e.target.value)}
                    className="w-full max-w-xs border rounded-lg px-3 py-2"
                  />
                </div>

                {scopeType === 'product' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Product search</label>
                    <div className="flex gap-2">
                      <input
                        value={productQuery}
                        onChange={(e) => setProductQuery(e.target.value)}
                        className="flex-1 border rounded-lg px-3 py-2"
                        placeholder="Type product name…"
                      />
                      <button
                        type="button"
                        onClick={searchProducts}
                        className="px-3 py-2 bg-gray-100 rounded-lg border"
                      >
                        Search
                      </button>
                    </div>
                    {productHits.length > 0 && (
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2"
                      >
                        <option value="">Select product…</option>
                        {productHits.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {scopeType === 'category' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="">Select…</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {scopeType === 'brand' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand (exact match, case-insensitive)</label>
                    <input
                      value={brandInput}
                      onChange={(e) => setBrandInput(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="e.g. Acme Co"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Set <Link href="/admin/products" className="text-purple-600 underline">product.brand</Link> in catalog
                      for matching.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={addRule}
                  disabled={addingRule}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {addingRule ? 'Adding…' : 'Add rule'}
                </button>
              </div>

              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="p-6 border-b">
                  <h2 className="text-lg font-semibold">Active rules ({rules.length})</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2">Target</th>
                        <th className="text-left px-4 py-2">Rate</th>
                        <th className="text-left px-4 py-2">Priority</th>
                        <th className="text-left px-4 py-2">Active</th>
                        <th className="text-right px-4 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="px-4 py-2">{ruleLabel(r)}</td>
                          <td className="px-4 py-2">{(Number(r.commissionRate) * 100).toFixed(2)}%</td>
                          <td className="px-4 py-2">{r.priority}</td>
                          <td className="px-4 py-2">{r.isActive ? 'Yes' : 'No'}</td>
                          <td className="px-4 py-2 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => toggleRule(r)}
                              className="text-purple-600 hover:underline"
                            >
                              {r.isActive ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeRule(r.id)}
                              className="text-red-600 hover:underline"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rules.length === 0 && (
                    <p className="p-6 text-gray-500 text-center">No rules yet — base rate and campaigns apply.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
