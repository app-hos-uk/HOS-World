'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface TenantUser {
  id: string;
  userId: string;
  role: string;
  user?: { email?: string; firstName?: string; lastName?: string };
}

interface Tenant {
  id: string;
  name: string;
  domain?: string;
  subdomain?: string;
  isActive: boolean;
  storeCount?: number;
  userCount?: number;
  stores?: any[];
  users?: TenantUser[];
}

export default function AdminTenantsPage() {
  const toast = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<Tenant | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', domain: '', subdomain: '', isActive: true });
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', domain: '', subdomain: '', isActive: true });

  // Add user state
  const [addUserTenantId, setAddUserTenantId] = useState<string | null>(null);
  const [addUserForm, setAddUserForm] = useState({ userId: '', role: 'MEMBER' });

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.adminListTenants();
      if (res.data) {
        setTenants(res.data as Tenant[]);
      }
    } catch {
      toast.error('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedData(null);
      return;
    }
    try {
      setExpandedId(id);
      setExpandLoading(true);
      const res = await apiClient.adminGetTenant(id);
      if (res.data) {
        setExpandedData(res.data as Tenant);
      }
    } catch {
      toast.error('Failed to load tenant details');
    } finally {
      setExpandLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    try {
      setCreating(true);
      await apiClient.adminCreateTenant({
        name: createForm.name,
        domain: createForm.domain || undefined,
        subdomain: createForm.subdomain || undefined,
        isActive: createForm.isActive,
      });
      toast.success('Tenant created successfully');
      setShowCreate(false);
      setCreateForm({ name: '', domain: '', subdomain: '', isActive: true });
      fetchTenants();
    } catch {
      toast.error('Failed to create tenant');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (tenant: Tenant) => {
    setEditingId(tenant.id);
    setEditForm({
      name: tenant.name,
      domain: tenant.domain || '',
      subdomain: tenant.subdomain || '',
      isActive: tenant.isActive,
    });
  };

  const handleUpdate = async (id: string) => {
    try {
      await apiClient.adminUpdateTenant(id, {
        name: editForm.name,
        domain: editForm.domain || undefined,
        subdomain: editForm.subdomain || undefined,
        isActive: editForm.isActive,
      });
      toast.success('Tenant updated');
      setEditingId(null);
      fetchTenants();
    } catch {
      toast.error('Failed to update tenant');
    }
  };

  const handleAddUser = async (tenantId: string) => {
    if (!addUserForm.userId.trim()) return;
    try {
      await apiClient.adminAddTenantUser(tenantId, addUserForm.userId, addUserForm.role);
      toast.success('User added to tenant');
      setAddUserForm({ userId: '', role: 'MEMBER' });
      setAddUserTenantId(null);
      handleExpand(tenantId);
    } catch {
      toast.error('Failed to add user');
    }
  };

  const handleRemoveUser = async (tenantId: string, userId: string) => {
    if (!confirm('Remove this user from the tenant?')) return;
    try {
      await apiClient.adminRemoveTenantUser(tenantId, userId);
      toast.success('User removed');
      handleExpand(tenantId);
    } catch {
      toast.error('Failed to remove user');
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Tenants Management</h1>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 bg-hos-gold text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            {showCreate ? 'Cancel' : '+ New Tenant'}
          </button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} className="bg-hos-bg-secondary border border-hos-border rounded-xl p-5 mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Name *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-hos-text-secondary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Domain</label>
                <input
                  type="text"
                  value={createForm.domain}
                  onChange={(e) => setCreateForm({ ...createForm, domain: e.target.value })}
                  className="w-full px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-hos-text-secondary"
                  placeholder="example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Subdomain</label>
                <input
                  type="text"
                  value={createForm.subdomain}
                  onChange={(e) => setCreateForm({ ...createForm, subdomain: e.target.value })}
                  className="w-full px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-hos-text-secondary"
                  placeholder="tenant-slug"
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createForm.isActive}
                    onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-600 peer-checked:bg-hos-gold rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>
                <span className="text-sm text-hos-text-secondary">Active</span>
              </div>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-hos-gold text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Tenant'}
            </button>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-20 text-hos-text-muted">No tenants found.</div>
        ) : (
          <div className="space-y-3">
            {tenants.map((tenant) => (
              <div key={tenant.id} className="bg-hos-bg-secondary border border-hos-border rounded-xl overflow-hidden">
                {editingId === tenant.id ? (
                  <div className="p-5 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-hos-text-secondary"
                        placeholder="Name"
                      />
                      <input
                        type="text"
                        value={editForm.domain}
                        onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })}
                        className="px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-hos-text-secondary"
                        placeholder="Domain"
                      />
                      <input
                        type="text"
                        value={editForm.subdomain}
                        onChange={(e) => setEditForm({ ...editForm, subdomain: e.target.value })}
                        className="px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-hos-text-secondary"
                        placeholder="Subdomain"
                      />
                      <div className="flex items-center gap-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.isActive}
                            onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-gray-600 peer-checked:bg-hos-gold rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                        </label>
                        <span className="text-xs text-hos-text-muted">Active</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(tenant.id)}
                        className="px-3 py-1.5 bg-hos-gold text-white rounded-lg text-sm font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 border border-hos-border text-hos-text-secondary rounded-lg text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="p-5 flex items-center justify-between cursor-pointer hover:bg-hos-bg-secondary/50"
                    onClick={() => handleExpand(tenant.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <h3 className="font-semibold text-hos-text-secondary">{tenant.name}</h3>
                        <div className="flex items-center gap-3 text-sm text-hos-text-muted mt-0.5">
                          {tenant.domain && <span>{tenant.domain}</span>}
                          {tenant.subdomain && <span className="text-hos-gold">{tenant.subdomain}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tenant.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {tenant.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {tenant.storeCount !== undefined && (
                        <span className="text-xs text-hos-text-muted">{tenant.storeCount} stores</span>
                      )}
                      {tenant.userCount !== undefined && (
                        <span className="text-xs text-hos-text-muted">{tenant.userCount} users</span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(tenant); }}
                        className="px-2 py-1 text-xs border border-hos-border text-hos-text-muted rounded hover:text-hos-text-secondary"
                      >
                        Edit
                      </button>
                      <span className="text-hos-text-muted">{expandedId === tenant.id ? '▲' : '▼'}</span>
                    </div>
                  </div>
                )}

                {expandedId === tenant.id && editingId !== tenant.id && (
                  <div className="border-t border-hos-border p-5">
                    {expandLoading ? (
                      <div className="flex justify-center py-6">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-hos-gold" />
                      </div>
                    ) : expandedData ? (
                      <div className="space-y-6">
                        {/* Stores */}
                        <div>
                          <h4 className="text-sm font-semibold text-hos-text-secondary mb-2">Stores</h4>
                          {expandedData.stores && expandedData.stores.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {expandedData.stores.map((store: any) => (
                                <div key={store.id} className="px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-sm text-hos-text-secondary">
                                  {store.name || store.storeName || store.id}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-hos-text-muted">No stores</p>
                          )}
                        </div>

                        {/* Users */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-hos-text-secondary">Users</h4>
                            <button
                              onClick={() => setAddUserTenantId(addUserTenantId === tenant.id ? null : tenant.id)}
                              className="text-xs text-hos-gold hover:underline"
                            >
                              + Add User
                            </button>
                          </div>

                          {addUserTenantId === tenant.id && (
                            <div className="flex items-center gap-2 mb-3">
                              <input
                                type="text"
                                value={addUserForm.userId}
                                onChange={(e) => setAddUserForm({ ...addUserForm, userId: e.target.value })}
                                placeholder="User ID"
                                className="flex-1 px-3 py-1.5 bg-hos-bg-secondary border border-hos-border rounded-lg text-sm text-hos-text-secondary"
                              />
                              <select
                                value={addUserForm.role}
                                onChange={(e) => setAddUserForm({ ...addUserForm, role: e.target.value })}
                                className="px-3 py-1.5 bg-hos-bg-secondary border border-hos-border rounded-lg text-sm text-hos-text-secondary"
                              >
                                <option value="ADMIN">ADMIN</option>
                                <option value="MEMBER">MEMBER</option>
                                <option value="VIEWER">VIEWER</option>
                              </select>
                              <button
                                onClick={() => handleAddUser(tenant.id)}
                                className="px-3 py-1.5 bg-hos-gold text-white rounded-lg text-sm font-medium"
                              >
                                Add
                              </button>
                            </div>
                          )}

                          {expandedData.users && expandedData.users.length > 0 ? (
                            <div className="space-y-2">
                              {expandedData.users.map((tu) => (
                                <div key={tu.id || tu.userId} className="flex items-center justify-between px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg">
                                  <div className="text-sm text-hos-text-secondary">
                                    <span className="font-medium">{tu.user?.email || tu.userId}</span>
                                    <span className="ml-2 px-1.5 py-0.5 bg-hos-gold/20 text-hos-gold text-xs rounded">{tu.role}</span>
                                  </div>
                                  <button
                                    onClick={() => handleRemoveUser(tenant.id, tu.userId)}
                                    className="text-xs text-red-400 hover:text-red-300"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-hos-text-muted">No users</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
