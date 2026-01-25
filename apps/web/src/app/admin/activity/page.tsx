'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { DataExport } from '@/components/DataExport';

interface ActivityLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  description?: string;
  metadata?: Record<string, any>;
  userId?: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  };
  sellerId?: string;
  seller?: {
    id: string;
    storeName?: string;
  };
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

interface Stats {
  total: number;
  today: number;
  thisWeek: number;
  byAction: Record<string, number>;
  byEntity: Record<string, number>;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  LOGIN: 'bg-purple-100 text-purple-800',
  LOGOUT: 'bg-gray-100 text-gray-800',
  VIEW: 'bg-cyan-100 text-cyan-800',
  EXPORT: 'bg-yellow-100 text-yellow-800',
  IMPORT: 'bg-indigo-100 text-indigo-800',
  APPROVE: 'bg-emerald-100 text-emerald-800',
  REJECT: 'bg-orange-100 text-orange-800',
};

const ENTITY_ICONS: Record<string, string> = {
  USER: '👤',
  PRODUCT: '📦',
  ORDER: '🛒',
  SUBMISSION: '📋',
  PAYMENT: '💳',
  SETTLEMENT: '💰',
  SHIPMENT: '🚚',
  REVIEW: '⭐',
  TICKET: '🎫',
  SETTING: '⚙️',
};

