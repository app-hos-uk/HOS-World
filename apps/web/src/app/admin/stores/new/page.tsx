'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminStoreNewPage() {
  const router = useRouter();
  const toast = useToast();
  const [tenantId, setTenantId] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [country, setCountry] = useState('GB');
  const [currency, setCurrency] = useState('USD');
  const [region, setRegion] = useState('GB');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient
      .adminListStores()
      .then((r) => {
        const d = r.data as Record<string, unknown>[] | undefined;
        const first = d?.[0] as Record<string, unknown> | undefined;
        const t = first?.tenant as Record<string, string> | undefined;
        if (t?.id) setTenantId(t.id);
      })
      .catch((e: unknown) => {
        console.error('adminListStores failed:', e instanceof Error ? e.message : e);
      });
  }, []);

  const save = async () => {
    if (!tenantId || !name.trim() || !code.trim()) {
      toast.error('Tenant, name, and code are required');
      return;
    }
    setSaving(true);
    try {
      const r = await apiClient.adminCreateStore({
        tenantId,
        name: name.trim(),
        code: code.trim(),
        country,
        currency,
        defaultRegionCode: region,
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

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
              <div className="p-6 max-w-lg mx-auto space-y-4">
          <Link href="/admin/stores" className="text-sm text-violet-400">
            ← Stores
          </Link>
          <h1 className="text-2xl font-semibold text-hos-text-secondary">New store</h1>
          <p className="text-xs text-hos-text-muted">
            Tenant ID defaults from your first existing store if available; override if needed.
          </p>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Tenant ID</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2 font-mono text-sm bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            />
          </label>
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
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Country</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Currency</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Default region code</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
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
