'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface EmailHealth {
  configured?: boolean;
  enabled?: boolean;
  provider?: string;
}

interface TestResult {
  success: boolean;
  provider: string;
  to: string;
  from?: string;
  messageId?: string;
  error?: string;
}

interface EmailTestPanelProps {
  /** Show link to integrations page for SendGrid setup */
  showIntegrationsLink?: boolean;
  className?: string;
}

export function EmailTestPanel({ showIntegrationsLink = false, className = '' }: EmailTestPanelProps) {
  const toast = useToast();
  const [health, setHealth] = useState<EmailHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<TestResult | null>(null);

  const loadHealth = useCallback(async () => {
    try {
      setHealthLoading(true);
      const res = await apiClient.getNotificationChannelHealth();
      setHealth(res?.data?.email ?? null);
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const handleSendTest = async () => {
    const to = testEmail.trim();
    if (!to) {
      toast.error('Enter a recipient email address');
      return;
    }

    setSending(true);
    setLastResult(null);
    try {
      const res = await apiClient.sendTestEmail(to);
      const result = res?.data as TestResult | undefined;
      if (result) {
        setLastResult(result);
      }
      if (result?.success) {
        toast.success(`Test email sent to ${to} via ${result.provider}`);
        loadHealth();
      } else {
        toast.error(result?.error || res?.message || 'Failed to send test email');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send test email';
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const providerLabel =
    health?.provider === 'sendgrid'
      ? 'SendGrid'
      : health?.provider === 'smtp'
        ? 'SMTP'
        : health?.configured
          ? 'Email'
          : 'Not configured';

  return (
    <div
      className={`rounded-lg border border-hos-border bg-hos-bg-secondary p-5 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-hos-text-primary">Send test email</h3>
          <p className="text-sm text-hos-text-secondary mt-1">
            Verify outbound mail using your active email provider (SendGrid integration or SMTP).
          </p>
        </div>
        {healthLoading ? (
          <span className="text-xs text-hos-text-muted">Checking status…</span>
        ) : (
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              health?.enabled
                ? 'bg-green-500/15 text-green-300'
                : 'bg-red-500/15 text-red-300'
            }`}
          >
            {health?.enabled ? `${providerLabel} ready` : 'Email not configured'}
          </span>
        )}
      </div>

      {showIntegrationsLink && !health?.enabled && (
        <p className="text-sm text-hos-text-secondary mb-4">
          Activate SendGrid under{' '}
          <Link href="/admin/settings/integrations" className="text-hos-gold hover:text-hos-gold-hover">
            Settings → Integrations
          </Link>
          , or configure SMTP environment variables on the API service.
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="Recipient e.g. arun@houseofspells.com"
          className="flex-1 px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-primary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold focus:ring-2 focus:ring-hos-gold/50"
          disabled={sending}
        />
        <button
          type="button"
          onClick={handleSendTest}
          disabled={sending || healthLoading}
          className="px-5 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover font-medium disabled:opacity-50 shrink-0"
        >
          {sending ? 'Sending…' : 'Send test email'}
        </button>
      </div>

      {lastResult && (
        <div
          className={`mt-4 rounded-lg p-3 text-sm ${
            lastResult.success
              ? 'bg-green-500/10 border border-green-500/30 text-green-200'
              : 'bg-red-500/10 border border-red-500/30 text-red-200'
          }`}
        >
          <p className="font-medium">
            {lastResult.success ? 'Email sent successfully' : 'Send failed'}
          </p>
          <ul className="mt-2 space-y-1 text-hos-text-secondary">
            <li>Provider: {lastResult.provider}</li>
            <li>To: {lastResult.to}</li>
            {lastResult.from && <li>From: {lastResult.from}</li>}
            {lastResult.messageId && <li>Message ID: {lastResult.messageId}</li>}
            {lastResult.error && <li className="text-red-300">Error: {lastResult.error}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
