'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { AdminLayout } from '@/components/AdminLayout';

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
        apiClient.getAdminCampaigns({ status: statusFilter || undefined, limit: 100 }),
        apiClient.getInfluencers({ status: 'ACTIVE', limit: 100 }),
      ]);
      setCampaigns(campaignsRes.data || []);
      setInfluencers(influencersRes.data || []);
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
      await apiClient.createCampaign({
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
      await apiClient.updateCampaign(id, { status });
      toast.success('Campaign status updated');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update campaign');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;

    try {
      await apiClient.deleteCampaign(id);
      toast.success('Campaign deleted');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete campaign');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      ACTIVE: 'bg-green-100 text-green-800',
      PAUSED: 'bg-yellow-100 text-yellow-800',
      COMPLETED: 'bg-blue-100 text-blue-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Influencer Campaigns</h1>
            <p className="text-gray-600 mt-1">
              Create and manage promotional campaigns with custom commission rates
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Create Campaign
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No campaigns found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Influencer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{campaign.name}</p>
                        {campaign.description && (
                          <p className="text-sm text-gray-500 truncate max-w-xs">{campaign.description}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{campaign.influencer.displayName}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">
                        {campaign.overrideCommissionRate
                          ? `${(campaign.overrideCommissionRate * 100).toFixed(0)}%`
                          : 'Default'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{campaign.totalClicks} clicks · {campaign.totalConversions} sales</div>
                        <div className="text-green-600 font-medium">{formatCurrency(campaign.totalSales)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(campaign.status)}`}>
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          {campaign.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleUpdateStatus(campaign.id, 'PAUSED')}
                              className="text-yellow-600 hover:text-yellow-800 text-sm font-medium"
                            >
                              Pause
                            </button>
                          )}
                          {campaign.status === 'PAUSED' && (
                            <button
                              onClick={() => handleUpdateStatus(campaign.id, 'ACTIVE')}
                              className="text-green-600 hover:text-green-800 text-sm font-medium"
                            >
                              Resume
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(campaign.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
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

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold text-gray-900">Create Campaign</h2>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Influencer *</label>
                  <select
                    value={form.influencerId}
                    onChange={(e) => setForm({ ...form, influencerId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Select influencer</option>
                    {influencers.map((i) => (
                      <option key={i.id} value={i.id}>{i.displayName} ({i.referralCode})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Override Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    step="1"
                    value={form.overrideCommissionRate}
                    onChange={(e) => setForm({ ...form, overrideCommissionRate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="Leave empty to use influencer's default rate"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
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
  );
}
