'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { AdminLayout } from '@/components/AdminLayout';
import { RouteGuard } from '@/components/RouteGuard';

interface MigrationResult {
  success: boolean;
  message: string;
  summary?: {
    totalStatements: number;
    successful: number;
    errors: number;
  };
  verification?: Record<string, boolean>;
  details?: Array<{
    statement: string;
    status: string;
    error?: string;
  }>;
  error?: string;
}

interface DataMigrationResult {
  success: boolean;
  message: string;
  results?: {
    categoriesCreated: number;
    categoriesLinked: number;
    tagsCreated: number;
    tagsLinked: number;
    errors: string[];
  };
  error?: string;
}

interface MigrationStatus {
  oldData: {
    productsWithCategoryString: number;
    productsWithTagArray: number;
  };
  newData: {
    categoriesCreated: number;
    tagsCreated: number;
    productsLinkedToCategories: number;
    productsLinkedToTags: number;
  };
  migrationNeeded: boolean;
}

export default function MigrationTaxonomyPage() {
  const [loading, setLoading] = useState(false);
  const [dataMigrating, setDataMigrating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [dataResult, setDataResult] = useState<DataMigrationResult | null>(null);
  const [verification, setVerification] = useState<Record<string, boolean> | null>(null);
  const [status, setStatus] = useState<MigrationStatus | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const response = await apiClient.getTaxonomyMigrationStatus();
      if (response?.data) {
        setStatus(response.data as MigrationStatus);
      }
    } catch (error: any) {
      console.error('Failed to load status:', error);
    } finally {
      setLoadingStatus(false);
    }
  };

  const runMigration = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await apiClient.runTaxonomyMigration();

      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          const data = response.data;
          // Handle the actual backend response structure
          if (typeof data === 'object' && 'totalStatements' in data) {
            // Backend returns: { totalStatements, successful, errors, results, verification }
            const success = data.errors === 0;
            setResult({
              success,
              message: response.message || (success ? 'Migration completed successfully' : `Migration completed with ${data.errors} errors`),
              summary: {
                totalStatements: data.totalStatements || 0,
                successful: data.successful || 0,
                errors: data.errors || 0,
              },
              verification: data.verification || {},
              details: data.results || [],
            });
            await loadStatus();
            return;
          }
          // Fallback: check for success/error fields
          if (typeof data === 'object' && ('success' in data || 'error' in data)) {
            setResult(data as MigrationResult);
            await loadStatus();
            return;
          }
        }
        if ('success' in response || 'error' in response) {
          setResult(response as unknown as MigrationResult);
          await loadStatus();
          return;
        }
      }

      setResult({
        success: false,
        message: 'Unexpected response format',
        error: JSON.stringify(response),
      });
    } catch (apiError: any) {
      console.error('API Error:', apiError);
      try {
        const token = localStorage.getItem('auth_token');
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        const fetchResponse = await fetch(`${apiUrl}/admin/migration-taxonomy/run-sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        const fetchData = await fetchResponse.json();
        if (fetchData.data) {
          const data = fetchData.data;
          // Handle the actual backend response structure
          if (typeof data === 'object' && 'totalStatements' in data) {
            const success = data.errors === 0;
            setResult({
              success,
              message: fetchData.message || (success ? 'Migration completed successfully' : `Migration completed with ${data.errors} errors`),
              summary: {
                totalStatements: data.totalStatements || 0,
                successful: data.successful || 0,
                errors: data.errors || 0,
              },
              verification: data.verification || {},
              details: data.results || [],
            });
          } else if (typeof data === 'object' && ('success' in data || 'error' in data)) {
            setResult(data as MigrationResult);
          } else {
            setResult({
              success: false,
              message: 'Unexpected response format',
              error: JSON.stringify(fetchData),
            });
          }
        } else if (typeof fetchData === 'object' && ('success' in fetchData || 'error' in fetchData)) {
          setResult(fetchData as unknown as MigrationResult);
        } else {
          setResult({
            success: false,
            message: 'Unexpected response format',
            error: JSON.stringify(fetchData),
          });
        }
        await loadStatus();
      } catch (fetchError: any) {
        setResult({
          success: false,
          message: 'Migration failed',
          error: fetchError.message || apiError.message,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const migrateData = async () => {
    setDataMigrating(true);
    setDataResult(null);
    try {
      const response = await apiClient.migrateTaxonomyData();

      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          const data = response.data;
          if (typeof data === 'object' && ('success' in data || 'error' in data)) {
            setDataResult(data as DataMigrationResult);
            await loadStatus();
            return;
          }
        }
        if ('success' in response || 'error' in response) {
          setDataResult(response as unknown as DataMigrationResult);
          await loadStatus();
          return;
        }
      }

      setDataResult({
        success: false,
        message: 'Unexpected response format',
        error: JSON.stringify(response),
      });
    } catch (error: any) {
      setDataResult({
        success: false,
        message: 'Data migration failed',
        error: error.message,
      });
    } finally {
      setDataMigrating(false);
    }
  };

  const verifyMigration = async () => {
    setVerifying(true);
    setVerification(null);
    try {
      const response = await apiClient.verifyTaxonomyMigration();

      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          const data = response.data;
          if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
            setVerification(data as Record<string, boolean>);
            return;
          }
        }
        if (typeof response === 'object' && response !== null && !Array.isArray(response) && !('data' in response)) {
          setVerification(response as unknown as Record<string, boolean>);
          return;
        }
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      setVerification({ error: error.message } as Record<string, boolean>);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6">Product Taxonomy Migration</h1>

          {status && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">Migration Status</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Old Data (to migrate):</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>Products with category strings: {status.oldData.productsWithCategoryString}</li>
                    <li>Products with tag arrays: {status.oldData.productsWithTagArray}</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">New Data (migrated):</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>Categories created: {status.newData.categoriesCreated}</li>
                    <li>Tags created: {status.newData.tagsCreated}</li>
                    <li>Products linked to categories: {status.newData.productsLinkedToCategories}</li>
                    <li>Products linked to tags: {status.newData.productsLinkedToTags}</li>
                  </ul>
                </div>
              </div>
              {status.migrationNeeded && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-yellow-800 text-sm">
                    ⚠️ Migration needed: There are products with old category strings or tag arrays that need to be migrated.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Schema Migration */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Step 1: Schema Migration</h2>
            <p className="text-gray-600 mb-4">
              This migration will create all new tables and models for:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-4 space-y-1">
              <li>Categories (3-level hierarchy)</li>
              <li>Attributes (global and category-specific)</li>
              <li>Attribute Values</li>
              <li>Product Attributes</li>
              <li>Tags (with categories)</li>
              <li>Product Tags</li>
            </ul>

            <div className="flex gap-4">
              <button
                onClick={runMigration}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Running Migration...' : 'Run Schema Migration'}
              </button>

              <button
                onClick={verifyMigration}
                disabled={verifying}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {verifying ? 'Verifying...' : 'Verify Schema'}
              </button>
            </div>
          </div>

          {/* Step 2: Data Migration */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Step 2: Data Migration</h2>
            <p className="text-gray-600 mb-4">
              This will migrate existing category strings and tag arrays to the new taxonomy system:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-4 space-y-1">
              <li>Convert category strings to Category records</li>
              <li>Link products to categories</li>
              <li>Convert tag arrays to Tag records</li>
              <li>Link products to tags</li>
            </ul>

            <button
              onClick={migrateData}
              disabled={dataMigrating || loadingStatus}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {dataMigrating ? 'Migrating Data...' : 'Migrate Data'}
            </button>
          </div>

          {/* Schema Migration Result */}
          {result && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">Schema Migration Result</h2>
              <div className={`p-4 rounded mb-4 ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className={`font-semibold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                  {result.success ? '✅ Success' : '❌ Failed'}
                </p>
                <p className={result.success ? 'text-green-700' : 'text-red-700'}>
                  {result.message}
                </p>
                {result.error && (
                  <p className="text-red-600 mt-2 text-sm">{result.error}</p>
                )}
              </div>

              {result.summary && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">Summary:</h3>
                  <ul className="list-disc list-inside text-gray-700">
                    <li>Total Statements: {result.summary.totalStatements}</li>
                    <li>Successful: {result.summary.successful}</li>
                    <li>Errors: {result.summary.errors}</li>
                  </ul>
                </div>
              )}

              {result.verification && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">Verification:</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(result.verification).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className={value ? 'text-green-600' : 'text-red-600'}>
                          {value ? '✅' : '❌'}
                        </span>
                        <span className="text-sm text-gray-700">{key}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Data Migration Result */}
          {dataResult && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">Data Migration Result</h2>
              <div className={`p-4 rounded mb-4 ${dataResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className={`font-semibold ${dataResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {dataResult.success ? '✅ Success' : '❌ Failed'}
                </p>
                <p className={dataResult.success ? 'text-green-700' : 'text-red-700'}>
                  {dataResult.message}
                </p>
                {dataResult.error && (
                  <p className="text-red-600 mt-2 text-sm">{dataResult.error}</p>
                )}
              </div>

              {dataResult.results && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">Results:</h3>
                  <ul className="list-disc list-inside text-gray-700">
                    <li>Categories Created: {dataResult.results.categoriesCreated}</li>
                    <li>Products Linked to Categories: {dataResult.results.categoriesLinked}</li>
                    <li>Tags Created: {dataResult.results.tagsCreated}</li>
                    <li>Products Linked to Tags: {dataResult.results.tagsLinked}</li>
                    {dataResult.results.errors.length > 0 && (
                      <li className="text-red-600">
                        Errors: {dataResult.results.errors.length}
                        <ul className="list-disc list-inside ml-4 mt-1">
                          {dataResult.results.errors.map((error, index) => (
                            <li key={index} className="text-sm">{error}</li>
                          ))}
                        </ul>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {verification && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Schema Verification Results</h2>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(verification).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    {typeof value === 'boolean' ? (
                      <>
                        <span className={value ? 'text-green-600' : 'text-red-600'}>
                          {value ? '✅' : '❌'}
                        </span>
                        <span className="text-sm text-gray-700">{key}</span>
                      </>
                    ) : (
                      <span className="text-red-600 text-sm">{key}: {String(value)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}

