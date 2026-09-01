'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { PERMISSION_CATALOG } from '@hos-marketplace/shared-types';
import type { PermissionScopeKind } from '@hos-marketplace/shared-types';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface RoleDetail {
  id: string;
  name: string;
  permissions: string[];
  scopeKind: string;
  isSystem: boolean;
}

const FALLBACK_PERMISSIONS: Permission[] = PERMISSION_CATALOG.map((p) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  category: p.category,
}));

const SCOPE_KINDS: PermissionScopeKind[] = ['ANY', 'GLOBAL', 'MARKET', 'TENANT', 'STORE'];

export default function AdminPermissionsPage() {
  const [rolesDetailed, setRolesDetailed] = useState<RoleDetail[]>([]);
  const [selectedRoleName, setSelectedRoleName] = useState<string>('ADMIN');
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [roleScopeKinds, setRoleScopeKinds] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [creatingRole, setCreatingRole] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>(FALLBACK_PERMISSIONS);

  const selectedRole = rolesDetailed.find((r) => r.name === selectedRoleName) || null;
  const currentPermissions = rolePermissions[selectedRoleName] || [];
  const currentScopeKind = roleScopeKinds[selectedRoleName] || selectedRole?.scopeKind || 'ANY';

  const permissionsByCategory = useMemo(() => {
    return permissions.reduce((acc, perm) => {
      if (!acc[perm.category]) acc[perm.category] = [];
      acc[perm.category].push(perm);
      return acc;
    }, {} as Record<string, Permission[]>);
  }, [permissions]);

  const catalogIdSet = useMemo(() => new Set(permissions.map((p) => p.id)), [permissions]);

  const grantedInMatrixCount = useMemo(() => {
    return [...new Set(currentPermissions)].filter((id) => catalogIdSet.has(id)).length;
  }, [currentPermissions, catalogIdSet]);

  const unknownGrantedIds = useMemo(() => {
    return [...new Set(currentPermissions)].filter((id) => !catalogIdSet.has(id));
  }, [currentPermissions, catalogIdSet]);

  useEffect(() => {
    (async () => {
      try {
        const catalogRes = await apiClient.getPermissionCatalog();
        const catalog = catalogRes?.data || [];
        if (catalog.length > 0 && catalog[0].name) {
          setPermissions(catalog as Permission[]);
        }
      } catch {
        // keep shared-types fallback
      }

      try {
        const res = await apiClient.listPermissionRolesDetailed();
        const roles: RoleDetail[] = res?.data || [];
        setRolesDetailed(roles);
        if (roles.length > 0) {
          const initialRole = roles.find((r) => r.name === 'ADMIN') || roles[0];
          setSelectedRoleName(initialRole.name);
          const permsMap: Record<string, string[]> = {};
          const scopeMap: Record<string, string> = {};
          for (const r of roles) {
            permsMap[r.name] = Array.isArray(r.permissions) ? r.permissions.map(String) : [];
            scopeMap[r.name] = r.scopeKind || 'ANY';
          }
          setRolePermissions(permsMap);
          setRoleScopeKinds(scopeMap);
        }
      } catch {
        try {
          const rolesRes = await apiClient.listPermissionRoles();
          const roleNames = rolesRes?.data || [];
          setRolesDetailed(roleNames.map((n: string) => ({ id: '', name: n, permissions: [], scopeKind: 'ANY', isSystem: false })));
          if (roleNames.length > 0) setSelectedRoleName(roleNames[0]);
        } catch {
          setRolesDetailed([{ id: '', name: 'ADMIN', permissions: [], scopeKind: 'ANY', isSystem: false }]);
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedRoleName || rolePermissions[selectedRoleName]) return;
    (async () => {
      try {
        const permsRes = await apiClient.getRolePermissions(selectedRoleName);
        const perms = permsRes?.data || [];
        setRolePermissions((prev) => ({ ...prev, [selectedRoleName]: perms }));
      } catch {
        setRolePermissions((prev) => ({ ...prev, [selectedRoleName]: [] }));
      }
    })();
  }, [selectedRoleName, rolePermissions]);

  const togglePermission = (permissionId: string) => {
    const rolePerms = rolePermissions[selectedRoleName] || [];
    const updated = rolePerms.includes(permissionId)
      ? rolePerms.filter((p) => p !== permissionId)
      : [...rolePerms, permissionId];
    setRolePermissions({ ...rolePermissions, [selectedRoleName]: updated });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const perms = rolePermissions[selectedRoleName] || [];
      const scopeKind = roleScopeKinds[selectedRoleName] || 'ANY';

      if (selectedRole?.id) {
        await apiClient.updatePermissionRole(selectedRole.id, {
          permissions: perms,
          scopeKind,
        });
      } else {
        await apiClient.updateRolePermissions(selectedRoleName, perms);
      }
      toast.success('Permissions saved successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAll = (category: string) => {
    const rolePerms = rolePermissions[selectedRoleName] || [];
    const categoryPerms = permissionsByCategory[category].map((p) => p.id);
    const allSelected = categoryPerms.every((p) => rolePerms.includes(p));
    const updated = allSelected
      ? rolePerms.filter((p) => !categoryPerms.includes(p))
      : [...rolePerms, ...categoryPerms.filter((p) => !rolePerms.includes(p))];
    setRolePermissions({ ...rolePermissions, [selectedRoleName]: updated });
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Permissions Management</h1>
        <p className="text-hos-text-secondary mt-2">Manage granular permissions and scope kinds for each role</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Role Selector */}
        <div className="lg:col-span-1">
          <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Select Role</h2>
              <button
                onClick={() => setShowCreateRole(true)}
                className="text-sm px-3 py-1 bg-hos-gold text-[#1a1406] rounded hover:bg-hos-gold-hover"
              >
                + New
              </button>
            </div>
            <div className="space-y-2">
              {rolesDetailed.map((role) => (
                <button
                  key={role.name}
                  onClick={() => setSelectedRoleName(role.name)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedRoleName === role.name
                      ? 'bg-hos-gold/20 text-hos-gold-hover font-medium'
                      : 'text-hos-text-secondary hover:bg-hos-bg-tertiary'
                  }`}
                >
                  <div>{role.name}</div>
                  <div className="text-xs text-hos-text-muted">
                    scope: {role.scopeKind || 'ANY'}
                    {role.isSystem && ' (system)'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Permissions + Scope Kind */}
        <div className="lg:col-span-3">
          <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">{selectedRoleName} Permissions</h2>
                <p className="text-sm text-hos-text-secondary mt-1">
                  {grantedInMatrixCount} of {permissions.length} permissions granted
                  {unknownGrantedIds.length > 0 && (
                    <span className="text-amber-400">
                      {' '}(+ {unknownGrantedIds.length} legacy id{unknownGrantedIds.length !== 1 ? 's' : ''})
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>

            {/* Scope Kind Selector */}
            <div className="mb-6 p-4 border border-hos-border rounded-lg bg-hos-bg-tertiary">
              <label className="block text-sm font-semibold text-hos-text-secondary mb-2">
                Scope Kind
                <span className="font-normal text-hos-text-muted ml-2">
                  — restricts where this role may be assigned
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                {SCOPE_KINDS.map((sk) => (
                  <button
                    key={sk}
                    onClick={() => setRoleScopeKinds({ ...roleScopeKinds, [selectedRoleName]: sk })}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      currentScopeKind === sk
                        ? 'border-hos-gold bg-hos-gold/20 text-hos-gold-hover font-medium'
                        : 'border-hos-border text-hos-text-muted hover:bg-hos-bg-secondary'
                    }`}
                  >
                    {sk}
                  </button>
                ))}
              </div>
              <p className="text-xs text-hos-text-muted mt-2">
                {currentScopeKind === 'ANY' && 'This role can be assigned at any scope level.'}
                {currentScopeKind === 'GLOBAL' && 'This role can only be assigned globally (platform-wide).'}
                {currentScopeKind === 'MARKET' && 'This role can only be assigned scoped to a specific market.'}
                {currentScopeKind === 'TENANT' && 'This role can only be assigned scoped to a specific tenant.'}
                {currentScopeKind === 'STORE' && 'This role can only be assigned scoped to a specific store.'}
              </p>
            </div>

            <div className="space-y-6">
              {Object.entries(permissionsByCategory).map(([category, perms]) => {
                const categoryPerms = perms.map((p) => p.id);
                const allSelected = categoryPerms.every((p) => currentPermissions.includes(p));

                return (
                  <div key={category} className="border border-hos-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-lg">{category}</h3>
                      <button
                        onClick={() => handleSelectAll(category)}
                        className="text-sm text-hos-gold hover:text-hos-gold-hover"
                      >
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {perms.map((perm) => {
                        const isChecked = currentPermissions.includes(perm.id);
                        return (
                          <label
                            key={perm.id}
                            className="flex items-start gap-3 p-2 rounded hover:bg-hos-bg-tertiary cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => togglePermission(perm.id)}
                              className="mt-1 h-4 w-4 text-hos-gold focus:ring-hos-gold/50 border-hos-border rounded"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-hos-text-secondary">{perm.name}</div>
                              <div className="text-sm text-hos-text-muted">{perm.description}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Create Role Modal */}
      {showCreateRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-hos-bg-secondary rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Create New Role</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Role Name *</label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                  placeholder="e.g., MODERATOR"
                  className="w-full px-3 py-2 border border-hos-border rounded-md focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold"
                />
                <p className="text-xs text-hos-text-muted mt-1">Use uppercase letters and underscores</p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowCreateRole(false); setNewRoleName(''); }}
                  className="px-4 py-2 text-sm font-medium text-hos-text-secondary bg-hos-bg-tertiary rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!newRoleName.trim()) { toast.error('Please enter a role name'); return; }
                    if (rolesDetailed.some((r) => r.name === newRoleName)) { toast.error('Role already exists'); return; }
                    setCreatingRole(true);
                    try {
                      await apiClient.createPermissionRole(newRoleName);
                      const res = await apiClient.listPermissionRolesDetailed();
                      const roles: RoleDetail[] = res?.data || [];
                      setRolesDetailed(roles);
                      setRolePermissions((prev) => ({ ...prev, [newRoleName]: [] }));
                      setRoleScopeKinds((prev) => ({ ...prev, [newRoleName]: 'ANY' }));
                      setSelectedRoleName(newRoleName);
                      setShowCreateRole(false);
                      setNewRoleName('');
                      toast.success('Role created! You can now assign permissions and scope.');
                    } catch (err: any) {
                      toast.error('Failed to create role: ' + err.message);
                    } finally {
                      setCreatingRole(false);
                    }
                  }}
                  disabled={creatingRole || !newRoleName.trim()}
                  className="px-4 py-2 text-sm font-medium text-[#1a1406] bg-hos-gold rounded-lg hover:bg-hos-gold-hover disabled:opacity-50"
                >
                  {creatingRole ? 'Creating...' : 'Create Role'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </RouteGuard>
  );
}
