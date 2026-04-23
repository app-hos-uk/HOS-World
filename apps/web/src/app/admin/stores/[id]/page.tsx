'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

type StepRow = { key: string; label: string; completedAt: string | null };

export default function AdminStoreDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const toast = useToast();
  const [row, setRow] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    apiClient
      .adminGetStore(id)
      .then((r) => setRow((r.data as Record<string, unknown>) || null))
      .catch((e: Error) => toast.error(e.message));
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const checklist = row?.onboardingChecklist as Record<string, unknown> | undefined;
  const steps = (checklist?.steps as StepRow[]) ?? [];

  const completeStep = async (key: string) => {
    try {
      await apiClient.adminCompleteOnboardingStep(id, key);
      toast.success('Step saved');
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const finishOnboarding = async () => {
    try {
      await apiClient.adminCompleteOnboarding(id);
      toast.success('Onboarding completed');
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const activate = async () => {
    try {
      await apiClient.adminActivateStore(id);
      toast.success('Store activated');
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-3xl mx-auto space-y-6">
          <Link href="/admin/stores" className="text-sm text-violet-700">
            ← Stores
          </Link>
          {row ? (
            <>
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">{String(row.name)}</h1>
                  <p className="text-sm text-gray-500">
                    {String(row.code)} · {String(row.defaultRegionCode)} · active:{' '}
                    {String(row.isActive)}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-sm rounded-md bg-emerald-600 px-3 py-2 text-white"
                  onClick={activate}
                >
                  Activate (requires completed onboarding)
                </button>
              </div>
              <div>
                <h2 className="text-lg font-medium mb-2">Onboarding</h2>
                <p className="text-xs text-gray-500 mb-2">Status: {String(checklist?.status ?? '—')}</p>
                <ul className="space-y-2 text-sm">
                  {steps.map((s) => (
                    <li
                      key={s.key}
                      className="flex justify-between items-center border rounded p-2 bg-white"
                    >
                      <span>
                        {s.label}
                        {s.completedAt ? (
                          <span className="text-emerald-600 text-xs ml-2">done</span>
                        ) : null}
                      </span>
                      {!s.completedAt && (
                        <button
                          type="button"
                          className="text-xs text-violet-700"
                          onClick={() => completeStep(s.key)}
                        >
                          Mark done
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="mt-3 text-sm px-3 py-1 rounded bg-gray-900 text-white"
                  onClick={finishOnboarding}
                >
                  Complete onboarding (all steps must be done)
                </button>
              </div>
            </>
          ) : (
            <p className="text-gray-500">Loading…</p>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
