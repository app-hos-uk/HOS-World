'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { DataExport } from '@/components/DataExport';

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  avatar: string | null;
  isActive?: boolean;
  emailVerified?: boolean;
  lastLoginAt?: string;
  storeName?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  total: number;
  admins: number;
  sellers: number;
  customers: number;
  influencers: number;
  teamMembers: number;
  newThisMonth: number;
  active: number;
  inactive: number;
}

const ROLES = [
  'CUSTOMER',
  'WHOLESALER',
  'B2C_SELLER',
  'SELLER',
  'ADMIN',
  'INFLUENCER',
  'PROCUREMENT',
  'FULFILLMENT',
  'CATALOG',
  'MARKETING',
  'FINANCE',
  'CMS_EDITOR',
];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  CUSTOMER: 'Regular platform customer',
  WHOLESALER: 'Wholesale seller with bulk pricing',
  B2C_SELLER: 'Business-to-consumer seller',
  SELLER: 'Legacy seller role',
  ADMIN: 'Full platform administrator',
  INFLUENCER: 'Referral partner with commission tracking and storefront',
  PROCUREMENT: 'Manages product procurement',
  FULFILLMENT: 'Manages order fulfillment',
  CATALOG: 'Manages product catalog',
  MARKETING: 'Manages marketing materials',
  FINANCE: 'Manages pricing and finances',
  CMS_EDITOR: 'Content management editor',
};

