'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { AdminLayout } from '@/components/AdminLayout';
import { RouteGuard } from '@/components/RouteGuard';

const api = apiClient as any;

interface Invitation {
  id: string;
  email: string;
  status: string;
  baseCommissionRate?: number;
  message?: string;
  expiresAt: string;
  createdAt: string;
  user: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

export default function AdminInfluencerInvitationsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    message: '',
    baseCommissionRate: '',
  });
  const [statusFilter, setStatusFilter] = useState('');

  const fetchInvitations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getInfluencerInvitations({
        status: statusFilter || undefined,
        limit: 100,
      });
      setInvitations(response.data || []);
    } catch (err: any) {
      console.error('Error fetching invitations:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email) {
      toast.error('Email is required');
      return;
    }

    try {
      setSending(true);
      await api.createInfluencerInvitation({
        email: inviteForm.email,
        message: inviteForm.message || undefined,
        baseCommissionRate: inviteForm.baseCommissionRate
          ? parseFloat(inviteForm.baseCommissionRate) / 100
          : undefined,
      });
      toast.success('Invitation sent successfully');
      setShowInviteModal(false);
      setInviteForm({ email: '', message: '', baseCommissionRate: '' });
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;

    try {
      await api.cancelInfluencerInvitation(id);
      toast.success('Invitation cancelled');
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel invitation');
    }
  };

  const handleResend = async (id: string) => {
    try {
      await api.resendInfluencerInvitation(id);
      toast.success('Invitation resent');
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend invitation');
    }
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
      PENDING: 'bg-yellow-100 text-yellow-800',
      ACCEPTED: 'bg-green-100 text-green-800',
      EXPIRED: 'bg-hos-bg-tertiary text-white',
      CANCELLED: 'bg-red-100 text-red-800',
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
            <h1 className="text-2xl font-bold text-white">Influencer Invitations</h1>
            <p className="text-hos-text-secondary mt-1">
              Invite new influencers to join the program
            </p>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Send Invitation
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
            <option value="PENDING">Pending</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Invitations Table */}
        <div className="bg-hos-bg-secondary rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold mx-auto"></div>
            </div>
          ) : invitations.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 text-hos-text-muted mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-hos-text-muted">No invitations found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-hos-bg-secondary">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Invited By</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Commission</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Expires</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hos-border">
                  {invitations.map((invitation) => (
                    <tr key={invitation.id} className="hover:bg-hos-bg-tertiary">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="font-medium text-white">{invitation.email}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                        {invitation.user.firstName} {invitation.user.lastName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                        {invitation.baseCommissionRate
                          ? `${(invitation.baseCommissionRate * 100).toFixed(0)}%`
                          : 'Default'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(invitation.status)}`}>
                          {invitation.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                        {formatDate(invitation.expiresAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {invitation.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleResend(invitation.id)}
                              className="text-hos-gold hover:text-hos-gold-hover text-sm font-medium"
                            >
                              Resend
                            </button>
                            <button
                              onClick={() => handleCancel(invitation.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-hos-bg-secondary rounded-xl max-w-md w-full">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">Invite Influencer</h2>
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="text-hos-text-muted hover:text-hos-text-secondary"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <form onSubmit={handleSendInvitation} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
                    placeholder="influencer@example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                    Base Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    step="1"
                    value={inviteForm.baseCommissionRate}
                    onChange={(e) => setInviteForm({ ...inviteForm, baseCommissionRate: e.target.value })}
                    className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
                    placeholder="10 (default)"
                  />
                  <p className="text-xs text-hos-text-muted mt-1">Leave empty for default rate (10%)</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                    Personal Message
                  </label>
                  <textarea
                    value={inviteForm.message}
                    onChange={(e) => setInviteForm({ ...inviteForm, message: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
                    placeholder="Optional message to include in the invitation email..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 text-hos-text-secondary hover:bg-hos-bg-tertiary rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 transition-colors"
                  >
                    {sending ? 'Sending...' : 'Send Invitation'}
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
