'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';

interface ShippingRule {
  id: string;
  name: string;
  rate: number | string;
  priority: number;
  estimatedDays?: number;
  freeShippingThreshold?: number | string | null;
  isActive: boolean;
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

export default function AdminShippingPage() {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

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

  return (
    <RouteGuard allowedRoles={['ADMIN', 'FINANCE', 'FULFILLMENT']}>
      <AdminLayout title="Shipping Methods">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-hos-text-secondary">Platform Shipping Methods</h1>
            <p className="text-hos-text-muted text-sm mt-1">Manage default shipping options available at checkout</p>
          </div>
          <button
            type="button"
            onClick={handleSeedDefaults}
            disabled={seeding}
            className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 font-medium text-sm"
          >
            {seeding ? 'Seeding…' : 'Seed Default Methods'}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-hos-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : methods.length === 0 ? (
          <div className="text-center py-16 bg-hos-bg-secondary border border-hos-border rounded-xl">
            <p className="text-hos-text-muted mb-4">No platform shipping methods configured.</p>
            <button
              type="button"
              onClick={handleSeedDefaults}
              disabled={seeding}
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover font-medium text-sm"
            >
              Create Standard & Express defaults
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {methods.map((method) => (
              <div key={method.id} className="bg-hos-bg-secondary border border-hos-border rounded-xl p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-hos-text-secondary">{method.name}</h2>
                      <span className={`px-2 py-0.5 rounded text-xs ${method.isActive ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                        {method.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs bg-hos-bg-tertiary text-hos-text-muted">{method.type}</span>
                    </div>
                    {method.description && (
                      <p className="text-sm text-hos-text-muted mt-1">{method.description}</p>
                    )}
                  </div>
                </div>
                {method.rules && method.rules.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-hos-border text-hos-text-muted text-left">
                          <th className="py-2 px-3 font-medium">Rule</th>
                          <th className="py-2 px-3 font-medium">Rate</th>
                          <th className="py-2 px-3 font-medium">Est. Days</th>
                          <th className="py-2 px-3 font-medium">Free over</th>
                          <th className="py-2 px-3 font-medium">Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {method.rules.map((rule) => (
                          <tr key={rule.id} className="border-b border-hos-border/50">
                            <td className="py-2 px-3 text-hos-text-secondary">{rule.name}</td>
                            <td className="py-2 px-3">{formatPrice(Number(rule.rate))}</td>
                            <td className="py-2 px-3 text-hos-text-muted">{rule.estimatedDays ?? '—'}</td>
                            <td className="py-2 px-3 text-hos-text-muted">
                              {rule.freeShippingThreshold ? formatPrice(Number(rule.freeShippingThreshold)) : '—'}
                            </td>
                            <td className="py-2 px-3 text-hos-text-muted">{rule.priority}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-hos-text-muted">No rules configured for this method.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </AdminLayout>
    </RouteGuard>
  );
}
