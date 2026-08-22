'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

type StoreOption = { id: string; name: string; code: string };
type StaffUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  createdAt: string;
};

const INPUT_CLS =
  'mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border';

export default function AdminStoreStaffPage() {
  const toast = useToast();
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [storeId, setStoreId] = useState('');

  const loadStaff = useCallback(async () => {
    setStaffLoading(true);
    try {
      const res = await apiClient.getUsers({ role: 'STORE_STAFF', limit: 100 });
      const rows = res?.data?.data ?? res?.data ?? [];
      setStaffUsers(Array.isArray(rows) ? rows : []);
    } catch {
      setStaffUsers([]);
    } finally {
      setStaffLoading(false);
    }
  }, []);

  useEffect(() => {
    apiClient
      .adminListStores()
      .catch(() => ({ data: [] }))
      .then((r) => {
        const rows = (r.data ?? []) as Record<string, unknown>[];
        setStores(
          rows
            .filter((s) => s?.id)
            .map((s) => ({
              id: String(s.id),
              name: String(s.name ?? s.id),
              code: String(s.code ?? ''),
            })),
        );
        setLoaded(true);
      });
    void loadStaff();
  }, [loadStaff]);

  const save = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error('Email and password are required');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!storeId) {
      toast.error('Select a store');
      return;
    }

    setSaving(true);
    try {
      await apiClient.createUser({
        email: email.trim(),
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        role: 'STORE_STAFF',
        storeId,
      });
      toast.success('Store staff user created');
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');
      void loadStaff();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create staff');
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
      <div className="p-6 max-w-2xl mx-auto space-y-8">
        <Link href="/admin/stores" className="text-sm text-violet-400">
          ← Stores
        </Link>

        {/* ── Existing staff listing ── */}
        <div>
          <h1 className="text-2xl font-semibold text-hos-text-secondary">Store staff</h1>
          <p className="text-sm text-hos-text-muted mt-1">
            Manage store staff logins for customer lookup and in-store operations.
          </p>
        </div>

        <div className="bg-hos-bg-secondary border border-hos-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-hos-border">
            <h2 className="text-sm font-medium text-hos-text-secondary">Current staff ({staffUsers.length})</h2>
          </div>
          {staffLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
            </div>
          ) : staffUsers.length === 0 ? (
            <div className="p-6 text-center text-hos-text-muted text-sm">
              No store staff users yet. Create one below.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-hos-bg-tertiary/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-hos-text-muted">Name</th>
                  <th className="text-left px-4 py-2 font-medium text-hos-text-muted">Email</th>
                  <th className="text-left px-4 py-2 font-medium text-hos-text-muted">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hos-border">
                {staffUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-hos-bg-tertiary">
                    <td className="px-4 py-2.5 text-hos-text-secondary">
                      {[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-hos-text-secondary font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          u.isActive
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Create new staff ── */}
        <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-5 space-y-4">
          <h2 className="text-lg font-medium text-hos-text-secondary">Add store staff</h2>

          <label className="block text-sm">
            <span className="text-hos-text-secondary">Store *</span>
            <select className={INPUT_CLS} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="">Select a store</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="text-hos-text-secondary">First name</span>
              <input className={INPUT_CLS} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-hos-text-secondary">Last name</span>
              <input className={INPUT_CLS} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
          </div>

          <label className="block text-sm">
            <span className="text-hos-text-secondary">Email *</span>
            <input
              className={INPUT_CLS}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
          </label>

          <label className="block text-sm">
            <span className="text-hos-text-secondary">Password *</span>
            <input
              className={INPUT_CLS}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>

          <button
            type="button"
            disabled={saving || stores.length === 0}
            onClick={() => void save()}
            className="w-full rounded-md bg-violet-700 px-4 py-2.5 text-white font-medium disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create store staff'}
          </button>

          {stores.length === 0 && (
            <p className="text-xs text-amber-400">
              No stores found.{' '}
              <Link href="/admin/stores/new" className="underline">
                Connect a store
              </Link>{' '}
              first.
            </p>
          )}
        </div>

        <p className="text-xs text-hos-text-muted">
          Staff can sign in and will be redirected to{' '}
          <Link href="/store/lookup" className="underline text-violet-400">
            /store/lookup
          </Link>
          .
        </p>
      </div>
    </RouteGuard>
  );
}