export default function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showNewThisMonth, setShowNewThisMonth] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'date' | 'role'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [permissionRoles, setPermissionRoles] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  // Create form state with role-specific fields
  const [createForm, setCreateForm] = useState({
    // Basic info (all roles)
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: 'CUSTOMER',
    // Admin specific
    permissionRoleName: '',
    // Seller/Wholesaler specific
    storeName: '',
    companyName: '',
    vatNumber: '',
    // Wholesaler specific
    businessType: '',
    // Team member specific
    department: '',
    employeeId: '',
  });

  // Helper to check role categories
  const isSellerRole = ['SELLER', 'B2C_SELLER', 'WHOLESALER'].includes(createForm.role);
  const isTeamRole = ['PROCUREMENT', 'FULFILLMENT', 'CATALOG', 'MARKETING', 'FINANCE', 'CMS_EDITOR'].includes(createForm.role);
  const isWholesaler = createForm.role === 'WHOLESALER';

  // Edit form state
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: '',
    isActive: true,
  });

  // Calculate stats from user list - pure function to avoid closure issues
  // Returns stats object; caller is responsible for setting state
  const calculateUserStats = (userList: User[]) => {
    // Calculate current month boundary at call time (not captured in closure)
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const sellerRoles = ['SELLER', 'B2C_SELLER', 'WHOLESALER'];
    const teamRoles = ['PROCUREMENT', 'FULFILLMENT', 'CATALOG', 'MARKETING', 'FINANCE', 'CMS_EDITOR'];
    
    return {
      total: userList.length,
      admins: userList.filter(u => u.role === 'ADMIN').length,
      sellers: userList.filter(u => sellerRoles.includes(u.role)).length,
      customers: userList.filter(u => u.role === 'CUSTOMER').length,
      influencers: userList.filter(u => u.role === 'INFLUENCER').length,
      teamMembers: userList.filter(u => teamRoles.includes(u.role)).length,
      newThisMonth: userList.filter(u => new Date(u.createdAt) >= firstOfMonth).length,
      active: userList.filter(u => u.isActive !== false).length,
      inactive: userList.filter(u => u.isActive === false).length,
    };
  };

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getUsers();
      
      // Handle both paginated response { data: { data: users, pagination } } 
      // and flat array response { data: users }
      let userList: User[] = [];
      if (response?.data) {
        if (Array.isArray(response.data)) {
          userList = response.data;
        } else if ((response.data as any)?.data && Array.isArray((response.data as any).data)) {
          // Paginated response format
          userList = (response.data as any).data;
        }
      }
      
      // Always update both users and stats
      setUsers(userList);
      setStats(calculateUserStats(userList));
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Failed to load users');
      setUsers([]);
      setStats(calculateUserStats([])); // Reset stats on error
    } finally {
      setLoading(false);
    }
  }, []); // No dependencies needed - calculateUserStats is a pure function

  useEffect(() => {
    fetchUsers();
    apiClient
      .listPermissionRoles()
      .then((res) => setPermissionRoles(res?.data || []))
      .catch(() => setPermissionRoles([]));
  }, [fetchUsers]);

  // Filtered and sorted users
  const filteredUsers = useMemo(() => {
    let filtered = Array.isArray(users) ? [...users] : [];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(term) ||
        `${user.firstName} ${user.lastName}`.toLowerCase().includes(term) ||
        user.storeName?.toLowerCase().includes(term)
      );
    }

    // Role filter
    if (roleFilter !== 'ALL') {
      if (roleFilter === 'SELLERS') {
        filtered = filtered.filter(u => ['SELLER', 'B2C_SELLER', 'WHOLESALER'].includes(u.role));
      } else if (roleFilter === 'TEAM') {
        filtered = filtered.filter(u => ['PROCUREMENT', 'FULFILLMENT', 'CATALOG', 'MARKETING', 'FINANCE', 'CMS_EDITOR'].includes(u.role));
      } else {
        filtered = filtered.filter(u => u.role === roleFilter);
      }
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'ACTIVE') {
        filtered = filtered.filter(u => u.isActive !== false);
      } else if (statusFilter === 'INACTIVE') {
        filtered = filtered.filter(u => u.isActive === false);
      } else if (statusFilter === 'VERIFIED') {
        filtered = filtered.filter(u => u.emailVerified === true);
      } else if (statusFilter === 'UNVERIFIED') {
        filtered = filtered.filter(u => u.emailVerified !== true);
      }
    }

    // New this month filter
    if (showNewThisMonth) {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = filtered.filter(u => new Date(u.createdAt) >= firstOfMonth);
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          break;
        case 'email':
          comparison = a.email.localeCompare(b.email);
          break;
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'role':
          comparison = a.role.localeCompare(b.role);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [users, searchTerm, roleFilter, statusFilter, showNewThisMonth, sortBy, sortOrder]);

  const handleViewDetails = (user: User) => {
    setSelectedUser(user);
    setShowDetailModal(true);
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email,
      role: user.role,
      isActive: user.isActive !== false,
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      setActionLoading(true);
      await toast.promise(
        apiClient.updateUser(selectedUser.id, editForm),
        {
          loading: 'Updating user...',
          success: 'User updated successfully',
          error: (err: any) => err.message || 'Failed to update user',
        }
      );
      setShowEditModal(false);
      await fetchUsers();
    } catch (err: any) {
      console.error('Error updating user:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const handleCreateUser = async () => {
    try {
      setActionLoading(true);

      if (!createForm.email || !createForm.password) {
        toast.error('Email and password are required');
        setActionLoading(false);
        return;
      }

      if (createForm.password.length < 8) {
        toast.error('Password must be at least 8 characters');
        setActionLoading(false);
        return;
      }

      if (createForm.password !== createForm.confirmPassword) {
        toast.error('Passwords do not match');
        setActionLoading(false);
        return;
      }

      const sellerRoles = ['SELLER', 'B2C_SELLER', 'WHOLESALER'];
      if (sellerRoles.includes(createForm.role) && !createForm.storeName) {
        toast.error('Store name is required for seller roles');
        setActionLoading(false);
        return;
      }

      const payload: any = {
        email: createForm.email,
        password: createForm.password,
        firstName: createForm.firstName || undefined,
        lastName: createForm.lastName || undefined,
        phone: createForm.phone || undefined,
        role: createForm.role,
        // Admin specific
        permissionRoleName: createForm.permissionRoleName || undefined,
        // Seller/Wholesaler specific
        storeName: createForm.storeName || undefined,
        companyName: createForm.companyName || undefined,
        vatNumber: createForm.vatNumber || undefined,
        // Wholesaler specific
        businessType: createForm.businessType || undefined,
        // Team member specific
        department: createForm.department || undefined,
        employeeId: createForm.employeeId || undefined,
      };

      const response = await apiClient.createUser(payload);

      toast.success('User created successfully');
      setShowCreateModal(false);
      setCreateForm({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        role: 'CUSTOMER',
        permissionRoleName: '',
        storeName: '',
        companyName: '',
        vatNumber: '',
        businessType: '',
        department: '',
        employeeId: '',
      });
      await fetchUsers();
    } catch (err: any) {
      console.error('Error creating user:', err);
      toast.error(err.message || 'Failed to create user');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!selectedUser) return;

    if (selectedUser.email === 'app@houseofspells.co.uk') {
      toast.error('Cannot delete the primary admin user');
      setShowDeleteModal(false);
      return;
    }

    try {
      setActionLoading(true);
      await toast.promise(
        apiClient.deleteUser(selectedUser.id),
        {
          loading: 'Deleting user...',
          success: 'User deleted successfully',
          error: (err: any) => err.message || 'Failed to delete user',
        }
      );
      setShowDeleteModal(false);
      await fetchUsers();
    } catch (err: any) {
      console.error('Error deleting user:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    if (user.email === 'app@houseofspells.co.uk') {
      toast.error('Cannot modify the primary admin user');
      return;
    }
    // TODO: Implement user status toggle when backend supports it
    toast.error('User status toggle is not yet supported by the API');
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedUsers.size === 0) return;
    
    const protectedEmail = 'app@houseofspells.co.uk';
    const selectedList = [...selectedUsers].filter(id => {
      const user = users.find(u => u.id === id);
      return user && user.email !== protectedEmail;
    });

    if (selectedList.length === 0) {
      toast.error('No eligible users selected');
      return;
    }

    if (!confirm(`${action === 'delete' ? 'Delete' : action === 'activate' ? 'Activate' : 'Deactivate'} ${selectedList.length} users?`)) return;

    if (action !== 'delete') {
      // TODO: Implement user status toggle when backend supports it
      toast.error('User activate/deactivate is not yet supported by the API');
      return;
    }

    let success = 0;
    for (const id of selectedList) {
      try {
        await apiClient.deleteUser(id);
        success++;
      } catch {
        // Continue on error
      }
    }

    toast.success(`Successfully ${action === 'delete' ? 'deleted' : action === 'activate' ? 'activated' : 'deactivated'} ${success} users`);
    setSelectedUsers(new Set());
    fetchUsers();
  };

  const toggleSelection = (id: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      ADMIN: 'bg-red-100 text-red-800',
      SELLER: 'bg-blue-100 text-blue-800',
      B2C_SELLER: 'bg-blue-100 text-blue-800',
      WHOLESALER: 'bg-green-100 text-green-800',
      CUSTOMER: 'bg-gray-100 text-gray-800',
      PROCUREMENT: 'bg-purple-100 text-purple-800',
      FULFILLMENT: 'bg-yellow-100 text-yellow-800',
      CATALOG: 'bg-indigo-100 text-indigo-800',
      MARKETING: 'bg-pink-100 text-pink-800',
      FINANCE: 'bg-emerald-100 text-emerald-800',
      CMS_EDITOR: 'bg-cyan-100 text-cyan-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const exportColumns = [
    { key: 'email', header: 'Email' },
    { key: 'firstName', header: 'First Name' },
    { key: 'lastName', header: 'Last Name' },
    { key: 'role', header: 'Role' },
    { key: 'storeName', header: 'Store Name' },
    { key: 'isActive', header: 'Status', format: (v: boolean) => v !== false ? 'Active' : 'Inactive' },
    { key: 'emailVerified', header: 'Email Verified', format: (v: boolean) => v ? 'Yes' : 'No' },
    { key: 'createdAt', header: 'Created', format: (v: string) => v ? new Date(v).toLocaleDateString() : '' },
    { key: 'lastLoginAt', header: 'Last Login', format: (v: string) => v ? new Date(v).toLocaleDateString() : 'Never' },
  ];

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">User Management</h1>
              <p className="text-gray-600 mt-1">Manage all platform users, roles, and permissions</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <DataExport data={filteredUsers} columns={exportColumns} filename="users-export" />
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                + Create User
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <button
                onClick={() => { setRoleFilter('ALL'); setStatusFilter('ALL'); setShowNewThisMonth(false); }}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md transition-shadow ${roleFilter === 'ALL' && statusFilter === 'ALL' && !showNewThisMonth ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-xl font-bold text-gray-900">{stats.total}</p>
              </button>
              <button
                onClick={() => { setRoleFilter('ADMIN'); setShowNewThisMonth(false); }}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md transition-shadow ${roleFilter === 'ADMIN' && !showNewThisMonth ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Admins</p>
                <p className="text-xl font-bold text-red-600">{stats.admins}</p>
              </button>
              <button
                onClick={() => { setRoleFilter('SELLERS'); setShowNewThisMonth(false); }}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md transition-shadow ${roleFilter === 'SELLERS' && !showNewThisMonth ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Sellers</p>
                <p className="text-xl font-bold text-blue-600">{stats.sellers}</p>
              </button>
              <button
                onClick={() => { setRoleFilter('CUSTOMER'); setShowNewThisMonth(false); }}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md transition-shadow ${roleFilter === 'CUSTOMER' && !showNewThisMonth ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Customers</p>
                <p className="text-xl font-bold text-gray-600">{stats.customers}</p>
              </button>
              <button
                onClick={() => { setRoleFilter('TEAM'); setShowNewThisMonth(false); }}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md transition-shadow ${roleFilter === 'TEAM' && !showNewThisMonth ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Team</p>
                <p className="text-xl font-bold text-purple-600">{stats.teamMembers}</p>
              </button>
              <button
                onClick={() => { setRoleFilter('INFLUENCER'); setShowNewThisMonth(false); }}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md transition-shadow ${roleFilter === 'INFLUENCER' && !showNewThisMonth ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Influencers</p>
                <p className="text-xl font-bold text-amber-600">{stats.influencers}</p>
              </button>
              <button
                onClick={() => {
                  setShowNewThisMonth(!showNewThisMonth);
                  if (!showNewThisMonth) {
                    setRoleFilter('ALL');
                    setStatusFilter('ALL');
                  }
                }}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md transition-shadow ${showNewThisMonth ? 'ring-2 ring-green-500' : ''}`}
              >
                <p className="text-xs text-gray-500">New This Month</p>
                <p className="text-xl font-bold text-green-600">{stats.newThisMonth}</p>
              </button>
              <button
                onClick={() => { setStatusFilter('ACTIVE'); setShowNewThisMonth(false); }}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md transition-shadow ${statusFilter === 'ACTIVE' && !showNewThisMonth ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Active</p>
                <p className="text-xl font-bold text-green-600">{stats.active}</p>
              </button>
              <button
                onClick={() => { setStatusFilter('INACTIVE'); setShowNewThisMonth(false); }}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md transition-shadow ${statusFilter === 'INACTIVE' && !showNewThisMonth ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Inactive</p>
                <p className="text-xl font-bold text-red-600">{stats.inactive}</p>
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
              <button onClick={fetchUsers} className="mt-2 text-red-600 hover:text-red-800 text-sm">Retry</button>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Name, email, or store..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ALL">All Roles</option>
                  <option value="SELLERS">All Sellers</option>
                  <option value="TEAM">Team Members</option>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="VERIFIED">Email Verified</option>
                  <option value="UNVERIFIED">Email Unverified</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field as any);
                    setSortOrder(order as any);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="name-asc">Name A-Z</option>
                  <option value="name-desc">Name Z-A</option>
                  <option value="email-asc">Email A-Z</option>
                  <option value="role-asc">Role A-Z</option>
                </select>
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedUsers.size > 0 && (
              <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                <span className="text-sm text-gray-600">{selectedUsers.size} selected</span>
                <button
                  onClick={() => handleBulkAction('activate')}
                  className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                >
                  Activate
                </button>
                <button
                  onClick={() => handleBulkAction('deactivate')}
                  className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                >
                  Deactivate
                </button>
                <button
                  onClick={() => handleBulkAction('delete')}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  Delete
                </button>
                <button
                  onClick={() => setSelectedUsers(new Set())}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          )}

          {!loading && filteredUsers.length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500 text-lg">No users found</p>
            </div>
          )}

          {/* Users Table */}
          {!loading && filteredUsers.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center">
                <h2 className="font-semibold">Users ({filteredUsers.length})</h2>
                <button onClick={selectAll} className="text-sm text-purple-600 hover:text-purple-800">
                  {selectedUsers.size === filteredUsers.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        <input
                          type="checkbox"
                          checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                          onChange={selectAll}
                          className="rounded border-gray-300 text-purple-600"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className={`hover:bg-gray-50 ${selectedUsers.has(user.id) ? 'bg-purple-50' : ''}`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedUsers.has(user.id)}
                            onChange={() => toggleSelection(user.id)}
                            className="rounded border-gray-300 text-purple-600"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              {user.avatar ? (
                                <Image width={40} height={40} className="h-10 w-10 rounded-full object-cover" src={user.avatar} alt="" />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                                  <span className="text-purple-600 font-medium text-sm">
                                    {user.firstName?.[0] || user.email[0].toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">
                                {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : 'No Name'}
                              </p>
                              <p className="text-xs text-gray-500">{user.email}</p>
                              {user.storeName && <p className="text-xs text-purple-600">{user.storeName}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded-full ${getRoleBadgeColor(user.role)}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className={`px-2 py-0.5 text-xs rounded-full w-fit ${user.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {user.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                            {user.emailVerified && (
                              <span className="text-xs text-blue-600">✓ Verified</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handleViewDetails(user)}
                              className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleEdit(user)}
                              className="px-2 py-1 text-sm text-purple-600 hover:bg-purple-50 rounded"
                            >
                              Edit
                            </button>
                            {user.email !== 'app@houseofspells.co.uk' && (
                              <>
                                <button
                                  onClick={() => handleToggleStatus(user)}
                                  className={`px-2 py-1 text-sm rounded ${user.isActive !== false ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}
                                >
                                  {user.isActive !== false ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                  onClick={() => handleDelete(user)}
                                  className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* User Detail Modal */}
          {showDetailModal && selectedUser && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-bold">User Details</h2>
                    <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      {selectedUser.avatar ? (
                        <Image width={64} height={64} className="rounded-full object-cover" src={selectedUser.avatar} alt="" />
                      ) : (
                        <div className="h-16 w-16 rounded-full bg-purple-100 flex items-center justify-center">
                          <span className="text-purple-600 font-bold text-2xl">
                            {selectedUser.firstName?.[0] || selectedUser.email[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="text-xl font-semibold">
                          {selectedUser.firstName && selectedUser.lastName 
                            ? `${selectedUser.firstName} ${selectedUser.lastName}` 
                            : 'No Name'}
                        </p>
                        <p className="text-gray-500">{selectedUser.email}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-sm text-gray-500">Role</p>
                        <span className={`px-2 py-1 text-xs rounded-full ${getRoleBadgeColor(selectedUser.role)}`}>
                          {selectedUser.role}
                        </span>
                        <p className="text-xs text-gray-400 mt-1">{ROLE_DESCRIPTIONS[selectedUser.role]}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Status</p>
                        <span className={`px-2 py-1 text-xs rounded-full ${selectedUser.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {selectedUser.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {selectedUser.storeName && (
                        <div className="col-span-2">
                          <p className="text-sm text-gray-500">Store Name</p>
                          <p className="font-medium">{selectedUser.storeName}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-gray-500">Email Verified</p>
                        <p className="font-medium">{selectedUser.emailVerified ? 'Yes' : 'No'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Member Since</p>
                        <p className="font-medium">{new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                      </div>
                      {selectedUser.lastLoginAt && (
                        <div className="col-span-2">
                          <p className="text-sm text-gray-500">Last Login</p>
                          <p className="font-medium">{new Date(selectedUser.lastLoginAt).toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-4 border-t">
                      <button
                        onClick={() => { setShowDetailModal(false); handleEdit(selectedUser); }}
                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      >
                        Edit User
                      </button>
                      <button
                        onClick={() => setShowDetailModal(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Edit Modal */}
          {showEditModal && selectedUser && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold">Edit User</h2>
                    <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                        <input
                          type="text"
                          value={editForm.firstName}
                          onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                        <input
                          type="text"
                          value={editForm.lastName}
                          onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        disabled={selectedUser.email === 'app@houseofspells.co.uk'}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        disabled={selectedUser.email === 'app@houseofspells.co.uk'}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={editForm.isActive}
                        onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                        disabled={selectedUser.email === 'app@houseofspells.co.uk'}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Active Account</label>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleUpdateUser}
                        disabled={actionLoading}
                        className="flex-1 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        {actionLoading ? 'Updating...' : 'Update User'}
                      </button>
                      <button
                        onClick={() => setShowEditModal(false)}
                        className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold">Create User</h2>
                    <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                        <input
                          type="text"
                          value={createForm.firstName}
                          onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                        <input
                          type="text"
                          value={createForm.lastName}
                          onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                      <input
                        type="email"
                        value={createForm.email}
                        onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="user@example.com"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={createForm.phone}
                        onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="+1234567890"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                        <input
                          type="password"
                          value={createForm.password}
                          onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="Min 8 characters"
                          minLength={8}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                        <input
                          type="password"
                          value={createForm.confirmPassword}
                          onChange={(e) => setCreateForm({ ...createForm, confirmPassword: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="Confirm password"
                          minLength={8}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                      <select
                        value={createForm.role}
                        onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">{ROLE_DESCRIPTIONS[createForm.role]}</p>
                    </div>

                    {/* ADMIN specific fields */}
                    {createForm.role === 'ADMIN' && permissionRoles.length > 0 && (
                      <div className="bg-red-50 p-4 rounded-lg space-y-4">
                        <h4 className="text-sm font-semibold text-red-800">Admin Configuration</h4>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Permission Role</label>
                          <select
                            value={createForm.permissionRoleName}
                            onChange={(e) => setCreateForm({ ...createForm, permissionRoleName: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">Full Admin (no restrictions)</option>
                            {permissionRoles.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* SELLER/B2C_SELLER/WHOLESALER specific fields */}
                    {isSellerRole && (
                      <div className="bg-blue-50 p-4 rounded-lg space-y-4">
                        <h4 className="text-sm font-semibold text-blue-800">Business Information</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Store Name *</label>
                            <input
                              type="text"
                              value={createForm.storeName}
                              onChange={(e) => setCreateForm({ ...createForm, storeName: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                              placeholder="Your store name"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                            <input
                              type="text"
                              value={createForm.companyName}
                              onChange={(e) => setCreateForm({ ...createForm, companyName: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                              placeholder="Legal company name"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">VAT/Tax ID</label>
                            <input
                              type="text"
                              value={createForm.vatNumber}
                              onChange={(e) => setCreateForm({ ...createForm, vatNumber: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                              placeholder="GB123456789"
                            />
                          </div>
                          {isWholesaler && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
                              <select
                                value={createForm.businessType}
                                onChange={(e) => setCreateForm({ ...createForm, businessType: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="">Select type</option>
                                <option value="RETAIL">Retail</option>
                                <option value="DISTRIBUTOR">Distributor</option>
                                <option value="RESELLER">Reseller</option>
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TEAM ROLES specific fields */}
                    {isTeamRole && (
                      <div className="bg-purple-50 p-4 rounded-lg space-y-4">
                        <h4 className="text-sm font-semibold text-purple-800">Team Member Details</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                            <select
                              value={createForm.department}
                              onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            >
                              <option value="">Select department</option>
                              <option value="OPERATIONS">Operations</option>
                              <option value="WAREHOUSE">Warehouse</option>
                              <option value="CUSTOMER_SERVICE">Customer Service</option>
                              <option value="MARKETING">Marketing</option>
                              <option value="FINANCE">Finance</option>
                              <option value="CONTENT">Content</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                            <input
                              type="text"
                              value={createForm.employeeId}
                              onChange={(e) => setCreateForm({ ...createForm, employeeId: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                              placeholder="EMP-001"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={handleCreateUser}
                        disabled={actionLoading}
                        className="flex-1 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        {actionLoading ? 'Creating...' : 'Create User'}
                      </button>
                      <button
                        onClick={() => setShowCreateModal(false)}
                        className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Delete Modal */}
          {showDeleteModal && selectedUser && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full">
                <div className="p-6">
                  <h2 className="text-2xl font-bold mb-4">Delete User</h2>
                  <p className="text-gray-600 mb-6">
                    Are you sure you want to delete <strong>{selectedUser.email}</strong>? This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={confirmDelete}
                      disabled={actionLoading}
                      className="flex-1 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {actionLoading ? 'Deleting...' : 'Delete User'}
                    </button>
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
