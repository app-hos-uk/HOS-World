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

type Option = { id: string; name: string };

const INPUT_CLS =
  'mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border';

export default function AdminStoreNewPage() {
  const router = useRouter();
  const toast = useToast();

  const [tenants, setTenants] = useState<Option[]>([]);
  const [sellers, setSellers] = useState<Option[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [tenantId, setTenantId] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [countryCode, setCountryCode] = useState('US');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient.adminListTenants().catch(() => ({ data: [] })),
      apiClient.getAdminSellers({ page: 1, limit: 200 }).catch(() => ({ data: [] })),
    ]).then(([tRes, sRes]) => {
      const tRows = (tRes.data ?? []) as Record<string, unknown>[];
      const tList = tRows.filter((t) => t?.id).map((t) => ({ id: String(t.id), name: String(t.name ?? t.id) }));
      setTenants(tList);
      if (tList.length === 1) setTenantId(tList[0].id);

      const sRaw = ((sRes.data as Record<string, unknown>)?.sellers ?? sRes.data) as Record<string, unknown>[];
      const sList = (Array.isArray(sRaw) ? sRaw : [])
        .filter((s) => s?.id)
        .map((s) => ({ id: String(s.id), name: String(s.storeName || s.businessName || s.id) }));
      setSellers(sList);
      if (sList.length === 1) setSellerId(sList[0].id);

      setLoaded(true);
    });
  }, []);

  const handleNameChange = (v: string) => {
    setName(v);
    if (!code || code === slugify(name)) {
      setCode(slugify(v));
    }
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cc = e.target.value;
    setCountryCode(cc);
    const mapped = COUNTRY_TO_CURRENCY[cc];
    if (mapped) setCurrency(mapped);
  };

  const save = async () => {
    if (!tenantId) { toast.error('Select a tenant'); return; }
    if (!name.trim()) { toast.error('Store name is required'); return; }
    if (!code.trim()) { toast.error('Store code is required'); return; }
    setSaving(true);
    try {
      const countryName = COUNTRIES.find((c) => c.code === countryCode)?.name || countryCode;
      const r = await apiClient.adminCreateStore({
        tenantId,
        sellerId: sellerId || undefined,
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
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <RouteGuard allowedRoles={['ADMIN']}>
        <div className="p-6 max-w-lg mx-auto text-hos-text-muted">Loading…</div>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="p-6 max-w-lg mx-auto space-y-5">
        <Link href="/admin/stores" className="text-sm text-violet-400">← Stores</Link>
        <h1 className="text-2xl font-semibold text-hos-text-secondary">New store</h1>

        {tenants.length <= 1 ? null : (
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Tenant</span>
            <select className={INPUT_CLS} value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
              <option value="">Select a tenant</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Store name *</span>
            <input className={INPUT_CLS} value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="NYC Times Square" />
          </label>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Code *</span>
            <input className={INPUT_CLS} value={code} onChange={(e) => setCode(e.target.value)} placeholder="NYC-TS" />
            <span className="text-xs text-hos-text-muted">Unique store identifier</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="text-sm">
            <span className="text-hos-text-secondary">Country</span>
            <CountrySelect
              id="store-country"
              name="countryCode"
              value={countryCode}
              onChange={handleCountryChange}
              className={INPUT_CLS}
            />
          </div>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Currency</span>
            <input className={INPUT_CLS} value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </label>
        </div>

        {sellers.length > 0 && (
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Seller (for POS)</span>
            <select className={INPUT_CLS} value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
              <option value="">None — assign later</option>
              {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <span className="text-xs text-hos-text-muted">Required for POS connection. Can be set later.</span>
          </label>
        )}

        <button
          type="button"
          disabled={saving || !tenantId}
          onClick={save}
          className="w-full rounded-md bg-violet-700 px-4 py-2.5 text-white font-medium disabled:opacity-50 hover:bg-violet-600"
        >
          {saving ? 'Creating…' : 'Create store'}
        </button>

        {tenants.length === 0 && (
          <p className="text-xs text-amber-400">
            No tenants found. <Link href="/admin/tenants" className="underline">Create a tenant</Link> first.
          </p>
        )}
      </div>
    </RouteGuard>
  );
}

function slugify(s: string): string {
  return s.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20);
}
