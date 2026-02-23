'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface Notification {
  id: string;
  type: string;
  subject: string | null;
  content: string;
  email: string | null;
  status: string;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

type TabFilter = 'all' | 'unread';

const NOTIFICATION_ICONS: Record<string, string> = {
  ORDER_CONFIRMATION: '📦',
  ORDER_SHIPPED: '🚚',
  ORDER_DELIVERED: '✅',
  ORDER_CANCELLED: '❌',
  PAYMENT_RECEIVED: '💳',
  PAYMENT_FAILED: '⚠️',
  RETURN_REQUESTED: '🔄',
  RETURN_APPROVED: '✔️',
  REVIEW_REMINDER: '⭐',
  WISHLIST_SALE: '❤️',
  SUBMISSION_APPROVED: '👍',
  SUBMISSION_REJECTED: '👎',
  SUBMISSION_RESUBMITTED: '🔁',
  CATALOG_COMPLETED: '📚',
  MARKETING_COMPLETED: '📢',
  FINANCE_APPROVED: '💰',
  FINANCE_REJECTED: '🚫',
  PRODUCT_PUBLISHED: '🎉',
};

function getNotificationIcon(type: string): string {
  return NOTIFICATION_ICONS[type] || '🔔';
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const ALL_ROLES = [
  'CUSTOMER', 'SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN',
  'PROCUREMENT', 'FULFILLMENT', 'CATALOG', 'MARKETING', 'FINANCE',
  'CMS_EDITOR', 'INFLUENCER',
] as const;

export default function NotificationsPage() {
  const toast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getNotifications();
      if (response?.data) {
        setNotifications(Array.isArray(response.data) ? response.data : []);
      }
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
      setError(err.message || 'Failed to load notifications');
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const filteredNotifications = activeTab === 'unread'
    ? notifications.filter((n) => !n.readAt)
    : notifications;

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const handleMarkRead = async (id: string) => {
    try {
      setActionLoading(id);
      await apiClient.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n
        )
      );
      toast.success('Notification marked as read');
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark as read');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setActionLoading('all');
      await apiClient.markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
      toast.success('All notifications marked as read');
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark all as read');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setActionLoading(`delete-${id}`);
      await apiClient.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success('Notification deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete notification');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <RouteGuard allowedRoles={[...ALL_ROLES]} showAccessDenied={true}>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Notifications</h1>
              <p className="text-gray-600 mt-1">
                {unreadCount > 0
                  ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                  : 'All caught up!'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={actionLoading === 'all'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'all' ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                Mark All as Read
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 mb-6 bg-white rounded-lg shadow p-1 w-fit">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setActiveTab('unread')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'unread'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
            </div>
          ) : error ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-5xl mb-4">⚠️</div>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={fetchNotifications}
                className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                Try Again
              </button>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-5xl mb-4">🔔</div>
              <p className="text-gray-600">
                {activeTab === 'unread'
                  ? 'No unread notifications'
                  : 'No notifications yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`bg-white rounded-lg shadow overflow-hidden transition-all ${
                    !notification.readAt
                      ? 'border-l-4 border-l-purple-600'
                      : 'border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="p-4 sm:p-5 flex items-start gap-4">
                    {/* Icon */}
                    <div className="text-2xl flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3
                            className={`text-sm sm:text-base font-medium ${
                              !notification.readAt ? 'text-gray-900' : 'text-gray-600'
                            }`}
                          >
                            {notification.subject || notification.type.replace(/_/g, ' ')}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {notification.content}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            {formatTimestamp(notification.createdAt)}
                          </p>
                        </div>

                        {/* Unread dot (desktop) */}
                        {!notification.readAt && (
                          <span className="hidden sm:block w-2.5 h-2.5 bg-purple-600 rounded-full flex-shrink-0 mt-1.5" />
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3">
                        {!notification.readAt && (
                          <button
                            onClick={() => handleMarkRead(notification.id)}
                            disabled={actionLoading === notification.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {actionLoading === notification.id ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600" />
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                            Mark as Read
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notification.id)}
                          disabled={actionLoading === `delete-${notification.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoading === `delete-${notification.id}` ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600" />
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Results count */}
          {!loading && !error && notifications.length > 0 && (
            <div className="text-sm text-gray-500 text-center mt-6">
              Showing {filteredNotifications.length} of {notifications.length} notifications
            </div>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
