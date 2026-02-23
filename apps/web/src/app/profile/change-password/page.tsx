'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';

export default function ChangePasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (formData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    try {
      setLoading(true);
      await apiClient.changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
      toast.success('Password changed successfully');
      router.push('/profile?tab=settings');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['CUSTOMER', 'SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN', 'PROCUREMENT', 'FULFILLMENT', 'CATALOG', 'MARKETING', 'FINANCE', 'CMS_EDITOR', 'INFLUENCER']}>
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="max-w-md mx-auto">
            <Link href="/profile?tab=settings" className="text-purple-600 hover:text-purple-800 mb-4 inline-block">
              ← Back to Profile
            </Link>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h1 className="text-2xl font-bold mb-6">Change Password</h1>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <input
                    type="password"
                    value={formData.currentPassword}
                    onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input
                    type="password"
                    value={formData.newPassword}
                    onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                    required
                    minLength={8}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter new password (min 8 characters)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    minLength={8}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Confirm new password"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
                  >
                    {loading ? 'Changing...' : 'Change Password'}
                  </button>
                  <Link
                    href="/profile?tab=settings"
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
