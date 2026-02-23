'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import type { ApiResponse } from '@hos-marketplace/shared-types';

type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

interface JobProgress {
  jobId: string;
  status: JobStatus;
  progress: number;
  processed: number;
  total: number;
  success?: number;
  failed?: number;
  errors?: string[];
}

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bg: string; bar: string }> = {
  queued: { label: 'Queued', color: 'text-yellow-800', bg: 'bg-yellow-100', bar: 'bg-yellow-500' },
  processing: { label: 'Processing', color: 'text-blue-800', bg: 'bg-blue-100', bar: 'bg-blue-500' },
  completed: { label: 'Completed', color: 'text-green-800', bg: 'bg-green-100', bar: 'bg-green-500' },
  failed: { label: 'Failed', color: 'text-red-800', bg: 'bg-red-100', bar: 'bg-red-500' },
};

export default function SellerBulkProductsPage() {
  const toast = useToast();
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<any>(null);
  const [jobProgress, setJobProgress] = useState<JobProgress | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollJobStatus = useCallback((jobId: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const res = await apiClient.getJobStatus(jobId);
        const data = res?.data;
        if (!data) return;

        const status: JobStatus = (data.status || 'queued').toLowerCase();
        const progress: JobProgress = {
          jobId,
          status,
          progress: data.progress ?? 0,
          processed: data.processed ?? 0,
          total: data.total ?? 0,
          success: data.success,
          failed: data.failed,
          errors: data.errors,
        };
        setJobProgress(progress);

        if (status === 'completed' || status === 'failed') {
          stopPolling();
          setImportLoading(false);

          if (status === 'completed') {
            setImportResults({
              successCount: data.success || 0,
              errorCount: data.failed || 0,
              errors: data.errors || [],
            });
            toast.success(`Import completed! ${data.success || 0} products imported, ${data.failed || 0} errors`);
          } else {
            toast.error(data.error || 'Import job failed');
          }
        }
      } catch (err) {
        console.error('Error polling job status:', err);
      }
    }, 2000);
  }, [stopPolling, toast]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const menuItems = [
    { title: 'Dashboard', href: '/seller/dashboard', icon: '📊' },
    { title: 'Submit Product', href: '/seller/submit-product', icon: '➕' },
    { title: 'My Products', href: '/seller/products', icon: '📦' },
    { title: 'Orders', href: '/seller/orders', icon: '🛒' },
    { title: 'Submissions', href: '/seller/submissions', icon: '📝' },
    { title: 'Profile', href: '/seller/profile', icon: '👤' },
    { title: 'Themes', href: '/seller/themes', icon: '🎨' },
    { title: 'Bulk Import', href: '/seller/products/bulk', icon: '📤' },
  ];

  const handleExport = async () => {
    try {
      setExportLoading(true);
      const response = await apiClient.exportProducts();
      const products = response?.data || [];
      
      if (products.length === 0) {
        toast.error('No products to export');
        return;
      }

      // Convert to CSV
      const headers = ['name', 'description', 'sku', 'price', 'stock', 'currency', 'category', 'fandom', 'tags', 'images', 'status'];
      const csvRows = [
        headers.join(','),
        ...products.map((product: any) => {
          return headers.map((header) => {
            let value = product[header] ?? '';
            if (Array.isArray(value)) {
              value = value.join('|');
            }
            if (typeof value === 'object') {
              value = JSON.stringify(value);
            }
            // Escape commas and quotes
            value = String(value).replace(/"/g, '""');
            return `"${value}"`;
          }).join(',');
        }),
      ];
      
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Products exported successfully!');
    } catch (err: any) {
      console.error('Export error:', err);
      toast.error(err?.message || 'Failed to export products');
    } finally {
      setExportLoading(false);
    }
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
    const products = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
      const product: any = {};
      
      headers.forEach((header, index) => {
        let value = values[index]?.replace(/^"|"$/g, '').replace(/""/g, '"') || '';
        if (header === 'tags' && value) {
          product[header] = value.split('|').map((t: string) => t.trim());
        } else if (header === 'images' && value) {
          product[header] = value.split('|').map((img: string) => ({ url: img.trim(), order: 0 }));
        } else if (['price', 'stock'].includes(header)) {
          product[header] = parseFloat(value) || 0;
        } else {
          product[header] = value;
        }
      });
      
      if (product.name) {
        products.push(product);
      }
    }
    
    return products;
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    try {
      setImportLoading(true);
      const fileText = await selectedFile.text();
      const products = parseCSV(fileText);
      
      if (products.length === 0) {
        toast.error('No valid products found in CSV file');
        setImportLoading(false);
        return;
      }

      setImportResults(null);
      setJobProgress(null);

      const response = await apiClient.importProducts(products);

      if (response?.data?.jobId) {
        // Async job — start polling for progress
        const jobId = response.data.jobId;
        setJobProgress({
          jobId,
          status: 'queued',
          progress: 0,
          processed: 0,
          total: products.length,
        });
        toast.success('Import job started — tracking progress...');
        pollJobStatus(jobId);

        setSelectedFile(null);
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        // importLoading stays true until job completes
      } else if (response?.data) {
        // Sync response — show results immediately
        setImportResults({
          successCount: response.data.success || 0,
          errorCount: response.data.failed || 0,
          errors: response.data.errors || [],
        });
        const successCount = response.data.success || 0;
        const errorCount = response.data.failed || 0;
        toast.success(`Import completed! ${successCount} products imported, ${errorCount} errors`);
        setSelectedFile(null);

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        setImportLoading(false);
      }
    } catch (err: any) {
      console.error('Import error:', err);
      toast.error(err?.message || 'Failed to import products');
      setImportLoading(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="SELLER" menuItems={menuItems} title="Seller">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Bulk Product Import/Export</h1>
          <p className="text-gray-600 mt-2">Import or export products in bulk using CSV files</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Export Products</h2>
            <p className="text-gray-600 mb-4">
              Download all your products as a CSV file. You can edit the file and re-import it.
            </p>
            <button
              onClick={handleExport}
              disabled={exportLoading}
              className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportLoading ? 'Exporting...' : '📥 Export Products to CSV'}
            </button>
          </div>

          {/* Import Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Import Products</h2>
            <p className="text-gray-600 mb-4">
              Upload a CSV file to import products. Make sure the file follows the correct format.
            </p>
            <form onSubmit={handleImport} className="space-y-4">
              <div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={importLoading || !selectedFile}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importLoading ? 'Importing...' : '📤 Import Products from CSV'}
              </button>
            </form>
          </div>
        </div>

        {/* Job Progress Tracking */}
        {jobProgress && jobProgress.status !== 'completed' && (
          <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Import Progress</h3>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_CONFIG[jobProgress.status].bg} ${STATUS_CONFIG[jobProgress.status].color}`}>
                {STATUS_CONFIG[jobProgress.status].label}
              </span>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-4 mb-3 overflow-hidden">
              <div
                className={`h-4 rounded-full transition-all duration-500 ease-out ${STATUS_CONFIG[jobProgress.status].bar}`}
                style={{ width: `${Math.min(jobProgress.progress, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>{jobProgress.processed} / {jobProgress.total} items processed</span>
              <span className="font-medium">{Math.round(jobProgress.progress)}%</span>
            </div>

            {jobProgress.status === 'failed' && jobProgress.errors && jobProgress.errors.length > 0 && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="font-medium text-red-700 mb-2">Error Details:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-600">
                  {jobProgress.errors.slice(0, 10).map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                  {jobProgress.errors.length > 10 && (
                    <li className="text-red-500">... and {jobProgress.errors.length - 10} more errors</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Import Results */}
        {importResults && (
          <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Import Results</h3>
            <div className="space-y-2">
              <p><span className="font-medium">Success:</span> {importResults.successCount || 0} products imported</p>
              <p><span className="font-medium">Errors:</span> {importResults.errorCount || 0}</p>
              {importResults.errors && importResults.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-red-600 mb-2">Errors:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-red-600">
                    {importResults.errors.slice(0, 10).map((error: string, index: number) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">CSV Format Instructions</h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
            <li>Required columns: name, price, description, stock</li>
            <li>Optional columns: category, sku, images (comma-separated URLs)</li>
            <li>First row should contain column headers</li>
            <li>Export your products first to see the correct format</li>
            <li>Make sure to save as CSV (UTF-8 encoding)</li>
          </ul>
        </div>
      </DashboardLayout>
    </RouteGuard>
  );
}
