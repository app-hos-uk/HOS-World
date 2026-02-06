'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface MarketingMaterial {
  id: string;
  submissionId: string;
  type: string;
  url: string;
  createdAt: string;
  submission?: {
    id: string;
    seller?: {
      storeName: string;
      slug: string;
    };
    catalogEntry?: {
      title: string;
      images?: string[];
    };
    productData?: {
      name?: string;
    };
  };
}

interface PendingSubmission {
  id: string;
  status: string;
  catalogCompletedAt: string;
  seller?: {
    storeName: string;
    slug: string;
  };
  catalogEntry?: {
    title: string;
    images?: string[];
  };
  productData?: {
    name?: string;
  };
  marketingMaterials: MarketingMaterial[];
}

const MATERIAL_TYPES = [
  'HERO_IMAGE',
  'LIFESTYLE',
  'DETAIL',
  'VIDEO',
  'BANNER',
  'SOCIAL',
  'OTHER',
];

const TYPE_COLORS: Record<string, string> = {
  HERO_IMAGE: 'bg-purple-100 text-purple-800',
  LIFESTYLE: 'bg-blue-100 text-blue-800',
  DETAIL: 'bg-green-100 text-green-800',
  VIDEO: 'bg-red-100 text-red-800',
  BANNER: 'bg-yellow-100 text-yellow-800',
  SOCIAL: 'bg-pink-100 text-pink-800',
  OTHER: 'bg-gray-100 text-gray-800',
};

