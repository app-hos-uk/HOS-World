'use client';

import { useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';

interface MigrationResult {
  success: boolean;
  message: string;
  summary?: {
    totalStatements: number;
    successful: number;
    errors: number;
  };
  verification?: {
    currencyPreferenceColumnExists?: boolean;
    currencyExchangeRatesTableExists?: boolean;
    allColumns?: string[];
  };
  error?: string;
  details?: Array<{
    statement: string;
    status: string;
    error?: string;
  }>;
}

export default function AdminMigrationPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<any>(null);

  const runMigration = async () => {
    if (!confirm('⚠️ This will run database migration SQL. Continue?')) {
      return;
    }

    setRunning(true);
    setResult(null);

    try {
      const response = await apiClient.runSQLDirectMigration();
      if (response?.data) {
        setResult(response.data);
      } else {
        setResult({
          success: false,
          message: 'No response data',
          error: 'Unknown error',
        });
      }
    } catch (error: any) {
      console.error('Migration error:', error);
      setResult({
        success: false,
        message: 'Migration failed',
        error: error.message || 'Unknown error',
      });
    } finally {
      setRunning(false);
    }
  };

  const verifyMigration = async () => {
    setVerifying(true);
    setVerification(null);

    try {
      const response = await apiClient.verifyMigration();
      if (response?.data) {
        setVerification(response.data);
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      setVerification({
        success: false,
        error: error.message || 'Unknown error',
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
      <AdminLayout>
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Database Migration</h1>
            <p className="text-gray-600 mt-2">
              Run SQL migration to add missing database columns and tables
            </p>
          </div>

          {/* Migration Section */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Run Migration</h2>
            <p className="text-gray-600 mb-4">
              This will execute SQL to add:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-6 space-y-1">
              <li><code className="bg-gray-100 px-2 py-1 rounded">currencyPreference</code> column to users table</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">country</code> column to users table</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">currency_exchange_rates</code> table</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">gdpr_consent_logs</code> table</li>
              <li>And other required columns</li>
            </ul>

            <button
              onClick={runMigration}
              disabled={running}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {running ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Running Migration...
                </>
              ) : (
                <>
                  <span>🚀</span>
                  Run SQL Migration
                </>
              )}
            </button>

            {result && (
              <div className={`mt-6 p-4 rounded-lg ${
                result.success 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <h3 className={`font-semibold mb-2 ${
                  result.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {result.success ? '✅ Migration Completed' : '❌ Migration Failed'}
                </h3>
                
                {result.success && result.summary && (
                  <div className="text-sm text-green-700 space-y-1">
                    <p>Total Statements: {result.summary.totalStatements}</p>
                    <p>✅ Successful: {result.summary.successful}</p>
                    {result.summary.errors > 0 && (
                      <p>⚠️ Errors: {result.summary.errors} (may be expected for idempotent operations)</p>
                    )}
                  </div>
                )}

                {result.verification && (
                  <div className="mt-4 text-sm">
                    <p className="font-semibold mb-2">Verification:</p>
                    <ul className="space-y-1">
                      <li>
                        {result.verification.currencyPreferenceColumnExists ? '✅' : '❌'} 
                        currencyPreference column: {result.verification.currencyPreferenceColumnExists ? 'Exists' : 'Missing'}
                      </li>
                      <li>
                        {result.verification.currencyExchangeRatesTableExists ? '✅' : '❌'} 
                        currency_exchange_rates table: {result.verification.currencyExchangeRatesTableExists ? 'Exists' : 'Missing'}
                      </li>
                      {result.verification.allColumns && (
                        <li>
                          Found columns: {result.verification.allColumns.join(', ')}
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {result.error && (
                  <div className="mt-4 text-sm text-red-700">
                    <p className="font-semibold">Error:</p>
                    <p className="font-mono text-xs bg-red-100 p-2 rounded mt-1">
                      {result.error}
                    </p>
                  </div>
                )}

                {result.success && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm text-blue-800">
                      <strong>Next Step:</strong> Redeploy the API service to regenerate Prisma client, then refresh this page.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Verification Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Verify Migration</h2>
            <p className="text-gray-600 mb-4">
              Check if migration columns and tables exist in the database
            </p>

            <button
              onClick={verifyMigration}
              disabled={verifying}
              className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {verifying ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Verifying...
                </>
              ) : (
                <>
                  <span>🔍</span>
                  Verify Migration
                </>
              )}
            </button>

            {verification && (
              <div className={`mt-6 p-4 rounded-lg ${
                verification.success !== false
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <h3 className="font-semibold mb-2">Verification Results</h3>
                
                {verification.usersColumns && (
                  <div className="text-sm space-y-2">
                    <p><strong>User Columns Found:</strong></p>
                    <ul className="list-disc list-inside ml-4">
                      {verification.usersColumns.map((col: string) => (
                        <li key={col} className="text-green-700">✅ {col}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {verification.newTables && (
                  <div className="text-sm space-y-2 mt-4">
                    <p><strong>Tables Found:</strong></p>
                    <ul className="list-disc list-inside ml-4">
                      {verification.newTables.map((table: string) => (
                        <li key={table} className="text-green-700">✅ {table}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {verification.allColumnsPresent !== undefined && (
                  <div className="mt-4">
                    <p className={`font-semibold ${
                      verification.allColumnsPresent ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {verification.allColumnsPresent 
                        ? '✅ All required columns and tables are present!' 
                        : '❌ Some columns or tables are missing'}
                    </p>
                  </div>
                )}

                {verification.error && (
                  <div className="mt-4 text-sm text-red-700">
                    <p className="font-semibold">Error:</p>
                    <p className="font-mono text-xs bg-red-100 p-2 rounded mt-1">
                      {verification.error}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
