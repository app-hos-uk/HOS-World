'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

interface Notification {
  id: string;
  type: string;
  subject: string | null;
  content: string;
  readAt: string | null;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await apiClient.getNotifications({ limit: 5 });
      if (response?.data) {
        const items = Array.isArray(response.data) ? response.data : [];
        setNotifications(items);
        setUnreadCount(items.filter((n: Notification) => !n.readAt).length);
      }
    } catch {
      // Silently fail for bell polling
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-purple-700 hover:text-amber-600 transition-colors duration-300 rounded-lg hover:bg-purple-50"
        aria-label="Notifications"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-purple-50">
            <h3 className="text-sm font-semibold text-purple-800">Notifications</h3>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    !notification.readAt ? 'bg-purple-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!notification.readAt && (
                      <span className="mt-1.5 w-2 h-2 bg-purple-600 rounded-full flex-shrink-0" />
                    )}
                    <div className={`flex-1 ${notification.readAt ? 'ml-4' : ''}`}>
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">
                        {notification.subject || notification.type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {timeAgo(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="block text-center text-sm font-medium text-purple-700 hover:text-purple-900 transition-colors"
            >
              View All Notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
