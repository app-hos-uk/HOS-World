'use client';

import { useEffect, useMemo, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface RolePermissions {
  role: string;
  permissions: string[];
}

const PERMISSIONS: Permission[] = [
  // Product Management (ids must match `permissionCatalog` in services/api/src/admin/admin.service.ts)
  { id: 'products.view', name: 'View Products', description: 'View product catalog and details', category: 'Products' },
  { id: 'products.create', name: 'Create Products', description: 'Create new products', category: 'Products' },
  { id: 'products.edit', name: 'Edit Products', description: 'Edit existing products', category: 'Products' },
  { id: 'products.delete', name: 'Delete Products', description: 'Delete products', category: 'Products' },
  { id: 'products.publish', name: 'Publish Products', description: 'Publish products to marketplace', category: 'Products' },
  
  // Order Management
  { id: 'orders.view', name: 'View Orders', description: 'View all orders', category: 'Orders' },
  { id: 'orders.manage', name: 'Manage Orders', description: 'Update order status', category: 'Orders' },
  { id: 'orders.cancel', name: 'Cancel Orders', description: 'Cancel orders', category: 'Orders' },
  { id: 'orders.refund', name: 'Process Refunds', description: 'Process order refunds', category: 'Orders' },
  
  // User Management
  { id: 'users.view', name: 'View Users', description: 'View user list', category: 'Users' },
  { id: 'users.create', name: 'Create Users', description: 'Create new users', category: 'Users' },
  { id: 'users.edit', name: 'Edit Users', description: 'Edit user details', category: 'Users' },
  { id: 'users.delete', name: 'Delete Users', description: 'Delete users', category: 'Users' },
  { id: 'users.roles', name: 'Manage Roles', description: 'Assign/change user roles', category: 'Users' },
  
  // Business Operations
  { id: 'submissions.review', name: 'Review Submissions', description: 'Review product submissions', category: 'Business Operations' },
  { id: 'submissions.approve', name: 'Approve Submissions', description: 'Approve product submissions', category: 'Business Operations' },
  { id: 'submissions.reject', name: 'Reject Submissions', description: 'Reject product submissions', category: 'Business Operations' },
  { id: 'shipments.verify', name: 'Verify Shipments', description: 'Verify incoming shipments', category: 'Business Operations' },
  { id: 'catalog.create', name: 'Create Catalog Entries', description: 'Create marketplace listings', category: 'Business Operations' },
  { id: 'marketing.create', name: 'Create Marketing Materials', description: 'Create marketing assets', category: 'Business Operations' },
  { id: 'pricing.approve', name: 'Approve Pricing', description: 'Approve product pricing', category: 'Business Operations' },
  
  // System Administration
  { id: 'system.settings', name: 'Manage Settings', description: 'Modify system settings', category: 'System' },
  { id: 'system.themes', name: 'Manage Themes', description: 'Manage platform themes', category: 'System' },
  { id: 'system.permissions', name: 'Manage Permissions', description: 'Manage role permissions', category: 'System' },
  { id: 'system.analytics', name: 'View Analytics', description: 'Access analytics and reports', category: 'System' },
  
  // Seller Management
  { id: 'sellers.view', name: 'View Sellers', description: 'View seller list', category: 'Sellers' },
  { id: 'sellers.approve', name: 'Approve Sellers', description: 'Approve seller applications', category: 'Sellers' },
  { id: 'sellers.suspend', name: 'Suspend Sellers', description: 'Suspend seller accounts', category: 'Sellers' },
];

export default function AdminPermissionsPage() {
  const [roles, setRoles] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('ADMIN');
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [creatingRole, setCreatingRole] = useState(false);

  const currentPermissions = rolePermissions[selectedRole] || [];

  const permissionsByCategory = useMemo(() => {
    return PERMISSIONS.reduce((acc, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = [];
      }
      acc[perm.category].push(perm);
      return acc;
    }, {} as Record<string, Permission[]>);
  }, []);

  const catalogIdSet = useMemo(() => new Set(PERMISSIONS.map((p) => p.id)), []);

  /** Granted permissions that appear in this UI (excludes unknown ids from older API data). */
  const grantedInMatrixCount = useMemo(() => {
    const uniq = [...new Set(currentPermissions)];
    return uniq.filter((id) => catalogIdSet.has(id)).length;
  }, [currentPermissions, catalogIdSet]);

  const unknownGrantedIds = useMemo(() => {
    const uniq = [...new Set(currentPermissions)];
    return uniq.filter((id) => !catalogIdSet.has(id));
  }, [currentPermissions, catalogIdSet]);

  useEffect(() => {
    (async () => {
      try {
        const rolesRes = await apiClient.listPermissionRoles();
        const roleNames = rolesRes?.data || [];
        setRoles(roleNames);
        if (roleNames.length > 0 && !roleNames.includes(selectedRole)) {
          setSelectedRole(roleNames[0]);
        }
      } catch (e) {
        // fallback: show at least ADMIN
        setRoles(['ADMIN']);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedRole) return;
    (async () => {
      try {
        const permsRes = await apiClient.getRolePermissions(selectedRole);
        const perms = permsRes?.data || [];
        setRolePermissions((prev) => ({ ...prev, [selectedRole]: perms }));
      } catch (e) {
        setRolePermissions((prev) => ({ ...prev, [selectedRole]: [] }));
      }
    })();
  }, [selectedRole]);

  const togglePermission = (permissionId: string) => {
    const newPermissions = { ...rolePermissions };
    const rolePerms = newPermissions[selectedRole] || [];
    
    if (rolePerms.includes(permissionId)) {
      newPermissions[selectedRole] = rolePerms.filter((p) => p !== permissionId);
    } else {
      newPermissions[selectedRole] = [...rolePerms, permissionId];
    }
    
    setRolePermissions(newPermissions);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiClient.updateRolePermissions(selectedRole, rolePermissions[selectedRole]);
      alert('Permissions saved successfully!');
    } catch (error) {
      console.error('Error saving permissions:', error);
      alert('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAll = (category: string) => {
    const newPermissions = { ...rolePermissions };
    const rolePerms = newPermissions[selectedRole] || [];
    const categoryPerms = permissionsByCategory[category].map((p) => p.id);
    const allSelected = categoryPerms.every((p) => rolePerms.includes(p));
    
    if (allSelected) {
      newPermissions[selectedRole] = rolePerms.filter((p) => !categoryPerms.includes(p));
    } else {
      const toAdd = categoryPerms.filter((p) => !rolePerms.includes(p));
      newPermissions[selectedRole] = [...rolePerms, ...toAdd];
    }
    
    setRolePermissions(newPermissions);
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
              <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Permissions Management</h1>
          <p className="text-hos-text-secondary mt-2">Manage granular permissions for each role</p>
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
                {roles.map((role) => (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedRole === role
                        ? 'bg-hos-gold/20 text-hos-gold-hover font-medium'
                        : 'text-hos-text-secondary hover:bg-hos-bg-tertiary'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Permissions List */}
          <div className="lg:col-span-3">
            <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold">{selectedRole} Permissions</h2>
                  <p className="text-sm text-hos-text-secondary mt-1">
                    {grantedInMatrixCount} of {PERMISSIONS.length} permissions granted
                    {unknownGrantedIds.length > 0 && (
                      <span className="text-amber-400">
                        {' '}
                        (+ {unknownGrantedIds.length} legacy / unknown id{unknownGrantedIds.length !== 1 ? 's' : ''}{' '}
                        not shown below)
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

              <div className="space-y-6">
                {Object.entries(permissionsByCategory).map(([category, perms]) => {
                  const categoryPerms = perms.map((p) => p.id);
                  const allSelected = categoryPerms.every((p) => currentPermissions.includes(p));
                  const someSelected = categoryPerms.some((p) => currentPermissions.includes(p));

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
                    onClick={() => {
                      setShowCreateRole(false);
                      setNewRoleName('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-hos-text-secondary bg-hos-bg-tertiary rounded-lg hover:bg-hos-bg-tertiary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!newRoleName.trim()) {
                        alert('Please enter a role name');
                        return;
                      }
                      if (roles.includes(newRoleName)) {
                        alert('Role already exists');
                        return;
                      }
                      setCreatingRole(true);
                      try {
                      await apiClient.createPermissionRole(newRoleName);
                      const rolesRes = await apiClient.listPermissionRoles();
                      const roleNames = rolesRes?.data || [];
                      setRoles(roleNames);
                      setRolePermissions((prev) => ({ ...prev, [newRoleName]: [] }));
                      setSelectedRole(newRoleName);
                        setShowCreateRole(false);
                        setNewRoleName('');
                        alert('Role created successfully! You can now assign permissions.');
                      } catch (err: any) {
                        alert('Failed to create role: ' + err.message);
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

