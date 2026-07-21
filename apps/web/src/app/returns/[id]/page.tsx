'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';

import type { UserRole } from '@hos-marketplace/shared-types';

const RETURN_ROLES: UserRole[] = ['CUSTOMER', 'ADMIN', 'FINANCE', 'SELLER', 'B2C_SELLER', 'WHOLESALER'];

function resolveBackHref(from: string | null): string {
  switch (from) {
    case 'seller':
      return '/seller/returns';
    case 'admin':
      return '/admin/returns';
    default:
      return '/returns';
  }
}

export default function ReturnDetailPage() {
  return (
    <Suspense>
      <ReturnDetailContent />
    </Suspense>
  );
}

function ReturnDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { formatPrice } = useCurrency();
  const toast = useToast();
  const id = params?.id as string;
  const backHref = resolveBackHref(searchParams.get('from'));
  const [returnRequest, setReturnRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchReturn = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getReturn(id);
        if (response?.data) {
          setReturnRequest(response.data);
        } else {
          setError('Return request not found');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load return request');
      } finally {
        setLoading(false);
      }
    };
    fetchReturn();
  }, [id]);

  const handleCancelReturn = async () => {
    if (!confirm('Are you sure you want to cancel this return request?')) return;
    try {
      setCancelLoading(true);
      await apiClient.cancelReturn(id);
      toast.success('Return request cancelled');
      router.push(backHref);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel return request');
    } finally {
      setCancelLoading(false);
    }
  };


  const shell = (children: ReactNode) => (
    <RouteGuard allowedRoles={RETURN_ROLES}>
      <div className="min-h-screen bg-hos-bg-secondary">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          {children}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );

  if (loading) {
    return shell(
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold" />
      </div>,
    );
  }

  if (error || !returnRequest) {
    return shell(
      <div className="max-w-md mx-auto text-center">
        <p className="text-hos-text-secondary mb-4">{error || 'Return request not found'}</p>
        <Link href={backHref} className="text-hos-gold hover:text-hos-gold-hover font-medium">
          ← Back to Returns
        </Link>
      </div>,
    );
  }

  const currency = returnRequest.order?.currency || 'USD';

  return shell(
    <div className="max-w-2xl mx-auto">
      <Link href={backHref} className="text-hos-gold hover:text-hos-gold-hover mb-4 inline-block">
        ← Back to Returns
      </Link>
      <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Return Request Details</h1>
          {returnRequest.order?.orderNumber && (
            <p className="text-sm text-hos-text-muted mt-1">
              Order #{returnRequest.order.orderNumber}
            </p>
          )}
        </div>

        {returnRequest.timeline && returnRequest.timeline.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-hos-text-muted uppercase tracking-wide mb-3">
              Refund tracking
            </h2>
            <ol className="space-y-3">
              {returnRequest.timeline.map((step: any, idx: number) => (
                <li key={step.step} className="flex gap-3">
                  <div
                    className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${
                      step.completed
                        ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                        : 'bg-hos-bg-tertiary text-hos-text-muted border border-hos-border'
                    }`}
                  >
                    {step.completed ? '✓' : idx + 1}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${step.completed ? 'text-hos-text-secondary' : 'text-hos-text-muted'}`}>
                      {step.label}
                    </p>
                    {step.at && (
                      <p className="text-xs text-hos-text-muted">
                        {new Date(step.at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-hos-text-muted">Status</dt>
            <dd className="mt-1">
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-hos-bg-tertiary text-hos-text-secondary capitalize">
                {returnRequest.status || 'N/A'}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-hos-text-muted">Reason</dt>
            <dd className="mt-1 text-hos-text-secondary">{returnRequest.reason || 'N/A'}</dd>
          </div>
          {returnRequest.items?.length > 0 && (
            <div>
              <dt className="text-sm font-medium text-hos-text-muted">Items</dt>
              <dd className="mt-1 space-y-1">
                {returnRequest.items.map((item: any) => (
                  <p key={item.id} className="text-sm text-hos-text-secondary">
                    {item.productName || 'Product'} × {item.quantity}
                  </p>
                ))}
              </dd>
            </div>
          )}
          {returnRequest.notes && (
            <div>
              <dt className="text-sm font-medium text-hos-text-muted">Notes</dt>
              <dd className="mt-1 text-hos-text-secondary">{returnRequest.notes}</dd>
            </div>
          )}
          {returnRequest.refundAmount != null && (
            <div>
              <dt className="text-sm font-medium text-hos-text-muted">Refund Amount</dt>
              <dd className="mt-1 text-lg font-semibold text-green-400">
                {formatPrice(Number(returnRequest.refundAmount), currency)}
              </dd>
            </div>
          )}
          {returnRequest.refundMethod && (
            <div>
              <dt className="text-sm font-medium text-hos-text-muted">Refund Method</dt>
              <dd className="mt-1 text-hos-text-secondary">{returnRequest.refundMethod}</dd>
            </div>
          )}
          {returnRequest.refundTransactions?.length > 0 && (
            <div>
              <dt className="text-sm font-medium text-hos-text-muted">Refund transactions</dt>
              <dd className="mt-2 space-y-2">
                {returnRequest.refundTransactions.map((tx: any) => {
                  const txStatus = String(tx.status || '').toUpperCase();
                  const statusColor =
                    txStatus === 'COMPLETED'
                      ? 'text-green-400'
                      : txStatus === 'FAILED'
                        ? 'text-red-400'
                        : 'text-yellow-400';
                  return (
                  <div
                    key={tx.id}
                    className="text-sm p-3 rounded-lg bg-hos-bg-tertiary border border-hos-border"
                  >
                    <p className={`font-medium ${statusColor}`}>
                      {formatPrice(Number(tx.amount), tx.currency || currency)} — {tx.status}
                    </p>
                    <p className="text-xs text-hos-text-muted mt-1">
                      {new Date(tx.createdAt).toLocaleString()}
                      {tx.stripeRefundId ? ` · Ref: ${tx.stripeRefundId}` : ''}
                    </p>
                  </div>
                  );
                })}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-sm font-medium text-hos-text-muted">Created</dt>
            <dd className="mt-1 text-hos-text-secondary">
              {returnRequest.createdAt
                ? new Date(returnRequest.createdAt).toLocaleString()
                : 'N/A'}
            </dd>
          </div>
        </dl>

        {(returnRequest.status || '').toLowerCase() === 'pending' && (
          <div className="pt-4 border-t border-hos-border">
            <button
              type="button"
              onClick={handleCancelReturn}
              disabled={cancelLoading}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
            >
              {cancelLoading ? 'Cancelling...' : 'Cancel Return'}
            </button>
          </div>
        )}
      </div>
    </div>,
  );
}
