'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { DataExport } from '@/components/DataExport';
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface Seller {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  storeName?: string;
  storeDescription?: string;
  avatar?: string;
  phone?: string;
  isActive?: boolean;
  emailVerified?: boolean;
  createdAt: string;
  updatedAt?: string;
  // Performance metrics (may be populated separately)
  totalProducts?: number;
  totalOrders?: number;
  totalRevenue?: number;
  rating?: number;
  onboardingComplete?: boolean;
  // Address fields
  warehouseAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
  };
  city?: string;
  country?: string;
}

interface Invitation {
  id: string;
  email: string;
  sellerType: string;
  status: string;
  message?: string;
  expiresAt: string;
  createdAt: string;
}

interface Stats {
  totalSellers: number;
  b2cSellers: number;
  wholesalers: number;
  activeSellers: number;
  inactiveSellers: number;
  pendingInvitations: number;
  newThisMonth: number;
  avgProductsPerSeller: number;
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function AdminSellersPage() {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTab, setActiveTab] = useState<'sellers' | 'invitations'>('sellers');
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'products' | 'revenue'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Modals
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Invite form
  const [inviteForm, setInviteForm] = useState({
    email: '',
    sellerType: 'B2C_SELLER' as 'WHOLESALER' | 'B2C_SELLER',
    message: '',
  });

  const fetchSellers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getAdminSellers();
      
      const raw = response?.data;
      const sellerData = Array.isArray(raw) ? raw : [];
      
      // Map seller profile data to the Seller interface expected by the UI
      const mappedSellers = sellerData.map((seller: any) => ({
        id: seller.user?.id || seller.userId || seller.id,
        sellerId: seller.id, // The actual seller profile ID (for suspend/activate)
        email: seller.user?.email || '',
        firstName: seller.user?.firstName || '',
        lastName: seller.user?.lastName || '',
        phone: seller.user?.phone || seller.warehouseAddress?.phone || '',
        role: seller.user?.role || seller.sellerType || 'SELLER',
        storeName: seller.storeName || '',
        storeDescription: seller.storeDescription || '',
        avatar: seller.user?.avatar || '',
        isActive: seller.verified !== false,
        companyName: seller.companyName || '',
        vatNumber: seller.vatNumber || '',
        customDomain: seller.customDomain || '',
        subDomain: seller.subDomain || '',
        country: seller.country || seller.warehouseAddress?.country || '',
        city: seller.city || seller.warehouseAddress?.city || '',
        warehouseAddress: seller.warehouseAddress ? {
          street: seller.warehouseAddress.street || '',
          city: seller.warehouseAddress.city || '',
          state: seller.warehouseAddress.state || '',
          postalCode: seller.warehouseAddress.postalCode || '',
          country: seller.warehouseAddress.country || '',
          phone: seller.warehouseAddress.phone || '',
        } : undefined,
        totalProducts: seller.totalProducts || seller._count?.products || 0,
        createdAt: seller.createdAt || seller.user?.createdAt || '',
        updatedAt: seller.updatedAt || '',
      }));
      
