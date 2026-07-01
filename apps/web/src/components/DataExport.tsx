'use client';

import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';

interface ExportColumn {
  key: string;
  header: string;
  format?: (value: any, row: any) => string;
}

interface DataExportProps {
  data: any[];
  columns: ExportColumn[];
  filename?: string;
  className?: string;
}

function triggerDownload(blob: Blob, filename: string) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function DataExport({ data, columns, filename = 'export', className = '' }: DataExportProps) {
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null);

  const exportToCSV = useCallback(async () => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }

    setExporting('csv');
    try {
      const headers = columns.map((col) => `"${col.header}"`).join(',');
      const rows = data.map((item) =>
        columns
          .map((col) => {
            let value = item[col.key];
            if (col.format) value = col.format(value, item);
            if (value === null || value === undefined) value = '';
            const strValue = String(value).replace(/"/g, '""');
            return `"${strValue}"`;
          })
          .join(','),
      );

      const csvContent = [headers, ...rows].join('\n');
      triggerDownload(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
      toast.success(`Exported ${data.length} rows to CSV`);
    } finally {
      setExporting(null);
    }
  }, [data, columns, filename]);

  const exportToJSON = useCallback(async () => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }

    setExporting('json');
    try {
      const exportData = data.map((item) => {
        const row: Record<string, any> = {};
        columns.forEach((col) => {
          let value = item[col.key];
          if (col.format) value = col.format(value, item);
          row[col.header] = value;
        });
        return row;
      });

      const jsonContent = JSON.stringify(exportData, null, 2);
      triggerDownload(
        new Blob([jsonContent], { type: 'application/json;charset=utf-8;' }),
        `${filename}.json`,
      );
      toast.success(`Exported ${data.length} rows to JSON`);
    } finally {
      setExporting(null);
    }
  }, [data, columns, filename]);

  const busy = exporting !== null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={exportToCSV}
        disabled={busy}
        className="px-3 py-1.5 text-sm font-medium text-hos-text-secondary bg-hos-bg-secondary border border-hos-border rounded-lg hover:bg-hos-bg-tertiary transition-colors flex items-center gap-1 disabled:opacity-50"
      >
        {exporting === 'csv' ? (
          <span className="w-4 h-4 border-2 border-hos-border border-t-hos-gold rounded-full animate-spin" aria-hidden />
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        )}
        {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
      </button>
      <button
        type="button"
        onClick={exportToJSON}
        disabled={busy}
        className="px-3 py-1.5 text-sm font-medium text-hos-text-secondary bg-hos-bg-secondary border border-hos-border rounded-lg hover:bg-hos-bg-tertiary transition-colors flex items-center gap-1 disabled:opacity-50"
      >
        {exporting === 'json' ? (
          <span className="w-4 h-4 border-2 border-hos-border border-t-hos-gold rounded-full animate-spin" aria-hidden />
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        )}
        {exporting === 'json' ? 'Exporting…' : 'Export JSON'}
      </button>
    </div>
  );
}

// Hook for programmatic export
export function useDataExport() {
  const exportToCSV = useCallback((data: any[], columns: ExportColumn[], filename: string = 'export') => {
    if (data.length === 0) return;

    const headers = columns.map((col) => `"${col.header}"`).join(',');
    const rows = data.map((item) =>
      columns
        .map((col) => {
          let value = item[col.key];
          if (col.format) value = col.format(value, item);
          if (value === null || value === undefined) value = '';
          const strValue = String(value).replace(/"/g, '""');
          return `"${strValue}"`;
        })
        .join(','),
    );

    const csvContent = [headers, ...rows].join('\n');
    triggerDownload(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
    toast.success(`Exported ${data.length} rows to CSV`);
  }, []);

  const exportToJSON = useCallback((data: any[], columns: ExportColumn[], filename: string = 'export') => {
    if (data.length === 0) return;

    const exportData = data.map((item) => {
      const row: Record<string, any> = {};
      columns.forEach((col) => {
        let value = item[col.key];
        if (col.format) value = col.format(value, item);
        row[col.header] = value;
      });
      return row;
    });

    const jsonContent = JSON.stringify(exportData, null, 2);
    triggerDownload(
      new Blob([jsonContent], { type: 'application/json;charset=utf-8;' }),
      `${filename}.json`,
    );
    toast.success(`Exported ${data.length} rows to JSON`);
  }, []);

  return { exportToCSV, exportToJSON };
}
