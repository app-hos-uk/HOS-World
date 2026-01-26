'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { AdminLayout } from '@/components/AdminLayout';
import { RouteGuard } from '@/components/RouteGuard';
import { getPublicApiBaseUrl } from '@/lib/apiBaseUrl';

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

export default function MigrationFeaturesPage() {
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [verification, setVerification] = useState<Record<string, boolean> | null>(null);

  const runMigration = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await apiClient.runComprehensiveFeaturesMigration();

      if (response && typeof response === 'object') {
        // ApiResponse structure: { data: {...}, message: string }
        if ('data' in response && response.data) {
          const data = response.data;
          // Check if data has success/error properties (MigrationResult)
          if (typeof data === 'object' && ('success' in data || 'error' in data)) {
            setResult(data as MigrationResult);
            return;
          }
        }
        // Fallback: check if response itself has success/error (direct MigrationResult)
        if ('success' in response || 'error' in response) {
          setResult(response as unknown as MigrationResult);
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
      // Fallback: try direct fetch
      try {
        const token = localStorage.getItem('auth_token');
        const apiUrl = getPublicApiBaseUrl() || 'http://localhost:3001/api';
        const fetchResponse = await fetch(`${apiUrl}/admin/migration-features/run-sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        const fetchData = await fetchResponse.json();
        if (fetchData.data) {
          setResult(fetchData.data as MigrationResult);
        } else if (typeof fetchData === 'object' && ('success' in fetchData || 'error' in fetchData)) {
          setResult(fetchData as unknown as MigrationResult);
        } else {
          setResult({
            success: false,
            message: 'Unexpected response format',
            error: JSON.stringify(fetchData),
          });
        }
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

  const verifyMigration = async () => {
    setVerifying(true);
    setVerification(null);
    try {
      const response = await apiClient.verifyComprehensiveFeaturesMigration();

      if (response && typeof response === 'object') {
        // ApiResponse structure: { data: {...}, message: string }
        if ('data' in response && response.data) {
          const data = response.data;
          // Check if data is a Record<string, boolean>
          if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
            setVerification(data as Record<string, boolean>);
            return;
          }
        }
        // Fallback: check if response itself is a Record
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
          <h1 className="text-2xl font-bold mb-6">Comprehensive Features Migration</h1>

          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <p className="text-gray-600 mb-4">
              This migration will create all new tables and models for:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-4 space-y-1">
              <li>Seller Invitations</li>
              <li>Activity Logging</li>
              <li>Transaction Ledger</li>
              <li>Discrepancy Reporting</li>
              <li>Support Tickets & Messages</li>
              <li>Knowledge Base Articles</li>
              <li>WhatsApp Conversations & Messages</li>
              <li>Product platform-owned support</li>
            </ul>

            <div className="flex gap-4">
              <button
                onClick={runMigration}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Running Migration...' : 'Run Migration'}
              </button>

              <button
                onClick={verifyMigration}
                disabled={verifying}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {verifying ? 'Verifying...' : 'Verify Migration'}
              </button>
            </div>
          </div>

          {result && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">Migration Result</h2>
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

              {result.details && result.details.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Details:</h3>
                  <div className="max-h-96 overflow-y-auto">
                    {result.details.map((detail, index) => (
                      <div
                        key={index}
                        className={`p-2 mb-2 rounded text-sm ${
                          detail.status === 'success'
                            ? 'bg-green-50 border border-green-200'
                            : 'bg-red-50 border border-red-200'
                        }`}
                      >
                        <p className="font-mono text-xs mb-1">{detail.statement}</p>
                        <p className={detail.status === 'success' ? 'text-green-700' : 'text-red-700'}>
                          Status: {detail.status}
                        </p>
                        {detail.error && (
                          <p className="text-red-600 text-xs mt-1">{detail.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {verification && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Verification Results</h2>
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

