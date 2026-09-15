'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

interface FeatureFlagBannerProps {
  /** The feature flag key, e.g. "LOYALTY_PROGRAMME" */
  flag: string;
  /** Label shown when enabled, e.g. "Loyalty Programme Enabled" */
  enabledLabel: string;
  /** Label shown when disabled */
  disabledLabel: string;
  /** Description shown when enabled */
  enabledDescription?: string;
  /** Description shown when disabled */
  disabledDescription?: string;
  /** Called after a successful toggle with the new value */
  onToggle?: (enabled: boolean) => void;
}

export function FeatureFlagBanner({
  flag,
  enabledLabel,
  disabledLabel,
  enabledDescription,
  disabledDescription,
  onToggle,
}: FeatureFlagBannerProps) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFlag = useCallback(async () => {
    try {
      const res = await apiClient.getFeatureFlags();
      const flags = res.data as Record<string, boolean> | undefined;
      if (flags && typeof flags[flag] === 'boolean') {
        setEnabled(flags[flag]);
      }
    } catch {
      // Silently fail — banner simply won't render
    }
  }, [flag]);

  useEffect(() => {
    fetchFlag();
  }, [fetchFlag]);

  const handleToggle = async () => {
    if (enabled === null) return;
    setToggling(true);
    setError(null);
    try {
      await apiClient.setFeatureFlag(flag, !enabled);
      const next = !enabled;
      setEnabled(next);
      onToggle?.(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update feature flag');
    } finally {
      setToggling(false);
    }
  };

  if (enabled === null) return null;

  return (
    <div className="space-y-2">
      <div
        className={`flex items-center justify-between rounded-xl border p-4 ${
          enabled
            ? 'border-green-500/30 bg-green-500/5'
            : 'border-red-500/30 bg-red-500/5'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${
              enabled ? 'bg-green-400' : 'bg-red-400'
            }`}
          />
          <div>
            <span
              className={`text-sm font-medium ${
                enabled ? 'text-green-300' : 'text-red-300'
              }`}
            >
              {enabled ? enabledLabel : disabledLabel}
            </span>
            {(enabled ? enabledDescription : disabledDescription) && (
              <p className="text-xs text-hos-text-muted mt-0.5">
                {enabled ? enabledDescription : disabledDescription}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-hos-gold/50 focus:ring-offset-2 focus:ring-offset-hos-bg-secondary disabled:opacity-50 ${
            enabled ? 'bg-green-500' : 'bg-hos-border'
          }`}
          role="switch"
          aria-checked={enabled}
          aria-label={`Toggle ${flag}`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      {error && (
        <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
