'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { SafeImage } from '@/components/SafeImage';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/contexts/AuthContext';
import { isProtectedAdminEmail, isSuperAdminEmail } from '@/lib/protectedAdminEmails';
import { DataExport } from '@/components/DataExport';
import { VirtualizedTableBody } from '@/components/VirtualizedTableBody';
import { avatarColorClass } from '@/lib/adminFormat';
import {
  AdminColumnToggle,
  useAdminColumnVisibility,
  type AdminColumnDef,
} from '@/components/ui/AdminColumnToggle';

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

const USER_TABLE_COLUMNS: AdminColumnDef[] = [
  { id: 'select', label: 'Select' },
  { id: 'user', label: 'User' },
  { id: 'role', label: 'Role' },
  { id: 'status', label: 'Status' },
  { id: 'created', label: 'Created' },
  { id: 'actions', label: 'Actions' },
];

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
  const { user: currentUser } = useAuth();
  const isSuperAdmin = isSuperAdminEmail(currentUser?.email);
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
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordForm, setResetPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [permissionRoles, setPermissionRoles] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const {
    visibleIds: userVisibleColumnIds,
    isVisible: isUserColumnVisible,
    toggleColumn: toggleUserColumn,
    resetColumns: resetUserColumns,
  } = useAdminColumnVisibility('admin-users', USER_TABLE_COLUMNS);

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

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const PAGE_SIZE = 50;

  const fetchUsers = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError(null);

        const params: Parameters<typeof apiClient.getUsers>[0] = {
          page,
          limit: PAGE_SIZE,
        };
        const q = searchTerm.trim();
        if (q) params.search = q;
        if (roleFilter !== 'ALL') params.role = roleFilter;
        if (statusFilter === 'ACTIVE') params.status = 'active';
        else if (statusFilter === 'INACTIVE') params.status = 'inactive';
        if (showNewThisMonth) params.newThisMonth = true;

        const response = await apiClient.getUsers(params);

        let userList: User[] = [];
        let paginationMeta: { total: number; totalPages: number } | null = null;

        if (response?.data) {
          if (Array.isArray(response.data)) {
            userList = response.data;
          } else if ((response.data as any)?.data && Array.isArray((response.data as any).data)) {
            userList = (response.data as any).data;
            const pagination = (response.data as any).pagination;
            if (pagination) {
              paginationMeta = {
                total: pagination.total ?? userList.length,
                totalPages: Math.max(1, pagination.totalPages ?? 1),
              };
            }
          }
        }

        if (paginationMeta) {
          const { totalPages: tp, total: tu } = paginationMeta;
          if (page > tp) {
            await fetchUsers(tp);
            return;
          }
          setTotalPages(tp);
          setTotalUsers(tu);
        } else {
          setTotalPages(1);
          setTotalUsers(userList.length);
        }

        setUsers(userList);
        setCurrentPage(page);
      } catch (err: unknown) {
        console.error('Error fetching users:', err);
        setError(err instanceof Error ? err.message : 'Failed to load users');
        setUsers([]);
      } finally {
        setLoading(false);
      }
    },
    [searchTerm, roleFilter, statusFilter, showNewThisMonth],
  );

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiClient.getUserStats();
      if (res?.data) setStats(res.data as Stats);
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    void apiClient
      .listPermissionRoles()
      .then((res) => setPermissionRoles(res?.data || []))
      .catch(() => setPermissionRoles([]));
  }, [fetchStats]);

  useEffect(() => {
    const id = setTimeout(
      () => {
        void fetchUsers(1);
      },
      searchTerm.trim().length > 0 ? 300 : 0,
    );
    return () => clearTimeout(id);
  }, [searchTerm, roleFilter, statusFilter, showNewThisMonth, fetchUsers]);

  // Search, role, active/inactive, and new-this-month are applied server-side so totals and
  // pagination match the table. Email verified / unverified filters are client-only (not on list API).
  // All server-side dependencies are listed so the memo invalidates when they change.
  const filteredUsers = useMemo(() => {
    let filtered = Array.isArray(users) ? [...users] : [];

    if (statusFilter === 'VERIFIED') {
      filtered = filtered.filter(u => u.emailVerified === true);
    } else if (statusFilter === 'UNVERIFIED') {
      filtered = filtered.filter(u => u.emailVerified !== true);
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
        case 'role': {
          const ROLE_ORDER: Record<string, number> = {
            ADMIN: 0, PROCUREMENT: 1, FULFILLMENT: 2, CATALOG: 3,
            MARKETING: 4, FINANCE: 5, CMS_EDITOR: 6,
            B2C_SELLER: 7, SELLER: 8, WHOLESALER: 9,
            INFLUENCER: 10, CUSTOMER: 11,
          };
          comparison = (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99);
          break;
        }
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [users, statusFilter, sortBy, sortOrder, searchTerm, roleFilter, showNewThisMonth]);

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
      await fetchUsers(currentPage);
      await fetchStats();
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
      await fetchUsers(currentPage);
      await fetchStats();
    } catch (err: any) {
      console.error('Error creating user:', err);
      toast.error(err.message || 'Failed to create user');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!selectedUser) return;

    if (isProtectedAdminEmail(selectedUser.email)) {
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
      await fetchUsers(currentPage);
      await fetchStats();
    } catch (err: any) {
      console.error('Error deleting user:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    if (isProtectedAdminEmail(user.email)) {
      toast.error('Cannot modify the primary admin user');
      return;
    }
    try {
      const response = await apiClient.toggleUserStatus(user.id);
      const updatedUser = response.data;
      toast.success(updatedUser?.isActive ? 'User activated' : 'User deactivated');
      await fetchUsers(currentPage);
      await fetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle user status');
    }
  };

  const handleResetPassword = (user: User) => {
    setSelectedUser(user);
    setResetPasswordForm({ newPassword: '', confirmPassword: '' });
    setShowResetPasswordModal(true);
  };

  const confirmResetPassword = async () => {
    if (!selectedUser) return;

    if (!resetPasswordForm.newPassword) {
      toast.error('Password is required');
      return;
    }
    if (resetPasswordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setActionLoading(true);
      await toast.promise(
        apiClient.resetUserPassword(selectedUser.id, resetPasswordForm.newPassword),
        {
          loading: 'Resetting password...',
          success: `Password updated for ${selectedUser.email}`,
          error: (err: any) => err.message || 'Failed to reset password',
        }
      );
      setShowResetPasswordModal(false);
      setResetPasswordForm({ newPassword: '', confirmPassword: '' });
      await fetchUsers(currentPage);
      await fetchStats();
    } catch (err: any) {
      console.error('Error resetting password:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedUsers.size === 0) return;
    
    const selectedList = [...selectedUsers].filter(id => {
      const user = users.find(u => u.id === id);
      return user && !isProtectedAdminEmail(user.email);
    });

    if (selectedList.length === 0) {
      toast.error('No eligible users selected');
      return;
    }

    if (!confirm(`${action === 'delete' ? 'Delete' : action === 'activate' ? 'Activate' : 'Deactivate'} ${selectedList.length} users?`)) return;

    let success = 0;
    for (const id of selectedList) {
      try {
        if (action === 'delete') {
          await apiClient.deleteUser(id);
          success++;
        } else {
          // Only toggle if the user's current status actually needs changing.
          // Skip users whose isActive is undefined (data not loaded) to avoid
          // accidental toggles.
          const user = users.find(u => u.id === id);
          const isCurrentlyActive = user?.isActive === true;
          const isCurrentlyInactive = user?.isActive === false;
          const shouldToggle =
            (action === 'deactivate' && isCurrentlyActive) ||
            (action === 'activate' && isCurrentlyInactive);
          if (shouldToggle) {
            await apiClient.toggleUserStatus(id);
            success++;
          }
        }
      } catch {
        // Continue on error
      }
    }

    toast.success(`Successfully ${action === 'delete' ? 'deleted' : action === 'activate' ? 'activated' : 'deactivated'} ${success} users`);
    setSelectedUsers(new Set());
    await fetchUsers(currentPage);
    await fetchStats();
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
      ADMIN: 'bg-red-500/15 text-red-300',
      SELLER: 'bg-hos-gold/20 text-hos-gold',
      B2C_SELLER: 'bg-hos-gold/20 text-hos-gold',
      WHOLESALER: 'bg-green-500/15 text-green-300',
      CUSTOMER: 'bg-hos-bg-tertiary text-hos-text-secondary',
      PROCUREMENT: 'bg-hos-gold/20 text-hos-gold',
      FULFILLMENT: 'bg-yellow-500/15 text-yellow-300',
      CATALOG: 'bg-hos-gold/20 text-hos-gold',
      MARKETING: 'bg-pink-500/15 text-pink-300',
      FINANCE: 'bg-emerald-500/15 text-emerald-300',
      CMS_EDITOR: 'bg-cyan-500/15 text-cyan-300',
    };
    return colors[role] || 'bg-hos-bg-tertiary text-hos-text-secondary';
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

  const tableUsesEmailVerifiedFilter = statusFilter === 'VERIFIED' || statusFilter === 'UNVERIFIED';
  const displayedListCount = tableUsesEmailVerifiedFilter ? filteredUsers.length : totalUsers;
  const showPagination = !tableUsesEmailVerifiedFilter && totalPages > 1;

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-hos-text-secondary">User Management</h1>
              <p className="text-hos-text-secondary mt-1">Manage all platform users, roles, and permissions</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <DataExport data={filteredUsers} columns={exportColumns} filename="users-export" />
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover"
              >
                + Create User
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
              <button
                onClick={() => { setRoleFilter('ALL'); setStatusFilter('ALL'); setShowNewThisMonth(false); }}
                className={`bg-hos-bg-secondary rounded-lg shadow p-3 text-left hover:shadow-md transition-shadow ${roleFilter === 'ALL' && statusFilter === 'ALL' && !showNewThisMonth ? 'ring-2 ring-hos-gold/50' : ''}`}
              >
                <p className="admin-metric-label">Total</p>
                <p className="text-xl font-bold text-hos-text-secondary">{stats.total}</p>
              </button>
              <button
                onClick={() => { setRoleFilter('ADMIN'); setShowNewThisMonth(false); }}
                className={`bg-hos-bg-secondary rounded-lg shadow p-3 text-left hover:shadow-md transition-shadow ${roleFilter === 'ADMIN' && !showNewThisMonth ? 'ring-2 ring-hos-gold/50' : ''}`}
              >
                <p className="text-xs text-hos-text-muted">Admins</p>
                <p className="text-xl font-bold text-red-400">{stats.admins}</p>
              </button>
              <button
                onClick={() => { setRoleFilter('SELLERS'); setShowNewThisMonth(false); }}
                className={`bg-hos-bg-secondary rounded-lg shadow p-3 text-left hover:shadow-md transition-shadow ${roleFilter === 'SELLERS' && !showNewThisMonth ? 'ring-2 ring-hos-gold/50' : ''}`}
              >
                <p className="text-xs text-hos-text-muted">Sellers</p>
                <p className="text-xl font-bold text-hos-gold">{stats.sellers}</p>
              </button>
              <button
                onClick={() => { setRoleFilter('CUSTOMER'); setShowNewThisMonth(false); }}
                className={`bg-hos-bg-secondary rounded-lg shadow p-3 text-left hover:shadow-md transition-shadow ${roleFilter === 'CUSTOMER' && !showNewThisMonth ? 'ring-2 ring-hos-gold/50' : ''}`}
              >
                <p className="text-xs text-hos-text-muted">Customers</p>
                <p className="text-xl font-bold text-hos-text-secondary">{stats.customers}</p>
              </button>
              <button
                onClick={() => { setRoleFilter('TEAM'); setShowNewThisMonth(false); }}
                className={`bg-hos-bg-secondary rounded-lg shadow p-3 text-left hover:shadow-md transition-shadow ${roleFilter === 'TEAM' && !showNewThisMonth ? 'ring-2 ring-hos-gold/50' : ''}`}
              >
                <p className="text-xs text-hos-text-muted">Team</p>
                <p className="text-xl font-bold text-hos-gold">{stats.teamMembers}</p>
              </button>
              <button
                onClick={() => { setRoleFilter('INFLUENCER'); setShowNewThisMonth(false); }}
                className={`bg-hos-bg-secondary rounded-lg shadow p-3 text-left hover:shadow-md transition-shadow ${roleFilter === 'INFLUENCER' && !showNewThisMonth ? 'ring-2 ring-hos-gold/50' : ''}`}
              >
                <p className="text-xs text-hos-text-muted">Influencers</p>
                <p className="text-xl font-bold text-amber-400">{stats.influencers}</p>
              </button>
              <button
                onClick={() => {
                  const next = !showNewThisMonth;
                  setShowNewThisMonth(next);
                  if (next) {
                    setRoleFilter('ALL');
                    setStatusFilter('ALL');
                  }
                }}
                className={`bg-hos-bg-secondary rounded-lg shadow p-3 text-left hover:shadow-md transition-shadow ${showNewThisMonth ? 'ring-2 ring-green-500' : ''}`}
              >
                <p className="text-xs text-hos-text-muted">New This Month</p>
                <p className="text-xl font-bold text-green-400">{stats.newThisMonth}</p>
              </button>
              <button
                onClick={() => { setStatusFilter('ACTIVE'); setShowNewThisMonth(false); }}
                className={`bg-hos-bg-secondary rounded-lg shadow p-3 text-left hover:shadow-md transition-shadow ${statusFilter === 'ACTIVE' && !showNewThisMonth ? 'ring-2 ring-hos-gold/50' : ''}`}
              >
                <p className="text-xs text-hos-text-muted">Active</p>
                <p className="text-xl font-bold text-green-400">{stats.active}</p>
              </button>
              <button
                onClick={() => { setStatusFilter('INACTIVE'); setShowNewThisMonth(false); }}
                className={`bg-hos-bg-secondary rounded-lg shadow p-3 text-left hover:shadow-md transition-shadow ${statusFilter === 'INACTIVE' && !showNewThisMonth ? 'ring-2 ring-hos-gold/50' : ''}`}
              >
                <p className="text-xs text-hos-text-muted">Inactive</p>
                <p className="text-xl font-bold text-red-400">{stats.inactive}</p>
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-300">Error: {error}</p>
              <button onClick={() => { fetchUsers(1); fetchStats(); }} className="mt-2 text-red-400 hover:text-red-300 text-sm">Retry</button>
            </div>
          )}

          {/* Filters */}
          <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Name, email, or store..."
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Role</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="select w-full"
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
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="select w-full"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="VERIFIED">Email Verified</option>
                  <option value="UNVERIFIED">Email Unverified</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Sort By</label>
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field as any);
                    setSortOrder(order as any);
                  }}
                  className="select w-full"
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

            {(searchTerm || roleFilter !== 'ALL' || statusFilter !== 'ALL' || showNewThisMonth) && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setRoleFilter('ALL');
                    setStatusFilter('ALL');
                    setShowNewThisMonth(false);
                  }}
                  className="text-sm text-hos-gold hover:text-hos-gold-hover"
                >
                  Clear filters
                </button>
              </div>
            )}

            {/* Bulk Actions */}
            {selectedUsers.size > 0 && (
              <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                <span className="text-sm text-hos-text-secondary">{selectedUsers.size} selected</span>
                <button
                  onClick={() => handleBulkAction('activate')}
                  className="px-3 py-1 text-sm bg-green-500/15 text-green-400 rounded hover:bg-green-200"
                >
                  Activate
                </button>
                <button
                  onClick={() => handleBulkAction('deactivate')}
                  className="px-3 py-1 text-sm bg-yellow-500/15 text-yellow-400 rounded hover:bg-yellow-200"
                >
                  Deactivate
                </button>
                <button
                  onClick={() => handleBulkAction('delete')}
                  className="px-3 py-1 text-sm bg-red-500/15 text-red-400 rounded hover:bg-red-200"
                >
                  Delete
                </button>
                <button
                  onClick={() => setSelectedUsers(new Set())}
                  className="text-sm text-hos-text-muted hover:text-hos-text-secondary"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
            </div>
          )}

          {!loading && filteredUsers.length === 0 && (
            <div className="bg-hos-bg-secondary rounded-lg shadow p-8 text-center">
              <p className="text-hos-text-muted text-lg">No users found</p>
            </div>
          )}

          {/* Users Table */}
          {!loading && filteredUsers.length > 0 && (
            <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b flex justify-between items-start gap-4">
                <div>
                  <h2 className="font-semibold">Users ({displayedListCount})</h2>
                  {tableUsesEmailVerifiedFilter && (
                    <p className="text-xs text-hos-text-muted mt-0.5">
                      Email verification is filtered on the loaded page only; totals above reflect the full directory.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <AdminColumnToggle
                    columns={USER_TABLE_COLUMNS}
                    visibleIds={userVisibleColumnIds}
                    onToggle={toggleUserColumn}
                    onReset={resetUserColumns}
                  />
                  <button onClick={selectAll} className="text-sm text-hos-gold hover:text-hos-gold-hover">
                    {selectedUsers.size === filteredUsers.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>
              <div ref={tableScrollRef} className="overflow-auto max-h-[500px] overflow-x-auto">
                <table className="admin-table min-w-full divide-y divide-hos-border">
                  <thead className="bg-hos-bg-secondary sticky top-0 z-10">
                    <tr>
                      {isUserColumnVisible('select') && (
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                            onChange={selectAll}
                            className="rounded border-hos-border text-hos-gold"
                            aria-label="Select all users"
                          />
                        </th>
                      )}
                      {isUserColumnVisible('user') && <th className="px-4 py-3 text-left">User</th>}
                      {isUserColumnVisible('role') && <th className="px-4 py-3 text-left">Role</th>}
                      {isUserColumnVisible('status') && <th className="px-4 py-3 text-left">Status</th>}
                      {isUserColumnVisible('created') && <th className="px-4 py-3 text-left">Created</th>}
                      {isUserColumnVisible('actions') && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <VirtualizedTableBody
                    items={filteredUsers}
                    scrollRef={tableScrollRef}
                    getRowClassName={(user) =>
                      `admin-table-row-clickable ${selectedUsers.has(user.id) ? 'bg-hos-gold/10' : ''}`
                    }
                    onRowClick={(user) => handleViewDetails(user)}
                    renderRow={(user) => (
                      <>
                        {isUserColumnVisible('select') && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedUsers.has(user.id)}
                            onChange={() => toggleSelection(user.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-hos-border text-hos-gold"
                            aria-label={`Select ${user.email}`}
                          />
                        </td>
                        )}
                        {isUserColumnVisible('user') && (
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              {user.avatar ? (
                                <SafeImage width={40} height={40} className="h-10 w-10 rounded-full object-cover" src={user.avatar} alt={`${user.firstName || user.email} avatar`} fallback="👤" />
                              ) : (
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${avatarColorClass(user.email)}`}>
                                  <span className="text-hos-gold font-medium text-sm">
                                    {user.firstName?.[0] || user.email[0].toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-hos-text-secondary">
                                {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : 'No Name'}
                              </p>
                              <p className="text-xs text-hos-text-muted truncate max-w-[180px]">{user.email}</p>
                              {user.storeName && <p className="text-xs text-hos-gold">{user.storeName}</p>}
                            </div>
                          </div>
                        </td>
                        )}
                        {isUserColumnVisible('role') && (
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded-full ${getRoleBadgeColor(user.role)}`}>
                            {user.role}
                          </span>
                        </td>
                        )}
                        {isUserColumnVisible('status') && (
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className={`px-2 py-0.5 text-xs rounded-full w-fit ${user.isActive !== false ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'}`}>
                              {user.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                            {user.emailVerified && (
                              <span className="text-xs text-hos-gold">✓ Verified</span>
                            )}
                          </div>
                        </td>
                        )}
                        {isUserColumnVisible('created') && (
                        <td className="px-4 py-3 text-sm text-hos-text-muted">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        )}
                        {isUserColumnVisible('actions') && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleViewDetails(user); }}
                              className="admin-table-action"
                            >
                              View
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEdit(user); }}
                              className="admin-table-action"
                            >
                              Edit
                            </button>
                            {isSuperAdmin && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleResetPassword(user); }}
                                className="admin-table-action"
                              >
                                Reset Pwd
                              </button>
                            )}
                            {!isProtectedAdminEmail(user.email) && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleToggleStatus(user); }}
                                  className="admin-table-action"
                                >
                                  {user.isActive !== false ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(user); }}
                                  className="admin-table-action-danger"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                        )}
                      </>
                    )}
                  />
                </table>
              </div>
              {showPagination && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-hos-border text-sm bg-hos-bg-secondary/80">
                  <span className="text-hos-text-muted">
                    Page {currentPage} of {totalPages} ({totalUsers} matching)
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => fetchUsers(currentPage - 1)}
                      className="admin-pagination-btn"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => fetchUsers(currentPage + 1)}
                      className="admin-pagination-btn admin-pagination-btn-primary"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Detail Modal */}
          {showDetailModal && selectedUser && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
              role="dialog"
              aria-modal="true"
              aria-labelledby="user-detail-modal-title"
              onKeyDown={(e) => e.key === 'Escape' && setShowDetailModal(false)}
            >
              <div className="bg-hos-bg-secondary rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <h2 id="user-detail-modal-title" className="text-2xl font-bold">User Details</h2>
                    <button onClick={() => setShowDetailModal(false)} className="text-hos-text-muted hover:text-hos-text-secondary text-2xl">×</button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      {selectedUser.avatar ? (
                        <SafeImage width={64} height={64} className="rounded-full object-cover" src={selectedUser.avatar} alt="" fallback="👤" />
                      ) : (
                        <div className="h-16 w-16 rounded-full bg-hos-gold/20 flex items-center justify-center">
                          <span className="text-hos-gold font-bold text-2xl">
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
                        <p className="text-hos-text-muted">{selectedUser.email}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-sm text-hos-text-muted">Role</p>
                        <span className={`px-2 py-1 text-xs rounded-full ${getRoleBadgeColor(selectedUser.role)}`}>
                          {selectedUser.role}
                        </span>
                        <p className="text-xs text-hos-text-muted mt-1">{ROLE_DESCRIPTIONS[selectedUser.role]}</p>
                      </div>
                      <div>
                        <p className="text-sm text-hos-text-muted">Status</p>
                        <span className={`px-2 py-1 text-xs rounded-full ${selectedUser.isActive !== false ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'}`}>
                          {selectedUser.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {selectedUser.storeName && (
                        <div className="col-span-2">
                          <p className="text-sm text-hos-text-muted">Store Name</p>
                          <p className="font-medium">{selectedUser.storeName}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-hos-text-muted">Email Verified</p>
                        <p className="font-medium">{selectedUser.emailVerified ? 'Yes' : 'No'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-hos-text-muted">Member Since</p>
                        <p className="font-medium">{new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                      </div>
                      {selectedUser.lastLoginAt && (
                        <div className="col-span-2">
                          <p className="text-sm text-hos-text-muted">Last Login</p>
                          <p className="font-medium">{new Date(selectedUser.lastLoginAt).toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-4 border-t">
                      <button
                        onClick={() => { setShowDetailModal(false); handleEdit(selectedUser); }}
                        className="flex-1 px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover"
                      >
                        Edit User
                      </button>
                      <button
                        onClick={() => setShowDetailModal(false)}
                        className="px-4 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary"
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
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-user-modal-title"
              onKeyDown={(e) => e.key === 'Escape' && setShowEditModal(false)}
            >
              <div className="bg-hos-bg-secondary rounded-lg max-w-md w-full">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 id="edit-user-modal-title" className="text-2xl font-bold">Edit User</h2>
                    <button onClick={() => setShowEditModal(false)} className="text-hos-text-muted hover:text-hos-text-secondary">✕</button>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">First Name</label>
                        <input
                          type="text"
                          value={editForm.firstName}
                          onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">Last Name</label>
                        <input
                          type="text"
                          value={editForm.lastName}
                          onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                          className="input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Email</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        disabled={isProtectedAdminEmail(selectedUser.email)}
                        className="input disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Role</label>
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        disabled={isProtectedAdminEmail(selectedUser.email)}
                        className="select w-full disabled:opacity-60"
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
                        disabled={isProtectedAdminEmail(selectedUser.email)}
                        className="rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
                      />
                      <label htmlFor="isActive" className="text-sm font-medium text-hos-text-secondary">Active Account</label>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleUpdateUser}
                        disabled={actionLoading}
                        className="flex-1 px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50"
                      >
                        {actionLoading ? 'Updating...' : 'Update User'}
                      </button>
                      <button
                        onClick={() => setShowEditModal(false)}
                        className="px-6 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-text-muted"
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
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-user-modal-title"
              onKeyDown={(e) => e.key === 'Escape' && setShowCreateModal(false)}
            >
              <div className="bg-hos-bg-secondary rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 id="create-user-modal-title" className="text-2xl font-bold">Create User</h2>
                    <button onClick={() => setShowCreateModal(false)} className="text-hos-text-muted hover:text-hos-text-secondary">✕</button>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">First Name</label>
                        <input
                          type="text"
                          value={createForm.firstName}
                          onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">Last Name</label>
                        <input
                          type="text"
                          value={createForm.lastName}
                          onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                          className="input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Email *</label>
                      <input
                        type="email"
                        value={createForm.email}
                        onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                        className="input"
                        placeholder="user@example.com"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Phone</label>
                      <input
                        type="tel"
                        value={createForm.phone}
                        onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                        className="input"
                        placeholder="+1234567890"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">Password *</label>
                        <input
                          type="password"
                          value={createForm.password}
                          onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                          className="input"
                          placeholder="Min 8 characters"
                          minLength={8}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">Confirm Password *</label>
                        <input
                          type="password"
                          value={createForm.confirmPassword}
                          onChange={(e) => setCreateForm({ ...createForm, confirmPassword: e.target.value })}
                          className="input"
                          placeholder="Confirm password"
                          minLength={8}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Role *</label>
                      <select
                        value={createForm.role}
                        onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                        className="select w-full"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                      <p className="text-xs text-hos-text-muted mt-1">{ROLE_DESCRIPTIONS[createForm.role]}</p>
                    </div>

                    {/* ADMIN specific fields */}
                    {createForm.role === 'ADMIN' && permissionRoles.length > 0 && (
                      <div className="bg-red-500/10 p-4 rounded-lg space-y-4">
                        <h4 className="text-sm font-semibold text-red-300">Admin Configuration</h4>
                        <div>
                          <label className="block text-sm font-medium text-hos-text-secondary mb-1">Permission Role</label>
                          <select
                            value={createForm.permissionRoleName}
                            onChange={(e) => setCreateForm({ ...createForm, permissionRoleName: e.target.value })}
                            className="select w-full"
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
                      <div className="bg-hos-gold/10 p-4 rounded-lg space-y-4">
                        <h4 className="text-sm font-semibold text-hos-gold">Business Information</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-hos-text-secondary mb-1">Store Name *</label>
                            <input
                              type="text"
                              value={createForm.storeName}
                              onChange={(e) => setCreateForm({ ...createForm, storeName: e.target.value })}
                              className="input"
                              placeholder="Your store name"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-hos-text-secondary mb-1">Company Name</label>
                            <input
                              type="text"
                              value={createForm.companyName}
                              onChange={(e) => setCreateForm({ ...createForm, companyName: e.target.value })}
                              className="input"
                              placeholder="Legal company name"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-hos-text-secondary mb-1">Tax ID / EIN</label>
                            <input
                              type="text"
                              value={createForm.vatNumber}
                              onChange={(e) => setCreateForm({ ...createForm, vatNumber: e.target.value })}
                              className="input"
                              placeholder="GB123456789"
                            />
                          </div>
                          {isWholesaler && (
                            <div>
                              <label className="block text-sm font-medium text-hos-text-secondary mb-1">Business Type</label>
                              <select
                                value={createForm.businessType}
                                onChange={(e) => setCreateForm({ ...createForm, businessType: e.target.value })}
                                className="select w-full"
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
                      <div className="bg-hos-gold/10 p-4 rounded-lg space-y-4">
                        <h4 className="text-sm font-semibold text-hos-gold">Team Member Details</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-hos-text-secondary mb-1">Department</label>
                            <select
                              value={createForm.department}
                              onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                              className="select w-full"
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
                            <label className="block text-sm font-medium text-hos-text-secondary mb-1">Employee ID</label>
                            <input
                              type="text"
                              value={createForm.employeeId}
                              onChange={(e) => setCreateForm({ ...createForm, employeeId: e.target.value })}
                              className="input"
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
                        className="flex-1 px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50"
                      >
                        {actionLoading ? 'Creating...' : 'Create User'}
                      </button>
                      <button
                        onClick={() => setShowCreateModal(false)}
                        className="px-6 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-text-muted"
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
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-user-modal-title"
              onKeyDown={(e) => e.key === 'Escape' && setShowDeleteModal(false)}
            >
              <div className="bg-hos-bg-secondary rounded-lg max-w-md w-full">
                <div className="p-6">
                  <h2 id="delete-user-modal-title" className="text-2xl font-bold mb-4">Delete User</h2>
                  <p className="text-hos-text-secondary mb-6">
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
                      className="px-6 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-text-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Reset Password Modal */}
          {showResetPasswordModal && selectedUser && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
              role="dialog"
              aria-modal="true"
              aria-labelledby="reset-password-modal-title"
              onKeyDown={(e) => e.key === 'Escape' && setShowResetPasswordModal(false)}
            >
              <div className="bg-hos-bg-secondary rounded-lg max-w-md w-full">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 id="reset-password-modal-title" className="text-2xl font-bold">Reset Password</h2>
                    <button onClick={() => setShowResetPasswordModal(false)} className="text-hos-text-muted hover:text-hos-text-secondary">&#10005;</button>
                  </div>

                  <p className="text-hos-text-secondary mb-4">
                    Set a new password for <strong>{selectedUser.email}</strong>
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">New Password</label>
                      <input
                        type="password"
                        value={resetPasswordForm.newPassword}
                        onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, newPassword: e.target.value })}
                        className="input"
                        placeholder="Min 8 characters"
                        minLength={8}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Confirm Password</label>
                      <input
                        type="password"
                        value={resetPasswordForm.confirmPassword}
                        onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, confirmPassword: e.target.value })}
                        className="input"
                        placeholder="Confirm new password"
                        minLength={8}
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={confirmResetPassword}
                        disabled={actionLoading}
                        className="flex-1 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                      >
                        {actionLoading ? 'Resetting...' : 'Reset Password'}
                      </button>
                      <button
                        onClick={() => setShowResetPasswordModal(false)}
                        className="px-6 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-text-muted"
                      >
                        Cancel
                      </button>
                    </div>
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
