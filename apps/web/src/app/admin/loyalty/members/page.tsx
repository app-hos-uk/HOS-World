'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminLoyaltyMembersPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [adjustForm, setAdjustForm] = useState({ pointsDelta: 0, reason: '' });
  const [adjusting, setAdjusting] = useState(false);
  const toast = useToast();

  const load = useCallback(async (q?: string) => {
    try {
      setLoading(true);
      const res = await apiClient.adminGetLoyaltyMembers(q);
      if (res?.data) setMembers(res.data as any[]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(searchQuery.trim() || undefined);
  };

  const handleAdjust = async () => {
    if (!selectedMember || !adjustForm.reason.trim()) {
      toast.error('Reason is required');
      return;
    }
    setAdjusting(true);
    try {
      await apiClient.adminAdjustLoyaltyPoints(selectedMember.userId, adjustForm.pointsDelta, adjustForm.reason);
      toast.success(`Points adjusted by ${adjustForm.pointsDelta > 0 ? '+' : ''}${adjustForm.pointsDelta}`);
      setSelectedMember(null);
      setAdjustForm({ pointsDelta: 0, reason: '' });
      await load(searchQuery.trim() || undefined);
    } catch (err: any) {
      toast.error(err.message || 'Failed to adjust points');
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
      <AdminLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Loyalty Members</h1>
          <p className="text-gray-600 mt-1">Search members, view details, and adjust points</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <input
            className="flex-1 border rounded-lg px-4 py-2"
            placeholder="Search by email or card number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">Search</button>
        </form>

        {selectedMember && (
          <div className="bg-white border rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">
              Adjust Points — {selectedMember.user?.firstName} {selectedMember.user?.lastName} ({selectedMember.user?.email})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Points Delta (negative to deduct)</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2" value={adjustForm.pointsDelta} onChange={(e) => setAdjustForm({ ...adjustForm, pointsDelta: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input className="w-full border rounded-lg px-3 py-2" placeholder="e.g. Goodwill credit" value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAdjust} disabled={adjusting} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium">
                {adjusting ? 'Adjusting...' : 'Apply Adjustment'}
              </button>
              <button onClick={() => setSelectedMember(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
          </div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Member</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Card #</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tier</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Points</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Lifetime</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Enrolled</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {members.map((m) => (
                  <tr key={m.id || m.userId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{m.user?.firstName} {m.user?.lastName}</p>
                        <p className="text-xs text-gray-500">{m.user?.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{m.cardNumber || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                        {m.tier?.name || 'None'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{Number(m.pointsBalance ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{Number(m.lifetimePoints ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{m.enrolledAt ? new Date(m.enrolledAt).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { setSelectedMember(m); setAdjustForm({ pointsDelta: 0, reason: '' }); }}
                        className="text-purple-600 hover:text-purple-800 font-medium"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {members.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                {searchQuery ? 'No members found for this search.' : 'No loyalty members yet.'}
              </div>
            )}
          </div>
        )}
      </AdminLayout>
    </RouteGuard>
  );
}
