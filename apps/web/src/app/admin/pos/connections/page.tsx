'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';

type Connection = {
  id: string;
  storeId: string;
  provider: string;
  isActive: boolean;
  syncStatus: string;
  lastSyncedAt: string | null;
  externalOutletId?: string | null;
  externalRegisterId?: string | null;
  autoSyncProducts?: boolean;
  autoSyncInventory?: boolean;
  syncIntervalMinutes?: number;
  hasCredentials?: boolean;
  hasWebhookSecret?: boolean;
  store?: { id?: string; name?: string; code?: string; city?: string | null };
};

type Store = {
  id: string;
  name: string;
  code: string;
  sellerId?: string | null;
};

type Outlet = { id?: string; name?: string };

const INPUT_CLS =
  'w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border';

const EMPTY_FORM = {
  storeId: '',
  provider: 'lightspeed',
  domainPrefix: '',
  clientId: '',
  clientSecret: '',
  accessToken: '',
  refreshToken: '',
  externalOutletId: '',
  externalRegisterId: '',
  webhookSecret: '',
  autoSyncProducts: true,
  autoSyncInventory: true,
  syncIntervalMinutes: 60,
  isActive: true,
};

export default function AdminPosConnectionsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Connection[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Connection | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loadingOutlets, setLoadingOutlets] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getPosConnections();
      const data = (res as { data?: Connection[] })?.data;
      setItems(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadStores = useCallback(async () => {
    try {
      const res = await apiClient.adminListStores();
      const data = (res as { data?: Store[] })?.data;
      setStores(Array.isArray(data) ? data : []);
    } catch {
      setStores([]);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadStores();
  }, [load, loadStores]);

  // A store needs a seller (inherited by the connection) and can hold only one
  // connection — POSConnection.storeId is unique, so linked stores are excluded.
  const connectableStores = useMemo(() => {
    const linked = new Set(items.map((c) => c.storeId));
    return stores.filter((s) => !!s.sellerId && !linked.has(s.id));
  }, [stores, items]);
  const blockedStoreCount = stores.length - connectableStores.length;

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditing(null);
    setShowForm(false);
    setOutlets([]);
  };

  const startCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditing(null);
    setOutlets([]);
    setShowForm(true);
  };

  const startEdit = (c: Connection) => {
    setForm({
      ...EMPTY_FORM,
      storeId: c.storeId,
      provider: c.provider,
      externalOutletId: c.externalOutletId ?? '',
      externalRegisterId: c.externalRegisterId ?? '',
      autoSyncProducts: c.autoSyncProducts ?? true,
      autoSyncInventory: c.autoSyncInventory ?? true,
      syncIntervalMinutes: c.syncIntervalMinutes ?? 60,
      isActive: c.isActive,
    });
    setEditing(c);
    setOutlets([]);
    setShowForm(true);
  };

  /** Only send credentials the admin actually typed — blank means "keep existing". */
  const buildCredentials = (): Record<string, unknown> | null => {
    const creds: Record<string, unknown> = {};
    if (form.domainPrefix.trim()) creds.domainPrefix = form.domainPrefix.trim();
    if (form.clientId.trim()) creds.clientId = form.clientId.trim();
    if (form.clientSecret.trim()) creds.clientSecret = form.clientSecret.trim();
    if (form.accessToken.trim()) creds.accessToken = form.accessToken.trim();
    if (form.refreshToken.trim()) creds.refreshToken = form.refreshToken.trim();
    return Object.keys(creds).length ? creds : null;
  };

  const handleSave = async () => {
    const credentials = buildCredentials();

    if (!editing) {
      if (!form.storeId) {
        toast.error('Select a store');
        return;
      }
      if (!form.domainPrefix.trim()) {
        toast.error('Domain prefix is required');
        return;
      }
    }
    if (form.syncIntervalMinutes < 5) {
      toast.error('Sync interval must be at least 5 minutes');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await apiClient.updatePosConnection(editing.id, {
          ...(credentials ? { credentials } : {}),
          externalOutletId: form.externalOutletId.trim(),
          externalRegisterId: form.externalRegisterId.trim(),
          ...(form.webhookSecret.trim() ? { webhookSecret: form.webhookSecret.trim() } : {}),
          autoSyncProducts: form.autoSyncProducts,
          autoSyncInventory: form.autoSyncInventory,
          syncIntervalMinutes: form.syncIntervalMinutes,
          isActive: form.isActive,
        });
        toast.success('Connection updated');
      } else {
        await apiClient.createPosConnection({
          storeId: form.storeId,
          provider: form.provider,
          credentials: credentials ?? {},
          ...(form.externalOutletId.trim()
            ? { externalOutletId: form.externalOutletId.trim() }
            : {}),
          ...(form.externalRegisterId.trim()
            ? { externalRegisterId: form.externalRegisterId.trim() }
            : {}),
          ...(form.webhookSecret.trim() ? { webhookSecret: form.webhookSecret.trim() } : {}),
          autoSyncProducts: form.autoSyncProducts,
          autoSyncInventory: form.autoSyncInventory,
          syncIntervalMinutes: form.syncIntervalMinutes,
        });
        toast.success('Connection created — test it, then map an outlet');
      }
      resetForm();
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Connection) => {
    const label = c.store?.name || c.provider;
    if (!confirm(`Delete the POS connection for ${label}? Sync will stop immediately.`)) return;
    try {
      await apiClient.deletePosConnection(c.id);
      toast.success('Connection deleted');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const test = async (id: string) => {
    try {
      const res = await apiClient.testPosConnection(id);
      const body = (res as { data?: { success?: boolean; error?: string; outlets?: Outlet[] } })
        ?.data;
      if (body?.success) {
        toast.success(`Connection OK — ${body.outlets?.length ?? 0} outlet(s) visible`);
      } else {
        toast.error(body?.error || 'Test failed');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Test failed');
    }
  };

  /** Outlets come from the live POS, so this needs a saved connection with credentials. */
  const loadOutlets = async () => {
    if (!editing) return;
    setLoadingOutlets(true);
    try {
      const res = await apiClient.getPosOutlets(editing.id);
      const data = (res as { data?: Outlet[] })?.data;
      const list = Array.isArray(data) ? data : [];
      setOutlets(list);
      if (!list.length) toast.error('No outlets returned — check credentials');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not load outlets');
    } finally {
      setLoadingOutlets(false);
    }
  };

  const runSync = async (id: string, kind: 'products' | 'inventory') => {
    try {
      if (kind === 'products') {
        await apiClient.triggerPosProductSync(id);
        toast.success('Product sync queued for this store');
      } else {
        await apiClient.triggerPosInventorySync(id);
        toast.success('Inventory reconciliation queued for this store');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Queue failed');
    }
  };

  /**
   * Customer sync is platform-wide: it queues loyalty members to every connected
   * POS store, so it is a page-level action. The endpoint is per-connection only
   * because it uses the id as an existence check.
   */
  const syncAllCustomers = async () => {
    const anyConnection = items[0];
    if (!anyConnection) return;
    try {
      const res = await apiClient.triggerPosCustomerSync(anyConnection.id);
      const queued = (res as { data?: { queued?: number } })?.data?.queued ?? 0;
      toast.success(`Queued ${queued} loyalty member(s) for sync to all POS stores`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Queue failed');
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/admin/pos" className="text-sm text-hos-gold hover:text-hos-gold">
              ← POS home
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-hos-text-secondary">POS connections</h1>
            <p className="text-sm text-hos-text-muted mt-1">
              Connect a store to Lightspeed, map its outlet, and run syncs.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={startCreate}
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover text-sm font-medium whitespace-nowrap"
            >
              + New connection
            </button>
            <button
              type="button"
              onClick={() => void syncAllCustomers()}
              disabled={items.length === 0}
              className="text-sm text-hos-gold hover:text-hos-gold-hover disabled:opacity-40 whitespace-nowrap"
            >
              Sync loyalty customers → all POS stores
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs text-amber-200/70">
            POS only runs when <code className="text-amber-300">POS_ENABLED=true</code> is set in the
            deployment <em>and</em> the <code className="text-amber-300">POS_INTEGRATION</code> flag is on
            in <Link href="/admin/feature-flags" className="underline">Feature Flags</Link>. Credentials
            are encrypted before storage and are never returned by the API.
          </p>
        </div>

        {showForm && (
          <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-hos-text-secondary">
              {editing
                ? `Edit connection — ${editing.store?.name || editing.provider}`
                : 'New POS connection'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Store</label>
                {editing ? (
                  <input className={INPUT_CLS} value={editing.store?.name || editing.storeId} disabled />
                ) : (
                  <select
                    className={INPUT_CLS}
                    value={form.storeId}
                    onChange={(e) => setForm({ ...form, storeId: e.target.value })}
                  >
                    <option value="">Select a store…</option>
                    {connectableStores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                )}
                {!editing && connectableStores.length === 0 && (
                  <p className="text-xs text-amber-300 mt-1">
                    No eligible stores. Create one under{' '}
                    <Link href="/admin/stores" className="underline">
                      Stores
                    </Link>{' '}
                    and make sure it has a seller assigned.
                  </p>
                )}
                {!editing && blockedStoreCount > 0 && (
                  <p className="text-xs text-hos-text-muted mt-1">
                    {blockedStoreCount} store(s) hidden — a store needs a seller and can only hold one
                    POS connection.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Provider</label>
                <select
                  className={INPUT_CLS}
                  value={form.provider}
                  disabled={!!editing}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
                >
                  <option value="lightspeed">Lightspeed</option>
                </select>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-hos-text-secondary mb-2">
              Lightspeed credentials
              {editing && (
                <span className="ml-2 font-normal text-xs text-hos-text-muted">
                  {editing.hasCredentials
                    ? 'stored — leave blank to keep existing'
                    : 'none stored yet'}
                </span>
              )}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                  Domain prefix{!editing && ' *'}
                </label>
                <input
                  className={INPUT_CLS}
                  placeholder="e.g. houseofspells"
                  value={form.domainPrefix}
                  onChange={(e) => setForm({ ...form, domainPrefix: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Client ID</label>
                <input
                  className={INPUT_CLS}
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                  Client secret
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={INPUT_CLS}
                  value={form.clientSecret}
                  onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                  Access token
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={INPUT_CLS}
                  value={form.accessToken}
                  onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                  Refresh token
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={INPUT_CLS}
                  value={form.refreshToken}
                  onChange={(e) => setForm({ ...form, refreshToken: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                  Webhook secret
                  {editing && editing.hasWebhookSecret && (
                    <span className="ml-2 font-normal text-xs text-hos-text-muted">stored</span>
                  )}
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={INPUT_CLS}
                  value={form.webhookSecret}
                  onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
                />
              </div>
            </div>

            <h3 className="text-sm font-semibold text-hos-text-secondary mb-2">Outlet mapping</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                  Outlet ID
                </label>
                {outlets.length > 0 ? (
                  <select
                    className={INPUT_CLS}
                    value={form.externalOutletId}
                    onChange={(e) => setForm({ ...form, externalOutletId: e.target.value })}
                  >
                    <option value="">Select an outlet…</option>
                    {outlets.map((o) => (
                      <option key={String(o.id)} value={String(o.id ?? '')}>
                        {o.name || o.id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={INPUT_CLS}
                    placeholder="Lightspeed outlet id"
                    value={form.externalOutletId}
                    onChange={(e) => setForm({ ...form, externalOutletId: e.target.value })}
                  />
                )}
                {editing ? (
                  <button
                    type="button"
                    onClick={() => void loadOutlets()}
                    disabled={loadingOutlets}
                    className="mt-2 text-sm text-hos-gold hover:text-hos-gold-hover disabled:opacity-50"
                  >
                    {loadingOutlets ? 'Loading outlets…' : 'Load outlets from Lightspeed'}
                  </button>
                ) : (
                  <p className="text-xs text-hos-text-muted mt-1">
                    Save the connection first, then reopen it to pick from live outlets.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                  Register ID
                </label>
                <input
                  className={INPUT_CLS}
                  placeholder="optional"
                  value={form.externalRegisterId}
                  onChange={(e) => setForm({ ...form, externalRegisterId: e.target.value })}
                />
              </div>
            </div>

            <h3 className="text-sm font-semibold text-hos-text-secondary mb-2">Sync behaviour</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                  Sync interval (minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  className={INPUT_CLS}
                  value={form.syncIntervalMinutes}
                  onChange={(e) =>
                    setForm({ ...form, syncIntervalMinutes: parseInt(e.target.value, 10) || 0 })
                  }
                />
              </div>
              <div className="flex flex-col justify-center gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="posAutoProducts"
                    className="rounded"
                    checked={form.autoSyncProducts}
                    onChange={(e) => setForm({ ...form, autoSyncProducts: e.target.checked })}
                  />
                  <label htmlFor="posAutoProducts" className="text-sm text-hos-text-secondary">
                    Auto-sync products
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="posAutoInventory"
                    className="rounded"
                    checked={form.autoSyncInventory}
                    onChange={(e) => setForm({ ...form, autoSyncInventory: e.target.checked })}
                  />
                  <label htmlFor="posAutoInventory" className="text-sm text-hos-text-secondary">
                    Auto-sync inventory
                  </label>
                </div>
                {editing && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="posActive"
                      className="rounded"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    />
                    <label htmlFor="posActive" className="text-sm text-hos-text-secondary">
                      Connection active
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 text-sm font-medium"
              >
                {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-hos-border rounded-lg hover:bg-hos-bg-tertiary text-sm font-medium text-hos-text-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-hos-text-muted">Loading…</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-hos-border bg-hos-bg-secondary shadow">
            <table className="min-w-full divide-y divide-hos-border">
              <thead className="bg-hos-bg-secondary">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                    Store
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                    Provider
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                    Outlet
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                    Sync
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-hos-text-muted">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hos-border bg-hos-bg-secondary">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-hos-text-muted">
                      No POS connections yet. Use <strong>+ New connection</strong> to link a store to
                      Lightspeed.
                    </td>
                  </tr>
                ) : (
                  items.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 text-sm text-hos-text-secondary">
                        {c.store?.name ?? '—'}{' '}
                        <span className="text-hos-text-muted">({c.store?.code})</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-hos-text-secondary">{c.provider}</td>
                      <td className="px-4 py-3 text-sm">
                        {c.isActive ? (
                          <span className="text-green-400">Active</span>
                        ) : (
                          <span className="text-hos-text-muted">Inactive</span>
                        )}
                        {!c.hasCredentials && (
                          <span className="ml-2 text-xs text-amber-300">no credentials</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-hos-text-secondary">
                        {c.externalOutletId || (
                          <span className="text-amber-300">unmapped</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-hos-text-secondary">{c.syncStatus}</td>
                      <td className="px-4 py-3 text-right text-sm">
                        <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                          <button
                            type="button"
                            onClick={() => void test(c.id)}
                            className="text-hos-gold hover:text-hos-gold-hover"
                          >
                            Test
                          </button>
                          <button
                            type="button"
                            onClick={() => void runSync(c.id, 'products')}
                            className="text-hos-gold hover:text-hos-gold-hover"
                          >
                            Sync products
                          </button>
                          <button
                            type="button"
                            onClick={() => void runSync(c.id, 'inventory')}
                            disabled={!c.isActive}
                            title={
                              !c.isActive
                                ? 'Reconciliation skips inactive connections'
                                : !c.externalOutletId
                                  ? 'Without a mapped outlet this may not reconcile anything'
                                  : undefined
                            }
                            className="text-hos-gold hover:text-hos-gold-hover disabled:opacity-40 disabled:hover:text-hos-gold"
                          >
                            Sync inventory
                          </button>
                          <button
                            type="button"
                            onClick={() => startEdit(c)}
                            className="text-hos-gold hover:text-hos-gold-hover"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(c)}
                            className="text-red-400 hover:text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
