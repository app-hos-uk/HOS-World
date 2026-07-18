'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { SafeImage } from '@/components/SafeImage';
import { RouteGuard } from '@/components/RouteGuard';
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
  /** Seller profile (Seller table) id – use this for View Products so Product.sellerId filter works */
  sellerId?: string;
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
  newThisMonth: number;
  avgProductsPerSeller: number;
}

/** API / serialization may vary casing — keep counts aligned with badges in the invitations table */
function invitationStatusNormalized(status: string | undefined): string {
  return String(status ?? '')
    .trim()
    .toUpperCase();
}

function isInvitationPending(inv: Invitation): boolean {
  return invitationStatusNormalized(inv.status) === 'PENDING';
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
  const [sellersPage, setSellersPage] = useState(1);
  const [sellersTotal, setSellersTotal] = useState(0);
  const sellersLimit = 50;

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
      const response = await apiClient.getAdminSellers({ page: sellersPage, limit: sellersLimit });

      const raw = response?.data as
        | { data?: unknown[]; pagination?: { total?: number } }
        | unknown[]
        | undefined;
      const payload = raw && !Array.isArray(raw) && 'data' in raw ? raw : null;
      const sellerData = Array.isArray(raw)
        ? raw
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      const pTotal = payload?.pagination?.total;
      if (pTotal != null) {
        setSellersTotal(pTotal);
      }
      
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
      calculateStats(mappedSellers, typeof pTotal === 'number' ? pTotal : undefined);
    } catch (err: any) {
      console.error('Error fetching sellers:', err);
      setError(err.message || 'Failed to load sellers');
      setSellers([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellersPage]);

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

  const calculateStats = (sellerList: Seller[], totalFromServer?: number) => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const totalProducts = sellerList.reduce((sum, s) => sum + (s.totalProducts || 0), 0);
    const totalCount = totalFromServer ?? (sellersTotal > 0 ? sellersTotal : sellerList.length);

    setStats({
      totalSellers: totalCount,
      b2cSellers: sellerList.filter(s => s.role === 'B2C_SELLER').length,
      wholesalers: sellerList.filter(s => s.role === 'WHOLESALER').length,
      activeSellers: sellerList.filter(s => s.isActive !== false).length,
      inactiveSellers: sellerList.filter(s => s.isActive === false).length,
      newThisMonth: sellerList.filter(s => new Date(s.createdAt) >= firstOfMonth).length,
      avgProductsPerSeller: sellerList.length > 0 ? Math.round(totalProducts / sellerList.length) : 0,
    });
  };

  useEffect(() => {
    fetchSellers();
    fetchInvitations();
  }, [fetchSellers, fetchInvitations]);

  /** Always derived from invitations state — never coupled to seller fetch lifecycle (fixes stale card counts) */
  const pendingInvitationsCount = useMemo(
    () => invitations.filter(isInvitationPending).length,
    [invitations],
  );

  // Invitation filters (separate from seller filters)
  const [invStatusFilter, setInvStatusFilter] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED'>('ALL');
  const [invSearchTerm, setInvSearchTerm] = useState('');

  // Filtered invitations
  const filteredInvitations = useMemo(() => {
    let filtered = [...invitations];
    
    // Search filter (uses separate invSearchTerm, not shared with sellers)
    if (invSearchTerm) {
      const term = invSearchTerm.toLowerCase();
      filtered = filtered.filter(inv =>
        inv.email.toLowerCase().includes(term)
      );
    }
    
    // Status filter
    if (invStatusFilter !== 'ALL') {
      filtered = filtered.filter(inv => 
        invitationStatusNormalized(inv.status) === invStatusFilter
      );
    }
    
    return filtered;
  }, [invitations, invSearchTerm, invStatusFilter]);

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
      B2C_SELLER: 'bg-hos-gold/20 text-hos-gold',
      WHOLESALER: 'bg-green-500/15 text-green-300',
      SELLER: 'bg-hos-bg-tertiary text-hos-text-secondary',
    };
    const labels: Record<string, string> = {
      B2C_SELLER: 'B2C',
      WHOLESALER: 'Wholesale',
      SELLER: 'Legacy',
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${styles[role] || 'bg-hos-bg-tertiary text-hos-text-secondary'}`}>
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
    {
      id: 'invitations',
      label: 'Invitations',
      count: invitations.length,
      pendingCount: pendingInvitationsCount,
    },
  ];

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
              <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-hos-text-secondary">Seller Management</h1>
              <p className="text-hos-text-secondary mt-1">Manage marketplace sellers and invitations</p>
            </div>
            <div className="flex gap-2">
              <DataExport data={filteredSellers} columns={exportColumns} filename="sellers-export" />
              <button
                onClick={() => setShowInviteForm(true)}
                className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover"
              >
                + Invite Seller
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <button
                onClick={() => { setTypeFilter('ALL'); setStatusFilter('ALL'); setActiveTab('sellers'); }}
                className={`bg-hos-bg-secondary rounded-lg shadow p-3 text-left hover:shadow-md ${typeFilter === 'ALL' && statusFilter === 'ALL' && activeTab === 'sellers' ? 'ring-2 ring-hos-gold/50' : ''}`}
              >
                <p className="text-xs text-hos-text-muted">Total Sellers</p>
                <p className="text-xl font-bold text-hos-text-secondary">{stats.totalSellers}</p>
              </button>
              <button
                onClick={() => { setTypeFilter('B2C_SELLER'); setStatusFilter('ALL'); setActiveTab('sellers'); }}
                className={`bg-hos-bg-secondary rounded-lg shadow p-3 text-left hover:shadow-md ${typeFilter === 'B2C_SELLER' && statusFilter === 'ALL' ? 'ring-2 ring-hos-gold/50' : ''}`}
              >
                <p className="text-xs text-hos-text-muted">B2C Sellers</p>
                <p className="text-xl font-bold text-hos-gold">{stats.b2cSellers}</p>
              </button>
              <button
                onClick={() => { setTypeFilter('WHOLESALER'); setStatusFilter('ALL'); setActiveTab('sellers'); }}
                className={`bg-hos-bg-secondary rounded-lg shadow p-3 text-left hover:shadow-md ${typeFilter === 'WHOLESALER' && statusFilter === 'ALL' ? 'ring-2 ring-hos-gold/50' : ''}`}
              >
                <p className="text-xs text-hos-text-muted">Wholesalers</p>
                <p className="text-xl font-bold text-green-400">{stats.wholesalers}</p>
              </button>
              <button
                onClick={() => { setTypeFilter('ALL'); setStatusFilter('ACTIVE'); setActiveTab('sellers'); }}
                className={`bg-hos-bg-secondary rounded-lg shadow p-3 text-left hover:shadow-md ${typeFilter === 'ALL' && statusFilter === 'ACTIVE' ? 'ring-2 ring-hos-gold/50' : ''}`}
              >
                <p className="text-xs text-hos-text-muted">Active</p>
                <p className="text-xl font-bold text-green-400">{stats.activeSellers}</p>
              </button>
              <button
                onClick={() => { setTypeFilter('ALL'); setStatusFilter('INACTIVE'); setActiveTab('sellers'); }}
                className={`bg-hos-bg-secondary rounded-lg shadow p-3 text-left hover:shadow-md ${typeFilter === 'ALL' && statusFilter === 'INACTIVE' ? 'ring-2 ring-hos-gold/50' : ''}`}
              >
                <p className="text-xs text-hos-text-muted">Inactive</p>
                <p className="text-xl font-bold text-red-400">{stats.inactiveSellers}</p>
              </button>
              <button
                onClick={() => { setActiveTab('invitations'); setInvStatusFilter('PENDING'); }}
                className={`bg-hos-bg-secondary rounded-lg shadow p-3 text-left hover:shadow-md ${activeTab === 'invitations' && invStatusFilter === 'PENDING' ? 'ring-2 ring-hos-gold/50' : ''}`}
              >
                <p className="text-xs text-hos-text-muted">Pending Invites</p>
                <p className="text-xl font-bold text-yellow-400">{pendingInvitationsCount}</p>
              </button>
              <button
                onClick={() => { setActiveTab('sellers'); setTypeFilter('ALL'); setStatusFilter('ALL'); setSortBy('date'); setSortOrder('desc'); }}
                className="bg-hos-bg-secondary rounded-lg shadow p-3 text-left hover:shadow-md"
              >
                <p className="text-xs text-hos-text-muted">New This Month</p>
                <p className="text-xl font-bold text-hos-gold">{stats.newThisMonth}</p>
              </button>
              <button
                onClick={() => { setActiveTab('sellers'); setTypeFilter('ALL'); setStatusFilter('ALL'); setSortBy('products'); setSortOrder('desc'); }}
                className="bg-hos-bg-secondary rounded-lg shadow p-3 text-left hover:shadow-md"
              >
                <p className="text-xs text-hos-text-muted">Avg Products</p>
                <p className="text-xl font-bold text-hos-text-secondary">{stats.avgProductsPerSeller}</p>
              </button>
            </div>
          )}

          {/* Charts */}
          {sellerTypeData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
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
              <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-hos-bg-secondary rounded-lg">
                    <span className="text-hos-text-secondary">Total Active Sellers</span>
                    <span className="text-xl font-bold text-green-400">{stats?.activeSellers || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-hos-bg-secondary rounded-lg">
                    <span className="text-hos-text-secondary">Pending Invitations</span>
                    <span className="text-xl font-bold text-yellow-400">{pendingInvitationsCount}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-hos-bg-secondary rounded-lg">
                    <span className="text-hos-text-secondary">Accepted This Month</span>
                    <span className="text-xl font-bold text-hos-gold">{stats?.newThisMonth || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-hos-bg-secondary rounded-lg">
                    <span className="text-hos-text-secondary">Expired Invitations</span>
                    <span className="text-xl font-bold text-red-400">
                      {invitations.filter((i) => invitationStatusNormalized(i.status) === 'EXPIRED').length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-300">Error: {error}</p>
              <button onClick={fetchSellers} className="mt-2 text-red-400 hover:text-red-300 text-sm">Retry</button>
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-hos-border">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab: { id: string; label: string; count: number; pendingCount?: number }) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-hos-gold text-hos-gold'
                      : 'border-transparent text-hos-text-muted hover:text-hos-text-secondary hover:border-hos-border'
                  }`}
                >
                  {tab.id === 'invitations'
                    ? `${tab.label} (${tab.count}${tab.pendingCount != null ? ` · ${tab.pendingCount} pending` : ''})`
                    : `${tab.label} (${tab.count})`}
                </button>
              ))}
            </nav>
          </div>

          {/* Sellers Tab */}
          {activeTab === 'sellers' && (
            <>
              {/* Filters */}
              <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Search</label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Store name, email..."
                      className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Type</label>
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                    >
                      <option value="ALL">All Types</option>
                      <option value="B2C_SELLER">B2C Seller</option>
                      <option value="WHOLESALER">Wholesaler</option>
                      <option value="SELLER">Legacy Seller</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                    >
                      <option value="ALL">All Status</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="VERIFIED">Email Verified</option>
                      <option value="ONBOARDING">Onboarding Pending</option>
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
                      className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
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
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
                </div>
              ) : (
                <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-hos-border">
                      <thead className="bg-hos-bg-secondary">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Seller</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Products</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Orders</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Revenue</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Joined</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-hos-text-muted uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                        {filteredSellers.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-8 text-center text-hos-text-muted">
                              No sellers found
                            </td>
                          </tr>
                        ) : (
                          filteredSellers.map((seller) => (
                            <tr key={seller.id} className="hover:bg-hos-bg-tertiary">
                              <td className="px-4 py-3">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10">
                                    {seller.avatar ? (
                                      <SafeImage width={40} height={40} className="h-10 w-10 rounded-full object-cover" src={seller.avatar} alt="" fallback="🏪" />
                                    ) : (
                                      <div className="h-10 w-10 rounded-full bg-hos-gold/20 flex items-center justify-center">
                                        <span className="text-hos-gold font-medium text-sm">
                                          {seller.storeName?.[0] || seller.email[0].toUpperCase()}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="ml-3">
                                    <p className="text-sm font-medium text-hos-text-secondary">{seller.storeName || seller.email || 'No Store Name'}</p>
                                    <p className="text-xs text-hos-text-muted">{seller.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">{getRoleBadge(seller.role)}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-1">
                                  <span className={`px-2 py-0.5 text-xs rounded-full w-fit ${seller.isActive !== false ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'}`}>
                                    {seller.isActive !== false ? 'Active' : 'Inactive'}
                                  </span>
                                  {seller.emailVerified && (
                                    <span className="text-xs text-hos-gold">✓ Verified</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-hos-text-secondary">{seller.totalProducts || 0}</td>
                              <td className="px-4 py-3 text-sm text-hos-text-secondary">{seller.totalOrders || 0}</td>
                              <td className="px-4 py-3 text-sm font-medium text-hos-text-secondary">
                                {formatPrice(seller.totalRevenue || 0)}
                              </td>
                              <td className="px-4 py-3 text-sm text-hos-text-muted">
                                {new Date(seller.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-1">
                                  <button
                                    onClick={() => handleViewDetails(seller)}
                                    className="px-2 py-1 text-sm text-hos-gold hover:bg-hos-gold/10 rounded"
                                  >
                                    View
                                  </button>
                                  <button
                                    onClick={() => handleToggleStatus(seller)}
                                    disabled={actionLoading}
                                    className={`px-2 py-1 text-sm rounded ${seller.isActive !== false ? 'text-yellow-400 hover:bg-yellow-500/10' : 'text-green-400 hover:bg-green-500/10'}`}
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
                  {sellersTotal > sellersLimit && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-hos-border bg-hos-bg-secondary">
                      <button
                        type="button"
                        disabled={sellersPage <= 1 || loading}
                        onClick={() => setSellersPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 text-sm rounded-lg border border-hos-border bg-hos-bg-secondary text-hos-text-secondary disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-hos-text-secondary">
                        Page {sellersPage} of {Math.max(1, Math.ceil(sellersTotal / sellersLimit))}
                        {' · '}
                        {sellersTotal} total
                      </span>
                      <button
                        type="button"
                        disabled={loading || sellersPage * sellersLimit >= sellersTotal}
                        onClick={() => setSellersPage((p) => p + 1)}
                        className="px-3 py-1.5 text-sm rounded-lg border border-hos-border bg-hos-bg-secondary text-hos-text-secondary disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Invitations Tab */}
          {activeTab === 'invitations' && (
            <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Seller invitations</h2>
                    <p className="text-xs text-hos-text-muted mt-0.5">
                      {filteredInvitations.length} showing{invStatusFilter !== 'ALL' ? ` (${invStatusFilter.toLowerCase()})` : ''} · {pendingInvitationsCount} pending · {invitations.length} total
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={invSearchTerm}
                      onChange={(e) => setInvSearchTerm(e.target.value)}
                      placeholder="Search by email..."
                      className="px-3 py-1.5 text-sm border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted w-48"
                    />
                    <select
                      value={invStatusFilter}
                      onChange={(e) => setInvStatusFilter(e.target.value as any)}
                      className="px-3 py-1.5 text-sm border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="PENDING">Pending</option>
                      <option value="ACCEPTED">Accepted</option>
                      <option value="EXPIRED">Expired</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                    <button
                      onClick={() => { setInvStatusFilter('ALL'); setInvSearchTerm(''); }}
                      className="px-3 py-1.5 text-sm text-hos-text-muted hover:text-hos-text-secondary"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-hos-border">
                  <thead className="bg-hos-bg-secondary">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Sent</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Expires</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-hos-text-muted uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                    {filteredInvitations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-hos-text-muted">
                          No invitations found{invStatusFilter !== 'ALL' ? ` with status "${invStatusFilter}"` : ''}
                        </td>
                      </tr>
                    ) : (
                      filteredInvitations.map((inv) => (
                        <tr key={inv.id} className="hover:bg-hos-bg-tertiary">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-hos-text-secondary">{inv.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{getRoleBadge(inv.sellerType)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              invitationStatusNormalized(inv.status) === 'PENDING'
                                ? 'bg-yellow-500/15 text-yellow-300'
                                : invitationStatusNormalized(inv.status) === 'ACCEPTED'
                                  ? 'bg-green-500/15 text-green-300'
                                  : invitationStatusNormalized(inv.status) === 'EXPIRED'
                                    ? 'bg-red-500/15 text-red-300'
                                    : invitationStatusNormalized(inv.status) === 'CANCELLED'
                                      ? 'bg-hos-bg-tertiary text-hos-text-secondary'
                                      : 'bg-hos-bg-tertiary text-hos-text-secondary'
                            }`}>
                              {invitationStatusNormalized(inv.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                            {new Date(inv.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                            {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            {isInvitationPending(inv) && (
                              <>
                                <button
                                  onClick={() => handleResendInvitation(inv.id)}
                                  className="text-hos-gold hover:text-hos-gold mr-3"
                                >
                                  Resend
                                </button>
                                <button
                                  onClick={() => handleCancelInvitation(inv.id)}
                                  className="text-red-400 hover:text-red-300"
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
              <div className="bg-hos-bg-secondary rounded-lg max-w-md w-full">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <h2 className="text-xl font-bold">Invite New Seller</h2>
                    <button onClick={() => setShowInviteForm(false)} className="text-hos-text-muted hover:text-hos-text-secondary text-2xl">×</button>
                  </div>
                  <form onSubmit={handleInviteSeller} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Email Address *</label>
                      <input
                        type="email"
                        required
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                        placeholder="seller@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Seller Type *</label>
                      <select
                        value={inviteForm.sellerType}
                        onChange={(e) => setInviteForm({ ...inviteForm, sellerType: e.target.value as any })}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                      >
                        <option value="B2C_SELLER">B2C Seller</option>
                        <option value="WHOLESALER">Wholesaler</option>
                      </select>
                      <p className="text-xs text-hos-text-muted mt-1">
                        {inviteForm.sellerType === 'B2C_SELLER' 
                          ? 'Sells directly to consumers with standard pricing' 
                          : 'Wholesale seller with bulk pricing options'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Welcome Message</label>
                      <textarea
                        value={inviteForm.message}
                        onChange={(e) => setInviteForm({ ...inviteForm, message: e.target.value })}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                        rows={3}
                        placeholder="Optional personalized message..."
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="flex-1 px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50"
                      >
                        {actionLoading ? 'Sending...' : 'Send Invitation'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowInviteForm(false)}
                        className="px-4 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary"
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
              <div className="bg-hos-bg-secondary rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-bold">Seller Details</h2>
                    <button onClick={() => setShowDetailModal(false)} className="text-hos-text-muted hover:text-hos-text-secondary text-2xl">×</button>
                  </div>

                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-4">
                      {selectedSeller.avatar ? (
                        <SafeImage width={80} height={80} className="rounded-full object-cover" src={selectedSeller.avatar} alt="" fallback="🏪" />
                      ) : (
                        <div className="h-20 w-20 rounded-full bg-hos-gold/20 flex items-center justify-center">
                          <span className="text-hos-gold font-bold text-3xl">
                            {selectedSeller.storeName?.[0] || selectedSeller.email[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <h3 className="text-xl font-semibold">{selectedSeller.storeName || selectedSeller.email || 'No Store Name'}</h3>
                        <p className="text-hos-text-muted">{selectedSeller.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {getRoleBadge(selectedSeller.role)}
                          <span className={`px-2 py-0.5 text-xs rounded-full ${selectedSeller.isActive !== false ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'}`}>
                            {selectedSeller.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Seller profile ID — required for Finance → Schedule Payout */}
                    {selectedSeller.sellerId && (
                      <div className="rounded-lg border border-hos-border-accent bg-hos-gold/10/80 p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-hos-text-secondary">Seller ID (payouts &amp; finance)</p>
                            <p className="text-xs text-hos-text-secondary mt-0.5">
                              Use this UUID in Finance → Process Payouts → Schedule Payout.
                            </p>
                            <p className="mt-2 font-mono text-xs text-hos-text-secondary break-all select-all">
                              {selectedSeller.sellerId}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(selectedSeller.sellerId!);
                                toast.success('Seller ID copied');
                              } catch {
                                toast.error('Could not copy to clipboard');
                              }
                            }}
                            className="shrink-0 px-3 py-1.5 text-sm font-medium text-hos-gold-hover bg-hos-bg-secondary border border-hos-border-accent rounded-lg hover:bg-hos-gold/10"
                          >
                            Copy ID
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-hos-bg-secondary rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-hos-gold">{selectedSeller.totalProducts || 0}</p>
                        <p className="text-sm text-hos-text-muted">Products</p>
                      </div>
                      <div className="bg-hos-bg-secondary rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-hos-gold">{selectedSeller.totalOrders || 0}</p>
                        <p className="text-sm text-hos-text-muted">Orders</p>
                      </div>
                      <div className="bg-hos-bg-secondary rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-green-400">{formatPrice(selectedSeller.totalRevenue || 0)}</p>
                        <p className="text-sm text-hos-text-muted">Revenue</p>
                      </div>
                      <div className="bg-hos-bg-secondary rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-yellow-400">{selectedSeller.rating?.toFixed(1) || 'N/A'}</p>
                        <p className="text-sm text-hos-text-muted">Rating</p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-sm text-hos-text-muted">Owner Name</p>
                        <p className="font-medium">
                          {selectedSeller.firstName && selectedSeller.lastName 
                            ? `${selectedSeller.firstName} ${selectedSeller.lastName}` 
                            : 'Not set'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-hos-text-muted">Phone</p>
                        <p className="font-medium">{selectedSeller.phone || 'Not set'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-hos-text-muted">Email Verified</p>
                        <p className="font-medium">{selectedSeller.emailVerified ? 'Yes' : 'No'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-hos-text-muted">Onboarding</p>
                        <p className="font-medium">{selectedSeller.onboardingComplete ? 'Complete' : 'Pending'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-hos-text-muted">Member Since</p>
                        <p className="font-medium">{new Date(selectedSeller.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {selectedSeller.storeDescription && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-hos-text-muted mb-1">Store Description</p>
                        <p className="text-hos-text-secondary">{selectedSeller.storeDescription}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-4 border-t">
                      <a
                        href={`/admin/products?seller=${selectedSeller.sellerId ?? selectedSeller.id}`}
                        className="px-4 py-2 bg-hos-gold/20 text-hos-gold-hover rounded-lg hover:bg-hos-gold/20"
                      >
                        View Products
                      </a>
                      <a
                        href={`/admin/orders?sellerId=${selectedSeller.sellerId ?? selectedSeller.id}`}
                        className="px-4 py-2 bg-hos-gold/20 text-hos-gold rounded-lg hover:bg-hos-gold/20"
                      >
                        View Orders
                      </a>
                      <button
                        onClick={() => { setShowDetailModal(false); handleToggleStatus(selectedSeller); }}
                        disabled={actionLoading}
                        className={`px-4 py-2 rounded-lg ${selectedSeller.isActive !== false ? 'bg-yellow-500/15 text-yellow-400 hover:bg-yellow-200' : 'bg-green-500/15 text-green-400 hover:bg-green-200'}`}
                      >
                        {selectedSeller.isActive !== false ? 'Suspend Seller' : 'Activate Seller'}
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
        </div>
          </RouteGuard>
  );
}
