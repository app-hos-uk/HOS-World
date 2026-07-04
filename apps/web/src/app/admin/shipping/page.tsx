'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';

const SHIPPING_METHOD_TYPES = [
  { value: 'FLAT_RATE', label: 'Flat Rate', description: 'Fixed rate per order' },
  { value: 'WEIGHT_BASED', label: 'Weight Based', description: 'Rate multiplied by weight in kg' },
  { value: 'DISTANCE_BASED', label: 'Distance Based', description: 'Rate based on delivery distance' },
  { value: 'FREE_SHIPPING', label: 'Free Shipping', description: 'No shipping charge' },
  { value: 'PICKUP_IN_STORE', label: 'Pickup In Store', description: 'Customer picks up from store' },
  { value: 'HYPERLOCAL', label: 'Hyperlocal', description: 'Same-day local delivery' },
] as const;

interface ShippingRuleConditions {
  weightRange?: { min?: number; max?: number };
  cartValueRange?: { min?: number; max?: number };
  country?: string;
  state?: string;
  city?: string;
  postalCode?: string;
}

interface ShippingRule {
  id: string;
  name: string;
  rate: number | string;
  priority: number;
  estimatedDays?: number | null;
  freeShippingThreshold?: number | string | null;
  isActive: boolean;
  conditions?: ShippingRuleConditions;
}

interface ShippingMethod {
  id: string;
  name: string;
  description?: string;
  type: string;
  isActive: boolean;
  rules?: ShippingRule[];
  createdAt: string;
}

interface MethodFormData {
  name: string;
  description: string;
  type: string;
  isActive: boolean;
}

interface RuleFormData {
  name: string;
  rate: string;
  freeShippingThreshold: string;
  estimatedDays: string;
  priority: string;
  isActive: boolean;
  country: string;
  state: string;
  city: string;
  postalCode: string;
  weightMin: string;
  weightMax: string;
  cartValueMin: string;
  cartValueMax: string;
}

const emptyMethodForm: MethodFormData = {
  name: '',
  description: '',
  type: 'FLAT_RATE',
  isActive: true,
};

const emptyRuleForm: RuleFormData = {
  name: '',
  rate: '',
  freeShippingThreshold: '',
  estimatedDays: '',
  priority: '0',
  isActive: true,
  country: '',
  state: '',
  city: '',
  postalCode: '',
  weightMin: '',
  weightMax: '',
  cartValueMin: '',
  cartValueMax: '',
};

function formatConditions(conditions?: ShippingRuleConditions): string {
  if (!conditions) return '—';
  const parts: string[] = [];
  if (conditions.country) parts.push(conditions.country);
  if (conditions.state) parts.push(conditions.state);
  if (conditions.city) parts.push(conditions.city);
  if (conditions.postalCode) parts.push(`ZIP: ${conditions.postalCode}`);
  if (conditions.weightRange) {
    const { min, max } = conditions.weightRange;
    if (min != null && max != null) parts.push(`Weight: ${min}-${max}kg`);
    else if (min != null) parts.push(`Weight: ≥${min}kg`);
    else if (max != null) parts.push(`Weight: ≤${max}kg`);
  }
  if (conditions.cartValueRange) {
    const { min, max } = conditions.cartValueRange;
    if (min != null && max != null) parts.push(`Cart: $${min}-$${max}`);
    else if (min != null) parts.push(`Cart: $${min}+`);
    else if (max != null) parts.push(`Cart: ≤$${max}`);
  }
  return parts.length > 0 ? parts.join(', ') : '—';
}

function getTypeBadgeColor(type: string): string {
  switch (type) {
    case 'FLAT_RATE': return 'bg-blue-900/30 text-blue-400';
    case 'WEIGHT_BASED': return 'bg-purple-900/30 text-purple-400';
    case 'DISTANCE_BASED': return 'bg-orange-900/30 text-orange-400';
    case 'FREE_SHIPPING': return 'bg-green-900/30 text-green-400';
    case 'PICKUP_IN_STORE': return 'bg-teal-900/30 text-teal-400';
    case 'HYPERLOCAL': return 'bg-pink-900/30 text-pink-400';
    default: return 'bg-gray-800 text-gray-400';
  }
}

