'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';

type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';

interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  budget: number;
  createdAt: string;
  updatedAt: string;
}

interface CampaignFormData {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  budget: string;
  status: CampaignStatus;
}

const emptyForm: CampaignFormData = {
  name: '',
  description: '',
  startDate: '',
  endDate: '',
  budget: '',
  status: 'DRAFT',
};

const STATUS_COLORS: Record<CampaignStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  ACTIVE: 'bg-green-100 text-green-800',
  PAUSED: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
};

const FILTER_TABS: { label: string; value: CampaignStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Paused', value: 'PAUSED' },
  { label: 'Completed', value: 'COMPLETED' },
];

export default function MarketingCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'ALL'>('ALL');

  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [formData, setFormData] = useState<CampaignFormData>(emptyForm);
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchCampaigns = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
        setError(null);
      }
      const response = await apiClient.getMarketingCampaigns();
      if (response?.data) {
        setCampaigns(Array.isArray(response.data) ? response.data : []);
      } else if (showLoading) {
        setError('Failed to load campaigns');
      }
    } catch (err: any) {
      console.error('Error fetching campaigns:', err);
      if (showLoading) setError(err?.message || 'Failed to load campaigns');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns(true);
  }, [fetchCampaigns]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchCampaigns(false);
    };
    const interval = setInterval(() => fetchCampaigns(false), 60_000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchCampaigns]);

  const filteredCampaigns =
    statusFilter === 'ALL'
      ? campaigns
      : campaigns.filter((c) => c.status === statusFilter);

  const openCreateModal = () => {
    setEditingCampaign(null);
    setFormData(emptyForm);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name,
      description: campaign.description || '',
      startDate: campaign.startDate ? campaign.startDate.slice(0, 10) : '',
      endDate: campaign.endDate ? campaign.endDate.slice(0, 10) : '',
      budget: String(campaign.budget ?? ''),
      status: campaign.status,
    });
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCampaign(null);
    setFormData(emptyForm);
    setFormError(null);
  };

  const handleFormChange = (field: keyof CampaignFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setFormError('Campaign name is required');
      return;
    }
    if (!formData.startDate) {
      setFormError('Start date is required');
      return;
    }
    if (!formData.endDate) {
      setFormError('End date is required');
      return;
    }
    if (formData.endDate < formData.startDate) {
      setFormError('End date must be after start date');
      return;
    }
    if (!formData.budget || Number(formData.budget) < 0) {
      setFormError('Budget must be a positive number');
      return;
    }

    try {
      setActionLoading(true);
      setFormError(null);
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        startDate: formData.startDate,
        endDate: formData.endDate,
        budget: Number(formData.budget),
        status: formData.status,
      };

      if (editingCampaign) {
        await apiClient.updateMarketingCampaign(editingCampaign.id, payload);
      } else {
        await apiClient.createMarketingCampaign(payload);
      }

      closeModal();
      await fetchCampaigns(true);
    } catch (err: any) {
      console.error('Error saving campaign:', err);
      setFormError(err?.message || 'Failed to save campaign');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleteLoading(true);
      await apiClient.deleteMarketingCampaign(id);
      setDeleteConfirmId(null);
      await fetchCampaigns(true);
    } catch (err: any) {
      console.error('Error deleting campaign:', err);
      setError(err?.message || 'Failed to delete campaign');
    } finally {
      setDeleteLoading(false);
    }
  };

  const menuItems = [
    { title: 'Dashboard', href: '/marketing/dashboard', icon: '📊' },
    { title: 'Marketing Materials', href: '/marketing/materials', icon: '📢' },
    { title: 'Campaigns', href: '/marketing/campaigns', icon: '📣' },
  ];

  return (
    <RouteGuard allowedRoles={['MARKETING', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="MARKETING" menuItems={menuItems} title="Marketing">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Campaigns</h1>
            <p className="text-gray-600 mt-2">Create and manage marketing campaigns</p>
          </div>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm whitespace-nowrap"
          >
            + Create Campaign
          </button>
        </div>

        {/* Status filter tabs */}
        <div className="mb-6 flex gap-2 border-b overflow-x-auto">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                statusFilter === tab.value
                  ? 'border-b-2 border-purple-600 text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.value !== 'ALL' && (
                <span className="ml-1.5 text-xs">
                  ({campaigns.filter((c) => c.status === tab.value).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <p className="font-semibold">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        )}

        {!loading && !error && filteredCampaigns.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <div className="text-4xl mb-3">📣</div>
            <p className="text-gray-500 text-lg">
              {statusFilter === 'ALL'
                ? 'No campaigns yet'
                : `No ${statusFilter.toLowerCase()} campaigns`}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {statusFilter === 'ALL'
                ? 'Create your first campaign to get started'
                : 'Try selecting a different status filter'}
            </p>
            {statusFilter === 'ALL' && (
              <button
                onClick={openCreateModal}
                className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
              >
                + Create Campaign
              </button>
            )}
          </div>
        )}

        {!loading && !error && filteredCampaigns.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Start Date</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">End Date</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Budget</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCampaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{campaign.name}</p>
                        {campaign.description && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{campaign.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${STATUS_COLORS[campaign.status]}`}>
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {campaign.startDate ? new Date(campaign.startDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        ${Number(campaign.budget ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(campaign)}
                            className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                          >
                            Edit
                          </button>
                          {deleteConfirmId === campaign.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(campaign.id)}
                                disabled={deleteLoading}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                              >
                                {deleteLoading ? 'Deleting...' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                disabled={deleteLoading}
                                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(campaign.id)}
                              className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              Delete
                            </button>
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

        {/* Create / Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold">
                    {editingCampaign ? 'Edit Campaign' : 'Create Campaign'}
                  </h2>
                  <button
                    onClick={closeModal}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {formError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    {formError}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Campaign Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleFormChange('name', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g. Summer Sale 2026"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleFormChange('description', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      placeholder="Brief description of the campaign..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => handleFormChange('startDate', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => handleFormChange('endDate', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Budget ($) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.budget}
                      onChange={(e) => handleFormChange('budget', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => handleFormChange('status', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="ACTIVE">Active</option>
                      <option value="PAUSED">Paused</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleSubmit}
                      disabled={actionLoading}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                    >
                      {actionLoading
                        ? 'Saving...'
                        : editingCampaign
                          ? 'Update Campaign'
                          : 'Create Campaign'}
                    </button>
                    <button
                      onClick={closeModal}
                      disabled={actionLoading}
                      className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </RouteGuard>
  );
}
