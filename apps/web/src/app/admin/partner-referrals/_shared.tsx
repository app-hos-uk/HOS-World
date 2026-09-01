'use client';

import { useRef } from 'react';
import { CustomerQr } from '@/components/CustomerQr';

export const FIELD_CLASS =
  'mt-1 w-full rounded-md border border-stone-800 bg-stone-900 px-3 py-2 text-sm text-stone-100 font-secondary placeholder-stone-500 focus:outline-none focus:border-amber-600';

export const PRIMARY_BTN =
  'rounded-md bg-amber-600 px-4 py-2 text-sm font-secondary font-medium text-stone-950 hover:bg-amber-500 disabled:opacity-50';

export const SECONDARY_BTN =
  'rounded-md border border-stone-600 px-4 py-2 text-sm font-secondary text-stone-100 hover:bg-stone-900 disabled:opacity-50';

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asList(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

export function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function str(value: unknown, fallback = '—'): string {
  if (value == null || String(value).trim() === '') return fallback;
  return String(value);
}

export function entityId(payload: unknown): string | undefined {
  const rec = asRecord(payload);
  const nested = rec ? asRecord(rec.data) : null;
  const id = rec?.id ?? nested?.id;
  return id != null && String(id).length > 0 ? String(id) : undefined;
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-500/15 text-green-300';
    case 'PAUSED':
      return 'bg-yellow-500/15 text-yellow-300';
    case 'ARCHIVED':
      return 'bg-stone-500/20 text-stone-300';
    case 'EXPIRED':
      return 'bg-red-500/15 text-red-300';
    default:
      return 'bg-stone-800 text-stone-400';
  }
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-secondary uppercase tracking-wide ${statusBadgeClass(status)}`}
    >
      {status || '—'}
    </span>
  );
}

export function extractListPayload(res: {
  data?: unknown;
  pagination?: { total?: number };
}): { items: Record<string, unknown>[]; total: number } {
  const data = res?.data;
  if (Array.isArray(data)) {
    return { items: data as Record<string, unknown>[], total: res.pagination?.total ?? data.length };
  }
  const rec = asRecord(data);
  if (!rec) return { items: [], total: 0 };
  const pagination = asRecord(rec.pagination);
  const items = asList(rec.items ?? rec.partners ?? rec.links);
  const total = num(rec.total ?? pagination?.total ?? res.pagination?.total ?? items.length);
  return { items, total };
}

export function partnerLinkCount(row: Record<string, unknown>): number {
  if (row.linkCount != null) return num(row.linkCount);
  if (row.linksCount != null) return num(row.linksCount);
  const count = asRecord(row._count);
  if (count?.links != null) return num(count.links);
  if (Array.isArray(row.links)) return row.links.length;
  return 0;
}

export function partnerRegistrations(row: Record<string, unknown>): number | null {
  if (row.totalRegistrations != null) return num(row.totalRegistrations);
  if (Array.isArray(row.links)) {
    return (row.links as Record<string, unknown>[]).reduce(
      (sum, link) => sum + num(link.totalRegistrations),
      0,
    );
  }
  const count = asRecord(row._count);
  if (count?.conversions != null) return num(count.conversions);
  return null;
}

export function unwrapUrl(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  const rec = asRecord(payload);
  if (!rec) return '';
  const nested = asRecord(rec.data);
  const url = rec.url ?? rec.fullUrl ?? nested?.url ?? nested?.fullUrl;
  return url != null ? String(url) : '';
}

export function buildPartnerRefUrl(opts: {
  origin: string;
  code: string;
  utmSource: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}): string {
  const origin = opts.origin.replace(/\/$/, '');
  const code = opts.code.trim() || 'CODE';
  const params = new URLSearchParams();
  if (opts.utmSource.trim()) params.set('utm_source', opts.utmSource.trim());
  params.set('utm_medium', opts.utmMedium?.trim() || 'referral');
  if (opts.utmCampaign?.trim()) params.set('utm_campaign', opts.utmCampaign.trim());
  if (opts.utmContent?.trim()) params.set('utm_content', opts.utmContent.trim());
  if (opts.utmTerm?.trim()) params.set('utm_term', opts.utmTerm.trim());
  const qs = params.toString();
  return `${origin}/ref/${encodeURIComponent(code)}${qs ? `?${qs}` : ''}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function QrPreview({
  value,
  size = 180,
  downloadName,
}: {
  value: string;
  size?: number;
  downloadName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const download = () => {
    const img = ref.current?.querySelector('img');
    if (!img?.src) return;
    const a = document.createElement('a');
    a.href = img.src;
    a.download = downloadName || 'partner-referral-qr.svg';
    a.click();
  };

  if (!value) {
    return <p className="text-sm text-stone-500 font-secondary">QR preview appears once a URL is ready.</p>;
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div ref={ref}>
        <CustomerQr value={value} size={size} className="flex flex-col items-start gap-1" />
      </div>
      {downloadName ? (
        <button type="button" onClick={download} className={SECONDARY_BTN}>
          Download QR
        </button>
      ) : null}
    </div>
  );
}
