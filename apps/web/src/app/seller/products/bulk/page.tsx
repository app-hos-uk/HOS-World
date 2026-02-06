'use client';

import { useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import type { ApiResponse } from '@hos-marketplace/shared-types';

export default function SellerBulkProductsPage() {
  const toast = useToast();
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<any>(null);

  const menuItems = [
    { title: 'Dashboard', href: '/seller/dashboard', icon: '📊' },
    { title: 'My Products', href: '/seller/products', icon: '📦' },
    { title: 'Bulk Import/Export', href: '/seller/products/bulk', icon: '📥' },
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
            let value = product[header] || '';
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
      toast.error(err.message || 'Failed to export products');
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
        return;
      }

      const response = await apiClient.importProducts(products);

      if (response?.data) {
        setImportResults({
          successCount: response.data.success || 0,
          errorCount: response.data.failed || 0,
          errors: response.data.errors || [],
        });
        const successCount = response.data.success || 0;
        const errorCount = response.data.failed || 0;
        toast.success(`Import completed! ${successCount} products imported, ${errorCount} errors`);
        setSelectedFile(null);
        
        // Reset file input
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (err: any) {
      console.error('Import error:', err);
      toast.error(err.message || 'Failed to import products');
    } finally {
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
