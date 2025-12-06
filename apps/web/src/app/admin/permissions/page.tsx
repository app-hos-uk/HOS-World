'use client';

import { useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
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
  // Product Management
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

const ROLES = [
  'ADMIN',
  'PROCUREMENT',
  'FULFILLMENT',
  'CATALOG',
  'MARKETING',
  'FINANCE',
  'SELLER',
  'B2C_SELLER',
  'WHOLESALER',
  'CUSTOMER',
  'CMS_EDITOR',
];

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: PERMISSIONS.map((p) => p.id),
  PROCUREMENT: ['submissions.review', 'submissions.approve', 'submissions.reject', 'products.view'],
  FULFILLMENT: ['shipments.verify', 'orders.view', 'orders.manage'],
  CATALOG: ['catalog.create', 'products.view', 'products.edit'],
  MARKETING: ['marketing.create', 'products.view'],
  FINANCE: ['pricing.approve', 'orders.view', 'orders.refund'],
  SELLER: ['products.create', 'products.edit', 'orders.view', 'orders.manage'],
  B2C_SELLER: ['products.create', 'products.edit', 'orders.view', 'orders.manage'],
  WHOLESALER: ['products.create', 'products.edit', 'orders.view'],
  CUSTOMER: ['products.view', 'orders.view'],
  CMS_EDITOR: ['products.view', 'products.edit', 'catalog.create'],
};

export default function AdminPermissionsPage() {
  const [selectedRole, setSelectedRole] = useState<string>('ADMIN');
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>(
    DEFAULT_ROLE_PERMISSIONS
  );
  const [saving, setSaving] = useState(false);

  const permissionsByCategory = PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const currentPermissions = rolePermissions[selectedRole] || [];

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
      <AdminLayout>
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Permissions Management</h1>
          <p className="text-gray-600 mt-2">Manage granular permissions for each role</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Role Selector */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="font-semibold mb-4">Select Role</h2>
              <div className="space-y-2">
                {ROLES.map((role) => (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedRole === role
                        ? 'bg-purple-100 text-purple-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
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
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold">{selectedRole} Permissions</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {currentPermissions.length} of {PERMISSIONS.length} permissions granted
                  </p>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
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
                    <div key={category} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-lg">{category}</h3>
                        <button
                          onClick={() => handleSelectAll(category)}
                          className="text-sm text-purple-600 hover:text-purple-700"
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
                              className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePermission(perm.id)}
                                className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                              />
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{perm.name}</div>
                                <div className="text-sm text-gray-500">{perm.description}</div>
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
      </AdminLayout>
    </RouteGuard>
  );
}

