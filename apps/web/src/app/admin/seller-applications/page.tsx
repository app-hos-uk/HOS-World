'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface SellerInvitation {
  id: string;
  email: string;
  sellerType: 'WHOLESALER' | 'B2C_SELLER';
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  message?: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string;
  invitedBy?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

export default function AdminSellerApplicationsPage() {
  const toast = useToast();
  const [invitations, setInvitations] = useState<SellerInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    sellerType: 'B2C_SELLER' as 'WHOLESALER' | 'B2C_SELLER',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInvitations();
  }, [statusFilter]);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getSellerInvitations(statusFilter || undefined);
      const invitationList = Array.isArray(response?.data) ? response.data : [];
      setInvitations(invitationList);
    } catch (err: any) {
      console.error('Error fetching seller invitations:', err);
      setError(err.message || 'Failed to load seller invitations');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email) {
      toast.error('Please enter an email address');
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.inviteSeller({
        email: inviteForm.email,
        sellerType: inviteForm.sellerType,
        message: inviteForm.message || undefined,
      });
      toast.success('Invitation sent successfully!');
      setShowInviteModal(false);
      setInviteForm({ email: '', sellerType: 'B2C_SELLER', message: '' });
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendInvitation = async (id: string) => {
    try {
      await apiClient.resendSellerInvitation(id);
      toast.success('Invitation resent successfully!');
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend invitation');
    }
  };

  const handleCancelInvitation = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;
    
    try {
      await apiClient.cancelSellerInvitation(id);
      toast.success('Invitation cancelled successfully!');
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel invitation');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'ACCEPTED':
        return 'bg-green-100 text-green-800';
      case 'EXPIRED':
        return 'bg-gray-100 text-gray-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const stats = {
    total: invitations.length,
    pending: invitations.filter(i => i.status === 'PENDING').length,
    accepted: invitations.filter(i => i.status === 'ACCEPTED').length,
    expired: invitations.filter(i => i.status === 'EXPIRED').length,
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Seller Invitations</h1>
              <p className="text-gray-600 mt-1">Manage seller invitations and applications</p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              + Invite Seller
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-gray-500 uppercase">Total Invitations</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <button
              onClick={() => setStatusFilter(statusFilter === 'PENDING' ? '' : 'PENDING')}
              className={`bg-white rounded-lg shadow p-4 text-left transition-colors ${
                statusFilter === 'PENDING' ? 'ring-2 ring-purple-500' : ''
              }`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Pending</h3>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'ACCEPTED' ? '' : 'ACCEPTED')}
              className={`bg-white rounded-lg shadow p-4 text-left transition-colors ${
                statusFilter === 'ACCEPTED' ? 'ring-2 ring-purple-500' : ''
              }`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Accepted</h3>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.accepted}</p>
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'EXPIRED' ? '' : 'EXPIRED')}
              className={`bg-white rounded-lg shadow p-4 text-left transition-colors ${
                statusFilter === 'EXPIRED' ? 'ring-2 ring-purple-500' : ''
              }`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Expired</h3>
              <p className="text-2xl font-bold text-gray-600 mt-1">{stats.expired}</p>
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
              <button
                onClick={fetchInvitations}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {statusFilter ? `${statusFilter} Invitations` : 'All Invitations'}
                </h2>
                {statusFilter && (
                  <button
                    onClick={() => setStatusFilter('')}
                    className="text-sm text-purple-600 hover:underline"
                  >
                    Clear filter
                  </button>
                )}
              </div>
              
              {invitations.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500">
                  <span className="text-5xl block mb-4">📧</span>
                  <p className="text-lg">No invitations found</p>
                  <p className="text-sm mt-2">Click "Invite Seller" to send a new invitation</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Sent
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Expires
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {invitations.map((invitation) => (
                        <tr key={invitation.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{invitation.email}</div>
                            {invitation.invitedBy && (
                              <div className="text-xs text-gray-500">
                                Invited by: {invitation.invitedBy.firstName || invitation.invitedBy.email}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              invitation.sellerType === 'WHOLESALER'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              {invitation.sellerType.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invitation.status)}`}>
                              {invitation.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(invitation.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(invitation.expiresAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {invitation.status === 'PENDING' && (
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleResendInvitation(invitation.id)}
                                  className="text-purple-600 hover:text-purple-900"
                                >
                                  Resend
                                </button>
                                <button
                                  onClick={() => handleCancelInvitation(invitation.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                            {invitation.status === 'EXPIRED' && (
                              <button
                                onClick={() => handleResendInvitation(invitation.id)}
                                className="text-purple-600 hover:text-purple-900"
                              >
                                Resend
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Invite Modal */}
          {showInviteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Invite Seller</h3>
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                <form onSubmit={handleInviteSeller} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="seller@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Seller Type *
                    </label>
                    <select
                      value={inviteForm.sellerType}
                      onChange={(e) => setInviteForm({ ...inviteForm, sellerType: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="B2C_SELLER">B2C Seller</option>
                      <option value="WHOLESALER">Wholesaler</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Message (optional)
                    </label>
                    <textarea
                      value={inviteForm.message}
                      onChange={(e) => setInviteForm({ ...inviteForm, message: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Welcome message for the seller..."
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {submitting ? 'Sending...' : 'Send Invitation'}
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
