'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import { getSellerMenuItems } from '@/lib/sellerMenu';
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
  failedRows?: Array<Record<string, unknown>>;
}

interface ValidationPreview {
  total: number;
  valid: number;
  invalid: number;
  rows: Array<{
    rowIndex: number;
    name: string;
    sku?: string;
    valid: boolean;
    errors: string[];
  }>;
}

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bg: string; bar: string }> = {
  queued: { label: 'Queued', color: 'text-yellow-300', bg: 'bg-yellow-500/15', bar: 'bg-yellow-500/10' },
  processing: { label: 'Processing', color: 'text-hos-gold', bg: 'bg-hos-gold/20', bar: 'bg-hos-gold/100' },
  completed: { label: 'Completed', color: 'text-green-300', bg: 'bg-green-500/15', bar: 'bg-green-500/10' },
  failed: { label: 'Failed', color: 'text-red-300', bg: 'bg-red-500/15', bar: 'bg-red-500/10' },
};

export default function SellerBulkProductsPage() {
  const toast = useToast();
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<any>(null);
  const [jobProgress, setJobProgress] = useState<JobProgress | null>(null);
  const [parsedProducts, setParsedProducts] = useState<any[]>([]);
  const [validationPreview, setValidationPreview] = useState<ValidationPreview | null>(null);
  const [validating, setValidating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
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
              failedRows: data.failedRows || [],
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

  const menuItems = getSellerMenuItems(false);

  const downloadFailedRowsCsv = (rows: Array<Record<string, unknown>>) => {
    if (!rows.length) return;
    const headers = ['rowIndex', 'error', 'name', 'sku', 'price', 'stock', 'description', 'currency', 'category', 'fandom', 'tags', 'images', 'status'];
    const csvRows = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((h) => {
            let value = row[h] ?? '';
            if (typeof value === 'object') value = JSON.stringify(value);
            value = String(value).replace(/"/g, '""');
            return `"${value}"`;
          })
          .join(','),
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-failed-rows-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success('Failed rows exported');
  };

  const handleFileChange = async (file: File | null) => {
    setSelectedFile(file);
    setValidationPreview(null);
    setShowPreview(false);
    setParsedProducts([]);
    if (!file) return;

    try {
      const fileText = await file.text();
      const products = parseCSV(fileText);
      setParsedProducts(products);
      if (products.length === 0) {
        toast.error('No valid product rows found in CSV');
        return;
      }
      setValidating(true);
      const response = await apiClient.validateProductImport(products);
      if (response?.data) {
        setValidationPreview(response.data);
        setShowPreview(true);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to validate CSV');
    } finally {
      setValidating(false);
    }
  };

  const handleDownloadSampleCSV = () => {
    const sampleHeaders = ['name', 'description', 'sku', 'price', 'stock', 'currency', 'category', 'fandom', 'tags', 'images', 'status'];
    const sampleRows = [
      [
        'Harry Potter Wand Replica',
        'Authentic replica of Harry Potter\'s wand from the movie series. Made with high-quality materials.',
        'HP-WAND-001',
        '49.99',
        '100',
        'USD',
        'Collectibles',
        'harry-potter',
        'wand|replica|collectible',
        'https://picsum.photos/seed/hp-wand-1/800/800|https://picsum.photos/seed/hp-wand-2/800/800',
        'ACTIVE',
      ],
      [
        'Hogwarts House Scarf - Gryffindor',
        'Official Gryffindor house scarf in maroon and gold. 100% acrylic, warm and comfortable.',
        'HP-SCARF-GRY',
        '29.99',
        '250',
        'USD',
        'Apparel',
        'harry-potter',
        'scarf|gryffindor|apparel',
        'https://picsum.photos/seed/hp-scarf-1/800/800',
        'ACTIVE',
      ],
      [
        'Lord of the Rings Ring Replica',
        'The One Ring replica with Elvish inscription. Gold-plated stainless steel.',
        'LOTR-RING-001',
        '34.99',
        '75',
        'USD',
        'Jewelry',
        'lord-of-the-rings',
        'ring|replica|jewelry',
        'https://picsum.photos/seed/lotr-ring-1/800/800|https://picsum.photos/seed/lotr-ring-2/800/800',
        'ACTIVE',
      ],
    ];

    const csvContent = [
      sampleHeaders.join(','),
      ...sampleRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products-sample.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast.success('Sample CSV downloaded!');
  };

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
    if (!selectedFile || parsedProducts.length === 0) {
      toast.error('Please select a valid CSV file');
      return;
    }

    if (!validationPreview) {
      toast.error('Validation is required before importing. Please re-select the file to validate.');
      return;
    }
    if (validationPreview.invalid > 0) {
      toast.error(`${validationPreview.invalid} rows have errors — fix them or remove invalid rows before importing`);
      return;
    }

    try {
      setImportLoading(true);
      const products = parsedProducts;

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
        setParsedProducts([]);
        setValidationPreview(null);
        setShowPreview(false);
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        // importLoading stays true until job completes
      } else if (response?.data) {
        // Sync response — show results immediately
        setImportResults({
          successCount: response.data.success || 0,
          errorCount: response.data.failed || 0,
          errors: response.data.errors || [],
          failedRows: response.data.failedRows || [],
        });
        const successCount = response.data.success || 0;
        const errorCount = response.data.failed || 0;
        toast.success(`Import completed! ${successCount} products imported, ${errorCount} errors`);
        setSelectedFile(null);
        setParsedProducts([]);
        setValidationPreview(null);
        setShowPreview(false);

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
      <DashboardLayout role="SELLER" menuItems={menuItems} title="Seller" backToHref={{ title: 'Admin Dashboard', href: '/admin/dashboard' }}>
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Bulk Product Import/Export</h1>
          <p className="text-hos-text-secondary mt-2">Import or export products in bulk using CSV files</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export Section */}
          <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Export Products</h2>
            <p className="text-hos-text-secondary mb-4">
              Download all your products as a CSV file. You can edit the file and re-import it.
            </p>
            <button
              onClick={handleExport}
              disabled={exportLoading}
              className="w-full px-6 py-3 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportLoading ? 'Exporting...' : '📥 Export Products to CSV'}
            </button>
          </div>

          {/* Import Section */}
          <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Import Products</h2>
            <p className="text-hos-text-secondary mb-4">
              Upload a CSV file to import products. Make sure the file follows the correct format.
            </p>
            <form onSubmit={handleImport} className="space-y-4">
              <div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold"
                  required
                />
                {validating && (
                  <p className="text-sm text-hos-text-muted mt-2">Validating import preview...</p>
                )}
              </div>
              <button
                type="submit"
                disabled={importLoading || !selectedFile || validating || (validationPreview?.invalid ?? 0) > 0}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importLoading ? 'Importing...' : validating ? 'Validating...' : '📤 Confirm Import'}
              </button>
            </form>
          </div>
        </div>

        {/* Import Preview (dry-run) */}
        {showPreview && validationPreview && (
          <div className="mt-6 bg-hos-bg-secondary border border-hos-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Import Preview</h3>
              <div className="flex gap-3 text-sm">
                <span className="text-green-400">{validationPreview.valid} valid</span>
                <span className="text-red-400">{validationPreview.invalid} invalid</span>
                <span className="text-hos-text-muted">{validationPreview.total} total rows</span>
              </div>
            </div>
            <div className="overflow-x-auto max-h-80 border border-hos-border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-hos-bg-tertiary sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Row</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">SKU</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Errors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hos-border">
                  {validationPreview.rows.slice(0, 50).map((row) => (
                    <tr key={row.rowIndex} className={row.valid ? '' : 'bg-red-500/5'}>
                      <td className="px-3 py-2">{row.rowIndex}</td>
                      <td className="px-3 py-2">{row.name || '—'}</td>
                      <td className="px-3 py-2">{row.sku || '—'}</td>
                      <td className="px-3 py-2">
                        <span className={row.valid ? 'text-green-400' : 'text-red-400'}>
                          {row.valid ? 'Valid' : 'Invalid'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-red-400">{row.errors.join('; ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {validationPreview.rows.length > 50 && (
              <p className="text-xs text-hos-text-muted mt-2">Showing first 50 rows</p>
            )}
            {validationPreview.invalid > 0 && (
              <p className="text-sm text-red-400 mt-3">
                Fix invalid rows before importing. Duplicate SKUs and missing names are common issues.
              </p>
            )}
          </div>
        )}

        {/* Job Progress Tracking */}
        {jobProgress && jobProgress.status !== 'completed' && (
          <div className="mt-6 bg-hos-bg-secondary border border-hos-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Import Progress</h3>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_CONFIG[jobProgress.status].bg} ${STATUS_CONFIG[jobProgress.status].color}`}>
                {STATUS_CONFIG[jobProgress.status].label}
              </span>
            </div>

            <div className="w-full bg-hos-bg-tertiary rounded-full h-4 mb-3 overflow-hidden">
              <div
                className={`h-4 rounded-full transition-all duration-500 ease-out ${STATUS_CONFIG[jobProgress.status].bar}`}
                style={{ width: `${Math.min(jobProgress.progress, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-sm text-hos-text-secondary">
              <span>{jobProgress.processed} / {jobProgress.total} items processed</span>
              <span className="font-medium">{Math.round(jobProgress.progress)}%</span>
            </div>

            {jobProgress.status === 'failed' && jobProgress.errors && jobProgress.errors.length > 0 && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <h4 className="font-medium text-red-400 mb-2">Error Details:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-400">
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
          <div className="mt-6 bg-hos-bg-secondary border border-hos-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Import Results</h3>
              {importResults.failedRows?.length > 0 && (
                <button
                  type="button"
                  onClick={() => downloadFailedRowsCsv(importResults.failedRows)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                >
                  Download failed rows CSV
                </button>
              )}
            </div>
            <div className="space-y-2">
              <p><span className="font-medium">Success:</span> {importResults.successCount || 0} products imported</p>
              <p><span className="font-medium">Errors:</span> {importResults.errorCount || 0}</p>
              {importResults.errors && importResults.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-red-400 mb-2">Errors:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-red-400">
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
        <div className="mt-6 bg-hos-gold/10 border border-hos-border-accent rounded-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h3 className="text-lg font-semibold">CSV Format Instructions</h3>
            <button
              onClick={handleDownloadSampleCSV}
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Sample CSV
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-hos-text-secondary mb-2">Required Columns:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-hos-text-secondary">
                <li><code className="bg-hos-gold/20 px-1 rounded">name</code> - Product name (required for each row)</li>
                <li><code className="bg-hos-gold/20 px-1 rounded">price</code> - Product price (number, e.g., 49.99)</li>
                <li><code className="bg-hos-gold/20 px-1 rounded">description</code> - Product description</li>
                <li><code className="bg-hos-gold/20 px-1 rounded">stock</code> - Available quantity (number)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-hos-text-secondary mb-2">Optional Columns:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-hos-text-secondary">
                <li><code className="bg-hos-gold/20 px-1 rounded">sku</code> - Product SKU/identifier</li>
                <li><code className="bg-hos-gold/20 px-1 rounded">currency</code> - Currency code (USD, EUR, AED)</li>
                <li><code className="bg-hos-gold/20 px-1 rounded">category</code> - Product category</li>
                <li><code className="bg-hos-gold/20 px-1 rounded">fandom</code> - Fandom slug (e.g., harry-potter, lord-of-the-rings)</li>
                <li><code className="bg-hos-gold/20 px-1 rounded">tags</code> - Tags separated by pipe | (e.g., wand|replica|collectible)</li>
                <li><code className="bg-hos-gold/20 px-1 rounded">images</code> - Image URLs separated by pipe | (e.g., url1|url2)</li>
                <li><code className="bg-hos-gold/20 px-1 rounded">status</code> - ACTIVE, DRAFT, or INACTIVE</li>
              </ul>
            </div>

            <div className="bg-hos-bg-secondary rounded-lg p-4 border border-hos-border-accent">
              <h4 className="font-medium text-hos-text-secondary mb-2">Example Row:</h4>
              <div className="text-xs font-mono bg-hos-bg-tertiary p-3 rounded overflow-x-auto whitespace-nowrap">
                &quot;Harry Potter Wand&quot;,&quot;Authentic wand replica&quot;,&quot;HP-001&quot;,&quot;49.99&quot;,&quot;100&quot;,&quot;USD&quot;,&quot;Collectibles&quot;,&quot;harry-potter&quot;,&quot;wand|replica&quot;,&quot;https://picsum.photos/seed/hp-wand/800/800&quot;,&quot;ACTIVE&quot;
              </div>
            </div>

            <div className="text-sm text-hos-text-secondary">
              <strong>Tips:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>First row must contain column headers</li>
                <li>Save file as CSV with UTF-8 encoding</li>
                <li>Wrap values containing commas in double quotes</li>
                <li>Download the sample CSV above for a ready-to-use template</li>
              </ul>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </RouteGuard>
  );
}
