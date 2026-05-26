'use client';

import type { ReactNode } from 'react';

interface PortalMobileCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  rows: Array<{ label: string; value: ReactNode }>;
  actions?: ReactNode;
}

export function PortalMobileCard({ title, subtitle, rows, actions }: PortalMobileCardProps) {
  return (
    <article className="border border-hos-border rounded-lg p-4 bg-hos-bg-tertiary space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-hos-text-secondary">{title}</h3>
        {subtitle ? <p className="text-xs text-hos-text-muted mt-0.5">{subtitle}</p> : null}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs text-hos-text-muted uppercase tracking-wide">{row.label}</dt>
            <dd className="text-hos-text-secondary mt-0.5">{row.value}</dd>
          </div>
        ))}
      </dl>
      {actions ? <div className="pt-1 border-t border-hos-border">{actions}</div> : null}
    </article>
  );
}
