'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type AdminColumnDef = {
  id: string;
  label: string;
  defaultVisible?: boolean;
};

export function useAdminColumnVisibility(tableId: string, columns: AdminColumnDef[]) {
  const storageKey = `admin-table-columns:${tableId}`;

  const defaultVisible = useMemo(
    () => new Set(columns.filter((c) => c.defaultVisible !== false).map((c) => c.id)),
    [columns],
  );

  const [visibleIds, setVisibleIds] = useState<Set<string>>(defaultVisible);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVisibleIds(new Set(parsed.filter((id) => columns.some((c) => c.id === id))));
        }
      }
    } catch {
      // ignore corrupt storage
    } finally {
      setReady(true);
    }
  }, [storageKey, columns]);

  const persist = useCallback(
    (next: Set<string>) => {
      setVisibleIds(next);
      localStorage.setItem(storageKey, JSON.stringify([...next]));
    },
    [storageKey],
  );

  const toggleColumn = useCallback(
    (id: string) => {
      const next = new Set(visibleIds);
      if (next.has(id)) {
        if (next.size <= 1) return;
        next.delete(id);
      } else {
        next.add(id);
      }
      persist(next);
    },
    [visibleIds, persist],
  );

  const resetColumns = useCallback(() => {
    persist(new Set(defaultVisible));
  }, [defaultVisible, persist]);

  const isVisible = useCallback((id: string) => visibleIds.has(id), [visibleIds]);

  return { visibleIds, isVisible, toggleColumn, resetColumns, ready };
}

interface AdminColumnToggleProps {
  columns: AdminColumnDef[];
  visibleIds: Set<string>;
  onToggle: (id: string) => void;
  onReset: () => void;
}

export function AdminColumnToggle({ columns, visibleIds, onToggle, onReset }: AdminColumnToggleProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="admin-table-action"
        aria-expanded={open}
        aria-haspopup="true"
      >
        Columns
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close column menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-52 rounded-lg border border-hos-border bg-hos-bg-secondary shadow-lg p-3">
            <p className="text-xs font-semibold text-hos-text-secondary mb-2">Show columns</p>
            <ul className="space-y-1 max-h-56 overflow-y-auto">
              {columns.map((col) => (
                <li key={col.id}>
                  <label className="flex items-center gap-2 text-sm text-hos-text-secondary cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={visibleIds.has(col.id)}
                      onChange={() => onToggle(col.id)}
                      className="rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
                    />
                    {col.label}
                  </label>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                onReset();
                setOpen(false);
              }}
              className="mt-2 text-xs text-hos-gold hover:text-hos-gold-hover"
            >
              Reset to default
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