export default function AdminShippingPage() {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [expandedMethods, setExpandedMethods] = useState<Set<string>>(new Set());

  // Method modal state
  const [showMethodModal, setShowMethodModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState<ShippingMethod | null>(null);
  const [methodForm, setMethodForm] = useState<MethodFormData>(emptyMethodForm);
  const [savingMethod, setSavingMethod] = useState(false);

  // Rule modal state
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<ShippingRule | null>(null);
  const [ruleMethodId, setRuleMethodId] = useState<string>('');
  const [ruleForm, setRuleForm] = useState<RuleFormData>(emptyRuleForm);
  const [savingRule, setSavingRule] = useState(false);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'method' | 'rule'; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchMethods = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAdminShippingMethods();
      setMethods(response?.data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load shipping methods');
      setMethods([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  const toggleExpand = (id: string) => {
    setExpandedMethods((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Seed defaults
  const handleSeedDefaults = async () => {
    try {
      setSeeding(true);
      const response = await apiClient.seedDefaultShippingMethods();
      const created = response?.data?.created ?? 0;
      if (created > 0) {
        toast.success(`Created ${created} default shipping method(s)`);
      } else {
        toast.info('Default shipping methods already exist');
      }
      await fetchMethods();
    } catch (err: any) {
      toast.error(err.message || 'Failed to seed defaults');
    } finally {
      setSeeding(false);
    }
  };

  // Method CRUD
  const openCreateMethod = () => {
    setEditingMethod(null);
    setMethodForm(emptyMethodForm);
    setShowMethodModal(true);
  };

  const openEditMethod = (method: ShippingMethod) => {
    setEditingMethod(method);
    setMethodForm({
      name: method.name,
      description: method.description || '',
      type: method.type,
      isActive: method.isActive,
    });
    setShowMethodModal(true);
  };

  const handleSaveMethod = async () => {
    if (!methodForm.name.trim()) {
      toast.error('Method name is required');
      return;
    }
    try {
      setSavingMethod(true);
      if (editingMethod) {
        await apiClient.updateShippingMethod(editingMethod.id, methodForm);
        toast.success('Shipping method updated');
      } else {
        await apiClient.createShippingMethod(methodForm);
        toast.success('Shipping method created');
      }
      setShowMethodModal(false);
      await fetchMethods();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save shipping method');
    } finally {
      setSavingMethod(false);
    }
  };

  const handleDeleteMethod = async (id: string) => {
    try {
      setDeleting(true);
      await apiClient.deleteShippingMethod(id);
      toast.success('Shipping method deleted');
      setDeleteConfirm(null);
      await fetchMethods();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete shipping method');
    } finally {
      setDeleting(false);
    }
  };

  // Rule CRUD
  const openCreateRule = (methodId: string) => {
    setEditingRule(null);
    setRuleMethodId(methodId);
    setRuleForm(emptyRuleForm);
    setShowRuleModal(true);
  };

  const openEditRule = (rule: ShippingRule, methodId: string) => {
    setEditingRule(rule);
    setRuleMethodId(methodId);
    const conditions = rule.conditions || {};
    setRuleForm({
      name: rule.name,
      rate: String(rule.rate),
      freeShippingThreshold: rule.freeShippingThreshold != null ? String(rule.freeShippingThreshold) : '',
      estimatedDays: rule.estimatedDays != null ? String(rule.estimatedDays) : '',
      priority: String(rule.priority),
      isActive: rule.isActive,
      country: conditions.country || '',
      state: conditions.state || '',
      city: conditions.city || '',
      postalCode: conditions.postalCode || '',
      weightMin: conditions.weightRange?.min != null ? String(conditions.weightRange.min) : '',
      weightMax: conditions.weightRange?.max != null ? String(conditions.weightRange.max) : '',
      cartValueMin: conditions.cartValueRange?.min != null ? String(conditions.cartValueRange.min) : '',
      cartValueMax: conditions.cartValueRange?.max != null ? String(conditions.cartValueRange.max) : '',
    });
    setShowRuleModal(true);
  };

  const buildConditions = (): ShippingRuleConditions => {
    const conditions: ShippingRuleConditions = {};
    if (ruleForm.country.trim()) conditions.country = ruleForm.country.trim();
    if (ruleForm.state.trim()) conditions.state = ruleForm.state.trim();
    if (ruleForm.city.trim()) conditions.city = ruleForm.city.trim();
    if (ruleForm.postalCode.trim()) conditions.postalCode = ruleForm.postalCode.trim();
    if (ruleForm.weightMin || ruleForm.weightMax) {
      conditions.weightRange = {};
      if (ruleForm.weightMin) conditions.weightRange.min = Number(ruleForm.weightMin);
      if (ruleForm.weightMax) conditions.weightRange.max = Number(ruleForm.weightMax);
    }
    if (ruleForm.cartValueMin || ruleForm.cartValueMax) {
      conditions.cartValueRange = {};
      if (ruleForm.cartValueMin) conditions.cartValueRange.min = Number(ruleForm.cartValueMin);
      if (ruleForm.cartValueMax) conditions.cartValueRange.max = Number(ruleForm.cartValueMax);
    }
    return conditions;
  };

  const handleSaveRule = async () => {
    if (!ruleForm.name.trim()) {
      toast.error('Rule name is required');
      return;
    }
    if (!ruleForm.rate || isNaN(Number(ruleForm.rate))) {
      toast.error('Valid rate is required');
      return;
    }
    try {
      setSavingRule(true);
      const payload: any = {
        name: ruleForm.name.trim(),
        rate: Number(ruleForm.rate),
        priority: Number(ruleForm.priority) || 0,
        isActive: ruleForm.isActive,
        conditions: buildConditions(),
      };
      if (ruleForm.freeShippingThreshold) {
        payload.freeShippingThreshold = Number(ruleForm.freeShippingThreshold);
      } else {
        payload.freeShippingThreshold = null;
      }
      if (ruleForm.estimatedDays) {
        payload.estimatedDays = Number(ruleForm.estimatedDays);
      } else {
        payload.estimatedDays = null;
      }

      if (editingRule) {
        await apiClient.updateShippingRule(editingRule.id, payload);
        toast.success('Shipping rule updated');
      } else {
        payload.shippingMethodId = ruleMethodId;
        await apiClient.createShippingRule(payload);
        toast.success('Shipping rule created');
      }
      setShowRuleModal(false);
      await fetchMethods();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save shipping rule');
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      setDeleting(true);
      await apiClient.deleteShippingRule(id);
      toast.success('Shipping rule deleted');
      setDeleteConfirm(null);
      await fetchMethods();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete shipping rule');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleMethodActive = async (method: ShippingMethod) => {
    try {
      await apiClient.updateShippingMethod(method.id, { isActive: !method.isActive });
      toast.success(`Method ${method.isActive ? 'deactivated' : 'activated'}`);
      await fetchMethods();
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle method');
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout title="Shipping Methods & Rules">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-hos-text-secondary">Shipping Methods & Rules</h1>
            <p className="text-hos-text-muted text-sm mt-1">
              Manage shipping methods, rules, and conditions for the marketplace
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSeedDefaults}
              disabled={seeding}
              className="px-4 py-2 border border-hos-border text-hos-text-secondary rounded-lg hover:bg-hos-bg-secondary disabled:opacity-50 font-medium text-sm transition-colors"
            >
              {seeding ? 'Seeding…' : 'Seed Defaults'}
            </button>
            <button
              type="button"
              onClick={openCreateMethod}
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover font-medium text-sm transition-colors"
            >
              + Add Method
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-hos-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : methods.length === 0 ? (
          <div className="text-center py-16 bg-hos-bg-secondary border border-hos-border rounded-xl">
            <svg className="w-12 h-12 mx-auto text-hos-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-hos-text-muted mb-4">No platform shipping methods configured.</p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={handleSeedDefaults}
                disabled={seeding}
                className="px-4 py-2 border border-hos-border text-hos-text-secondary rounded-lg hover:bg-hos-bg-secondary font-medium text-sm"
              >
                Seed Default Methods
              </button>
              <button
                type="button"
                onClick={openCreateMethod}
                className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover font-medium text-sm"
              >
                + Create Method
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {methods.map((method) => {
              const isExpanded = expandedMethods.has(method.id);
              const ruleCount = method.rules?.length || 0;
              return (
                <div key={method.id} className="bg-hos-bg-secondary border border-hos-border rounded-xl overflow-hidden">
                  {/* Method Header */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg font-semibold text-hos-text-secondary">{method.name}</h2>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeBadgeColor(method.type)}`}>
                            {method.type.replace(/_/g, ' ')}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${method.isActive ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                            {method.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs bg-hos-bg-tertiary text-hos-text-muted">
                            {ruleCount} rule{ruleCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {method.description && (
                          <p className="text-sm text-hos-text-muted mt-1">{method.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Active toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleMethodActive(method)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${method.isActive ? 'bg-green-600' : 'bg-gray-600'}`}
                          title={method.isActive ? 'Deactivate' : 'Activate'}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${method.isActive ? 'left-5' : 'left-0.5'}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditMethod(method)}
                          className="p-1.5 text-hos-text-muted hover:text-hos-text-secondary rounded transition-colors"
                          title="Edit method"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm({ type: 'method', id: method.id, name: method.name })}
                          className="p-1.5 text-hos-text-muted hover:text-red-400 rounded transition-colors"
                          title="Delete method"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleExpand(method.id)}
                          className="p-1.5 text-hos-text-muted hover:text-hos-text-secondary rounded transition-colors"
                          title={isExpanded ? 'Collapse rules' : 'Expand rules'}
                        >
                          <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Rules Section */}
                  {isExpanded && (
                    <div className="border-t border-hos-border px-5 pb-5 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-hos-text-muted uppercase tracking-wide">Rules</h3>
                        <button
                          type="button"
                          onClick={() => openCreateRule(method.id)}
                          className="px-3 py-1.5 text-xs bg-hos-gold/10 text-hos-gold border border-hos-gold/30 rounded-lg hover:bg-hos-gold/20 font-medium transition-colors"
                        >
                          + Add Rule
                        </button>
                      </div>
                      {method.rules && method.rules.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-hos-border text-hos-text-muted text-left">
                                <th className="py-2 px-3 font-medium">Name</th>
                                <th className="py-2 px-3 font-medium">Rate</th>
                                <th className="py-2 px-3 font-medium">Free Over</th>
                                <th className="py-2 px-3 font-medium">Est. Days</th>
                                <th className="py-2 px-3 font-medium">Priority</th>
                                <th className="py-2 px-3 font-medium">Conditions</th>
                                <th className="py-2 px-3 font-medium">Active</th>
                                <th className="py-2 px-3 font-medium text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {method.rules.map((rule) => (
                                <tr key={rule.id} className="border-b border-hos-border/50 hover:bg-hos-bg-tertiary/30">
                                  <td className="py-2 px-3 text-hos-text-secondary font-medium">{rule.name}</td>
                                  <td className="py-2 px-3">{formatPrice(Number(rule.rate))}</td>
                                  <td className="py-2 px-3 text-hos-text-muted">
                                    {rule.freeShippingThreshold != null ? formatPrice(Number(rule.freeShippingThreshold)) : '—'}
                                  </td>
                                  <td className="py-2 px-3 text-hos-text-muted">{rule.estimatedDays ?? '—'}</td>
                                  <td className="py-2 px-3 text-hos-text-muted">{rule.priority}</td>
                                  <td className="py-2 px-3 text-hos-text-muted text-xs max-w-[200px] truncate" title={formatConditions(rule.conditions)}>
                                    {formatConditions(rule.conditions)}
                                  </td>
                                  <td className="py-2 px-3">
                                    <span className={`inline-block w-2 h-2 rounded-full ${rule.isActive ? 'bg-green-400' : 'bg-gray-500'}`} />
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() => openEditRule(rule, method.id)}
                                        className="p-1 text-hos-text-muted hover:text-hos-text-secondary rounded"
                                        title="Edit rule"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeleteConfirm({ type: 'rule', id: rule.id, name: rule.name })}
                                        className="p-1 text-hos-text-muted hover:text-red-400 rounded"
                                        title="Delete rule"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-hos-text-muted py-4 text-center">No rules configured. Add a rule to define shipping rates and conditions.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Method Modal */}
        {showMethodModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMethodModal(false)} />
            <div className="relative bg-hos-bg-secondary border border-hos-border rounded-xl w-full max-w-lg p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">
                {editingMethod ? 'Edit Shipping Method' : 'Create Shipping Method'}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-hos-text-muted mb-1">Name *</label>
                  <input
                    type="text"
                    value={methodForm.name}
                    onChange={(e) => setMethodForm({ ...methodForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-secondary placeholder:text-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                    placeholder="e.g., Standard Delivery"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-muted mb-1">Description</label>
                  <input
                    type="text"
                    value={methodForm.description}
                    onChange={(e) => setMethodForm({ ...methodForm, description: e.target.value })}
                    className="w-full px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-secondary placeholder:text-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                    placeholder="e.g., 5–7 business days"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-muted mb-1">Type *</label>
                  <select
                    value={methodForm.type}
                    onChange={(e) => setMethodForm({ ...methodForm, type: e.target.value })}
                    className="w-full px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                  >
                    {SHIPPING_METHOD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label} — {t.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMethodForm({ ...methodForm, isActive: !methodForm.isActive })}
                    className={`relative w-10 h-5 rounded-full transition-colors ${methodForm.isActive ? 'bg-green-600' : 'bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${methodForm.isActive ? 'left-5' : 'left-0.5'}`} />
                  </button>
                  <span className="text-sm text-hos-text-secondary">{methodForm.isActive ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowMethodModal(false)}
                  className="px-4 py-2 text-sm text-hos-text-muted border border-hos-border rounded-lg hover:bg-hos-bg-tertiary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMethod}
                  disabled={savingMethod}
                  className="px-4 py-2 text-sm bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 font-medium transition-colors"
                >
                  {savingMethod ? 'Saving…' : editingMethod ? 'Update Method' : 'Create Method'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rule Modal */}
        {showRuleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowRuleModal(false)} />
            <div className="relative bg-hos-bg-secondary border border-hos-border rounded-xl w-full max-w-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">
                {editingRule ? 'Edit Shipping Rule' : 'Create Shipping Rule'}
              </h2>
              <div className="space-y-4">
                {/* Basic fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-hos-text-muted mb-1">Name *</label>
                    <input
                      type="text"
                      value={ruleForm.name}
                      onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-secondary placeholder:text-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                      placeholder="e.g., Standard US"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-muted mb-1">Rate ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={ruleForm.rate}
                      onChange={(e) => setRuleForm({ ...ruleForm, rate: e.target.value })}
                      className="w-full px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-secondary placeholder:text-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-hos-text-muted mb-1">Free Shipping Threshold ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={ruleForm.freeShippingThreshold}
                      onChange={(e) => setRuleForm({ ...ruleForm, freeShippingThreshold: e.target.value })}
                      className="w-full px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-secondary placeholder:text-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                      placeholder="e.g., 75"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-muted mb-1">Estimated Days</label>
                    <input
                      type="number"
                      min="1"
                      value={ruleForm.estimatedDays}
                      onChange={(e) => setRuleForm({ ...ruleForm, estimatedDays: e.target.value })}
                      className="w-full px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-secondary placeholder:text-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                      placeholder="e.g., 7"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-muted mb-1">Priority</label>
                    <input
                      type="number"
                      value={ruleForm.priority}
                      onChange={(e) => setRuleForm({ ...ruleForm, priority: e.target.value })}
                      className="w-full px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-secondary placeholder:text-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRuleForm({ ...ruleForm, isActive: !ruleForm.isActive })}
                    className={`relative w-10 h-5 rounded-full transition-colors ${ruleForm.isActive ? 'bg-green-600' : 'bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${ruleForm.isActive ? 'left-5' : 'left-0.5'}`} />
                  </button>
                  <span className="text-sm text-hos-text-secondary">{ruleForm.isActive ? 'Active' : 'Inactive'}</span>
                </div>

                {/* Conditions */}
                <div className="border-t border-hos-border pt-4">
                  <h3 className="text-sm font-semibold text-hos-text-secondary mb-3">Conditions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-hos-text-muted mb-1">Country</label>
                      <input
                        type="text"
                        value={ruleForm.country}
                        onChange={(e) => setRuleForm({ ...ruleForm, country: e.target.value })}
                        className="w-full px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-secondary placeholder:text-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold/50 text-sm"
                        placeholder="e.g., US"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-hos-text-muted mb-1">State</label>
                      <input
                        type="text"
                        value={ruleForm.state}
                        onChange={(e) => setRuleForm({ ...ruleForm, state: e.target.value })}
                        className="w-full px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-secondary placeholder:text-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold/50 text-sm"
                        placeholder="e.g., CA"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-hos-text-muted mb-1">City</label>
                      <input
                        type="text"
                        value={ruleForm.city}
                        onChange={(e) => setRuleForm({ ...ruleForm, city: e.target.value })}
                        className="w-full px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-secondary placeholder:text-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold/50 text-sm"
                        placeholder="e.g., Los Angeles"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-hos-text-muted mb-1">Postal Code</label>
                      <input
                        type="text"
                        value={ruleForm.postalCode}
                        onChange={(e) => setRuleForm({ ...ruleForm, postalCode: e.target.value })}
                        className="w-full px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-secondary placeholder:text-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold/50 text-sm"
                        placeholder="e.g., 90001"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-medium text-hos-text-muted mb-1">Weight Range (kg)</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={ruleForm.weightMin}
                          onChange={(e) => setRuleForm({ ...ruleForm, weightMin: e.target.value })}
                          className="flex-1 px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-secondary placeholder:text-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold/50 text-sm"
                          placeholder="Min"
                        />
                        <span className="text-hos-text-muted self-center">–</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={ruleForm.weightMax}
                          onChange={(e) => setRuleForm({ ...ruleForm, weightMax: e.target.value })}
                          className="flex-1 px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-secondary placeholder:text-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold/50 text-sm"
                          placeholder="Max"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-hos-text-muted mb-1">Cart Value Range ($)</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={ruleForm.cartValueMin}
                          onChange={(e) => setRuleForm({ ...ruleForm, cartValueMin: e.target.value })}
                          className="flex-1 px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-secondary placeholder:text-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold/50 text-sm"
                          placeholder="Min"
                        />
                        <span className="text-hos-text-muted self-center">–</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={ruleForm.cartValueMax}
                          onChange={(e) => setRuleForm({ ...ruleForm, cartValueMax: e.target.value })}
                          className="flex-1 px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-secondary placeholder:text-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold/50 text-sm"
                          placeholder="Max"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="px-4 py-2 text-sm text-hos-text-muted border border-hos-border rounded-lg hover:bg-hos-bg-tertiary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRule}
                  disabled={savingRule}
                  className="px-4 py-2 text-sm bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 font-medium transition-colors"
                >
                  {savingRule ? 'Saving…' : editingRule ? 'Update Rule' : 'Create Rule'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
            <div className="relative bg-hos-bg-secondary border border-hos-border rounded-xl w-full max-w-sm p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-hos-text-secondary mb-2">Confirm Delete</h2>
              <p className="text-sm text-hos-text-muted mb-4">
                Are you sure you want to delete <span className="font-medium text-hos-text-secondary">{deleteConfirm.name}</span>?
                {deleteConfirm.type === 'method' && ' This will also delete all associated rules.'}
                {' '}This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-sm text-hos-text-muted border border-hos-border rounded-lg hover:bg-hos-bg-tertiary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (deleteConfirm.type === 'method') handleDeleteMethod(deleteConfirm.id);
                    else handleDeleteRule(deleteConfirm.id);
                  }}
                  disabled={deleting}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium transition-colors"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </RouteGuard>
  );
}
