'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { AdminLayout } from '@/components/AdminLayout';
import { RouteGuard } from '@/components/RouteGuard';

// Influencer/campaign methods exist at runtime; cast for type-check until api-client types are regenerated
const api = apiClient as any;

interface Campaign {
  id: string;
  name: string;
  description?: string;
  influencerId: string;
  influencer: {
    displayName: string;
    referralCode: string;
  };
  startDate: string;
  endDate: string;
  overrideCommissionRate?: number;
  totalClicks: number;
  totalConversions: number;
  totalSales: number;
  status: string;
  createdAt: string;
}

interface Influencer {
  id: string;
  displayName: string;
  referralCode: string;
}

export default function AdminInfluencerCampaignsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [form, setForm] = useState({
    influencerId: '',
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    overrideCommissionRate: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [campaignsRes, influencersRes] = await Promise.all([
        api.getAdminCampaigns({ status: statusFilter || undefined, limit: 100 }),
        api.getInfluencers({ status: 'ACTIVE', limit: 100 }),
      ]);
      setCampaigns(campaignsRes?.data || []);
      setInfluencers(influencersRes?.data || []);
    } catch (err: any) {
      console.error('Error fetching campaigns:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.influencerId || !form.name || !form.startDate || !form.endDate) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setCreating(true);
      await api.createCampaign({
        influencerId: form.influencerId,
        name: form.name,
        description: form.description || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        overrideCommissionRate: form.overrideCommissionRate
          ? parseFloat(form.overrideCommissionRate) / 100
          : undefined,
      });
      toast.success('Campaign created successfully');
      setShowCreateModal(false);
      setForm({ influencerId: '', name: '', description: '', startDate: '', endDate: '', overrideCommissionRate: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await api.updateCampaign(id, { status });
      toast.success('Campaign status updated');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update campaign');
    }
  };

  const openAnalytics = async (campaignId: string) => {
    setAnalyticsOpen(true);
    setAnalyticsLoading(true);
    setAnalyticsData(null);
    try {
      const res = await apiClient.getCampaignAnalytics(campaignId);
      setAnalyticsData(res?.data ?? null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load campaign analytics');
      setAnalyticsOpen(false);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const closeAnalytics = () => {
    setAnalyticsOpen(false);
    setAnalyticsData(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;

    try {
      await api.deleteCampaign(id);
      toast.success('Campaign deleted');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete campaign');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-hos-bg-tertiary text-white',
      ACTIVE: 'bg-green-500/15 text-green-300',
      PAUSED: 'bg-yellow-500/15 text-yellow-300',
      COMPLETED: 'bg-hos-gold/20 text-hos-gold',
    };
    return styles[status] || 'bg-hos-bg-tertiary text-white';
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Influencer Campaigns</h1>
            <p className="text-hos-text-secondary mt-1">
              Create and manage promotional campaigns with custom commission rates
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors"
          >
            Create Campaign
          </button>
        </div>

        {/* Filters */}
        <div className="bg-hos-bg-secondary rounded-lg shadow-sm p-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-hos-border rounded-lg"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-hos-bg-secondary rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold mx-auto"></div>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="p-12 text-center text-hos-text-muted">No campaigns found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-hos-bg-secondary">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Campaign</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Influencer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Period</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Commission</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Performance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hos-border">
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-hos-bg-tertiary">
                      <td className="px-6 py-4">
                        <p className="font-medium text-white">{campaign.name}</p>
                        {campaign.description && (
                          <p className="text-sm text-hos-text-muted truncate max-w-xs">{campaign.description}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-white">{campaign.influencer.displayName}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                        {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-hos-gold">
                        {campaign.overrideCommissionRate != null
                          ? `${(Number(campaign.overrideCommissionRate) * 100).toFixed(1)}%`
                          : 'Default'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                        <div>{campaign.totalClicks} clicks · {campaign.totalConversions} sales</div>
                        <div className="text-green-400 font-medium">{formatCurrency(campaign.totalSales)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(campaign.status)}`}>
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openAnalytics(campaign.id)}
                            className="text-hos-gold hover:text-hos-gold-hover text-sm font-medium"
                          >
                            Results
                          </button>
                          {campaign.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleUpdateStatus(campaign.id, 'PAUSED')}
                              className="text-yellow-400 hover:text-yellow-300 text-sm font-medium"
                            >
                              Pause
                            </button>
                          )}
                          {campaign.status === 'PAUSED' && (
                            <button
                              onClick={() => handleUpdateStatus(campaign.id, 'ACTIVE')}
                              className="text-green-400 hover:text-green-300 text-sm font-medium"
                            >
                              Resume
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(campaign.id)}
                            className="text-red-400 hover:text-red-300 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Analytics modal */}
        {analyticsOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-hos-bg-secondary rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto my-8">
              <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-hos-bg-secondary">
                <h2 className="text-xl font-semibold text-white">Campaign results</h2>
                <button
                  type="button"
                  onClick={closeAnalytics}
                  className="text-hos-text-muted hover:text-hos-text-secondary text-2xl leading-none px-2"
                  aria-label="Close"
                >
                  &times;
                </button>
              </div>
              <div className="p-6 space-y-6">
                {analyticsLoading && (
                  <div className="py-12 text-center text-hos-text-muted">Loading analytics…</div>
                )}
                {!analyticsLoading && analyticsData && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-hos-bg-secondary rounded-lg p-4">
                        <p className="text-xs text-hos-text-muted uppercase">Conversions</p>
                        <p className="text-2xl font-bold text-white">{analyticsData.summary?.conversions ?? 0}</p>
                      </div>
                      <div className="bg-hos-bg-secondary rounded-lg p-4">
                        <p className="text-xs text-hos-text-muted uppercase">Sales attributed</p>
                        <p className="text-2xl font-bold text-green-400">
                          {formatCurrency(analyticsData.summary?.totalSalesAttributed ?? 0)}
                        </p>
                      </div>
                      <div className="bg-hos-bg-secondary rounded-lg p-4">
                        <p className="text-xs text-hos-text-muted uppercase">Commission (all)</p>
                        <p className="text-2xl font-bold text-hos-gold-hover">
                          {formatCurrency(analyticsData.summary?.totalCommissionAll ?? 0)}
                        </p>
                      </div>
                      <div className="bg-hos-bg-secondary rounded-lg p-4">
                        <p className="text-xs text-hos-text-muted uppercase">Pending commission</p>
                        <p className="text-2xl font-bold text-amber-400">
                          {formatCurrency(analyticsData.summary?.totalCommissionPending ?? 0)}
                        </p>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-2">Daily conversions</h3>
                      {analyticsData.timeSeries?.length ? (
                        <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-hos-bg-secondary">
                              <tr>
                                <th className="px-3 py-2 text-left">Date</th>
                                <th className="px-3 py-2 text-right">Conversions</th>
                                <th className="px-3 py-2 text-right">Sales</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analyticsData.timeSeries.map((row: any) => (
                                <tr key={row.date} className="border-t">
                                  <td className="px-3 py-2">{row.date}</td>
                                  <td className="px-3 py-2 text-right">{row.conversions}</td>
                                  <td className="px-3 py-2 text-right">{formatCurrency(row.sales)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-hos-text-muted">No conversion data yet for this campaign.</p>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-2">Top products (by revenue)</h3>
                      {analyticsData.topProducts?.length ? (
                        <ul className="border rounded-lg divide-y text-sm">
                          {analyticsData.topProducts.map((p: any) => (
                            <li key={p.productId} className="px-3 py-2 flex justify-between gap-2">
                              <span className="truncate">{p.name}</span>
                              <span className="text-hos-text-secondary whitespace-nowrap">
                                {formatCurrency(p.revenue)} · {p.units} units
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-hos-text-muted">No product breakdown yet.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-hos-bg-secondary rounded-xl max-w-md w-full">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold text-white">Create Campaign</h2>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Influencer *</label>
                  <select
                    value={form.influencerId}
                    onChange={(e) => setForm({ ...form, influencerId: e.target.value })}
                    className="w-full px-4 py-2 border border-hos-border rounded-lg"
                    required
                  >
                    <option value="">Select influencer</option>
                    {influencers.map((i) => (
                      <option key={i.id} value={i.id}>{i.displayName} ({i.referralCode})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Campaign Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2 border border-hos-border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 border border-hos-border rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Start Date *</label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className="w-full px-4 py-2 border border-hos-border rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">End Date *</label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      className="w-full px-4 py-2 border border-hos-border rounded-lg"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                    Override Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    step="1"
                    value={form.overrideCommissionRate}
                    onChange={(e) => setForm({ ...form, overrideCommissionRate: e.target.value })}
                    className="w-full px-4 py-2 border border-hos-border rounded-lg"
                    placeholder="Leave empty to use influencer's default rate"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-hos-text-secondary hover:bg-hos-bg-tertiary rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Campaign'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      </AdminLayout>
    </RouteGuard>
  );
}
