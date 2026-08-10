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
  const [loaded, setLoaded] = useState(false);

  const [tenantId, setTenantId] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [countryCode, setCountryCode] = useState('US');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);

  const [domainPrefix, setDomainPrefix] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [externalOutletId, setExternalOutletId] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient
      .adminListTenants()
      .catch(() => ({ data: [] }))
      .then((tRes) => {
        const tRows = (tRes.data ?? []) as Record<string, unknown>[];
        const tList = tRows
          .filter((t) => t?.id)
          .map((t) => ({ id: String(t.id), name: String(t.name ?? t.id) }));
        setTenants(tList);
        if (tList.length === 1) setTenantId(tList[0].id);
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
    if (!tenantId) {
      toast.error('Select a tenant');
      return;
    }
    if (!name.trim()) {
      toast.error('Store name is required');
      return;
    }
    if (!code.trim()) {
      toast.error('Store code is required');
      return;
    }
    if (!domainPrefix.trim() || !clientId.trim() || !clientSecret.trim() || !accessToken.trim() || !refreshToken.trim()) {
      toast.error('Lightspeed credentials are required');
      return;
    }

    setSaving(true);
    try {
      const countryName = COUNTRIES.find((c) => c.code === countryCode)?.name || countryCode;
      const r = await apiClient.adminCreateStore({
        tenantId,
        name: name.trim(),
        code: code.trim(),
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        country: countryName,
        countryCode,
        currency,
        defaultRegionCode: countryCode,
        lightspeed: {
          domainPrefix: domainPrefix.trim(),
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          accessToken: accessToken.trim(),
          refreshToken: refreshToken.trim(),
          webhookSecret: webhookSecret.trim() || undefined,
          externalOutletId: externalOutletId.trim() || undefined,
        },
      });
      const sid = (r.data as Record<string, unknown>)?.id;
      toast.success('Store connected');
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
        <div className="p-6 max-w-2xl mx-auto text-hos-text-muted">Loading…</div>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <Link href="/admin/stores" className="text-sm text-violet-400">
          ← Stores
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-hos-text-secondary">Connect a store</h1>
          <p className="text-sm text-hos-text-muted mt-1">
            Create the store and Lightspeed POS connection in one step for loyalty.
          </p>
        </div>

        {tenants.length <= 1 ? null : (
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Tenant</span>
            <select className={INPUT_CLS} value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
              <option value="">Select a tenant</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <section className="space-y-4">
          <h2 className="text-lg font-medium text-hos-text-secondary">Store</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="text-hos-text-secondary">Store name *</span>
              <input
                className={INPUT_CLS}
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="NYC Times Square"
              />
            </label>
            <label className="block text-sm">
              <span className="text-hos-text-secondary">Code *</span>
              <input
                className={INPUT_CLS}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="NYC-TS"
              />
              <span className="text-xs text-hos-text-muted">Auto-generated from name; editable</span>
            </label>
          </div>

          <label className="block text-sm">
            <span className="text-hos-text-secondary">Address</span>
            <input
              className={INPUT_CLS}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="text-hos-text-secondary">City</span>
              <input className={INPUT_CLS} value={city} onChange={(e) => setCity(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-hos-text-secondary">Postcode</span>
              <input
                className={INPUT_CLS}
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
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
              <input
                className={INPUT_CLS}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium text-hos-text-secondary">Lightspeed</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-sm sm:col-span-2">
              <span className="text-hos-text-secondary">Domain prefix *</span>
              <input
                className={INPUT_CLS}
                value={domainPrefix}
                onChange={(e) => setDomainPrefix(e.target.value)}
                placeholder="yourstore"
              />
            </label>
            <label className="block text-sm">
              <span className="text-hos-text-secondary">Client ID *</span>
              <input
                className={INPUT_CLS}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="block text-sm">
              <span className="text-hos-text-secondary">Client secret *</span>
              <input
                className={INPUT_CLS}
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="block text-sm">
              <span className="text-hos-text-secondary">Access token *</span>
              <input
                className={INPUT_CLS}
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="block text-sm">
              <span className="text-hos-text-secondary">Refresh token *</span>
              <input
                className={INPUT_CLS}
                type="password"
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="block text-sm">
              <span className="text-hos-text-secondary">Outlet ID (optional)</span>
              <input
                className={INPUT_CLS}
                value={externalOutletId}
                onChange={(e) => setExternalOutletId(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-hos-text-secondary">Webhook secret (optional)</span>
              <input
                className={INPUT_CLS}
                type="password"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                autoComplete="off"
              />
            </label>
          </div>
        </section>

        <button
          type="button"
          disabled={saving || !tenantId}
          onClick={save}
          className="w-full rounded-md bg-violet-700 px-4 py-2.5 text-white font-medium disabled:opacity-50 hover:bg-violet-600"
        >
          {saving ? 'Connecting…' : 'Connect store'}
        </button>

        {tenants.length === 0 && (
          <p className="text-xs text-amber-400">
            No tenants found.{' '}
            <Link href="/admin/tenants" className="underline">
              Create a tenant
            </Link>{' '}
            first.
          </p>
        )}
      </div>
    </RouteGuard>
  );
}

function slugify(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20);
}
