'use client';

import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

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
  /** When set, called to resolve rows before export (e.g. fetch all pages). */
  resolveData?: () => Promise<any[]>;
  /** Show Excel (.xlsx) button. Default true. */
  showExcel?: boolean;
  /** Show JSON button. Default true. */
  showJson?: boolean;
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

function mapRows(data: any[], columns: ExportColumn[]) {
  return data.map((item) => {
    const row: Record<string, any> = {};
    columns.forEach((col) => {
      let value = item[col.key];
      if (col.format) value = col.format(value, item);
      if (value === null || value === undefined) value = '';
      row[col.header] = value;
    });
    return row;
  });
}

export function DataExport({
  data,
  columns,
  filename = 'export',
  className = '',
  resolveData,
  showExcel = true,
  showJson = true,
}: DataExportProps) {
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | 'json' | null>(null);

  const loadRows = useCallback(async () => {
    if (resolveData) return resolveData();
    return data;
  }, [resolveData, data]);

  const exportToCSV = useCallback(async () => {
    setExporting('csv');
    try {
      const rowsSource = await loadRows();
      if (rowsSource.length === 0) {
        toast.error('No data to export');
        return;
      }
      const headers = columns.map((col) => `"${col.header}"`).join(',');
      const rows = rowsSource.map((item) =>
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
      toast.success(`Exported ${rowsSource.length} rows to CSV`);
    } catch (err: any) {
      toast.error(err?.message || 'CSV export failed');
    } finally {
      setExporting(null);
    }
  }, [loadRows, columns, filename]);

  const exportToExcel = useCallback(async () => {
    setExporting('xlsx');
    try {
      const rowsSource = await loadRows();
      if (rowsSource.length === 0) {
        toast.error('No data to export');
        return;
      }
      const sheetRows = mapRows(rowsSource, columns);
      const worksheet = XLSX.utils.json_to_sheet(sheetRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');
      XLSX.writeFile(workbook, `${filename}.xlsx`);
      toast.success(`Exported ${rowsSource.length} rows to Excel`);
    } catch (err: any) {
      toast.error(err?.message || 'Excel export failed');
    } finally {
      setExporting(null);
    }
  }, [loadRows, columns, filename]);

  const exportToJSON = useCallback(async () => {
    setExporting('json');
    try {
      const rowsSource = await loadRows();
      if (rowsSource.length === 0) {
        toast.error('No data to export');
        return;
      }
      const exportData = mapRows(rowsSource, columns);
      const jsonContent = JSON.stringify(exportData, null, 2);
      triggerDownload(
        new Blob([jsonContent], { type: 'application/json;charset=utf-8;' }),
        `${filename}.json`,
      );
      toast.success(`Exported ${rowsSource.length} rows to JSON`);
    } catch (err: any) {
      toast.error(err?.message || 'JSON export failed');
    } finally {
      setExporting(null);
    }
  }, [loadRows, columns, filename]);

  const busy = exporting !== null;
  const btnClass =
    'px-3 py-1.5 text-sm font-medium text-hos-text-secondary bg-hos-bg-secondary border border-hos-border rounded-lg hover:bg-hos-bg-tertiary transition-colors flex items-center gap-1 disabled:opacity-50';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button type="button" onClick={exportToCSV} disabled={busy} className={btnClass}>
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
      {showExcel && (
        <button type="button" onClick={exportToExcel} disabled={busy} className={btnClass}>
          {exporting === 'xlsx' ? (
            <span className="w-4 h-4 border-2 border-hos-border border-t-hos-gold rounded-full animate-spin" aria-hidden />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          )}
          {exporting === 'xlsx' ? 'Exporting…' : 'Export Excel'}
        </button>
      )}
      {showJson && (
        <button type="button" onClick={exportToJSON} disabled={busy} className={btnClass}>
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
      )}
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
