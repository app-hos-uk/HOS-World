'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

const EVENT_OPTIONS = [
  'order.created',
  'order.updated',
  'order.cancelled',
  'order.fulfilled',
  'product.created',
  'product.updated',
  'product.published',
  'product.deleted',
  'submission.created',
  'submission.approved',
  'submission.rejected',
  'payment.completed',
  'payment.failed',
  'refund.created',
  'seller.registered',
  'seller.approved',
  'inventory.low',
  'inventory.updated',
];

export default function WebhooksPage() {
  const toast = useToast();
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedDelivery, setExpandedDelivery] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, any[]>>({});
  const [loadingDeliveries, setLoadingDeliveries] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    url: '',
    events: [] as string[],
    secret: '',
    isActive: true,
  });

  const fetchWebhooks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getWebhooks();
      setWebhooks(Array.isArray(response?.data) ? response.data : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const resetForm = () => {
    setFormData({ url: '', events: [], secret: '', isActive: true });
    setShowCreate(false);
    setEditingId(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.url.trim() || formData.events.length === 0) {
      toast.error('URL and at least one event are required');
      return;
    }
    try {
      setCreating(true);
      await apiClient.createWebhook({
        url: formData.url.trim(),
        events: formData.events,
        secret: formData.secret.trim() || undefined,
        isActive: formData.isActive,
      });
      toast.success('Webhook created successfully');
      resetForm();
      fetchWebhooks();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create webhook');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      setSaving(true);
      await apiClient.updateWebhook(editingId, {
        url: formData.url.trim(),
        events: formData.events,
        secret: formData.secret.trim() || undefined,
        isActive: formData.isActive,
      });
      toast.success('Webhook updated');
      resetForm();
      fetchWebhooks();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update webhook');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;
    try {
      await apiClient.deleteWebhook(id);
      toast.success('Webhook deleted');
      fetchWebhooks();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete webhook');
    }
  };

  const handleToggleActive = async (webhook: any) => {
    try {
      await apiClient.updateWebhook(webhook.id, { isActive: !webhook.isActive });
      toast.success(webhook.isActive ? 'Webhook paused' : 'Webhook activated');
      fetchWebhooks();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update webhook');
    }
  };

  const handleEditClick = (webhook: any) => {
    setFormData({
      url: webhook.url || '',
      events: webhook.events || [],
      secret: '',
      isActive: webhook.isActive ?? true,
    });
    setEditingId(webhook.id);
    setShowCreate(false);
  };

  const refreshDeliveries = async (webhookId: string) => {
    try {
      setLoadingDeliveries(webhookId);
      const res = await apiClient.getWebhookDeliveries(webhookId, 20);
      setDeliveries((prev) => ({ ...prev, [webhookId]: Array.isArray(res?.data) ? res.data : [] }));
      setExpandedDelivery(webhookId);
    } catch (err: any) {
      toast.error('Failed to load delivery history');
    } finally {
      setLoadingDeliveries(null);
    }
  };

  const loadDeliveries = async (webhookId: string) => {
    if (expandedDelivery === webhookId) {
      setExpandedDelivery(null);
      return;
    }
    await refreshDeliveries(webhookId);
  };

  const handleRetryDelivery = async (deliveryId: string, webhookId: string) => {
    try {
      await apiClient.retryWebhookDelivery(deliveryId);
      toast.success('Delivery retried');
      await refreshDeliveries(webhookId);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to retry delivery');
    }
  };

  const toggleEvent = (event: string) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const webhookForm = (
    onSubmit: (e: React.FormEvent) => void,
    submitLabel: string,
    isSubmitting: boolean,
  ) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Endpoint URL <span className="text-red-500">*</span>
        </label>
        <input
          type="url"
          required
          value={formData.url}
          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          placeholder="https://example.com/webhook"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Secret <span className="text-gray-400">(optional)</span>
        </label>
        <input
          type="text"
          value={formData.secret}
          onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          placeholder="Signing secret for payload verification"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Events <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
          {EVENT_OPTIONS.map((event) => (
            <label key={event} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={formData.events.includes(event)}
                onChange={() => toggleEvent(event)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="truncate">{event}</span>
            </label>
          ))}
        </div>
        {formData.events.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">{formData.events.length} event(s) selected</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="webhook-active"
          checked={formData.isActive}
          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
        />
        <label htmlFor="webhook-active" className="text-sm font-medium text-gray-700">Active</label>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium text-sm"
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
        <button
          type="button"
          onClick={resetForm}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
      <AdminLayout>
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Webhooks</h1>
            <p className="text-gray-600 mt-1">
              Manage webhook subscriptions and monitor delivery history
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchWebhooks}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            {!showCreate && !editingId && (
              <button
                onClick={() => {
                  resetForm();
                  setShowCreate(true);
                }}
                className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                + Create Webhook
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Create Webhook</h2>
            {webhookForm(handleCreate, 'Create Webhook', creating)}
          </div>
        )}

        {/* Edit form */}
        {editingId && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Edit Webhook</h2>
            {webhookForm(handleUpdate, 'Save Changes', saving)}
          </div>
        )}

        {/* Webhooks list */}
        {!loading && !error && (
          <div className="space-y-4">
            {webhooks.length === 0 && !showCreate ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <div className="text-4xl mb-3">🔗</div>
                <p className="text-gray-500 text-lg font-medium">No webhooks configured</p>
                <p className="text-sm text-gray-400 mt-1">
                  Create a webhook to receive real-time notifications about marketplace events.
                </p>
                <button
                  onClick={() => {
                    resetForm();
                    setShowCreate(true);
                  }}
                  className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                >
                  + Create Your First Webhook
                </button>
              </div>
            ) : (
              webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
                >
                  <div className="p-4 flex items-start gap-3">
                    <div
                      className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 ${
                        webhook.isActive ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate font-mono text-sm">
                        {webhook.url}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(webhook.events || []).slice(0, 5).map((event: string) => (
                          <span
                            key={event}
                            className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                          >
                            {event}
                          </span>
                        ))}
                        {(webhook.events || []).length > 5 && (
                          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                            +{webhook.events.length - 5} more
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Created: {webhook.createdAt ? new Date(webhook.createdAt).toLocaleString() : 'N/A'}
                        {webhook.sellerId && ` | Seller: ${webhook.sellerId.slice(0, 8)}...`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleToggleActive(webhook)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg ${
                          webhook.isActive
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {webhook.isActive ? 'Active' : 'Paused'}
                      </button>
                      <button
                        onClick={() => loadDeliveries(webhook.id)}
                        disabled={loadingDeliveries === webhook.id}
                        className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                      >
                        {loadingDeliveries === webhook.id ? '...' : 'Deliveries'}
                      </button>
                      <button
                        onClick={() => handleEditClick(webhook)}
                        className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(webhook.id)}
                        className="px-3 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Delivery history */}
                  {expandedDelivery === webhook.id && (
                    <div className="border-t border-gray-200 bg-gray-50 p-4">
                      <h3 className="text-sm font-semibold mb-3">Delivery History</h3>
                      {(deliveries[webhook.id] || []).length === 0 ? (
                        <p className="text-sm text-gray-500">No deliveries recorded.</p>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {(deliveries[webhook.id] || []).map((delivery: any) => (
                            <div
                              key={delivery.id}
                              className="bg-white border border-gray-200 rounded-lg p-3 flex items-start justify-between"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      delivery.status === 'SUCCESS'
                                        ? 'bg-green-500'
                                        : delivery.status === 'FAILED'
                                          ? 'bg-red-500'
                                          : 'bg-yellow-500'
                                    }`}
                                  />
                                  <span className="text-sm font-medium">
                                    {delivery.event || 'Unknown event'}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    {delivery.statusCode ? `HTTP ${delivery.statusCode}` : ''}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  {delivery.createdAt
                                    ? new Date(delivery.createdAt).toLocaleString()
                                    : 'N/A'}
                                  {delivery.duration ? ` | ${delivery.duration}ms` : ''}
                                </p>
                              </div>
                              {delivery.status === 'FAILED' && (
                                <button
                                  onClick={() => handleRetryDelivery(delivery.id, webhook.id)}
                                  className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                                >
                                  Retry
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </AdminLayout>
    </RouteGuard>
  );
}
