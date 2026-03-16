'use client';

import { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface AuditEntry {
  id: string;
  userId: string;
  consentType: string;
  granted: boolean;
  grantedAt: string;
  ipAddress?: string;
  userAgent?: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export default function PrivacyAuditPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const limit = 25;

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getConsentAuditLog(page, limit);
      if (res?.data) {
        setLogs(res.data.logs || []);
        setTotal(res.data.total || 0);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  const filteredLogs = filterType
    ? logs.filter((l) => l.consentType === filterType)
    : logs;

  const consentTypes = Array.from(new Set(logs.map((l) => l.consentType)));

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'DO_NOT_SELL': return 'bg-orange-100 text-orange-800';
      case 'MARKETING': return 'bg-blue-100 text-blue-800';
      case 'ANALYTICS': return 'bg-indigo-100 text-indigo-800';
      case 'ESSENTIAL': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
      <AdminLayout>
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Privacy Audit Log</h1>
          <p className="text-gray-600 mt-2">
            Track all consent changes, Do Not Sell opt-outs, and data access request events across users.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <div className="text-2xl font-bold text-purple-700">{total}</div>
            <div className="text-sm text-gray-600">Total Events</div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-2xl font-bold text-orange-600">
              {logs.filter((l) => l.consentType === 'DO_NOT_SELL' && l.granted).length}
            </div>
            <div className="text-sm text-gray-600">Do Not Sell Opt-Outs</div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-2xl font-bold text-blue-600">
              {logs.filter((l) => l.consentType === 'MARKETING').length}
            </div>
            <div className="text-sm text-gray-600">Marketing Changes</div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-2xl font-bold text-green-600">
              {logs.filter((l) => l.granted).length}
            </div>
            <div className="text-sm text-gray-600">Grants (This Page)</div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm font-medium text-gray-700">Filter by type:</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All</option>
            {consentTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto" />
              <p className="text-gray-500 mt-3">Loading audit log...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No consent events found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Date / Time</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Action</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredLogs.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {new Date(entry.grantedAt).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500">{entry.user?.email || entry.userId}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeColor(entry.consentType)}`}>
                          {entry.consentType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${entry.granted ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {entry.granted ? 'Granted' : 'Revoked'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                        {entry.ipAddress || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-600">
              Page {page} of {totalPages} ({total} total events)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </AdminLayout>
    </RouteGuard>
  );
}
