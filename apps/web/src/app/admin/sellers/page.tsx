'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminSellersPage() {
  const toast = useToast();
  const [sellers, setSellers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    sellerType: 'B2C_SELLER' as 'WHOLESALER' | 'B2C_SELLER',
    message: '',
  });

  useEffect(() => {
    fetchSellers();
    fetchInvitations();
  }, []);

  const fetchSellers = async () => {
    try {
      setLoading(true);
      setError(null);
      // Get users with seller roles
      const response = await apiClient.getUsers();
      if (response?.data && Array.isArray(response.data)) {
        const sellerRoles = ['SELLER', 'B2C_SELLER', 'WHOLESALER'];
        const sellerUsers = response.data.filter((user: any) => 
          sellerRoles.includes(user.role)
        );
        setSellers(sellerUsers);
      } else {
        setSellers([]);
      }
    } catch (err: any) {
      console.error('Error fetching sellers:', err);
      setError(err.message || 'Failed to load sellers');
      setSellers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const response = await apiClient.getSellerInvitations();
      if (response?.data) {
        setInvitations(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching invitations:', err);
    }
  };

  const handleInviteSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.inviteSeller(inviteForm);
      toast.success('Seller invitation sent successfully');
      setShowInviteForm(false);
      setInviteForm({ email: '', sellerType: 'B2C_SELLER', message: '' });
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invitation');
    }
  };

  const handleResendInvitation = async (id: string) => {
    try {
      await apiClient.resendSellerInvitation(id);
      toast.success('Invitation resent successfully');
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend invitation');
    }
  };

  const handleCancelInvitation = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;
    try {
      await apiClient.cancelSellerInvitation(id);
      toast.success('Invitation cancelled successfully');
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel invitation');
    }
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['ADMIN']}>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading sellers...</div>
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  if (error) {
    return (
      <RouteGuard allowedRoles={['ADMIN']}>
        <AdminLayout>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Error: {error}</p>
            <button
              onClick={fetchSellers}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">All Sellers</h1>
            <button
              onClick={() => setShowInviteForm(!showInviteForm)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              {showInviteForm ? 'Cancel' : '+ Invite Seller'}
            </button>
          </div>

          {showInviteForm && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Invite New Seller</h2>
              <form onSubmit={handleInviteSeller} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="seller@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Seller Type
                  </label>
                  <select
                    value={inviteForm.sellerType}
                    onChange={(e) => setInviteForm({ ...inviteForm, sellerType: e.target.value as 'WHOLESALER' | 'B2C_SELLER' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="B2C_SELLER">B2C Seller</option>
                    <option value="WHOLESALER">Wholesaler</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Optional Message
                  </label>
                  <textarea
                    value={inviteForm.message}
                    onChange={(e) => setInviteForm({ ...inviteForm, message: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={3}
                    placeholder="Welcome message (optional)"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Send Invitation
                </button>
              </form>
            </div>
          )}

          {invitations.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <h2 className="text-lg font-semibold p-4 border-b">Pending Invitations</h2>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{inv.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{inv.sellerType}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          inv.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          inv.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {inv.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleResendInvitation(inv.id)}
                              className="text-blue-600 hover:text-blue-800 mr-3"
                            >
                              Resend
                            </button>
                            <button
                              onClick={() => handleCancelInvitation(inv.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <h2 className="text-lg font-semibold p-4 border-b">Active Sellers</h2>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sellers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                      No sellers found
                    </td>
                  </tr>
                ) : (
                  sellers.map((seller) => (
                    <tr key={seller.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {seller.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                          {seller.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {seller.createdAt
                          ? new Date(seller.createdAt).toLocaleDateString()
                          : 'N/A'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}

