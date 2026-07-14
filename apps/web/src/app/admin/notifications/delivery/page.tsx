'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface ChannelHealth {
  email: { configured: boolean; enabled: boolean; provider?: string };
  queue: { available: boolean };
  sms: { configured: boolean };
  whatsapp: { configured: boolean };
}

interface FailedJob {
  id: string;
  type: string;
  channel: string;
  status: string;
  recipient?: string;
  error?: string;
  createdAt: string;
}

export default function AdminNotificationDeliveryPage() {
  const toast = useToast();
  const [health, setHealth] = useState<ChannelHealth | null>(null);
  const [failedJobs, setFailedJobs] = useState<FailedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [healthRes, failedRes] = await Promise.all([
        apiClient.getNotificationDeliveryStats(),
        apiClient.getFailedNotifications(1, 50),
      ]);
      setHealth(healthRes?.data || null);
      const failedData = failedRes?.data;
      setFailedJobs(failedData?.notifications || failedData?.items || (Array.isArray(failedData) ? failedData : []));
    } catch (err: any) {
      toast.error(err.message || 'Failed to load notification delivery data');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRetry = async (id: string) => {
    try {
      setRetryingId(id);
      await apiClient.retryFailedNotification(id);
      toast.success('Notification queued for retry');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Retry failed');
    } finally {
      setRetryingId(null);
    }
  };

  const statusDot = (ok: boolean) => (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? 'bg-green-400' : 'bg-red-400'}`} />
  );

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
              <div className="mb-6">
          <h1 className="text-2xl font-bold text-hos-text-secondary">Notification Delivery Dashboard</h1>
          <p className="text-hos-text-muted text-sm mt-1">Channel health and failed delivery queue</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-hos-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            {health && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-hos-bg-secondary border border-hos-border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    {statusDot(health.email.configured && health.email.enabled)}
                    <h2 className="font-semibold text-hos-text-secondary">Email</h2>
                  </div>
                  <p className="text-sm text-hos-text-muted">
                    {health.email.configured
                      ? `Provider: ${health.email.provider || 'configured'}`
                      : 'Not configured'}
                  </p>
                  <p className="text-xs text-hos-text-muted mt-1">
                    {health.email.enabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <div className="bg-hos-bg-secondary border border-hos-border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    {statusDot(health.queue.available)}
                    <h2 className="font-semibold text-hos-text-secondary">Queue</h2>
                  </div>
                  <p className="text-sm text-hos-text-muted">
                    {health.queue.available ? 'Job queue available' : 'Queue unavailable'}
                  </p>
                </div>
                <div className="bg-hos-bg-secondary border border-hos-border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    {statusDot(health.sms.configured)}
                    <h2 className="font-semibold text-hos-text-secondary">SMS</h2>
                  </div>
                  <p className="text-sm text-hos-text-muted">
                    {health.sms.configured ? 'Twilio configured' : 'Not configured'}
                  </p>
                </div>
                <div className="bg-hos-bg-secondary border border-hos-border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    {statusDot(health.whatsapp.configured)}
                    <h2 className="font-semibold text-hos-text-secondary">WhatsApp</h2>
                  </div>
                  <p className="text-sm text-hos-text-muted">
                    {health.whatsapp.configured ? 'Configured' : 'Not configured'}
                  </p>
                </div>
              </div>
            )}

            <div>
              <h2 className="text-xl font-semibold text-hos-text-secondary mb-4">
                Failed Deliveries
                {failedJobs.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-red-400">({failedJobs.length})</span>
                )}
              </h2>
              {failedJobs.length === 0 ? (
                <div className="text-center py-12 bg-hos-bg-secondary border border-hos-border rounded-xl">
                  <p className="text-hos-text-muted">No failed notification jobs.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-hos-border text-hos-text-muted text-left">
                        <th className="py-3 px-4 font-medium">Type</th>
                        <th className="py-3 px-4 font-medium">Channel</th>
                        <th className="py-3 px-4 font-medium">Recipient</th>
                        <th className="py-3 px-4 font-medium">Error</th>
                        <th className="py-3 px-4 font-medium">Date</th>
                        <th className="py-3 px-4 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {failedJobs.map((job) => (
                        <tr key={job.id} className="border-b border-hos-border/50">
                          <td className="py-3 px-4 text-hos-text-secondary">{job.type}</td>
                          <td className="py-3 px-4">{job.channel}</td>
                          <td className="py-3 px-4 text-hos-text-muted text-xs">{job.recipient || '—'}</td>
                          <td className="py-3 px-4 text-red-400 text-xs max-w-xs truncate">{job.error || '—'}</td>
                          <td className="py-3 px-4 text-hos-text-muted text-xs">
                            {new Date(job.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => handleRetry(job.id)}
                              disabled={retryingId === job.id}
                              className="px-3 py-1 bg-hos-gold/20 text-hos-gold rounded text-xs hover:bg-hos-gold/30 disabled:opacity-50"
                            >
                              {retryingId === job.id ? 'Retrying…' : 'Retry'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
          </RouteGuard>
  );
}
