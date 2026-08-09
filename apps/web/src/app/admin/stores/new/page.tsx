'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { DEFAULT_CURRENCY, COUNTRY_TO_CURRENCY } from '@/lib/regionConfig';
import { CountrySelect } from '@/components/CountrySelect';
import { COUNTRIES } from '@/lib/countries';

type TenantOption = { id: string; name: string };

export default function AdminStoreNewPage() {
  const router = useRouter();
  const toast = useToast();
  const [tenantId, setTenantId] = useState('');
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantsLoaded, setTenantsLoaded] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [countryCode, setCountryCode] = useState('US');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient
      .adminListTenants()
      .then((r) => {
        const rows = (r.data ?? []) as Record<string, unknown>[];
        const list = rows
          .filter((t) => t?.id)
          .map((t) => ({ id: String(t.id), name: String(t.name ?? t.id) }));
        setTenants(list);
        if (list.length === 1) setTenantId(list[0].id);
      })
      .catch((e: unknown) => {
        console.error('adminListTenants failed:', e instanceof Error ? e.message : e);
      })
      .finally(() => setTenantsLoaded(true));
  }, []);

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cc = e.target.value;
    setCountryCode(cc);
    const mapped = COUNTRY_TO_CURRENCY[cc];
    if (mapped) setCurrency(mapped);
  };

  const save = async () => {
    if (!tenantId) {
      toast.error('Select a tenant');
      return;
    }
    if (!name.trim() || !code.trim()) {
      toast.error('Name and code are required');
      return;
    }
    setSaving(true);
    try {
      const countryName = COUNTRIES.find((c) => c.code === countryCode)?.name || countryCode;
      const r = await apiClient.adminCreateStore({
        tenantId,
        name: name.trim(),
        code: code.trim(),
        country: countryName,
        countryCode,
        currency,
        defaultRegionCode: countryCode,
        isActive: false,
      });
      const sid = (r.data as Record<string, unknown>)?.id;
      toast.success('Store created');
      router.push(sid ? `/admin/stores/${sid}` : '/admin/stores');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
              <div className="p-6 max-w-lg mx-auto space-y-4">
          <Link href="/admin/stores" className="text-sm text-violet-400">
            ← Stores
          </Link>
          <h1 className="text-2xl font-semibold text-hos-text-secondary">New store</h1>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Tenant</span>
            <select
              className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary focus:outline-none border-hos-border"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              disabled={!tenantsLoaded || tenants.length === 0}
            >
              <option value="">
                {!tenantsLoaded
                  ? 'Loading tenants…'
                  : tenants.length === 0
                    ? 'No tenants available'
                    : 'Select a tenant'}
              </option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          {tenantsLoaded && tenants.length === 0 && (
            <p className="text-xs text-amber-400">
              No tenants exist yet. A store must belong to a tenant, so create one first from{' '}
              <Link href="/admin/tenants" className="underline">
                Tenants
              </Link>
              .
            </p>
          )}
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Name</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Code</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <div className="block text-sm">
            <span className="text-hos-text-secondary">Country</span>
            <CountrySelect
              id="store-country"
              name="countryCode"
              value={countryCode}
              onChange={handleCountryChange}
              className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary focus:outline-none border-hos-border"
            />
          </div>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Currency</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="rounded-md bg-violet-700 px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
          </RouteGuard>
  );
}