      setSellers(mappedSellers);
      calculateStats(mappedSellers);
    } catch (err: any) {
      console.error('Error fetching sellers:', err);
      setError(err.message || 'Failed to load sellers');
      setSellers([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInvitations = useCallback(async () => {
    try {
      const response = await apiClient.getSellerInvitations();
      if (response?.data) {
        setInvitations(Array.isArray(response.data) ? response.data : []);
      }
    } catch (err: any) {
      console.error('Error fetching invitations:', err);
    }
  }, []);

  const calculateStats = (sellerList: Seller[]) => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const totalProducts = sellerList.reduce((sum, s) => sum + (s.totalProducts || 0), 0);
    
    setStats({
      totalSellers: sellerList.length,
      b2cSellers: sellerList.filter(s => s.role === 'B2C_SELLER').length,
      wholesalers: sellerList.filter(s => s.role === 'WHOLESALER').length,
      activeSellers: sellerList.filter(s => s.isActive !== false).length,
      inactiveSellers: sellerList.filter(s => s.isActive === false).length,
      pendingInvitations: invitations.filter(i => i.status === 'PENDING').length,
      newThisMonth: sellerList.filter(s => new Date(s.createdAt) >= firstOfMonth).length,
      avgProductsPerSeller: sellerList.length > 0 ? Math.round(totalProducts / sellerList.length) : 0,
    });
  };

  useEffect(() => {
    fetchSellers();
    fetchInvitations();
  }, [fetchSellers, fetchInvitations]);

  // Recalculate stats when invitations change
  useEffect(() => {
    if (sellers.length > 0) {
      calculateStats(sellers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitations]);

  // Filtered and sorted sellers
  const filteredSellers = useMemo(() => {
    let filtered = [...sellers];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(seller =>
        seller.email.toLowerCase().includes(term) ||
        seller.storeName?.toLowerCase().includes(term) ||
        `${seller.firstName} ${seller.lastName}`.toLowerCase().includes(term)
      );
    }

    // Type filter
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(s => s.role === typeFilter);
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'ACTIVE') {
        filtered = filtered.filter(s => s.isActive !== false);
      } else if (statusFilter === 'INACTIVE') {
        filtered = filtered.filter(s => s.isActive === false);
      } else if (statusFilter === 'VERIFIED') {
        filtered = filtered.filter(s => s.emailVerified === true);
      } else if (statusFilter === 'ONBOARDING') {
        filtered = filtered.filter(s => s.onboardingComplete === false);
      }
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = (a.storeName || a.email).localeCompare(b.storeName || b.email);
          break;
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'products':
          comparison = (a.totalProducts || 0) - (b.totalProducts || 0);
          break;
        case 'revenue':
          comparison = (a.totalRevenue || 0) - (b.totalRevenue || 0);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [sellers, searchTerm, typeFilter, statusFilter, sortBy, sortOrder]);

  // Chart data
  const sellerTypeData = useMemo(() => {
    return [
      { name: 'B2C Sellers', value: sellers.filter(s => s.role === 'B2C_SELLER').length },
      { name: 'Wholesalers', value: sellers.filter(s => s.role === 'WHOLESALER').length },
      { name: 'Legacy', value: sellers.filter(s => s.role === 'SELLER').length },
    ].filter(d => d.value > 0);
  }, [sellers]);

  const handleViewDetails = (seller: Seller) => {
    setSelectedSeller(seller);
    setShowDetailModal(true);
  };

  const handleInviteSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await apiClient.inviteSeller(inviteForm);
      toast.success('Seller invitation sent successfully');
      setShowInviteForm(false);
      setInviteForm({ email: '', sellerType: 'B2C_SELLER', message: '' });
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invitation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendInvitation = async (id: string) => {
    try {
      await apiClient.resendSellerInvitation(id);
      toast.success('Invitation resent successfully');
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend invitation');
    }
  };

  const handleCancelInvitation = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;
    try {
      await apiClient.cancelSellerInvitation(id);
      toast.success('Invitation cancelled successfully');
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel invitation');
    }
  };

  const handleToggleStatus = async (seller: Seller) => {
    const sellerId = (seller as any).sellerId || seller.id;
    try {
      setActionLoading(true);
      await apiClient.put(`/admin/sellers/${sellerId}/suspend`, {});
      toast.success(seller.isActive !== false ? 'Seller suspended successfully' : 'Seller activated successfully');
      fetchSellers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update seller status');
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      B2C_SELLER: 'bg-blue-100 text-blue-800',
      WHOLESALER: 'bg-green-100 text-green-800',
      SELLER: 'bg-gray-100 text-gray-800',
    };
    const labels: Record<string, string> = {
      B2C_SELLER: 'B2C',
      WHOLESALER: 'Wholesale',
      SELLER: 'Legacy',
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${styles[role] || 'bg-gray-100 text-gray-800'}`}>
        {labels[role] || role}
      </span>
    );
  };

  const exportColumns = [
    { key: 'storeName', header: 'Store Name' },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    { key: 'firstName', header: 'First Name' },
    { key: 'lastName', header: 'Last Name' },
    { key: 'companyName', header: 'Company Name' },
    { key: 'warehouseAddress', header: 'Address Street', format: (v: any, s: Seller) => (v?.street || '').trim() },
    { key: 'warehouseAddress', header: 'Address City', format: (v: any, s: Seller) => (v?.city || s.city || '').trim() },
    { key: 'warehouseAddress', header: 'Address State', format: (v: any) => (v?.state || '').trim() },
    { key: 'warehouseAddress', header: 'Address Postal Code', format: (v: any) => (v?.postalCode || '').trim() },
    { key: 'warehouseAddress', header: 'Address Country', format: (v: any, s: Seller) => (v?.country || s.country || '').trim() },
    { key: 'warehouseAddress', header: 'Address Phone', format: (v: any) => (v?.phone || '').trim() },
    { key: 'role', header: 'Type' },
    { key: 'isActive', header: 'Status', format: (v: boolean) => v !== false ? 'Active' : 'Inactive' },
    { key: 'totalProducts', header: 'Products', format: (v: number) => String(v || 0) },
    { key: 'totalOrders', header: 'Orders', format: (v: number) => String(v || 0) },
    { key: 'totalRevenue', header: 'Revenue', format: (v: number, s: Seller) => formatPrice(v || 0) },
    { key: 'customDomain', header: 'Custom Domain' },
    { key: 'subDomain', header: 'Subdomain' },
    { key: 'createdAt', header: 'Joined', format: (v: string) => new Date(v).toLocaleDateString() },
  ];

  const tabs = [
    { id: 'sellers', label: 'Active Sellers', count: sellers.length },
    { id: 'invitations', label: 'Invitations', count: invitations.length },
  ];

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Seller Management</h1>
              <p className="text-gray-600 mt-1">Manage marketplace sellers and invitations</p>
            </div>
            <div className="flex gap-2">
              <DataExport data={filteredSellers} columns={exportColumns} filename="sellers-export" />
              <button
                onClick={() => setShowInviteForm(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                + Invite Seller
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <button
                onClick={() => { setTypeFilter('ALL'); setStatusFilter('ALL'); }}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${typeFilter === 'ALL' && statusFilter === 'ALL' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Total Sellers</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalSellers}</p>
              </button>
              <button
                onClick={() => setTypeFilter('B2C_SELLER')}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${typeFilter === 'B2C_SELLER' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">B2C Sellers</p>
                <p className="text-xl font-bold text-blue-600">{stats.b2cSellers}</p>
              </button>
              <button
                onClick={() => setTypeFilter('WHOLESALER')}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${typeFilter === 'WHOLESALER' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Wholesalers</p>
                <p className="text-xl font-bold text-green-600">{stats.wholesalers}</p>
              </button>
              <button
                onClick={() => setStatusFilter('ACTIVE')}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${statusFilter === 'ACTIVE' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Active</p>
                <p className="text-xl font-bold text-green-600">{stats.activeSellers}</p>
              </button>
              <button
                onClick={() => setStatusFilter('INACTIVE')}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${statusFilter === 'INACTIVE' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Inactive</p>
                <p className="text-xl font-bold text-red-600">{stats.inactiveSellers}</p>
              </button>
              <button
                onClick={() => setActiveTab('invitations')}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${activeTab === 'invitations' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Pending Invites</p>
                <p className="text-xl font-bold text-yellow-600">{stats.pendingInvitations}</p>
              </button>
              <div className="bg-white rounded-lg shadow p-3">
                <p className="text-xs text-gray-500">New This Month</p>
                <p className="text-xl font-bold text-purple-600">{stats.newThisMonth}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-3">
                <p className="text-xs text-gray-500">Avg Products</p>
                <p className="text-xl font-bold text-gray-600">{stats.avgProductsPerSeller}</p>
              </div>
            </div>
          )}

          {/* Charts */}
          {sellerTypeData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Seller Distribution</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sellerTypeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {sellerTypeData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Total Active Sellers</span>
                    <span className="text-xl font-bold text-green-600">{stats?.activeSellers || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Pending Invitations</span>
                    <span className="text-xl font-bold text-yellow-600">{invitations.filter(i => i.status === 'PENDING').length}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Accepted This Month</span>
                    <span className="text-xl font-bold text-blue-600">{stats?.newThisMonth || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Expired Invitations</span>
                    <span className="text-xl font-bold text-red-600">{invitations.filter(i => i.status === 'EXPIRED').length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
              <button onClick={fetchSellers} className="mt-2 text-red-600 hover:text-red-800 text-sm">Retry</button>
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </nav>
          </div>

          {/* Sellers Tab */}
          {activeTab === 'sellers' && (
            <>
              {/* Filters */}
              <div className="bg-white rounded-lg shadow p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Store name, email..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="ALL">All Types</option>
                      <option value="B2C_SELLER">B2C Seller</option>
                      <option value="WHOLESALER">Wholesaler</option>
                      <option value="SELLER">Legacy Seller</option>
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
                      <option value="ONBOARDING">Onboarding Pending</option>
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
                      <option value="name-asc">Store A-Z</option>
                      <option value="products-desc">Most Products</option>
                      <option value="revenue-desc">Highest Revenue</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Sellers Table */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seller</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Products</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredSellers.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                              No sellers found
                            </td>
                          </tr>
                        ) : (
                          filteredSellers.map((seller) => (
                            <tr key={seller.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10">
                                    {seller.avatar ? (
                                      <Image width={40} height={40} className="h-10 w-10 rounded-full object-cover" src={seller.avatar} alt="" />
                                    ) : (
                                      <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                                        <span className="text-purple-600 font-medium text-sm">
                                          {seller.storeName?.[0] || seller.email[0].toUpperCase()}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="ml-3">
                                    <p className="text-sm font-medium text-gray-900">{seller.storeName || 'No Store Name'}</p>
                                    <p className="text-xs text-gray-500">{seller.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">{getRoleBadge(seller.role)}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-1">
                                  <span className={`px-2 py-0.5 text-xs rounded-full w-fit ${seller.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {seller.isActive !== false ? 'Active' : 'Inactive'}
                                  </span>
                                  {seller.emailVerified && (
                                    <span className="text-xs text-blue-600">✓ Verified</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{seller.totalProducts || 0}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{seller.totalOrders || 0}</td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {formatPrice(seller.totalRevenue || 0)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {new Date(seller.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-1">
                                  <button
                                    onClick={() => handleViewDetails(seller)}
                                    className="px-2 py-1 text-sm text-purple-600 hover:bg-purple-50 rounded"
                                  >
                                    View
                                  </button>
                                  <button
                                    onClick={() => handleToggleStatus(seller)}
                                    disabled={actionLoading}
                                    className={`px-2 py-1 text-sm rounded ${seller.isActive !== false ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}
                                  >
                                    {seller.isActive !== false ? 'Suspend' : 'Activate'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Invitations Tab */}
          {activeTab === 'invitations' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold">Pending Invitations</h2>
                <button
                  onClick={() => setShowInviteForm(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                >
                  + New Invitation
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {invitations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                          No invitations found
                        </td>
                      </tr>
                    ) : (
                      invitations.map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{inv.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{getRoleBadge(inv.sellerType)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              inv.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                              inv.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' :
                              inv.status === 'EXPIRED' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(inv.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            {inv.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleResendInvitation(inv.id)}
                                  className="text-blue-600 hover:text-blue-800 mr-3"
                                >
                                  Resend
                                </button>
                                <button
                                  onClick={() => handleCancelInvitation(inv.id)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Invite Form Modal */}
          {showInviteForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <h2 className="text-xl font-bold">Invite New Seller</h2>
                    <button onClick={() => setShowInviteForm(false)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                  </div>
                  <form onSubmit={handleInviteSeller} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                      <input
                        type="email"
                        required
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="seller@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Seller Type *</label>
                      <select
                        value={inviteForm.sellerType}
                        onChange={(e) => setInviteForm({ ...inviteForm, sellerType: e.target.value as any })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="B2C_SELLER">B2C Seller</option>
                        <option value="WHOLESALER">Wholesaler</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        {inviteForm.sellerType === 'B2C_SELLER' 
                          ? 'Sells directly to consumers with standard pricing' 
                          : 'Wholesale seller with bulk pricing options'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Welcome Message</label>
                      <textarea
                        value={inviteForm.message}
                        onChange={(e) => setInviteForm({ ...inviteForm, message: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        rows={3}
                        placeholder="Optional personalized message..."
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        {actionLoading ? 'Sending...' : 'Send Invitation'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowInviteForm(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Seller Detail Modal */}
          {showDetailModal && selectedSeller && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-bold">Seller Details</h2>
                    <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                  </div>

                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-4">
                      {selectedSeller.avatar ? (
                        <Image width={80} height={80} className="rounded-full object-cover" src={selectedSeller.avatar} alt="" />
                      ) : (
                        <div className="h-20 w-20 rounded-full bg-purple-100 flex items-center justify-center">
                          <span className="text-purple-600 font-bold text-3xl">
                            {selectedSeller.storeName?.[0] || selectedSeller.email[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <h3 className="text-xl font-semibold">{selectedSeller.storeName || 'No Store Name'}</h3>
                        <p className="text-gray-500">{selectedSeller.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {getRoleBadge(selectedSeller.role)}
                          <span className={`px-2 py-0.5 text-xs rounded-full ${selectedSeller.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {selectedSeller.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-purple-600">{selectedSeller.totalProducts || 0}</p>
                        <p className="text-sm text-gray-500">Products</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-blue-600">{selectedSeller.totalOrders || 0}</p>
                        <p className="text-sm text-gray-500">Orders</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-green-600">{formatPrice(selectedSeller.totalRevenue || 0)}</p>
                        <p className="text-sm text-gray-500">Revenue</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-yellow-600">{selectedSeller.rating?.toFixed(1) || 'N/A'}</p>
                        <p className="text-sm text-gray-500">Rating</p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-sm text-gray-500">Owner Name</p>
                        <p className="font-medium">
                          {selectedSeller.firstName && selectedSeller.lastName 
                            ? `${selectedSeller.firstName} ${selectedSeller.lastName}` 
                            : 'Not set'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Phone</p>
                        <p className="font-medium">{selectedSeller.phone || 'Not set'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Email Verified</p>
                        <p className="font-medium">{selectedSeller.emailVerified ? 'Yes' : 'No'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Onboarding</p>
                        <p className="font-medium">{selectedSeller.onboardingComplete ? 'Complete' : 'Pending'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Member Since</p>
                        <p className="font-medium">{new Date(selectedSeller.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {selectedSeller.storeDescription && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-gray-500 mb-1">Store Description</p>
                        <p className="text-gray-700">{selectedSeller.storeDescription}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-4 border-t">
                      <a
                        href={`/admin/products?seller=${(selectedSeller as any).sellerId || selectedSeller.id}`}
                        className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                      >
                        View Products
                      </a>
                      <a
                        href={`/admin/orders?seller=${selectedSeller.id}`}
                        className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                      >
                        View Orders
                      </a>
                      <button
                        onClick={() => { setShowDetailModal(false); handleToggleStatus(selectedSeller); }}
                        disabled={actionLoading}
                        className={`px-4 py-2 rounded-lg ${selectedSeller.isActive !== false ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                      >
                        {selectedSeller.isActive !== false ? 'Suspend Seller' : 'Activate Seller'}
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
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
