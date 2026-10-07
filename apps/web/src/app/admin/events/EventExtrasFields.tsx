'use client';

import type { ReactNode } from 'react';

export const EVENT_TYPES = [
  'IN_STORE',
  'VIRTUAL',
  'HYBRID',
  'PRODUCT_LAUNCH',
  'FAN_MEETUP',
  'VIP_EXPERIENCE',
  'MOVIE_RELEASE',
  'CONVENTION',
  'FANDOM_CELEBRATION',
] as const;

const MARKET_OPTIONS = ['US', 'MY'] as const;

const RSVP_HIDDEN_TYPES = new Set(['MOVIE_RELEASE', 'FANDOM_CELEBRATION']);

const inputClass =
  'mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border';

export type EventExtras = {
  type: string;
  showOnLanding: boolean;
  marketCodes: string[];
  displayOrder: number;
  trailerUrl: string;
  externalUrl: string;
  capacity: string;
  requiresTicket: boolean;
  ticketPrice: string;
  attendancePoints: number;
};

export const EMPTY_EVENT_EXTRAS: EventExtras = {
  type: 'IN_STORE',
  showOnLanding: false,
  marketCodes: [],
  displayOrder: 0,
  trailerUrl: '',
  externalUrl: '',
  capacity: '',
  requiresTicket: false,
  ticketPrice: '',
  attendancePoints: 100,
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export function readEventExtras(event: Record<string, unknown> | null | undefined): EventExtras {
  const metadata =
    event?.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)
      ? (event.metadata as Record<string, unknown>)
      : {};
  const text = (top: unknown, nested: unknown) => {
    const value = top ?? nested;
    return typeof value === 'string' ? value : value == null ? '' : String(value);
  };
  const order = Number(event?.displayOrder ?? metadata.displayOrder ?? 0);
  return {
    type: typeof event?.type === 'string' ? event.type : 'IN_STORE',
    showOnLanding: Boolean(event?.showOnLanding ?? metadata.showOnLanding),
    marketCodes: asStringArray(event?.marketCodes ?? metadata.marketCodes).filter(
      (code) => code === 'US' || code === 'MY',
    ),
    displayOrder: Number.isFinite(order) ? order : 0,
    trailerUrl: text(event?.trailerUrl, metadata.trailerUrl),
    externalUrl: text(event?.externalUrl, metadata.externalUrl),
    capacity: event?.capacity != null ? String(event.capacity) : '',
    requiresTicket: Boolean(event?.requiresTicket),
    ticketPrice: event?.ticketPrice != null ? String(event.ticketPrice) : '',
    attendancePoints:
      typeof event?.attendancePoints === 'number' ? event.attendancePoints : 100,
  };
}

export function buildEventExtraBody(
  values: EventExtras,
  mode: 'create' | 'update',
): Record<string, unknown> {
  const text = (value: string) => {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
    return mode === 'update' ? null : undefined;
  };
  const body: Record<string, unknown> = {
    type: values.type,
    showOnLanding: values.showOnLanding,
    marketCodes: values.marketCodes,
    displayOrder: Number.isFinite(values.displayOrder) ? Math.max(0, Math.trunc(values.displayOrder)) : 0,
    trailerUrl: text(values.trailerUrl),
    externalUrl: values.type === 'CONVENTION' ? text(values.externalUrl) : mode === 'update' ? null : undefined,
  };
  if (!RSVP_HIDDEN_TYPES.has(values.type)) {
    body.attendancePoints = Number.isFinite(values.attendancePoints) ? values.attendancePoints : 0;
    body.requiresTicket = values.requiresTicket;
    const capacity = parseInt(values.capacity, 10);
    body.capacity =
      values.capacity.trim() && Number.isFinite(capacity) && capacity >= 0
        ? capacity
        : mode === 'update'
          ? null
          : undefined;
    const price = parseFloat(values.ticketPrice);
    body.ticketPrice =
      values.ticketPrice.trim() && Number.isFinite(price) && price >= 0
        ? price
        : mode === 'update'
          ? null
          : undefined;
  }
  return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined));
}

export function hidesRsvpFields(type: string) {
  return RSVP_HIDDEN_TYPES.has(type);
}

export function EventExtrasFields({
  values,
  onChange,
  children,
}: {
  values: EventExtras;
  onChange: (patch: Partial<EventExtras>) => void;
  children?: ReactNode;
}) {
  const hideRsvp = hidesRsvpFields(values.type);

  const toggleMarket = (code: string, checked: boolean) => {
    onChange({
      marketCodes: checked
        ? Array.from(new Set([...values.marketCodes, code]))
        : values.marketCodes.filter((item) => item !== code),
    });
  };

  return (
    <>
      <label className="block text-sm">
        <span className="text-hos-text-secondary">Type</span>
        <select
          className={inputClass}
          value={values.type}
          onChange={(e) => onChange({ type: e.target.value })}
        >
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      {values.type === 'CONVENTION' && (
        <label className="block text-sm rounded-md border border-hos-gold/50 bg-hos-gold/10 p-3">
          <span className="font-medium text-hos-text-secondary">External URL</span>
          <input
            className={inputClass}
            value={values.externalUrl}
            onChange={(e) => onChange({ externalUrl: e.target.value })}
            placeholder="https://convention.example.com"
          />
        </label>
      )}

      {children}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.showOnLanding}
          onChange={(e) => onChange({ showOnLanding: e.target.checked })}
        />
        <span className="text-hos-text-secondary">Show on Landing Page</span>
      </label>

      <fieldset className="block text-sm">
        <legend className="text-hos-text-secondary">Market</legend>
        <p className="text-xs text-hos-text-muted mt-1">Leave empty for all markets.</p>
        <div className="mt-2 flex gap-4">
          {MARKET_OPTIONS.map((code) => (
            <label key={code} className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={values.marketCodes.includes(code)}
                onChange={(e) => toggleMarket(code, e.target.checked)}
              />
              {code}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="text-hos-text-secondary">Display Order</span>
        <input
          type="number"
          min={0}
          className={inputClass}
          value={values.displayOrder}
          onChange={(e) => onChange({ displayOrder: parseInt(e.target.value, 10) || 0 })}
        />
        <span className="mt-1 block text-xs text-hos-text-muted">
          0 = chronological, higher = pinned earlier
        </span>
      </label>

      <label className="block text-sm">
        <span className="text-hos-text-secondary">Trailer / Video URL</span>
        <input
          className={inputClass}
          value={values.trailerUrl}
          onChange={(e) => onChange({ trailerUrl: e.target.value })}
          placeholder="https://www.youtube.com/watch?v=…"
        />
      </label>

      {!hideRsvp && (
        <div className="space-y-4 rounded-md border border-hos-border p-3">
          <p className="text-sm font-medium text-hos-text-secondary">RSVP, capacity & tickets</p>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Capacity</span>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={values.capacity}
              onChange={(e) => onChange({ capacity: e.target.value })}
              placeholder="Unlimited if empty"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.requiresTicket}
              onChange={(e) => onChange({ requiresTicket: e.target.checked })}
            />
            <span className="text-hos-text-secondary">Requires ticket</span>
          </label>
          {values.requiresTicket && (
            <label className="block text-sm">
              <span className="text-hos-text-secondary">Ticket price</span>
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={values.ticketPrice}
                onChange={(e) => onChange({ ticketPrice: e.target.value })}
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Attendance points</span>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={values.attendancePoints}
              onChange={(e) => onChange({ attendancePoints: parseInt(e.target.value, 10) || 0 })}
            />
          </label>
        </div>
      )}
    </>
  );
}