export default function AdminMarketingPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'pending' | 'materials'>('pending');
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmission[]>([]);
  const [materials, setMaterials] = useState<MarketingMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [materialActionLoading, setMaterialActionLoading] = useState(false);
  
  // Refs to track current values for use in async handlers
  // This prevents stale closures when user switches tabs during async operations
  const activeTabRef = useRef(activeTab);
  const typeFilterRef = useRef(typeFilter);
  
  // Keep refs in sync with state
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  
  useEffect(() => {
    typeFilterRef.current = typeFilter;
  }, [typeFilter]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Stats
  const [stats, setStats] = useState({
    pending: 0,
    completed: 0,
    totalMaterials: 0,
  });

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<PendingSubmission | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<MarketingMaterial | null>(null);
  const [materialForm, setMaterialForm] = useState({
    submissionId: '',
    type: 'HERO_IMAGE',
    url: '',
  });

  const fetchStats = useCallback(async () => {
    try {
      const response = await apiClient.getMarketingDashboardStats();
      if (response?.data) {
        setStats(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // Pass tab and filter as parameters to avoid stale closure issues
  // Note: toast is NOT included in deps because useToast() returns a new object each render
  // The toast methods themselves are stable; including toast would cause infinite re-fetches
  const fetchData = useCallback(async (tab: 'pending' | 'materials', filter: string) => {
    try {
      setLoading(true);
      if (tab === 'pending') {
        const response = await apiClient.getMarketingPending();
        setPendingSubmissions(Array.isArray(response?.data) ? response.data : []);
      } else {
        const response = await apiClient.getMarketingMaterials(
          undefined,
          filter !== 'ALL' ? filter : undefined
        );
        setMaterials(Array.isArray(response?.data) ? response.data : []);
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      toast.error(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData(activeTab, typeFilter);
    fetchStats();
  }, [activeTab, typeFilter, fetchData, fetchStats]);

  const handleAddMaterial = async () => {
    if (!materialForm.submissionId || !materialForm.url) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (materialActionLoading) return;

    try {
      setMaterialActionLoading(true);
      await apiClient.createMarketingMaterial(materialForm);
      toast.success('Marketing material added successfully');
      setShowAddModal(false);
      setMaterialForm({ submissionId: '', type: 'HERO_IMAGE', url: '' });
      // Use refs to get current values after async operation completes
      // This prevents stale closure issues if user switched tabs during the operation
      fetchData(activeTabRef.current, typeFilterRef.current);
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add material');
    } finally {
      setMaterialActionLoading(false);
    }
  };

  const handleUpdateMaterial = async () => {
    if (!selectedMaterial || materialActionLoading) return;

    try {
      setMaterialActionLoading(true);
      await apiClient.updateMarketingMaterial(selectedMaterial.id, {
        type: materialForm.type,
        url: materialForm.url,
      });
      toast.success('Material updated successfully');
      setShowEditModal(false);
      setSelectedMaterial(null);
      // Use refs to get current values after async operation completes
      fetchData(activeTabRef.current, typeFilterRef.current);
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update material');
    } finally {
      setMaterialActionLoading(false);
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!confirm('Are you sure you want to delete this material?')) return;

    try {
      await apiClient.deleteMarketingMaterial(id);
      toast.success('Material deleted successfully');
      // Use refs to get current values after async operation completes
      fetchData(activeTabRef.current, typeFilterRef.current);
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete material');
    }
  };

  const handleMarkComplete = async (submissionId: string) => {
    try {
      await apiClient.markMarketingComplete(submissionId);
      toast.success('Submission marked as marketing complete');
      // Use refs to get current values after async operation completes
      fetchData(activeTabRef.current, typeFilterRef.current);
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark as complete');
    }
  };

  const openAddModal = (submission: PendingSubmission) => {
    setSelectedSubmission(submission);
    setMaterialForm({
      submissionId: submission.id,
      type: 'HERO_IMAGE',
      url: '',
    });
    setShowAddModal(true);
  };

  const openEditModal = (material: MarketingMaterial) => {
    setSelectedMaterial(material);
    setMaterialForm({
      submissionId: material.submissionId,
      type: material.type,
      url: material.url,
    });
    setShowEditModal(true);
  };

  // Filter materials
  const filteredMaterials = materials.filter((material) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    const urlMatch = material.url?.toLowerCase()?.includes(searchLower) ?? false;
    const titleMatch = material.submission?.catalogEntry?.title?.toLowerCase()?.includes(searchLower) ?? false;
    const storeMatch = material.submission?.seller?.storeName?.toLowerCase()?.includes(searchLower) ?? false;
    
    return urlMatch || titleMatch || storeMatch;
  });

  const tabs = [
    { id: 'pending', label: 'Pending Review', icon: '⏳', count: stats.pending },
    { id: 'materials', label: 'All Materials', icon: '📁', count: stats.totalMaterials },
  ];

  return (
    <RouteGuard allowedRoles={['ADMIN', 'MARKETING']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Marketing Dashboard</h1>
              <p className="text-gray-600 mt-1">Manage product marketing materials and submissions</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Pending Review</h3>
              <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
              <p className="text-xs text-gray-500 mt-1">Awaiting marketing materials</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Completed</h3>
              <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
              <p className="text-xs text-gray-500 mt-1">Marketing finalized</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Materials</h3>
              <p className="text-3xl font-bold text-purple-600">{stats.totalMaterials}</p>
              <p className="text-xs text-gray-500 mt-1">Images, videos, banners</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      activeTab === tab.id ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <>
              {activeTab === 'pending' && (
                <div className="space-y-4">
                  {pendingSubmissions.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                      <span className="text-4xl block mb-2">✅</span>
                      <p className="text-gray-500">No submissions pending marketing review</p>
                    </div>
                  ) : (
                    pendingSubmissions.map((submission) => (
                      <div key={submission.id} className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="p-6">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-gray-900">
                                {submission.catalogEntry?.title || submission.productData?.name || 'Untitled Product'}
                              </h3>
                              <p className="text-sm text-gray-500 mt-1">
                                Seller: {submission.seller?.storeName || 'Unknown'}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                Catalog completed: {new Date(submission.catalogCompletedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => openAddModal(submission)}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                              >
                                + Add Material
                              </button>
                              {submission.marketingMaterials.length > 0 && (
                                <button
                                  onClick={() => handleMarkComplete(submission.id)}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                                >
                                  Mark Complete
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Existing Materials */}
                          {submission.marketingMaterials.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <h4 className="text-sm font-medium text-gray-700 mb-3">
                                Materials ({submission.marketingMaterials.length})
                              </h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {submission.marketingMaterials.map((material) => (
                                  <div
                                    key={material.id}
                                    className="border rounded-lg p-3 relative group"
                                  >
                                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                                      TYPE_COLORS[material.type] || 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {material.type}
                                    </span>
                                    <a
                                      href={material.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block mt-2 text-sm text-purple-600 hover:underline truncate"
                                    >
                                      View Material
                                    </a>
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => handleDeleteMaterial(material.id)}
                                        className="text-red-500 hover:text-red-700 text-xs"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'materials' && (
                <div className="space-y-4">
                  {/* Filters */}
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Search by URL, product, or seller..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                        <select
                          value={typeFilter}
                          onChange={(e) => setTypeFilter(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="ALL">All Types</option>
                          {MATERIAL_TYPES.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Materials Table */}
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product/Seller</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredMaterials.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                              <span className="text-4xl block mb-2">📷</span>
                              <p>No marketing materials found</p>
                            </td>
                          </tr>
                        ) : (
                          filteredMaterials.map((material) => (
                            <tr key={material.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                  TYPE_COLORS[material.type] || 'bg-gray-100 text-gray-800'
                                }`}>
                                  {material.type}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {material.submission?.catalogEntry?.title || 'N/A'}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {material.submission?.seller?.storeName || 'Unknown Seller'}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <a
                                  href={material.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-purple-600 hover:text-purple-800 hover:underline truncate block max-w-xs"
                                >
                                  {material.url.length > 40 ? material.url.substring(0, 40) + '...' : material.url}
                                </a>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(material.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() => openEditModal(material)}
                                  className="text-purple-600 hover:text-purple-900 mr-3"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteMaterial(material.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Delete
                                </button>
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

          {/* Add Material Modal */}
          {showAddModal && selectedSubmission && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-lg w-full p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-bold">Add Marketing Material</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      For: {selectedSubmission.catalogEntry?.title || selectedSubmission.productData?.name}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Material Type</label>
                    <select
                      value={materialForm.type}
                      onChange={(e) => setMaterialForm({ ...materialForm, type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      {MATERIAL_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                    <input
                      type="url"
                      value={materialForm.url}
                      onChange={(e) => setMaterialForm({ ...materialForm, url: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Enter the URL of the image, video, or asset</p>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddMaterial}
                      disabled={materialActionLoading || !materialForm.url}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {materialActionLoading ? 'Adding...' : 'Add Material'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Edit Material Modal */}
          {showEditModal && selectedMaterial && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-lg w-full p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-bold">Edit Marketing Material</h2>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Material Type</label>
                    <select
                      value={materialForm.type}
                      onChange={(e) => setMaterialForm({ ...materialForm, type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      {MATERIAL_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                    <input
                      type="url"
                      value={materialForm.url}
                      onChange={(e) => setMaterialForm({ ...materialForm, url: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => setShowEditModal(false)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateMaterial}
                      disabled={materialActionLoading || !materialForm.url}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {materialActionLoading ? 'Saving...' : 'Save Changes'}
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
