'use client';

import { useState, useCallback, useMemo } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface BulkAction<T> {
  label: string;
  icon?: string;
  variant?: 'primary' | 'danger' | 'secondary';
  onExecute: (selectedItems: T[]) => void | Promise<void>;
  confirm?: string;
}

interface BulkSelectTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField: keyof T;
  bulkActions?: BulkAction<T>[];
  onRowClick?: (item: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function BulkSelectTable<T>({
  data,
  columns,
  keyField,
  bulkActions = [],
  onRowClick,
  loading = false,
  emptyMessage = 'No data found',
  className = '',
}: BulkSelectTableProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [executingAction, setExecutingAction] = useState(false);

  // Get all IDs
  const allIds = useMemo(() => data.map((item) => String(item[keyField])), [data, keyField]);

  // Check if all items are selected
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = allIds.some((id) => selectedIds.has(id));

  // Toggle all selection
  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }, [allSelected, allIds]);

  // Toggle single item
  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Get selected items
  const selectedItems = useMemo(() => {
    return data.filter((item) => selectedIds.has(String(item[keyField])));
  }, [data, selectedIds, keyField]);

  // Handle sort
  const handleSort = useCallback((column: string) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn) return data;

    return [...data].sort((a, b) => {
      const aVal = (a as any)[sortColumn];
      const bVal = (b as any)[sortColumn];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection]);

  // Execute bulk action
  const executeBulkAction = useCallback(async (action: BulkAction<T>) => {
    if (selectedItems.length === 0) return;

    if (action.confirm) {
      const confirmed = confirm(action.confirm.replace('{count}', String(selectedItems.length)));
      if (!confirmed) return;
    }

    try {
      setExecutingAction(true);
      await action.onExecute(selectedItems);
      setSelectedIds(new Set());
    } finally {
      setExecutingAction(false);
    }
  }, [selectedItems]);

  const getActionButtonClass = (variant: string = 'secondary') => {
    switch (variant) {
      case 'primary':
        return 'bg-purple-600 text-white hover:bg-purple-700';
      case 'danger':
        return 'bg-red-600 text-white hover:bg-red-700';
      default:
        return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow overflow-hidden ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow overflow-hidden ${className}`}>
      {/* Bulk Actions Bar */}
      {(someSelected || bulkActions.length > 0) && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {selectedIds.size > 0 ? (
                <>
                  <span className="font-medium">{selectedIds.size}</span> item{selectedIds.size !== 1 ? 's' : ''} selected
                </>
              ) : (
                'Select items to perform bulk actions'
              )}
            </span>
            {selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-purple-600 hover:underline"
              >
                Clear selection
              </button>
            )}
          </div>
          {selectedIds.size > 0 && bulkActions.length > 0 && (
            <div className="flex items-center gap-2">
              {bulkActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => executeBulkAction(action)}
                  disabled={executingAction}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${getActionButtonClass(action.variant)}`}
                >
                  {action.icon && <span className="mr-1">{action.icon}</span>}
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                  }`}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-1">
                    {column.header}
                    {column.sortable && sortColumn === column.key && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-6 py-12 text-center text-gray-500">
                  <span className="text-4xl block mb-2">📭</span>
                  <p>{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              sortedData.map((item) => {
                const id = String(item[keyField]);
                const isSelected = selectedIds.has(id);

                return (
                  <tr
                    key={id}
                    className={`${isSelected ? 'bg-purple-50' : 'hover:bg-gray-50'} ${
                      onRowClick ? 'cursor-pointer' : ''
                    }`}
                  >
                    <td className="w-12 px-4 py-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleItem(id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </td>
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                        onClick={() => onRowClick?.(item)}
                      >
                        {column.render
                          ? column.render(item)
                          : String((item as any)[column.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
