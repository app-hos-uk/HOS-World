'use client';

import { useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

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

export default function MigrationsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, MigrationResult | null>>({});

  const runMigration = async (migrationType: string, endpoint: string) => {
    setLoading((prev) => ({ ...prev, [migrationType]: true }));
    setResults((prev) => ({ ...prev, [migrationType]: null }));

    try {
      // Use fetch directly since we need to call admin endpoints
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please login first');
        return;
      }

      // Get API URL from apiClient or environment
      const apiUrl = (apiClient as any).baseUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setResults((prev) => ({ ...prev, [migrationType]: data.data || data }));
        toast.success(`Migration ${migrationType} completed successfully!`);
      } else {
        setResults((prev) => ({
          ...prev,
          [migrationType]: {
            success: false,
            message: data.message || 'Migration failed',
            error: data.error || 'Unknown error',
          },
        }));
        toast.error(data.message || 'Migration failed');
      }
    } catch (error: any) {
      setResults((prev) => ({
        ...prev,
        [migrationType]: {
          success: false,
          message: 'Failed to run migration',
          error: error.message,
        },
      }));
      toast.error(`Migration ${migrationType} failed: ${error.message}`);
    } finally {
      setLoading((prev) => ({ ...prev, [migrationType]: false }));
    }
  };

  const migrations = [
    {
      id: 'global-features',
      title: 'Global Platform Features',
      description: 'Adds country, currency, GDPR fields, and creates currency_exchange_rates and gdpr_consent_logs tables. This is the main migration for Prisma baselining.',
      endpoint: '/admin/migration/run-global-features',
      icon: '🌍',
      priority: 'high',
    },
    {
      id: 'comprehensive-features',
      title: 'Comprehensive Features',
      description: 'Adds additional platform features and enhancements.',
      endpoint: '/admin/migration-features/run-sql',
      icon: '🚀',
      priority: 'medium',
    },
    {
      id: 'taxonomy',
      title: 'Taxonomy System',
      description: 'Creates taxonomy system for categories, attributes, and tags.',
      endpoint: '/admin/migration-taxonomy/run-sql',
      icon: '📚',
      priority: 'medium',
    },
  ];

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Database Migrations</h1>
            <p className="mt-2 text-sm text-gray-600">
              Run database migrations to update schema and add new features. Migrations are idempotent and safe to run multiple times.
            </p>
          </div>

          {/* Warning Banner */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-yellow-400 text-xl">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Important Notes</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Migrations are idempotent - safe to run multiple times</li>
                    <li>Start with "Global Platform Features" for Prisma baselining</li>
                    <li>Migrations may take a few minutes to complete</li>
                    <li>Check the results section for detailed execution status</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Migration Cards */}
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            {migrations.map((migration) => {
              const isLoading = loading[migration.id];
              const result = results[migration.id];
              const isHighPriority = migration.priority === 'high';

              return (
                <div
                  key={migration.id}
                  className={`bg-white rounded-lg shadow-sm border-2 ${
                    isHighPriority ? 'border-purple-200' : 'border-gray-200'
                  } p-6`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{migration.icon}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{migration.title}</h3>
                        {isHighPriority && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                            Recommended First
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-4">{migration.description}</p>

                  <button
                    onClick={() => runMigration(migration.id, migration.endpoint)}
                    disabled={isLoading}
                    className={`w-full px-4 py-2 rounded-md font-medium transition-colors ${
                      isLoading
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : isHighPriority
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin">⏳</span>
                        Running Migration...
                      </span>
                    ) : (
                      `Run ${migration.title} Migration`
                    )}
                  </button>

                  {/* Results */}
                  {result && (
                    <div className={`mt-4 p-4 rounded-lg ${
                      result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        <span className="text-xl">{result.success ? '✅' : '❌'}</span>
                        <div className="flex-1">
                          <h4 className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                            {result.success ? 'Migration Completed' : 'Migration Failed'}
                          </h4>
                          <p className={`text-sm mt-1 ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                            {result.message}
                          </p>

                          {result.summary && (
                            <div className="mt-3 text-sm">
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <span className="text-gray-600">Total:</span>
                                  <span className="ml-2 font-medium">{result.summary.totalStatements}</span>
                                </div>
                                <div>
                                  <span className="text-green-600">Success:</span>
                                  <span className="ml-2 font-medium">{result.summary.successful}</span>
                                </div>
                                <div>
                                  <span className="text-red-600">Errors:</span>
                                  <span className="ml-2 font-medium">{result.summary.errors}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {result.verification && (
                            <div className="mt-3 text-sm">
                              <h5 className="font-medium text-gray-700 mb-1">Verification:</h5>
                              <ul className="space-y-1">
                                {Object.entries(result.verification).map(([key, value]) => (
                                  <li key={key} className="flex items-center gap-2">
                                    <span>{value ? '✅' : '❌'}</span>
                                    <span className="text-gray-600">{key}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {result.error && (
                            <div className="mt-2 text-sm text-red-700">
                              <strong>Error:</strong> {result.error}
                            </div>
                          )}

                          {result.details && result.details.length > 0 && (
                            <details className="mt-3">
                              <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                                View Details ({result.details.length} statements)
                              </summary>
                              <div className="mt-2 max-h-60 overflow-y-auto space-y-1">
                                {result.details.slice(0, 10).map((detail, idx) => (
                                  <div
                                    key={idx}
                                    className={`text-xs p-2 rounded ${
                                      detail.status === 'success'
                                        ? 'bg-green-100 text-green-800'
                                        : detail.status.includes('skipped')
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}
                                  >
                                    <div className="font-medium">{detail.status}</div>
                                    <div className="text-xs mt-1 truncate">{detail.statement}</div>
                                    {detail.error && (
                                      <div className="text-xs mt-1 text-red-600">{detail.error}</div>
                                    )}
                                  </div>
                                ))}
                                {result.details.length > 10 && (
                                  <div className="text-xs text-gray-500 text-center py-2">
                                    ... and {result.details.length - 10} more statements
                                  </div>
                                )}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Migration Status Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Migration Status</h3>
            <p className="text-sm text-blue-700">
              After running migrations, check your API server logs. You should see:
            </p>
            <ul className="mt-2 text-sm text-blue-700 list-disc list-inside space-y-1">
              <li>✅ Database migrations applied successfully</li>
              <li>✅ Database is up to date - no pending migrations</li>
            </ul>
            <p className="mt-2 text-sm text-blue-700">
              If you see "Prisma migrations table not found", run the "Global Platform Features" migration first.
            </p>
          </div>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}

