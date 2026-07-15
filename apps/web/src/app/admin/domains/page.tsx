'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { DataExport } from '@/components/DataExport';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts';

interface Seller {
  id: string;
  storeName: string;
  slug: string;
  sellerType: string;
  customDomain?: string;
  subDomain?: string;
  domainPackagePurchased: boolean;
  dnsVerified?: boolean;
  sslStatus?: 'VALID' | 'PENDING' | 'EXPIRED' | 'NONE';
  domainUpdatedAt?: string;
  user: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
  createdAt?: string;
}

interface Stats {
  total: number;
  withSubdomain: number;
  withCustomDomain: number;
  noDomain: number;
  pendingVerification: number;
  sslValid: number;
  packagesPurchased: number;
}

interface DomainHistory {
  id: string;
  sellerId: string;
  action: string;
  domain: string;
  domainType: 'subdomain' | 'custom';
  timestamp: string;
  performedBy?: string;
}

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export default function AdminDomainsPage() {
  const toast = useToast();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  
  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUBDOMAIN' | 'CUSTOM' | 'NONE' | 'PENDING'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'domain'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Modals
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [showSubDomainModal, setShowSubDomainModal] = useState(false);
  const [showCustomDomainModal, setShowCustomDomainModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDNSGuideModal, setShowDNSGuideModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Bulk selection
  const [selectedSellers, setSelectedSellers] = useState<Set<string>>(new Set());
  
  // History (mock - would be fetched from API)
  const [domainHistory, setDomainHistory] = useState<DomainHistory[]>([]);

  // Form state
  const [subDomainForm, setSubDomainForm] = useState({ subDomain: '' });
  const [customDomainForm, setCustomDomainForm] = useState({
    customDomain: '',
    domainPackagePurchased: false,
  });

  const fetchSellers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAdminSellers();
      if (response?.data) {
        const sellerList = Array.isArray(response.data) ? response.data : [];
        setSellers(sellerList);
        calculateStats(sellerList);
      }
    } catch (err: any) {
      console.error('Error fetching sellers:', err);
      toast.error(err.message || 'Failed to load sellers');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calculateStats = (sellerList: Seller[]) => {
    setStats({
      total: sellerList.length,
      withSubdomain: sellerList.filter(s => s.subDomain).length,
      withCustomDomain: sellerList.filter(s => s.customDomain).length,
      noDomain: sellerList.filter(s => !s.subDomain && !s.customDomain).length,
      pendingVerification: sellerList.filter(s => s.customDomain && !s.dnsVerified).length,
      sslValid: sellerList.filter(s => s.sslStatus === 'VALID').length,
      packagesPurchased: sellerList.filter(s => s.domainPackagePurchased).length,
    });
  };

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  // Filtered and sorted sellers
  const filteredSellers = useMemo(() => {
    let result = [...sellers];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s =>
        s.storeName.toLowerCase().includes(term) ||
        s.user.email.toLowerCase().includes(term) ||
        s.subDomain?.toLowerCase().includes(term) ||
        s.customDomain?.toLowerCase().includes(term)
      );
    }

    // Status filter
    switch (statusFilter) {
      case 'SUBDOMAIN':
        result = result.filter(s => s.subDomain && !s.customDomain);
        break;
      case 'CUSTOM':
        result = result.filter(s => s.customDomain);
        break;
      case 'NONE':
        result = result.filter(s => !s.subDomain && !s.customDomain);
        break;
      case 'PENDING':
        result = result.filter(s => s.customDomain && !s.dnsVerified);
        break;
    }

    // Type filter
    if (typeFilter !== 'ALL') {
      result = result.filter(s => s.sellerType === typeFilter);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.storeName.localeCompare(b.storeName);
          break;
        case 'date':
          comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
        case 'domain':
          const domainA = a.customDomain || a.subDomain || '';
          const domainB = b.customDomain || b.subDomain || '';
          comparison = domainA.localeCompare(domainB);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [sellers, searchTerm, statusFilter, typeFilter, sortBy, sortOrder]);

  // Chart data
  const chartData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'With Custom Domain', value: stats.withCustomDomain, color: '#10b981' },
      { name: 'Subdomain Only', value: stats.withSubdomain - sellers.filter(s => s.subDomain && s.customDomain).length, color: '#3b82f6' },
      { name: 'Pending Verification', value: stats.pendingVerification, color: '#f59e0b' },
      { name: 'No Domain', value: stats.noDomain, color: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [stats, sellers]);

  // Unique seller types
  const sellerTypes = useMemo(() => {
    return [...new Set(sellers.map(s => s.sellerType))].filter(Boolean);
  }, [sellers]);

  const handleGenerateSubDomain = (seller: Seller) => {
    setSelectedSeller(seller);
    const generated = seller.slug
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .substring(0, 50);
    setSubDomainForm({ subDomain: generated });
    setShowSubDomainModal(true);
  };

  const handleAssignSubDomain = async () => {
    if (!selectedSeller || !subDomainForm.subDomain) {
      toast.error('Please enter a subdomain');
      return;
    }

    try {
      setActionLoading(true);
      await toast.promise(
        apiClient.assignSubDomain(selectedSeller.id, { subDomain: subDomainForm.subDomain }),
        {
          loading: 'Assigning subdomain...',
          success: 'Subdomain assigned successfully',
          error: (err) => err.message || 'Failed to assign subdomain',
        }
      );
      setShowSubDomainModal(false);
      setSubDomainForm({ subDomain: '' });
      await fetchSellers();
    } catch (err: any) {
      console.error('Error assigning subdomain:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignCustomDomain = async () => {
    if (!selectedSeller || !customDomainForm.customDomain) {
      toast.error('Please enter a custom domain');
      return;
    }

    try {
      setActionLoading(true);
      await toast.promise(
        apiClient.assignCustomDomain(selectedSeller.id, {
          customDomain: customDomainForm.customDomain,
          domainPackagePurchased: customDomainForm.domainPackagePurchased,
        }),
        {
          loading: 'Assigning custom domain...',
          success: 'Custom domain assigned successfully',
          error: (err) => err.message || 'Failed to assign custom domain',
        }
      );
      setShowCustomDomainModal(false);
      setCustomDomainForm({ customDomain: '', domainPackagePurchased: false });
      await fetchSellers();
    } catch (err: any) {
      console.error('Error assigning custom domain:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveDomain = async (seller: Seller, type: 'subdomain' | 'custom') => {
    if (!confirm(`Are you sure you want to remove the ${type} for ${seller.storeName}?`)) {
      return;
    }

    try {
      await toast.promise(
        type === 'subdomain'
          ? apiClient.removeSubDomain(seller.id)
          : apiClient.removeCustomDomain(seller.id),
        {
          loading: `Removing ${type}...`,
          success: `${type === 'subdomain' ? 'Subdomain' : 'Custom domain'} removed successfully`,
          error: (err) => err.message || `Failed to remove ${type}`,
        }
      );
      await fetchSellers();
    } catch (err: any) {
      console.error(`Error removing ${type}:`, err);
    }
  };

  const handleVerifyDNS = async (seller: Seller) => {
    try {
      setActionLoading(true);
      await toast.promise(
        apiClient.getDNSConfiguration(seller.id),
        {
          loading: 'Checking DNS configuration...',
          success: 'DNS configuration retrieved',
          error: (err: any) => err.message || 'Failed to check DNS',
        }
      );
      await fetchSellers();
    } catch (err: any) {
      console.error('Error verifying DNS:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkGenerateSubdomains = async () => {
    const sellersWithoutDomain = filteredSellers.filter(s => !s.subDomain && selectedSellers.has(s.id));
    if (sellersWithoutDomain.length === 0) {
      toast.error('No eligible sellers selected');
      return;
    }

    try {
      setActionLoading(true);
      for (const seller of sellersWithoutDomain) {
        const subdomain = seller.slug.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50);
        await apiClient.assignSubDomain(seller.id, { subDomain: subdomain });
      }
      toast.success(`Generated subdomains for ${sellersWithoutDomain.length} sellers`);
      setSelectedSellers(new Set());
      await fetchSellers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate subdomains');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewDetails = (seller: Seller) => {
    setSelectedSeller(seller);
    setShowDetailModal(true);
  };

  const handleViewDNSGuide = (seller: Seller) => {
    setSelectedSeller(seller);
    setShowDNSGuideModal(true);
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedSellers);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedSellers(newSelection);
  };

  const selectAll = () => {
    if (selectedSellers.size === filteredSellers.length) {
      setSelectedSellers(new Set());
    } else {
      setSelectedSellers(new Set(filteredSellers.map(s => s.id)));
    }
  };

  const getSSLBadge = (status?: string) => {
    switch (status) {
      case 'VALID':
        return <span className="px-2 py-0.5 text-xs rounded bg-green-500/15 text-green-300">✓ SSL Valid</span>;
      case 'PENDING':
        return <span className="px-2 py-0.5 text-xs rounded bg-yellow-500/15 text-yellow-300">⏳ SSL Pending</span>;
      case 'EXPIRED':
        return <span className="px-2 py-0.5 text-xs rounded bg-red-500/15 text-red-300">✗ SSL Expired</span>;
      default:
        return null;
    }
  };

  const getDNSBadge = (verified?: boolean, hasCustomDomain?: boolean) => {
    if (!hasCustomDomain) return null;
    if (verified) {
      return <span className="px-2 py-0.5 text-xs rounded bg-green-500/15 text-green-300">✓ DNS Verified</span>;
    }
    return <span className="px-2 py-0.5 text-xs rounded bg-yellow-500/15 text-yellow-300">⏳ DNS Pending</span>;
  };

  const exportColumns = [
    { key: 'storeName', header: 'Store Name' },
    { key: 'user', header: 'Email', format: (v: any) => v?.email || '' },
    { key: 'sellerType', header: 'Type' },
    { key: 'subDomain', header: 'Subdomain', format: (v: string) => v ? `${v}.houseofspells.com` : '' },
    { key: 'customDomain', header: 'Custom Domain' },
    { key: 'dnsVerified', header: 'DNS Status', format: (v: boolean) => v ? 'Verified' : 'Pending' },
    { key: 'sslStatus', header: 'SSL Status' },
    { key: 'domainPackagePurchased', header: 'Package', format: (v: boolean) => v ? 'Purchased' : 'No' },
  ];

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
              <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-hos-text-secondary">Domain Management</h1>
              <p className="text-hos-text-secondary mt-1">Manage subdomains and custom domains for all sellers</p>
            </div>
            <DataExport data={filteredSellers} columns={exportColumns} filename="domains-export" />
          </div>

          {/* Stats Dashboard */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left hover:shadow-md transition-shadow ${statusFilter === 'ALL' ? 'ring-2 ring-hos-gold/50' : ''}`}
              >
                <p className="text-sm text-hos-text-muted">Total Sellers</p>
                <p className="text-2xl font-bold text-hos-text-secondary">{stats.total}</p>
              </button>
              <button
                onClick={() => setStatusFilter('SUBDOMAIN')}
                className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left hover:shadow-md transition-shadow ${statusFilter === 'SUBDOMAIN' ? 'ring-2 ring-hos-gold/50' : ''}`}
              >
                <p className="text-sm text-hos-text-muted">With Subdomain</p>
                <p className="text-2xl font-bold text-hos-gold">{stats.withSubdomain}</p>
              </button>
              <button
                onClick={() => setStatusFilter('CUSTOM')}
                className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left hover:shadow-md transition-shadow ${statusFilter === 'CUSTOM' ? 'ring-2 ring-hos-gold/50' : ''}`}
              >
                <p className="text-sm text-hos-text-muted">Custom Domain</p>
                <p className="text-2xl font-bold text-green-400">{stats.withCustomDomain}</p>
              </button>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left hover:shadow-md transition-shadow ${statusFilter === 'PENDING' ? 'ring-2 ring-hos-gold/50' : ''}`}
              >
                <p className="text-sm text-hos-text-muted">Pending DNS</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.pendingVerification}</p>
              </button>
              <button
                onClick={() => setStatusFilter('NONE')}
                className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left hover:shadow-md transition-shadow ${statusFilter === 'NONE' ? 'ring-2 ring-hos-gold/50' : ''}`}
              >
                <p className="text-sm text-hos-text-muted">No Domain</p>
                <p className="text-2xl font-bold text-red-400">{stats.noDomain}</p>
              </button>
              <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
                <p className="text-sm text-hos-text-muted">SSL Valid</p>
                <p className="text-2xl font-bold text-emerald-400">{stats.sslValid}</p>
              </div>
              <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
                <p className="text-sm text-hos-text-muted">Packages</p>
                <p className="text-2xl font-bold text-hos-gold">{stats.packagesPurchased}</p>
              </div>
            </div>
          )}

          {/* Chart */}
          {stats && chartData.length > 0 && (
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Domain Distribution</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Search & Filters */}
          <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Store name, email, domain..."
                  className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Seller Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                >
                  <option value="ALL">All Types</option>
                  {sellerTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
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
                  <option value="name-asc">Name A-Z</option>
                  <option value="name-desc">Name Z-A</option>
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="domain-asc">Domain A-Z</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Bulk Actions</label>
                <button
                  onClick={handleBulkGenerateSubdomains}
                  disabled={selectedSellers.size === 0 || actionLoading}
                  className="w-full h-[42px] px-4 py-2 text-sm bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50"
                >
                  Generate Subdomains ({selectedSellers.size})
                </button>
              </div>
            </div>
            {selectedSellers.size > 0 && (
              <div className="mt-3 flex items-center gap-4">
                <span className="text-sm text-hos-text-secondary">{selectedSellers.size} selected</span>
                <button onClick={() => setSelectedSellers(new Set())} className="text-sm text-hos-gold hover:underline">
                  Clear selection
                </button>
                <button onClick={selectAll} className="text-sm text-hos-gold hover:underline">
                  {selectedSellers.size === filteredSellers.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredSellers.length === 0 && (
            <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-8 text-center">
              <div className="text-5xl mb-4">🌐</div>
              <p className="text-hos-text-muted text-lg">No sellers found</p>
            </div>
          )}

          {/* Sellers Table */}
          {!loading && filteredSellers.length > 0 && (
            <div className="bg-hos-bg-secondary border border-hos-border rounded-lg overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold">Sellers ({filteredSellers.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-hos-border">
                  <thead className="bg-hos-bg-secondary">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">
                        <input
                          type="checkbox"
                          checked={selectedSellers.size === filteredSellers.length && filteredSellers.length > 0}
                          onChange={selectAll}
                          className="h-4 w-4 text-hos-gold rounded border-hos-border"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Seller</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Subdomain</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Custom Domain</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-hos-text-muted uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                    {filteredSellers.map((seller) => (
                      <tr key={seller.id} className={`hover:bg-hos-bg-tertiary ${selectedSellers.has(seller.id) ? 'bg-hos-gold/10' : ''}`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedSellers.has(seller.id)}
                            onChange={() => toggleSelection(seller.id)}
                            className="h-4 w-4 text-hos-gold rounded border-hos-border"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-hos-text-secondary">{seller.storeName}</p>
                            <p className="text-sm text-hos-text-muted">{seller.user.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 text-xs font-medium bg-hos-gold/20 text-hos-gold rounded">
                            {seller.sellerType}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {seller.subDomain ? (
                            <div>
                              <a
                                href={`/sellers/${seller.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-hos-gold hover:text-hos-gold hover:underline"
                              >
                                {seller.subDomain}.houseofspells.com
                              </a>
                              <div className="flex gap-2 mt-1">
                                <a
                                  href={`/sellers/${seller.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-hos-gold hover:text-hos-gold"
                                >
                                  Visit Store
                                </a>
                                <button
                                  onClick={() => {
                                    setSelectedSeller(seller);
                                    setSubDomainForm({ subDomain: seller.subDomain || '' });
                                    setShowSubDomainModal(true);
                                  }}
                                  className="text-xs text-hos-gold hover:text-hos-gold-hover"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleRemoveDomain(seller, 'subdomain')}
                                  className="text-xs text-red-400 hover:text-red-300"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleGenerateSubDomain(seller)}
                              className="text-sm text-hos-gold hover:text-hos-gold-hover"
                            >
                              + Generate
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {seller.customDomain ? (
                            <div>
                              <p className="text-sm font-medium text-hos-text-secondary">{seller.customDomain}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {seller.domainPackagePurchased && (
                                  <span className="text-xs text-green-400">✓ Package</span>
                                )}
                                <button
                                  onClick={() => {
                                    setSelectedSeller(seller);
                                    setCustomDomainForm({
                                      customDomain: seller.customDomain || '',
                                      domainPackagePurchased: seller.domainPackagePurchased,
                                    });
                                    setShowCustomDomainModal(true);
                                  }}
                                  className="text-xs text-hos-gold hover:text-hos-gold-hover"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleRemoveDomain(seller, 'custom')}
                                  className="text-xs text-red-400 hover:text-red-300"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedSeller(seller);
                                setCustomDomainForm({ customDomain: '', domainPackagePurchased: false });
                                setShowCustomDomainModal(true);
                              }}
                              className="text-sm text-hos-gold hover:text-hos-gold-hover"
                            >
                              + Configure
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {getDNSBadge(seller.dnsVerified, !!seller.customDomain)}
                            {getSSLBadge(seller.sslStatus)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handleViewDetails(seller)}
                              className="px-2 py-1 text-sm text-hos-text-secondary hover:bg-hos-bg-tertiary rounded"
                            >
                              Details
                            </button>
                            {seller.customDomain && (
                              <>
                                <button
                                  onClick={() => handleViewDNSGuide(seller)}
                                  className="px-2 py-1 text-sm text-hos-gold hover:bg-hos-gold/10 rounded"
                                >
                                  DNS Guide
                                </button>
                                <button
                                  onClick={() => handleVerifyDNS(seller)}
                                  disabled={actionLoading}
                                  className="px-2 py-1 text-sm text-green-400 hover:bg-green-500/10 rounded disabled:opacity-50"
                                >
                                  Verify
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

          {/* Subdomain Modal */}
          {showSubDomainModal && selectedSeller && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-hos-bg-secondary rounded-lg max-w-md w-full">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-bold">Configure Subdomain</h2>
                    <button onClick={() => setShowSubDomainModal(false)} className="text-hos-text-muted hover:text-hos-text-secondary text-2xl">×</button>
                  </div>

                  <p className="text-sm text-hos-text-secondary mb-4">
                    Store: <span className="font-medium">{selectedSeller.storeName}</span>
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Subdomain</label>
                      <div className="flex items-center">
                        <input
                          type="text"
                          value={subDomainForm.subDomain}
                          onChange={(e) => setSubDomainForm({ subDomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                          placeholder="store-name"
                          className="flex-1 px-4 py-2 border border-hos-border rounded-l-lg focus:ring-2 focus:ring-hos-gold/50"
                        />
                        <span className="px-4 py-2 bg-hos-bg-tertiary border border-l-0 border-hos-border rounded-r-lg text-hos-text-secondary text-sm">
                          .houseofspells.com
                        </span>
                      </div>
                      <p className="text-xs text-hos-text-muted mt-1">Only lowercase letters, numbers, and hyphens allowed</p>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleAssignSubDomain}
                        disabled={actionLoading || !subDomainForm.subDomain}
                        className="flex-1 px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50"
                      >
                        {actionLoading ? 'Saving...' : 'Save Subdomain'}
                      </button>
                      <button
                        onClick={() => setShowSubDomainModal(false)}
                        className="px-4 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Custom Domain Modal */}
          {showCustomDomainModal && selectedSeller && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-hos-bg-secondary rounded-lg max-w-md w-full">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-bold">Configure Custom Domain</h2>
                    <button onClick={() => setShowCustomDomainModal(false)} className="text-hos-text-muted hover:text-hos-text-secondary text-2xl">×</button>
                  </div>

                  <p className="text-sm text-hos-text-secondary mb-4">
                    Store: <span className="font-medium">{selectedSeller.storeName}</span>
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Custom Domain</label>
                      <input
                        type="text"
                        value={customDomainForm.customDomain}
                        onChange={(e) => setCustomDomainForm({ ...customDomainForm, customDomain: e.target.value })}
                        placeholder="example.com"
                        className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                      />
                      <p className="text-xs text-hos-text-muted mt-1">Enter the full domain name (e.g., mystore.com)</p>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="packagePurchased"
                        checked={customDomainForm.domainPackagePurchased}
                        onChange={(e) => setCustomDomainForm({ ...customDomainForm, domainPackagePurchased: e.target.checked })}
                        className="h-4 w-4 text-hos-gold rounded border-hos-border"
                      />
                      <label htmlFor="packagePurchased" className="ml-2 text-sm text-hos-text-secondary">Domain package purchased</label>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleAssignCustomDomain}
                        disabled={actionLoading || !customDomainForm.customDomain}
                        className="flex-1 px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50"
                      >
                        {actionLoading ? 'Saving...' : 'Save Domain'}
                      </button>
                      <button
                        onClick={() => setShowCustomDomainModal(false)}
                        className="px-4 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Detail Modal */}
          {showDetailModal && selectedSeller && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-hos-bg-secondary rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-bold">Domain Details</h2>
                    <button onClick={() => setShowDetailModal(false)} className="text-hos-text-muted hover:text-hos-text-secondary text-2xl">×</button>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-hos-bg-secondary p-4 rounded-lg">
                      <h3 className="font-semibold mb-2">Store Information</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-hos-text-muted">Store Name</p>
                          <p className="font-medium">{selectedSeller.storeName}</p>
                        </div>
                        <div>
                          <p className="text-hos-text-muted">Email</p>
                          <p className="font-medium">{selectedSeller.user.email}</p>
                        </div>
                        <div>
                          <p className="text-hos-text-muted">Type</p>
                          <p className="font-medium">{selectedSeller.sellerType}</p>
                        </div>
                        <div>
                          <p className="text-hos-text-muted">Slug</p>
                          <p className="font-medium">{selectedSeller.slug}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-hos-gold/10 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2">Subdomain</h3>
                      {selectedSeller.subDomain ? (
                        <div>
                          <p className="font-mono text-hos-gold">{selectedSeller.subDomain}.houseofspells.com</p>
                          <div className="flex flex-col gap-1 mt-2">
                            <a
                              href={`/sellers/${selectedSeller.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-hos-gold hover:underline inline-block"
                            >
                              Visit Store Page →
                            </a>
                            <p className="text-xs text-hos-text-muted">
                              Subdomain URL: {selectedSeller.subDomain}.houseofspells.com (requires wildcard DNS)
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-hos-text-muted">No subdomain configured</p>
                      )}
                    </div>

                    <div className="bg-green-500/10 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2">Custom Domain</h3>
                      {selectedSeller.customDomain ? (
                        <div>
                          <p className="font-mono text-green-300">{selectedSeller.customDomain}</p>
                          <div className="flex items-center gap-2 mt-2">
                            {getDNSBadge(selectedSeller.dnsVerified, true)}
                            {getSSLBadge(selectedSeller.sslStatus)}
                            {selectedSeller.domainPackagePurchased && (
                              <span className="px-2 py-0.5 text-xs rounded bg-hos-gold/20 text-hos-gold">Package Purchased</span>
                            )}
                          </div>
                          <a
                            href={`https://${selectedSeller.customDomain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-green-400 hover:underline mt-2 inline-block"
                          >
                            Open in new tab →
                          </a>
                        </div>
                      ) : (
                        <p className="text-hos-text-muted">No custom domain configured</p>
                      )}
                    </div>

                    {selectedSeller.domainUpdatedAt && (
                      <p className="text-sm text-hos-text-muted">
                        Last updated: {new Date(selectedSeller.domainUpdatedAt).toLocaleString()}
                      </p>
                    )}

                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="w-full px-4 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DNS Guide Modal */}
          {showDNSGuideModal && selectedSeller && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-hos-bg-secondary rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-bold">DNS Configuration Guide</h2>
                    <button onClick={() => setShowDNSGuideModal(false)} className="text-hos-text-muted hover:text-hos-text-secondary text-2xl">×</button>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                      <p className="text-sm text-yellow-300">
                        <strong>Important:</strong> DNS changes may take up to 48 hours to propagate globally.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Domain: {selectedSeller.customDomain}</h3>
                      <p className="text-sm text-hos-text-secondary mb-4">
                        Add the following DNS records to your domain provider:
                      </p>
                    </div>

                    <div className="bg-hos-bg-secondary rounded-lg p-4 space-y-4">
                      <div>
                        <h4 className="font-medium text-sm text-hos-text-secondary mb-2">Option 1: CNAME Record (Recommended)</h4>
                        <div className="bg-hos-bg-secondary border rounded p-3 font-mono text-sm">
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-hos-text-muted text-xs">Type</p>
                              <p>CNAME</p>
                            </div>
                            <div>
                              <p className="text-hos-text-muted text-xs">Name/Host</p>
                              <p>@ or www</p>
                            </div>
                            <div>
                              <p className="text-hos-text-muted text-xs">Value/Points to</p>
                              <p>proxy.houseofspells.com</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium text-sm text-hos-text-secondary mb-2">Option 2: A Records</h4>
                        <div className="bg-hos-bg-secondary border rounded p-3 font-mono text-sm">
                          <div className="grid grid-cols-3 gap-4 mb-2">
                            <div>
                              <p className="text-hos-text-muted text-xs">Type</p>
                              <p>A</p>
                            </div>
                            <div>
                              <p className="text-hos-text-muted text-xs">Name/Host</p>
                              <p>@</p>
                            </div>
                            <div>
                              <p className="text-hos-text-muted text-xs">Value/IP</p>
                              <p>76.76.21.21</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => { setShowDNSGuideModal(false); handleVerifyDNS(selectedSeller); }}
                        disabled={actionLoading}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        Verify DNS Now
                      </button>
                      <button
                        onClick={() => setShowDNSGuideModal(false)}
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