export default function AdminActivityPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('7d');
  const [userFilter, setUserFilter] = useState<string>('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 50;
  
  // Detail modal
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getActivityLogs();
      let logData: ActivityLog[] = [];
      if (response && 'data' in response) {
        const responseData = response.data as any;
        if (Array.isArray(responseData)) {
          logData = responseData;
        } else if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray(responseData.data)) {
          logData = responseData.data;
        }
      }
      setLogs(logData);
      calculateStats(logData);
    } catch (err: any) {
      console.error('Error fetching logs:', err);
      setError(err.message || 'Failed to load activity logs');
      toast.error(err.message || 'Failed to load activity logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calculateStats = (logData: ActivityLog[]) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const byAction: Record<string, number> = {};
    const byEntity: Record<string, number> = {};
    
    logData.forEach(log => {
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      byEntity[log.entityType] = (byEntity[log.entityType] || 0) + 1;
    });

    setStats({
      total: logData.length,
      today: logData.filter(l => new Date(l.createdAt) >= startOfToday).length,
      thisWeek: logData.filter(l => new Date(l.createdAt) >= startOfWeek).length,
      byAction,
      byEntity,
    });
  };

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Get unique values for filters
  const uniqueActions = useMemo(() => {
    return [...new Set(logs.map(l => l.action))].sort();
  }, [logs]);

  const uniqueEntities = useMemo(() => {
    return [...new Set(logs.map(l => l.entityType))].sort();
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    let filtered = [...logs];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log =>
        log.action?.toLowerCase().includes(term) ||
        log.entityType?.toLowerCase().includes(term) ||
        log.description?.toLowerCase().includes(term) ||
        log.user?.email?.toLowerCase().includes(term) ||
        log.seller?.storeName?.toLowerCase().includes(term) ||
        log.entityId?.toLowerCase().includes(term)
      );
    }

    // Action filter
    if (actionFilter !== 'ALL') {
      filtered = filtered.filter(l => l.action === actionFilter);
    }

    // Entity filter
    if (entityFilter !== 'ALL') {
      filtered = filtered.filter(l => l.entityType === entityFilter);
    }

    // Date filter
    if (dateFilter !== 'ALL') {
      const now = new Date();
      let startDate: Date;
      switch (dateFilter) {
        case '1d':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0);
      }
      filtered = filtered.filter(l => new Date(l.createdAt) >= startDate);
    }

    // User filter
    if (userFilter) {
      const term = userFilter.toLowerCase();
      filtered = filtered.filter(l =>
        l.user?.email?.toLowerCase().includes(term) ||
        `${l.user?.firstName} ${l.user?.lastName}`.toLowerCase().includes(term)
      );
    }

    // Sort by date descending
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return filtered;
  }, [logs, searchTerm, actionFilter, entityFilter, dateFilter, userFilter]);

  // Paginated logs
  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize);

  const handleViewDetails = (log: ActivityLog) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const getActionBadge = (action: string) => {
    const color = ACTION_COLORS[action] || 'bg-gray-100 text-gray-800';
    return <span className={`px-2 py-0.5 text-xs rounded-full ${color}`}>{action}</span>;
  };

  const getEntityIcon = (entityType: string) => {
    return ENTITY_ICONS[entityType] || '📄';
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  };

  const exportColumns = [
    { key: 'action', header: 'Action' },
    { key: 'entityType', header: 'Entity Type' },
    { key: 'entityId', header: 'Entity ID' },
    { key: 'description', header: 'Description' },
    { key: 'user', header: 'User', format: (v: any) => v?.email || '' },
    { key: 'ipAddress', header: 'IP Address' },
    { key: 'createdAt', header: 'Date', format: (v: string) => new Date(v).toLocaleString() },
  ];

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
              <p className="text-gray-600 mt-1">Monitor platform activity and audit trail</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchLogs}
                className="px-4 py-2 text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50"
              >
                Refresh
              </button>
              <DataExport data={filteredLogs} columns={exportColumns} filename="activity-logs-export" />
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Total Logs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Today</p>
                <p className="text-2xl font-bold text-blue-600">{stats.today.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">This Week</p>
                <p className="text-2xl font-bold text-purple-600">{stats.thisWeek.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Unique Actions</p>
                <p className="text-2xl font-bold text-green-600">{Object.keys(stats.byAction).length}</p>
              </div>
            </div>
          )}

          {/* Quick Filters - Actions */}
          {stats && Object.keys(stats.byAction).length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Filter by Action</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActionFilter('ALL')}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    actionFilter === 'ALL' ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  All ({stats.total})
                </button>
                {Object.entries(stats.byAction).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([action, count]) => (
                  <button
                    key={action}
                    onClick={() => setActionFilter(action)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                      actionFilter === action ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {action} ({count})
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
              <button onClick={fetchLogs} className="mt-2 text-red-600 hover:text-red-800 text-sm">Retry</button>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  placeholder="Action, entity, description, user..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
                <select
                  value={entityFilter}
                  onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ALL">All Entities</option>
                  {uniqueEntities.map(entity => (
                    <option key={entity} value={entity}>{entity}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                <select
                  value={dateFilter}
                  onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="1d">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="ALL">All Time</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
                <input
                  type="text"
                  value={userFilter}
                  onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
                  placeholder="Filter by user..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Activity Log Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold">
                  Activity Logs ({filteredLogs.length.toLocaleString()})
                </h2>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2 text-sm">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span>Page {page} of {totalPages}</span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                          No activity logs found
                        </td>
                      </tr>
                    ) : (
                      paginatedLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                            <div>{formatTimeAgo(log.createdAt)}</div>
                            <div className="text-xs">{new Date(log.createdAt).toLocaleTimeString()}</div>
                          </td>
                          <td className="px-4 py-3">{getActionBadge(log.action)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span>{getEntityIcon(log.entityType)}</span>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{log.entityType}</p>
                                {log.entityId && (
                                  <p className="text-xs text-gray-500 font-mono">{log.entityId.substring(0, 8)}...</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                            {log.description || '-'}
                          </td>
                          <td className="px-4 py-3">
                            {log.user ? (
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {log.user.firstName && log.user.lastName 
                                    ? `${log.user.firstName} ${log.user.lastName}` 
                                    : log.user.email}
                                </p>
                                {log.user.role && (
                                  <p className="text-xs text-gray-500">{log.user.role}</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">System</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleViewDetails(log)}
                              className="px-2 py-1 text-sm text-purple-600 hover:bg-purple-50 rounded"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Footer */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t flex justify-between items-center">
                  <p className="text-sm text-gray-500">
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredLogs.length)} of {filteredLogs.length} logs
                  </p>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`px-3 py-1 text-sm rounded ${
                            page === pageNum ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detail Modal */}
          {showDetailModal && selectedLog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-2xl font-bold">Activity Details</h2>
                      <p className="text-sm text-gray-500">Log ID: {selectedLog.id}</p>
                    </div>
                    <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                  </div>

                  <div className="space-y-6">
                    {/* Action & Entity */}
                    <div className="flex items-center gap-4">
                      {getActionBadge(selectedLog.action)}
                      <span className="text-2xl">{getEntityIcon(selectedLog.entityType)}</span>
                      <span className="text-lg font-medium">{selectedLog.entityType}</span>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Timestamp</p>
                        <p className="font-medium">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                      </div>
                      {selectedLog.entityId && (
                        <div>
                          <p className="text-sm text-gray-500">Entity ID</p>
                          <p className="font-medium font-mono text-sm">{selectedLog.entityId}</p>
                        </div>
                      )}
                      {selectedLog.user && (
                        <>
                          <div>
                            <p className="text-sm text-gray-500">User</p>
                            <p className="font-medium">{selectedLog.user.email}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">User Role</p>
                            <p className="font-medium">{selectedLog.user.role || 'N/A'}</p>
                          </div>
                        </>
                      )}
                      {selectedLog.seller && (
                        <div>
                          <p className="text-sm text-gray-500">Seller</p>
                          <p className="font-medium">{selectedLog.seller.storeName}</p>
                        </div>
                      )}
                      {selectedLog.ipAddress && (
                        <div>
                          <p className="text-sm text-gray-500">IP Address</p>
                          <p className="font-medium font-mono">{selectedLog.ipAddress}</p>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {selectedLog.description && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Description</p>
                        <p className="text-gray-700">{selectedLog.description}</p>
                      </div>
                    )}

                    {/* Metadata */}
                    {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                      <div>
                        <p className="text-sm text-gray-500 mb-2">Additional Data</p>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <pre className="text-xs overflow-auto">{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                        </div>
                      </div>
                    )}

                    {/* User Agent */}
                    {selectedLog.userAgent && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">User Agent</p>
                        <p className="text-xs text-gray-600 font-mono break-all">{selectedLog.userAgent}</p>
                      </div>
                    )}

                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      Close
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
