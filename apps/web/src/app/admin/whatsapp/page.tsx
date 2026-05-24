'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminWhatsAppPage() {
  const toast = useToast();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getWhatsAppConversations();
      let conversationData: any[] = [];
      if (response && 'data' in response) {
        const responseData = response.data as any;
        if (Array.isArray(responseData)) {
          conversationData = responseData;
        } else if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray(responseData.data)) {
          conversationData = responseData.data;
        }
      }
      setConversations(conversationData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load conversations');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-white">WhatsApp Conversations</h1>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-hos-text-muted">Loading conversations...</div>
            </div>
          ) : (
            <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-hos-border">
                <thead className="bg-hos-bg-secondary">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Phone Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Last Message</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Created</th>
                  </tr>
                </thead>
                <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                  {conversations.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-hos-text-muted">No conversations found</td>
                    </tr>
                  ) : (
                    conversations.map((conv) => (
                      <tr key={conv.id} className="hover:bg-hos-bg-tertiary">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{conv.phoneNumber}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            conv.status === 'ACTIVE' ? 'bg-green-500/15 text-green-300' :
                            conv.status === 'ARCHIVED' ? 'bg-hos-bg-tertiary text-white' :
                            'bg-red-500/15 text-red-300'
                          }`}>
                            {conv.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                          {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleString() : 'No messages'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                          {new Date(conv.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}

