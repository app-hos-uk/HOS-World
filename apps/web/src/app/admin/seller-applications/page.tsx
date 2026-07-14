'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        return 'bg-yellow-500/15 text-yellow-300';
      case 'ACCEPTED':
        return 'bg-green-500/15 text-green-300';
      case 'EXPIRED':
        return 'bg-hos-bg-tertiary text-hos-text-secondary';
      case 'CANCELLED':
        return 'bg-red-500/15 text-red-300';
      default:
        return 'bg-hos-bg-tertiary text-hos-text-secondary';
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
              <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-hos-text-secondary">Seller Applications</h1>
              <p className="text-hos-text-secondary mt-1">Manage seller applications and invitations</p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors"
            >
              + Invite Seller
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Total Invitations</h3>
              <p className="text-2xl font-bold text-hos-text-secondary mt-1">{stats.total}</p>
            </div>
            <button
              onClick={() => setStatusFilter(statusFilter === 'PENDING' ? '' : 'PENDING')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left transition-colors ${
                statusFilter === 'PENDING' ? 'ring-2 ring-hos-gold/50' : ''
              }`}
            >
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Pending</h3>
              <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.pending}</p>
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'ACCEPTED' ? '' : 'ACCEPTED')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left transition-colors ${
                statusFilter === 'ACCEPTED' ? 'ring-2 ring-hos-gold/50' : ''
              }`}
            >
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Accepted</h3>
              <p className="text-2xl font-bold text-green-400 mt-1">{stats.accepted}</p>
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'EXPIRED' ? '' : 'EXPIRED')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left transition-colors ${
                statusFilter === 'EXPIRED' ? 'ring-2 ring-hos-gold/50' : ''
              }`}
            >
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Expired</h3>
              <p className="text-2xl font-bold text-hos-text-secondary mt-1">{stats.expired}</p>
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-300">Error: {error}</p>
              <button
                onClick={fetchInvitations}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && (
            <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-hos-border flex items-center justify-between">
                <h2 className="text-lg font-semibold text-hos-text-secondary">
                  {statusFilter ? `${statusFilter} Invitations` : 'All Invitations'}
                </h2>
                {statusFilter && (
                  <button
                    onClick={() => setStatusFilter('')}
                    className="text-sm text-hos-gold hover:underline"
                  >
                    Clear filter
                  </button>
                )}
              </div>
              
              {invitations.length === 0 ? (
                <div className="px-6 py-12 text-center text-hos-text-muted">
                  <span className="text-5xl block mb-4">📧</span>
                  <p className="text-lg">No invitations found</p>
                  <p className="text-sm mt-2">Click &ldquo;Invite Seller&rdquo; to send a new invitation</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-hos-border">
                    <thead className="bg-hos-bg-secondary">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                          Sent
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                          Expires
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                      {invitations.map((invitation) => (
                        <tr key={invitation.id} className="hover:bg-hos-bg-tertiary">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-hos-text-secondary">{invitation.email}</div>
                            {invitation.invitedBy && (
                              <div className="text-xs text-hos-text-muted">
                                Invited by: {invitation.invitedBy.firstName || invitation.invitedBy.email}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              invitation.sellerType === 'WHOLESALER'
                                ? 'bg-hos-gold/20 text-hos-gold'
                                : 'bg-hos-gold/20 text-hos-gold'
                            }`}>
                              {invitation.sellerType.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invitation.status)}`}>
                              {invitation.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                            {new Date(invitation.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                            {new Date(invitation.expiresAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {invitation.status === 'PENDING' && (
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleResendInvitation(invitation.id)}
                                  className="text-hos-gold hover:text-hos-gold"
                                >
                                  Resend
                                </button>
                                <button
                                  onClick={() => handleCancelInvitation(invitation.id)}
                                  className="text-red-400 hover:text-red-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                            {invitation.status === 'EXPIRED' && (
                              <button
                                onClick={() => handleResendInvitation(invitation.id)}
                                className="text-hos-gold hover:text-hos-gold"
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
              <div className="bg-hos-bg-secondary rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-hos-text-secondary">Invite Seller</h3>
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="text-hos-text-muted hover:text-hos-text-secondary"
                  >
                    ✕
                  </button>
                </div>
                <form onSubmit={handleInviteSeller} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-transparent"
                      placeholder="seller@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Seller Type *
                    </label>
                    <select
                      value={inviteForm.sellerType}
                      onChange={(e) => setInviteForm({ ...inviteForm, sellerType: e.target.value as any })}
                      className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-transparent"
                    >
                      <option value="B2C_SELLER">B2C Seller</option>
                      <option value="WHOLESALER">Wholesaler</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Message (optional)
                    </label>
                    <textarea
                      value={inviteForm.message}
                      onChange={(e) => setInviteForm({ ...inviteForm, message: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-transparent"
                      placeholder="Welcome message for the seller..."
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(false)}
                      className="flex-1 px-4 py-2 border border-hos-border text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50"
                    >
                      {submitting ? 'Sending...' : 'Send Invitation'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
          </RouteGuard>
  );
}
