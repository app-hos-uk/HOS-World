'use client';

import { useCallback } from 'react';

interface ExportColumn {
  key: string;
  header: string;
  format?: (value: any) => string;
}

interface DataExportProps {
  data: any[];
  columns: ExportColumn[];
  filename?: string;
  className?: string;
}

export function DataExport({ data, columns, filename = 'export', className = '' }: DataExportProps) {
  const exportToCSV = useCallback(() => {
    if (data.length === 0) {
      alert('No data to export');
      return;
    }

    // Build CSV content
    const headers = columns.map((col) => `"${col.header}"`).join(',');
    const rows = data.map((item) =>
      columns
        .map((col) => {
          let value = item[col.key];
          if (col.format) {
            value = col.format(value);
          }
          // Handle null/undefined
          if (value === null || value === undefined) {
            value = '';
          }
          // Convert to string and escape quotes
          const strValue = String(value).replace(/"/g, '""');
          return `"${strValue}"`;
        })
        .join(',')
    );

    const csvContent = [headers, ...rows].join('\n');

    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [data, columns, filename]);

  const exportToJSON = useCallback(() => {
    if (data.length === 0) {
      alert('No data to export');
      return;
    }

    // Transform data using column definitions
    const exportData = data.map((item) => {
      const row: Record<string, any> = {};
      columns.forEach((col) => {
        let value = item[col.key];
        if (col.format) {
          value = col.format(value);
        }
        row[col.header] = value;
      });
      return row;
    });

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [data, columns, filename]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={exportToCSV}
        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        Export CSV
      </button>
      <button
        onClick={exportToJSON}
        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Export JSON
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
          if (col.format) {
            value = col.format(value);
          }
          if (value === null || value === undefined) {
            value = '';
          }
          const strValue = String(value).replace(/"/g, '""');
          return `"${strValue}"`;
        })
        .join(',')
    );

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const exportToJSON = useCallback((data: any[], columns: ExportColumn[], filename: string = 'export') => {
    if (data.length === 0) return;

    const exportData = data.map((item) => {
      const row: Record<string, any> = {};
      columns.forEach((col) => {
        let value = item[col.key];
        if (col.format) {
          value = col.format(value);
        }
        row[col.header] = value;
      });
      return row;
    });

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  return { exportToCSV, exportToJSON };
}
