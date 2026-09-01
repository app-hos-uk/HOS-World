'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import type { AccessScopeType } from '@hos-marketplace/shared-types';

interface PermissionRoleOption {
  id: string;
  name: string;
  scopeKind: string;
  isSystem: boolean;
}

interface Assignment {
  id: string;
  userId: string;
  permissionRoleId: string;
  permissionRole: { id: string; name: string; scopeKind: string };
  scopeType: string;
  scopeId: string | null;
  isActive: boolean;
  createdAt: string;
}

interface MarketOption {
  id: string;
  code: string;
  name: string;
}

interface StoreOption {
  id: string;
  name: string;
  code?: string;
}

interface UserSearchResult {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

const SCOPE_TYPES: AccessScopeType[] = ['GLOBAL', 'MARKET', 'STORE'];

export default function RoleAssignmentsPage() {
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [roles, setRoles] = useState<PermissionRoleOption[]>([]);
  const [markets, setMarkets] = useState<MarketOption[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const [newAssignment, setNewAssignment] = useState({
    permissionRoleId: '',
    scopeType: 'GLOBAL' as AccessScopeType,
    scopeId: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const [rolesRes, marketsRes, storesRes] = await Promise.all([
          apiClient.listPermissionRolesDetailed(),
          apiClient.listAdminMarkets(),
          apiClient.listStoresForScope(),
        ]);
        setRoles(rolesRes?.data || []);
        setMarkets(marketsRes?.data || []);
        setStores(storesRes?.data || []);
      } catch {
        toast.error('Failed to load reference data');
      }
    })();
  }, []);

  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await apiClient.getUsers({ page: 1, limit: 10, search: query });
      const users = (res?.data as any)?.users || res?.data || [];
      setSearchResults(Array.isArray(users) ? users : []);
    } catch {
      setSearchResults([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchUsers(userSearch), 300);
    return () => clearTimeout(timer);
  }, [userSearch, searchUsers]);

  const loadAssignments = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const res = await apiClient.listRoleAssignments(userId);
      setAssignments(res?.data || []);
    } catch {
      toast.error('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, []);

  const selectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setUserSearch('');
    setSearchResults([]);
    loadAssignments(user.id);
  };

  const handleAdd = async () => {
    if (!selectedUser || !newAssignment.permissionRoleId) {
      toast.error('Select a role');
      return;
    }
    if (newAssignment.scopeType !== 'GLOBAL' && !newAssignment.scopeId) {
      toast.error(`Select a ${newAssignment.scopeType.toLowerCase()} scope`);
      return;
    }
    try {
      await apiClient.createRoleAssignment({
        userId: selectedUser.id,
        permissionRoleId: newAssignment.permissionRoleId,
        scopeType: newAssignment.scopeType,
        scopeId: newAssignment.scopeType === 'GLOBAL' ? undefined : newAssignment.scopeId,
      });
      toast.success('Assignment created');
      setShowAddModal(false);
      setNewAssignment({ permissionRoleId: '', scopeType: 'GLOBAL', scopeId: '' });
      loadAssignments(selectedUser.id);
    } catch (e: any) {
      toast.error(e.message || 'Failed to create assignment');
    }
  };

  const handleDelete = async (assignmentId: string) => {
    if (!selectedUser) return;
    if (!confirm('Remove this role assignment?')) return;
    try {
      await apiClient.deleteRoleAssignment(assignmentId);
      toast.success('Assignment removed');
      loadAssignments(selectedUser.id);
    } catch (e: any) {
      toast.error(e.message || 'Failed to remove assignment');
    }
  };

  const scopeLabel = (a: Assignment) => {
    if (a.scopeType === 'GLOBAL') return 'Global';
    if (a.scopeType === 'MARKET') {
      const m = markets.find((x) => x.id === a.scopeId);
      return m ? `Market: ${m.name} (${m.code})` : `Market: ${a.scopeId}`;
    }
    if (a.scopeType === 'STORE') {
      const s = stores.find((x) => x.id === a.scopeId);
      return s ? `Store: ${s.name}` : `Store: ${a.scopeId}`;
    }
    return `${a.scopeType}: ${a.scopeId || '—'}`;
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Role Assignments</h1>
        <p className="text-hos-text-secondary mt-2">
          Assign permission roles to users with specific scopes (Global, Market, Store)
        </p>
      </div>

      {/* User Search */}
      <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6 mb-6">
        <h2 className="font-semibold mb-3">Select User</h2>
        <div className="relative">
          <input
            type="text"
            value={selectedUser ? `${selectedUser.firstName || ''} ${selectedUser.lastName || ''} (${selectedUser.email})`.trim() : userSearch}
            onChange={(e) => {
              setUserSearch(e.target.value);
              if (selectedUser) {
                setSelectedUser(null);
                setAssignments([]);
              }
            }}
            placeholder="Search by name or email..."
            className="input w-full"
          />
          {searchResults.length > 0 && !selectedUser && (
            <div className="absolute z-10 w-full mt-1 bg-hos-bg-secondary border border-hos-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => selectUser(u)}
                  className="w-full text-left px-4 py-3 hover:bg-hos-bg-tertiary border-b border-hos-border last:border-0"
                >
                  <div className="font-medium">{u.firstName} {u.lastName}</div>
                  <div className="text-sm text-hos-text-muted">{u.email} &middot; {u.role}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedUser && (
        <>
          {/* User Info Bar */}
          <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-4 mb-6 flex items-center justify-between">
            <div>
              <span className="font-semibold">{selectedUser.firstName} {selectedUser.lastName}</span>
              <span className="text-hos-text-muted ml-2">({selectedUser.email})</span>
              <span className="ml-3 px-2 py-0.5 text-xs rounded bg-hos-gold/20 text-hos-gold-hover">
                {selectedUser.role}
              </span>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover font-medium"
            >
              + Add Assignment
            </button>
          </div>

          {/* Assignments Table */}
          <div className="bg-hos-bg-secondary border border-hos-border rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-hos-text-muted">Loading assignments...</div>
            ) : assignments.length === 0 ? (
              <div className="p-8 text-center text-hos-text-muted">
                No explicit role assignments. This user inherits permissions from their platform role ({selectedUser.role}).
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-hos-border">
                    <th className="text-left px-4 py-3 text-sm font-semibold text-hos-text-secondary">Role</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-hos-text-secondary">Scope</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-hos-text-secondary">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-hos-text-secondary">Created</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-hos-text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id} className="border-b border-hos-border last:border-0">
                      <td className="px-4 py-3">
                        <span className="font-medium">{a.permissionRole.name}</span>
                        <span className="text-xs text-hos-text-muted ml-2">({a.permissionRole.scopeKind})</span>
                      </td>
                      <td className="px-4 py-3 text-sm">{scopeLabel(a)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded ${a.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {a.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-hos-text-muted">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="text-sm text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Add Assignment Modal */}
      {showAddModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-hos-bg-secondary rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Add Role Assignment for {selectedUser.firstName} {selectedUser.lastName}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Permission Role *</label>
                <select
                  value={newAssignment.permissionRoleId}
                  onChange={(e) => setNewAssignment({ ...newAssignment, permissionRoleId: e.target.value })}
                  className="select w-full"
                >
                  <option value="">Select a role...</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.scopeKind})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Scope Type *</label>
                <select
                  value={newAssignment.scopeType}
                  onChange={(e) => setNewAssignment({ ...newAssignment, scopeType: e.target.value as AccessScopeType, scopeId: '' })}
                  className="select w-full"
                >
                  {SCOPE_TYPES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              {newAssignment.scopeType === 'MARKET' && (
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Market *</label>
                  <select
                    value={newAssignment.scopeId}
                    onChange={(e) => setNewAssignment({ ...newAssignment, scopeId: e.target.value })}
                    className="select w-full"
                  >
                    <option value="">Select a market...</option>
                    {markets.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {newAssignment.scopeType === 'STORE' && (
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Store *</label>
                  <select
                    value={newAssignment.scopeId}
                    onChange={(e) => setNewAssignment({ ...newAssignment, scopeId: e.target.value })}
                    className="select w-full"
                  >
                    <option value="">Select a store...</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewAssignment({ permissionRoleId: '', scopeType: 'GLOBAL', scopeId: '' });
                  }}
                  className="px-4 py-2 text-sm font-medium text-hos-text-secondary bg-hos-bg-tertiary rounded-lg hover:bg-hos-bg-tertiary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  className="px-4 py-2 text-sm font-medium text-[#1a1406] bg-hos-gold rounded-lg hover:bg-hos-gold-hover"
                >
                  Create Assignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </RouteGuard>
  );
}
