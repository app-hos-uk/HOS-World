'use client';

import type { ReactNode } from 'react';

export type AlignedColumn<T> = {
  key: string;
  header: string;
  /** CSS grid track size, e.g. "1.4fr" or "120px" */
  width: string;
  align?: 'left' | 'right';
  cell: (row: T) => ReactNode;
};

type AlignedDataTableProps<T> = {
  columns: AlignedColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  minWidth?: number;
  emptyMessage?: string;
};

/**
 * Header/body cells share one CSS grid template so columns stay aligned.
 * Prefer this over .admin-table when numeric columns must line up with headers
 * (.admin-table th { text-left } previously beat utility text-right).
 */
export function AlignedDataTable<T>({
  columns,
  rows,
  rowKey,
  minWidth = 720,
  emptyMessage = 'No data available.',
}: AlignedDataTableProps<T>) {
  const template = columns.map((c) => c.width).join(' ');

  if (rows.length === 0) {
    return <p className="text-sm text-hos-text-muted">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-hos-border bg-hos-bg-secondary shadow-sm">
      <div style={{ minWidth }}>
        <div
          className="grid border-b border-hos-border bg-hos-bg-tertiary/60"
          style={{ gridTemplateColumns: template }}
          role="row"
        >
          {columns.map((col) => (
            <div
              key={col.key}
              role="columnheader"
              className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-hos-text-secondary"
              style={{ textAlign: col.align ?? 'left' }}
            >
              {col.header}
            </div>
          ))}
        </div>
        {rows.map((row, index) => (
          <div
            key={rowKey(row)}
            role="row"
            className={`grid border-b border-hos-border last:border-b-0 ${
              index % 2 === 1 ? 'bg-hos-bg-tertiary/30' : ''
            }`}
            style={{ gridTemplateColumns: template }}
          >
            {columns.map((col) => (
              <div
                key={col.key}
                role="cell"
                className={`px-4 py-3.5 text-sm text-hos-text-secondary ${
                  col.align === 'right' ? 'tabular-nums' : ''
                }`}
                style={{ textAlign: col.align ?? 'left' }}
              >
                {col.cell(row)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
